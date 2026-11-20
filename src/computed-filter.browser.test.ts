/**
 * Frente 28 no navegador: filtrar coluna calculada (`valueGetter` sem
 * `path`) pela linha de filtro, pelo filtro do cabeçalho, pela busca, por
 * `filterValue`/`setState`; cabeçalho com o `name`; colisão de `name`;
 * remoto; `axe-core` e roteiro de teclado (LTR e RTL).
 */
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGridColumn } from './grid-column.js';
import type { DataGrid } from './grid.js';
import { FakeSource, waitFor } from './test/fake-source.js';
import { cellText, cleanup, createGrid, dataRows, settle } from './test/fixture.js';

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

interface Person {
  id: number;
  first: string;
  last: string | null;
  a: number;
  b: number;
}

const people = (): Person[] => [
  { id: 1, first: 'Ana', last: 'Silva', a: 3, b: 4 },
  { id: 2, first: 'Bruno', last: 'Souza', a: 1, b: 1 },
  { id: 3, first: 'Carla', last: 'Silva', a: 5, b: 0 },
  { id: 4, first: 'Davi', last: null, a: 2, b: 2 },
];

const fullOf = (row: Person) => row.last ? `${row.first} ${row.last}` : null;

const columns = (): GridColumnDef<Person>[] => [
  { path: 'first', label: 'First' },
  { name: 'full', label: 'Full', valueGetter: fullOf },
  { name: 'sum', label: 'Sum', dataType: 'number', valueGetter: row => row.a + row.b },
];

const root = (grid: DataGrid) => grid.shadowRoot!;
const firsts = (grid: DataGrid) => dataRows(grid).map(row => cellText(row.cells[0]));
const header = (grid: DataGrid, label: string) =>
  [...root(grid).querySelectorAll<HTMLElement>('th.header-column')].find(th => th.querySelector('.header-text')!.textContent === label)!;
const funnel = (grid: DataGrid, label: string) => header(grid, label).querySelector<HTMLElement>('.header-filter-button');
const filterCell = (grid: DataGrid, index: number) =>
  root(grid).querySelectorAll<HTMLElement>('tr.filter-row td.filter-cell')[index];
const editor = (grid: DataGrid, index: number) =>
  filterCell(grid, index).querySelector<HTMLInputElement>('.filter-editor')!;

const typeInto = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};

const keyOn = async (grid: DataGrid, target: Element, key: string, init: KeyboardEventInit = {}) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const click = (target: HTMLElement) =>
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));

const treeItem = (popover: HTMLElement, text: string) =>
  [...popover.querySelectorAll<HTMLElement>('.header-filter-list [role=treeitem]')]
    .find(item => item.querySelector('.header-filter-text')!.textContent === text)!;

/** Texto da descrição do cabeçalho (`aria-describedby`), onde mora "Filtered". */
const description = (grid: DataGrid, label: string) => {
  const id = header(grid, label).getAttribute('aria-describedby');
  return id ? root(grid).getElementById(id)?.textContent ?? '' : '';
};

const violations = async (grid: DataGrid) =>
  (await axe.run(grid, { resultTypes: ['violations'] })).violations.map(violation => violation.id);

describe('coluna calculada: filtro local', () => {
  it('filterValue pelo name filtra pelo getter, acende o funil e a descrição "Filtered"', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.headerFilter = true });

    grid.filterValue = ['full', 'contains', 'silva'];
    await settle(grid);

    expect(firsts(grid)).toEqual(['Ana', 'Carla']);
    expect(header(grid, 'Full').classList.contains('filtered')).toBe(true);
    expect(funnel(grid, 'Full')!.classList.contains('active')).toBe(true);
    expect(funnel(grid, 'Full')!.getAttribute('aria-describedby')).toBeTruthy();
    expect(description(grid, 'Full')).toContain('Filtered');
    expect(header(grid, 'Sum').classList.contains('filtered')).toBe(false);
    expect(description(grid, 'Sum')).not.toContain('Filtered');

    // setState: mesma ida e volta, sem normalizar o campo.
    const state = grid.getState();

    expect(state.filterValue).toEqual(['full', 'contains', 'silva']);
    grid.setState({ ...state, filterValue: ['sum', '>', 3] });
    await settle(grid);
    expect(firsts(grid)).toEqual(['Ana', 'Carla', 'Davi']);
    expect(header(grid, 'Sum').classList.contains('filtered')).toBe(true);
    expect(description(grid, 'Sum')).toContain('Filtered');
    expect(header(grid, 'Full').classList.contains('filtered')).toBe(false);
  });

  it('linha de filtro grava [name, …] e mostra o valor vindo de fora', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showFilterRow = true });

    expect(editor(grid, 1).getAttribute('aria-label')).toBe('Filter Full');
    expect(editor(grid, 2).type).toBe('number');

    typeInto(editor(grid, 1), 'souza');
    await keyOn(grid, editor(grid, 1), 'Enter');

    expect(grid.filterValue).toEqual(['full', 'contains', 'souza']);
    expect(firsts(grid)).toEqual(['Bruno']);

    grid.filterValue = ['sum', '=', 2];
    await settle(grid);
    expect(editor(grid, 2).value).toBe('2');
    expect(editor(grid, 1).value).toBe('');
    expect(firsts(grid)).toEqual(['Bruno']);
  });

  it('filtro do cabeçalho lista os valores do getter e grava anyof pelo name', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.headerFilter = true });

    click(funnel(grid, 'Full')!);
    await settle(grid);

    const popover = root(grid).querySelector<HTMLElement>('.header-filter')!;
    const entries = [...popover.querySelectorAll('.header-filter-list [role=treeitem]')].map(item => item.textContent.replace(/\s+/g, ' ').trim());

    expect(entries).toEqual(['(Blanks) 1', 'Ana Silva 1', 'Bruno Souza 1', 'Carla Silva 1']);
    treeItem(popover, 'Bruno Souza').click();
    treeItem(popover, '(Blanks)').click();
    await settle(grid);
    click(popover.querySelector<HTMLElement>('.header-filter-ok')!);
    await settle(grid);

    expect(grid.filterValue).toEqual(['full', 'anyof', ['Ana Silva', 'Carla Silva']]);
    expect(firsts(grid)).toEqual(['Ana', 'Carla']);
  });

  it('busca procura no texto calculado e destaca', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showSearchPanel = true });

    grid.searchText = 'souza';
    await settle(grid);

    expect(firsts(grid)).toEqual(['Bruno']);
    expect(dataRows(grid)[0].cells[1].querySelector('mark')!.textContent).toBe('Souza');
    expect(grid.getCombinedFilter()).toEqual([['first', 'contains', 'souza'], 'or', ['full', 'contains', 'souza'], 'or', ['sum', 'contains', 'souza']]);
  });

  it('filterValue antes das colunas: recompila quando elas chegam', async () => {
    const grid = await createGrid({ items: people() });

    grid.filterValue = ['sum', '>', 4];
    await settle(grid);
    grid.columns = columns();
    await settle(grid);

    expect(firsts(grid)).toEqual(['Ana', 'Carla']);
  });

  it('filterable: false desliga; sem name não filtra e filterable: true avisa uma vez', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await createGrid({
      columns: [
        { path: 'first', label: 'First' },
        { name: 'full', label: 'Full', valueGetter: fullOf, filterable: false },
        { label: 'Anon', valueGetter: (row: Person) => row.a, filterable: true },
        // Só `name`, sem getter: sem valor para filtrar, mesmo com `filterable: true`.
        { name: 'status', label: 'Status', renderer: () => 'x', filterable: true },
      ],
      items: people(),
      configure: g => {
        g.showFilterRow = true;
        g.headerFilter = true;
      },
    });

    expect(filterCell(grid, 1).querySelector('.filter-editor')).toBeNull();
    expect(filterCell(grid, 2).querySelector('.filter-editor')).toBeNull();
    expect(funnel(grid, 'Full')).toBeNull();
    expect(funnel(grid, 'Anon')).toBeNull();
    expect(filterCell(grid, 3).querySelector('.filter-editor')).toBeNull();
    expect(funnel(grid, 'Status')).toBeNull();
    grid.requestUpdate();
    await settle(grid);
    expect(warn.mock.calls.filter(call => String(call[0]).includes('"Anon" needs a "path", or a "valueGetter" and a "name"'))).toHaveLength(1);
  });

  it('colisão: name igual ao path de outra coluna não filtra nem acende com a condição da outra', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await createGrid({
      columns: [
        { path: 'first', label: 'First' },
        { name: 'first', label: 'Clash', valueGetter: fullOf, filterable: true },
      ],
      items: people(),
      configure: g => {
        g.showFilterRow = true;
        g.headerFilter = true;
      },
    });

    grid.filterValue = ['first', 'contains', 'a'];
    await settle(grid);

    expect(funnel(grid, 'Clash')).toBeNull();
    expect(filterCell(grid, 1).querySelector('.filter-editor')).toBeNull();
    expect(header(grid, 'Clash').classList.contains('filtered')).toBe(false);
    expect(description(grid, 'Clash')).not.toContain('Filtered');
    expect(header(grid, 'First').classList.contains('filtered')).toBe(true);
    expect(warn.mock.calls.filter(call => String(call[0]).includes('"Clash" has the name "first"'))).toHaveLength(1);
  });
});

describe('coluna calculada: name repetido e renomeado', () => {
  it('duas calculadas com o mesmo name: só a primeira filtra e acende', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await createGrid({
      columns: [
        { name: 'x', label: 'One', valueGetter: (row: Person) => row.first },
        { name: 'x', label: 'Two', valueGetter: (row: Person) => row.last, filterable: true },
      ],
      items: people(),
      configure: g => {
        g.showFilterRow = true;
        g.headerFilter = true;
      },
    });

    grid.filterValue = ['x', 'contains', 'an'];
    await settle(grid);

    expect(firsts(grid)).toEqual(['Ana']);
    expect(funnel(grid, 'One')).toBeTruthy();
    expect(funnel(grid, 'Two')).toBeNull();
    expect(filterCell(grid, 1).querySelector('.filter-editor')).toBeNull();
    expect(description(grid, 'One')).toContain('Filtered');
    expect(description(grid, 'Two')).not.toContain('Filtered');
    expect(warn.mock.calls.filter(call => String(call[0]).includes('"Two" has the name "x"'))).toHaveLength(1);
  });

  it('renomear o name de uma <u-grid-column> calculada refaz o filtro', async () => {
    const grid = document.createElement('u-grid');
    grid.style.cssText = 'display:block;height:300px';
    grid.innerHTML = '<u-grid-column path="first">First</u-grid-column><u-grid-column name="a">Sum</u-grid-column>';
    grid.querySelectorAll<DataGridColumn>('u-grid-column')[1].valueGetter = (row: Person) => row.a + row.b;
    document.body.append(grid);
    grid.items = people();
    // Sem coluna `total`, o campo é lido do item (não existe): nada passa.
    grid.filterValue = ['total', '>', 4];
    await settle(grid);
    expect(firsts(grid)).toEqual([]);

    grid.querySelectorAll<DataGridColumn>('u-grid-column')[1].name = 'total';
    await settle(grid);
    expect(firsts(grid)).toEqual(['Ana', 'Carla']);
  });
});

describe('coluna calculada: cabeçalho sem label', () => {
  it('mostra o name, tem nome acessível e avisa uma vez; coluna só de renderer segue vazia', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await createGrid({
      columns: [
        { path: 'first', label: 'First' },
        { name: 'docA', valueGetter: (row: Person) => row.a },
        { name: 'actions', renderer: () => 'x' },
      ],
      items: people(),
      configure: g => {
        g.showFilterRow = true;
        g.headerFilter = true;
      },
    });

    expect(header(grid, 'docA')).toBeTruthy();
    expect(funnel(grid, 'docA')!.getAttribute('aria-label')).toBe('Filter options for docA');
    expect(header(grid, '')).toBeTruthy();
    expect(warn.mock.calls.filter(call => String(call[0]).includes('column "docA" has a "valueGetter" but no "label"'))).toHaveLength(1);
    expect(await violations(grid)).toEqual([]);
  });
});

describe('coluna calculada: teclado e axe', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    it(`funil por teclado (Alt+↓), Esc e OK devolvem o foco; axe limpo (${dir})`, async () => {
      const grid = await createGrid({
        columns: columns(),
        items: people(),
        configure: g => {
          g.dir = dir;
          g.language = dir === 'rtl' ? 'ar' : 'en';
          g.showFilterRow = true;
          g.headerFilter = true;
          g.showSearchPanel = true;
        },
      });

      expect(await violations(grid)).toEqual([]);

      const th = header(grid, 'Full');

      th.focus();
      await keyOn(grid, th, 'ArrowDown', { altKey: true });

      const popover = root(grid).querySelector<HTMLElement>('.header-filter')!;

      expect(popover).toBeTruthy();
      expect(await violations(grid)).toEqual([]);
      await keyOn(grid, root(grid).activeElement!, 'Escape');
      expect(root(grid).querySelector('.header-filter')).toBeNull();
      expect(root(grid).activeElement).toBe(funnel(grid, 'Full'));

      await keyOn(grid, th, 'ArrowDown', { altKey: true });
      const again = root(grid).querySelector<HTMLElement>('.header-filter')!;

      treeItem(again, 'Ana Silva').click();
      await settle(grid);

      const ok = again.querySelector<HTMLElement>('.header-filter-ok')!;

      ok.focus();
      // O botão nativo ativa com Enter: o keydown não pode ser engolido; o clique é o que o navegador gera.
      expect(ok.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }))).toBe(true);
      click(ok);
      await settle(grid);

      expect(grid.filterValue).toEqual(['full', 'noneof', ['Ana Silva']]);
      expect(root(grid).activeElement).toBe(funnel(grid, 'Full'));
      expect(await violations(grid)).toEqual([]);
    });
  }
});

describe('coluna calculada: remoto', () => {
  const remoteGrid = async (extra: Partial<GridColumnDef> = {}) => {
    const source = new FakeSource(people(), 5);
    const grid = await createGrid({
      columns: [{ path: 'first', label: 'First' }, { name: 'full', label: 'Full', valueGetter: fullOf, ...extra }],
      configure: element => {
        element.keyExpr = 'id';
        element.remoteOperations = true;
        element.showFilterRow = true;
        element.headerFilter = true;
        element.dataSource = source;
      },
    });

    await waitFor(() => source.calls.length > 0 && source.calls.every(call => call.settled));
    await settle(grid);
    return { grid, source };
  };

  it('padrão: sem controle de filtro na calculada (nada focável na célula)', async () => {
    const { grid } = await remoteGrid();

    expect(filterCell(grid, 1).querySelector('input, button, select, [tabindex]')).toBeNull();
    expect(funnel(grid, 'Full')).toBeNull();
    expect(funnel(grid, 'First')).toBeTruthy();
    expect(await violations(grid)).toEqual([]);
  });

  it('filterable: true manda [name, …] ao load, sem funil', async () => {
    const { grid, source } = await remoteGrid({ filterable: true });

    expect(funnel(grid, 'Full')).toBeNull();
    expect(header(grid, 'Full').getAttribute('aria-keyshortcuts') ?? '').not.toContain('Alt+ArrowDown');
    expect(header(grid, 'First').getAttribute('aria-keyshortcuts')).toContain('Alt+ArrowDown');
    await keyOn(grid, header(grid, 'Full'), 'ArrowDown', { altKey: true });
    expect(root(grid).querySelector('.header-filter')).toBeNull();
    expect(await violations(grid)).toEqual([]);
    typeInto(editor(grid, 1), 'sil');
    await keyOn(grid, editor(grid, 1), 'Enter');
    await waitFor(() => source.calls.every(call => call.settled));

    expect(source.calls.at(-1)!.options.filterValue).toEqual(['full', 'contains', 'sil']);
  });
});
