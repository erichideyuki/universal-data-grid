import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridColumnDef, GridFilterExpression } from './grid-column-def.js';
import type { DataGrid, GridFilterEventDetail } from './grid.js';
import { cellText, cleanup, createGrid, dataRows, groupInfos, groupLabels, settle } from './test/fixture.js';

afterEach(cleanup);

const people = () => [
  { name: 'Ana', age: 30, city: 'São Paulo', active: true, born: '1994-03-05' },
  { name: 'José', age: 41, city: 'Lima', active: false, born: '1983-07-20' },
  { name: 'joana', age: 25, city: 'Rio', active: true, born: '1999-12-31' },
  { name: 'Bob', age: null, city: null, active: null, born: null },
  { name: '<b>x</b>', age: 30, city: 'Lima', active: false, born: '1994-03-05' },
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'age', label: 'Age' },
  { path: 'city', label: 'City' },
  { path: 'active', label: 'Active' },
  { path: 'born', label: 'Born', dataType: 'date' },
];

const root = (grid: DataGrid) => grid.shadowRoot!;
const names = (grid: DataGrid) => dataRows(grid).map(row => cellText(row.cells[0]));
const header = (grid: DataGrid, label: string) =>
  [...root(grid).querySelectorAll<HTMLElement>('th.header-column')].find(th => th.querySelector('.header-text')!.textContent === label)!;
const filterCell = (grid: DataGrid, index: number) =>
  root(grid).querySelectorAll<HTMLElement>('tr.filter-row td.filter-cell')[index];
const editor = (grid: DataGrid, index: number, which = 0) =>
  filterCell(grid, index).querySelectorAll<HTMLInputElement | HTMLSelectElement>('.filter-editor')[which];
const announcement = (grid: DataGrid) => root(grid).querySelector('[role=status]')!.textContent.trim();

const typeInto = (input: HTMLInputElement | HTMLSelectElement, value: string, event = 'input') => {
  input.value = value;
  input.dispatchEvent(new Event(event, { bubbles: true, composed: true }));
};

const press = (target: HTMLElement, key: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));

const click = (target: HTMLElement) =>
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));

const events = (grid: DataGrid) => {
  const list: GridFilterEventDetail[] = [];
  grid.addEventListener('u-grid-filter-change', event => list.push(event.detail));
  return list;
};

describe('filterValue / searchText (API)', () => {
  it('filtra sem disparar evento, guarda cópia congelada e não muta items', async () => {
    const items = people();
    const grid = await createGrid({ columns: columns(), items });
    const fired = events(grid);
    const expression: GridFilterExpression = [['age', '>=', 30], 'and', ['city', 'contains', 'lima']];

    grid.filterValue = expression;
    await settle(grid);

    expect(names(grid)).toEqual(['José', '<b>x</b>']);
    expect(fired).toEqual([]);
    expect(grid.filterValue).toEqual(expression);
    expect(grid.filterValue).not.toBe(expression);
    expect(Object.isFrozen(grid.filterValue)).toBe(true);
    expect(items).toHaveLength(5);

    (expression as unknown[]).push('or', ['name', '=', 'Bob']);
    await settle(grid);
    expect(names(grid)).toEqual(['José', '<b>x</b>']);
  });

  it('searchText (atributo search-text) ignora caixa e acento, nas colunas visíveis', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });

    grid.setAttribute('search-text', 'SAO');
    await settle(grid);
    expect(names(grid)).toEqual(['Ana']);

    grid.searchText = 'jo';
    await settle(grid);
    expect(names(grid)).toEqual(['José', 'joana']);
  });

  it('clearFilter dispara u-grid-filter-change com source api; getCombinedFilter junta a busca', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    const fired = events(grid);

    grid.filterValue = ['age', '=', 30];
    grid.searchText = 'lima';
    await settle(grid);

    expect(grid.getCombinedFilter()).toEqual([
      ['age', '=', 30],
      'and',
      [['name', 'contains', 'lima'], 'or', ['age', 'contains', 'lima'], 'or', ['city', 'contains', 'lima'], 'or', ['active', 'contains', 'lima'], 'or', ['born', 'contains', 'lima']],
    ]);
    expect(names(grid)).toEqual(['<b>x</b>']);

    grid.clearFilter();
    await settle(grid);

    expect(names(grid)).toHaveLength(5);
    expect(fired).toEqual([{ filterValue: null, previousFilterValue: ['age', '=', 30], searchText: '', previousSearchText: 'lima', source: 'api' }]);

    grid.clearFilter();
    expect(fired).toHaveLength(1);
  });

  it('expressão inválida: avisa uma vez e mostra todas as linhas', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await createGrid({ columns: columns(), items: people() });

    grid.filterValue = ['age', 'like', 1] as never;
    await settle(grid);
    grid.requestUpdate();
    await settle(grid);

    expect(names(grid)).toHaveLength(5);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('filtro + agrupamento + ordenação: grupos recalculam sobre o resultado', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, { path: 'name', label: 'Name', sortOrder: 'desc' }, { path: 'age', label: 'Age' }],
      items: people(),
      configure: g => g.autoExpandGroups = true,
    });

    grid.filterValue = ['age', '>=', 30];
    await settle(grid);

    expect(groupLabels(grid)).toEqual(['City: Lima', 'City: São Paulo']);
    expect(dataRows(grid).map(row => cellText(row.cells[1]))).toEqual(['José', '<b>x</b>', 'Ana']);
  });
});

describe('filtro + resumos (frente 07)', () => {
  it('totais e resumos de grupo valem sobre as linhas filtradas (e voltam ao limpar)', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, { path: 'name', label: 'Name' }, { path: 'age', label: 'Age', dataType: 'number' }],
      items: people(),
      configure: g => {
        g.language = 'en';
        g.summary = { total: [{ column: 'age', type: 'sum' }, { column: 'name', type: 'count' }], group: [{ column: 'age', type: 'sum' }] };
      },
    });
    // Texto visível (o rótulo completo das células de resumo é só para o leitor de tela, frente 05).
    const totals = () => [...root(grid).querySelectorAll<HTMLTableCellElement>('tfoot tr.total-row td[aria-colindex]')]
      .map(td => (td.querySelector('[aria-hidden=true]') ?? td).textContent.trim());

    expect(totals()).toEqual(['Count: 5', 'Sum: 126']);

    grid.filterValue = ['age', '>=', 30];
    await settle(grid);

    expect(totals()).toEqual(['Count: 3', 'Sum: 101']);
    expect(groupLabels(grid)).toEqual(['City: Lima', 'City: São Paulo']);
    expect(groupInfos(grid)).toEqual(['(2, Sum of Age: 71)', '(1, Sum of Age: 30)']);

    grid.searchText = 'lima';
    await settle(grid);
    expect(totals()).toEqual(['Count: 2', 'Sum: 71']);

    grid.clearFilter();
    await settle(grid);
    expect(totals()).toEqual(['Count: 5', 'Sum: 126']);
  });
});

describe('linha de filtro', () => {
  it('editor por tipo, aria-label e aplicação após 300 ms (texto)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    try {
      const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showFilterRow = true });
      const fired = events(grid);

      expect(root(grid).querySelector('tr.filter-row')!.getAttribute('aria-rowindex')).toBe('2');
      expect(editor(grid, 0).getAttribute('aria-label')).toBe('Filter Name');
      expect((editor(grid, 1) as HTMLInputElement).type).toBe('number');
      expect(editor(grid, 3).tagName).toBe('BUTTON');
      expect(editor(grid, 3).getAttribute('aria-haspopup')).toBe('menu');
      expect((editor(grid, 4) as HTMLInputElement).type).toBe('date');

      typeInto(editor(grid, 0), 'jo');
      await vi.advanceTimersByTimeAsync(200);
      expect(fired).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(150);
      vi.useRealTimers();
      await settle(grid);

      expect(names(grid)).toEqual(['José', 'joana']);
      expect(grid.filterValue).toEqual(['name', 'contains', 'jo']);
      expect(fired).toEqual([{ filterValue: ['name', 'contains', 'jo'], previousFilterValue: null, searchText: '', previousSearchText: '', source: 'user' }]);
      expect(announcement(grid)).toBe('Rows: 2');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Enter aplica na hora; apagar tira a condição; número compara no tipo', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showFilterRow = true });

    typeInto(editor(grid, 1), '30');
    press(editor(grid, 1) as HTMLElement, 'Enter');
    await settle(grid);
    expect(names(grid)).toEqual(['Ana', '<b>x</b>']);
    expect(grid.filterValue).toEqual(['age', '=', 30]);

    typeInto(editor(grid, 1), '');
    press(editor(grid, 1) as HTMLElement, 'Enter');
    await settle(grid);
    expect(grid.filterValue).toBeNull();
    expect(names(grid)).toHaveLength(5);
  });

  it('booleano em três estados e data ao confirmar', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showFilterRow = true });

    // Booleano: botão de menu (estilizável) com menuitemradio.
    const chooseBoolean = async (label: string) => {
      click(editor(grid, 3));
      await settle(grid);
      const item = [...root(grid).querySelectorAll<HTMLElement>('.filter-menu [role=menuitemradio]')].find(element => element.textContent.trim() === label)!;
      click(item);
      await settle(grid);
    };

    await chooseBoolean('False');
    expect(names(grid)).toEqual(['José', '<b>x</b>']);
    expect(editor(grid, 3).getAttribute('aria-label')).toMatch(/, False$/);

    await chooseBoolean('(All)');
    typeInto(editor(grid, 4), '1994-03-05', 'change');
    await settle(grid);
    expect(grid.filterValue).toEqual(['born', '=', '1994-03-05']);
    expect(names(grid)).toEqual(['Ana', '<b>x</b>']);
  });

  it('menu de operação: teclado, menuitemradio, between e Reset', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showFilterRow = true });
    const button = filterCell(grid, 1).querySelector<HTMLElement>('.filter-operation-button')!;

    expect(button.getAttribute('aria-label')).toBe('Filter operation for Age: Equals');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');

    click(button);
    await settle(grid);

    const menu = root(grid).querySelector<HTMLElement>('.filter-menu')!;
    const items = [...menu.querySelectorAll<HTMLElement>('[role^=menuitem]')];

    expect(menu.getAttribute('role')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const expectedItems = ['=Equals', '≠Doesnotequal', '<Lessthan', '>Greaterthan', '≤Lessthanorequalto', '≥Greaterthanorequalto', '↔Between', 'Reset'];

    expect(items.map(item => item.textContent.replace(/\s+/g, ''))).toEqual(expectedItems);
    expect(root(grid).activeElement).toBe(items[0]);
    expect(items[0].getAttribute('aria-checked')).toBe('true');

    press(items[0], 'End');
    expect(root(grid).activeElement).toBe(items[7]);
    press(items[7], 'ArrowUp');
    expect(root(grid).activeElement).toBe(items[6]);
    click(items[6]);
    await settle(grid);

    expect(root(grid).querySelector('.filter-menu')).toBeNull();
    expect(root(grid).activeElement).toBe(filterCell(grid, 1).querySelector('.filter-operation-button'));

    const [from, to] = filterCell(grid, 1).querySelectorAll<HTMLInputElement>('.filter-editor');

    expect(from.getAttribute('aria-label')).toBe('Filter Age, From');
    typeInto(from, '26');
    press(from, 'Enter');
    typeInto(to, '35');
    press(to, 'Enter');
    await settle(grid);

    expect(grid.filterValue).toEqual(['age', 'between', [26, 35]]);
    expect(names(grid)).toEqual(['Ana', '<b>x</b>']);

    click(filterCell(grid, 1).querySelector<HTMLElement>('.filter-operation-button')!);
    await settle(grid);
    click([...root(grid).querySelectorAll<HTMLElement>('.filter-menu [role=menuitem]')].pop()!);
    await settle(grid);

    expect(grid.filterValue).toBeNull();
    expect(filterCell(grid, 1).querySelector('.filter-operation-button')!.getAttribute('aria-label')).toBe('Filter operation for Age: Equals');
  });

  it('Esc fecha o menu e devolve o foco; filterOperations/defaultFilterOperation; filterable=false sem editor', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'name', label: 'Name', filterOperations: ['startswith', '='], defaultFilterOperation: '=' },
        { path: 'city', label: 'City', filterable: false },
      ],
      items: people(),
      configure: g => {
        g.showFilterRow = true;
        g.headerFilter = true;
      },
    });
    const button = filterCell(grid, 0).querySelector<HTMLElement>('.filter-operation-button')!;

    expect(button.getAttribute('aria-label')).toBe('Filter operation for Name: Equals');
    click(button);
    await settle(grid);

    const items = [...root(grid).querySelectorAll<HTMLElement>('.filter-menu [role=menuitemradio]')];

    expect(items.map(item => item.textContent.replace(/\s+/g, ''))).toEqual(['a…Startswith', '=Equals']);
    press(items[1], 'Escape');
    await settle(grid);

    expect(root(grid).querySelector('.filter-menu')).toBeNull();
    expect(root(grid).activeElement).toBe(filterCell(grid, 0).querySelector('.filter-operation-button'));
    expect(filterCell(grid, 1).querySelector('.filter-editor')).toBeNull();
    expect(header(grid, 'City').querySelector('.header-filter-button')).toBeNull();
  });

  it('<u-grid-column filter-operations> lê a lista e avisa token desconhecido', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = document.createElement('u-grid');
    grid.style.cssText = 'display:block;height:300px';
    grid.innerHTML = '<u-grid-column path="name" filter-operations="contains = bogus" default-filter-operation="=">Name</u-grid-column>';
    grid.showFilterRow = true;
    document.body.append(grid);
    grid.items = people();
    await settle(grid);

    expect(grid.columns[0].filterOperations).toEqual(['contains', '=']);
    expect(grid.columns[0].defaultFilterOperation).toBe('=');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('bogus'));
    warn.mockRestore();
  });

  it('mudança por API descarta o texto digitado e o timer (o debounce não desfaz a API)', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.showFilterRow = true;
      g.showSearchPanel = true;
    } });
    const fired = events(grid);
    const search = root(grid).querySelector<HTMLInputElement>('.search-input')!;

    typeInto(editor(grid, 0), 'jo');
    typeInto(search, 'lima');
    grid.clearFilter();
    grid.filterValue = ['age', '=', 30];
    await new Promise(resolve => setTimeout(resolve, 400));
    await settle(grid);

    expect(grid.filterValue).toEqual(['age', '=', 30]);
    expect(grid.searchText).toBe('');
    expect(editor(grid, 0).value).toBe('');
    expect(search.value).toBe('');
    expect(fired.every(detail => detail.source === 'api')).toBe(true);
    expect(grid._memoryStats.filterTimers).toBe(0);
  });

  it('filterValue de fora aparece no editor (sincronia)', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showFilterRow = true });

    grid.filterValue = [['name', 'startswith', 'jo'], 'and', ['age', '<', 40]];
    await settle(grid);

    expect(editor(grid, 0).value).toBe('jo');
    expect(filterCell(grid, 0).querySelector('.filter-operation-button')!.getAttribute('aria-label')).toBe('Filter operation for Name: Starts with');
    expect(editor(grid, 1).value).toBe('40');
    expect(names(grid)).toEqual(['joana']);
  });
});

describe('painel de busca', () => {
  it('campo na barra, aplica com debounce/Enter e destaca com <mark> sem HTML do usuário', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showSearchPanel = true });
    const fired = events(grid);
    const input = root(grid).querySelector<HTMLInputElement>('.search-input')!;

    expect(input.getAttribute('aria-label')).toBe('Search in the grid');
    expect(input.getAttribute('part')).toBe('search-input');

    typeInto(input, 'b>X');
    press(input, 'Enter');
    await settle(grid);

    expect(names(grid)).toEqual(['<b>x</b>']);
    expect(fired.at(-1)).toMatchObject({ searchText: 'b>X', source: 'user' });

    const cell = dataRows(grid)[0].cells[0];
    const marks = [...cell.querySelectorAll('mark')];

    expect(marks.map(mark => mark.textContent)).toEqual(['b>x']);
    expect(marks[0].getAttribute('part')).toBe('search-highlight');
    expect(cell.querySelector('b')).toBeNull();
    expect(cell.textContent.trim()).toBe('<b>x</b>');

    typeInto(input, 'sao paulo');
    press(input, 'Enter');
    await settle(grid);
    expect(dataRows(grid)[0].cells[2].querySelector('mark')!.textContent).toBe('São Paulo');
  });

  it('coluna oculta sai da busca', async () => {
    const grid = await createGrid({
      columns: [{ path: 'name', label: 'Name' }, { path: 'city', label: 'City', visible: false }],
      items: people(),
    });

    grid.searchText = 'lima';
    await settle(grid);

    expect(names(grid)).toEqual([]);
  });
});

describe('filtro do cabeçalho', () => {
  const open = async (grid: DataGrid, label: string) => {
    click(header(grid, label).querySelector<HTMLElement>('.header-filter-button')!);
    await settle(grid);

    return root(grid).querySelector<HTMLElement>('.header-filter')!;
  };

  // Lista em árvore (spec 17, A10): o item é o treeitem, marcado por aria-checked.
  const entries = (popover: HTMLElement) =>
    [...popover.querySelectorAll('.header-filter-list [role=treeitem]')].map(item => item.textContent.replace(/\s+/g, ' ').trim());
  const check = (popover: HTMLElement, text: string) =>
    [...popover.querySelectorAll<HTMLElement>('.header-filter-list [role=treeitem]')]
      .find(item => item.querySelector('.header-filter-text')!.textContent === text)!;

  it('valores distintos com contagem e (Blanks); OK aplica; funil ativo; não ordena', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.headerFilter = true });
    const fired = events(grid);
    const button = header(grid, 'City').querySelector<HTMLElement>('.header-filter-button')!;

    expect(button.getAttribute('aria-label')).toBe('Filter options for City');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');

    const popover = await open(grid, 'City');

    expect(grid.getSorting()).toEqual([]);
    expect(popover.getAttribute('role')).toBe('dialog');
    expect(entries(popover)).toEqual(['(Blanks) 1', 'Lima 2', 'Rio 1', 'São Paulo 1']);
    expect(root(grid).activeElement).toBe(popover.querySelector('.header-filter-search'));

    check(popover, 'Lima').click();
    check(popover, '(Blanks)').click();
    await settle(grid);
    expect(popover.querySelector<HTMLInputElement>('.header-filter-select-all input')!.indeterminate).toBe(true);

    click(popover.querySelector<HTMLElement>('.header-filter-ok')!);
    await settle(grid);

    expect(grid.filterValue).toEqual(['city', 'anyof', ['Rio', 'São Paulo']]);
    expect(names(grid)).toEqual(['Ana', 'joana']);
    expect(fired.at(-1)!.source).toBe('user');
    expect(root(grid).querySelector('.header-filter')).toBeNull();
    expect(root(grid).activeElement).toBe(header(grid, 'City').querySelector('.header-filter-button'));
    expect(header(grid, 'City').classList.contains('filtered')).toBe(true);
    expect(header(grid, 'City').querySelector('.header-filter-button')!.classList.contains('active')).toBe(true);

    // Reabrir mostra a seleção atual; desmarcar um só grava noneof.
    const again = await open(grid, 'City');

    expect(check(again, 'Lima').getAttribute('aria-checked')).toBe('false');
    expect(check(again, 'Rio').getAttribute('aria-checked')).toBe('true');
    again.querySelector<HTMLInputElement>('.header-filter-select-all input')!.click();
    await settle(grid);
    check(again, 'Rio').click();
    click(again.querySelector<HTMLElement>('.header-filter-ok')!);
    await settle(grid);

    expect(grid.filterValue).toEqual(['city', 'noneof', ['Rio']]);
  });

  it('Esc cancela, Tab fica preso, busca estreita e Limpar filtro tira tudo da coluna', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.headerFilter = true });

    grid.filterValue = [['name', 'contains', 'o'], 'and', ['name', 'anyof', ['Ana']]];
    await settle(grid);

    let popover = await open(grid, 'Name');
    const search = popover.querySelector<HTMLInputElement>('.header-filter-search')!;

    typeInto(search, 'JO');
    await settle(grid);
    expect(entries(popover)).toEqual(['joana 1', 'José 1']);

    const cancel = popover.querySelector<HTMLElement>('.header-filter-cancel')!;

    cancel.focus();
    press(cancel, 'Tab');
    expect(root(grid).activeElement).toBe(search);

    press(search, 'Escape');
    await settle(grid);
    expect(root(grid).querySelector('.header-filter')).toBeNull();
    expect(grid.filterValue).toEqual([['name', 'contains', 'o'], 'and', ['name', 'anyof', ['Ana']]]);

    popover = await open(grid, 'Name');
    click(popover.querySelector<HTMLElement>('.header-filter-clear')!);
    await settle(grid);

    expect(grid.filterValue).toBeNull();
    expect(header(grid, 'Name').classList.contains('filtered')).toBe(false);
  });

  it('datas agrupadas ano → mês → dia; marcar o ano marca os dias', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.headerFilter = true });
    const popover = await open(grid, 'Born');

    expect(entries(popover)).toEqual(['(Blanks) 1', '1983 1', '1994 2', '1999 1']);

    popover.querySelector<HTMLInputElement>('.header-filter-select-all input')!.click();
    await settle(grid);

    const year = [...popover.querySelectorAll<HTMLElement>('.header-filter-item')].find(item => item.textContent.includes('1994'))!;

    year.click();
    click(year.querySelector<HTMLElement>('.header-filter-expand')!);
    await settle(grid);

    expect(entries(popover)).toContain('March 2');
    click(popover.querySelector<HTMLElement>('.header-filter-ok')!);
    await settle(grid);

    expect(grid.filterValue).toEqual(['born', 'anyof', ['1994-03-05']]);
    expect(names(grid)).toEqual(['Ana', '<b>x</b>']);
  });

  it('valores distintos respeitam os outros filtros', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.headerFilter = true });

    grid.filterValue = ['age', '=', 30];
    await settle(grid);

    expect(entries(await open(grid, 'City'))).toEqual(['Lima 1', 'São Paulo 1']);
  });
});

describe('RTL', () => {
  it('renderiza a linha de filtro, o funil e o popover em árabe', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: people(),
      configure: g => {
        g.dir = 'rtl';
        g.language = 'ar';
        g.showFilterRow = true;
        g.showSearchPanel = true;
        g.headerFilter = true;
      },
    });

    expect(editor(grid, 0).getAttribute('aria-label')).toBe('تصفية Name');
    click(header(grid, 'City').querySelector<HTMLElement>('.header-filter-button')!);
    await settle(grid);

    const popover = root(grid).querySelector<HTMLElement>('.header-filter')!;
    const button = header(grid, 'City').querySelector<HTMLElement>('.header-filter-button')!.getBoundingClientRect();

    expect(popover.querySelector('.header-filter-ok')!.textContent).toBe('موافق');
    // Em RTL abre a partir da borda inicial (esquerda) do botão.
    const expected = Math.max(8, Math.min(button.left, document.documentElement.clientWidth - popover.offsetWidth - 8));

    expect(Math.round(popover.getBoundingClientRect().left)).toBe(Math.round(expected));
  });
});
