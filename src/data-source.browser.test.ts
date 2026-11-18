/**
 * Frente 08 no navegador: chave de linha, fonte de dados (carga única,
 * remota com blocos, grupos remotos, rolagem infinita), paginação, painel de
 * carregamento, erro e "tentar de novo", eventos e `applyChanges`. A fonte
 * falsa responde com latência (`src/test/fake-source.ts`).
 */
import { html } from 'lit';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid, GridLoadOptions, GridPageChangeEventDetail } from './grid.js';
import { FakeSource, waitFor } from './test/fake-source.js';
import { cellText, cleanup, createGrid, dataRows, groupToggles, settle } from './test/fixture.js';

afterEach(cleanup);

interface Person {
  id: number;
  name: string;
  country: string;
  age: number;
}

const COUNTRIES = ['Argentina', 'Brazil', 'Chile'];

const makePeople = (count: number): Person[] =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Name ${String(id).padStart(5, '0')}`, country: COUNTRIES[id % 3], age: 20 + (id % 50) }));

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'country', label: 'Country' },
  { path: 'age', label: 'Age', dataType: 'number' },
];

const root = (grid: DataGrid) => grid.shadowRoot!;
const firstCells = (grid: DataGrid): string[] =>
  dataRows(grid).filter(tr => !tr.classList.contains('pinned'))
    .map(tr => cellText(tr.querySelector('td[part~=cell]')!));
const skeletonRows = (grid: DataGrid) => root(grid).querySelectorAll('tr.skeleton-row').length;

const key = async (grid: DataGrid, name: string, init: KeyboardEventInit = {}): Promise<void> => {
  const target = root(grid).activeElement ?? root(grid).querySelector('table [tabindex="0"]')!;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

/** Grid com fonte falsa já carregada. */
const createSourceGrid = async (source: FakeSource, configure?: (grid: DataGrid) => void): Promise<DataGrid> => {
  const grid = await createGrid({
    columns: columns(),
    configure: element => {
      element.keyExpr = 'id';
      configure?.(element);
      element.dataSource = source;
    },
  });

  await waitFor(() => !root(grid).querySelector('.load-panel') && source.calls.every(call => call.settled));
  await settle(grid);
  return grid;
};

describe('keyExpr', () => {
  it('keeps selection, focus and group expansion when items are replaced by new objects', async () => {
    const people = makePeople(30);
    const grid = await createGrid({
      columns: columns(),
      items: people,
      configure: element => {
        element.keyExpr = 'id';
        element.selectionMode = 'multiple';
      },
    });

    grid.selectRows([3, 5]);
    expect(grid.focusCell(5)).toBe(true);
    await settle(grid);

    grid.items = people.map(person => ({ ...person }));
    await settle(grid);

    expect(grid.selectedKeys).toEqual([3, 5]);
    expect(grid.focusedRowKey).toBe(5);
    expect(grid.getSelectedItems().map(person => person.id)).toEqual([3, 5]);
    expect(grid.getSelectedItems()[0]).toBe(grid.items[3]);
    expect(root(grid).querySelectorAll('tr[aria-selected=true]')).toHaveLength(2);
  });

  it('converts the selection when keyExpr changes', async () => {
    const people = makePeople(10);
    const grid = await createGrid({
      columns: columns(),
      items: people,
      configure: element => {
        element.selectionMode = 'multiple';
      },
    });
    const onChange = vi.fn();
    grid.addEventListener('u-grid-selection-change', onChange);

    grid.selectRows([people[1], people[2]]);
    onChange.mockClear();

    grid.keyExpr = person => (person as Person).name;
    expect(grid.selectedKeys).toEqual([people[1].name, people[2].name]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].detail.source).toBe('api');
  });

  it('reports empty or duplicate keys once', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await createGrid({ columns: columns(), items: [{ id: 1, name: 'a' }, { id: 1, name: 'b' }], configure: grid => grid.keyExpr = 'id' });
    expect(error.mock.calls.filter(call => String(call[0]).includes('keyExpr'))).toHaveLength(1);
    error.mockRestore();
  });
});

describe('dataSource (single load)', () => {
  it('loads every row once, shows the load panel meanwhile and fires the load events', async () => {
    const source = new FakeSource(makePeople(50), 60);
    const events: string[] = [];
    const grid = await createGrid({ columns: columns() });

    for (const type of ['u-grid-loading', 'u-grid-load', 'u-grid-load-error']) {
      grid.addEventListener(type, () => events.push(type));
    }

    grid.dataSource = source;
    await settle(grid);

    expect(root(grid).querySelector('[part=load-panel]')).not.toBeNull();
    expect(root(grid).querySelector('table')!.getAttribute('aria-busy')).toBe('true');
    expect(root(grid).querySelector('[part=no-data]')).toBeNull();

    await waitFor(() => !root(grid).querySelector('.load-panel'));
    await settle(grid);

    expect(source.calls).toHaveLength(1);
    expect(source.calls[0].options.skip).toBeUndefined();
    expect(source.calls[0].options.take).toBeUndefined();
    expect(events).toEqual(['u-grid-loading', 'u-grid-load']);
    expect(root(grid).querySelector('table')!.hasAttribute('aria-busy')).toBe(false);
    expect(firstCells(grid)[0]).toBe('Name 00000');
    expect(grid.getTotalCount()).toBe(50);

    // Ordenar e filtrar é local: nenhum pedido novo.
    grid.sortColumn(grid.columns[0], 'desc');
    grid.filterValue = ['country', '=', 'Chile'];
    await settle(grid);
    expect(firstCells(grid)[0]).toBe('Name 00047');
    expect(source.calls).toHaveLength(1);
  });

  it('cancels the load from u-grid-loading', async () => {
    const source = new FakeSource(makePeople(5), 5);
    const grid = await createGrid({ columns: columns() });

    grid.addEventListener('u-grid-loading', event => event.preventDefault());
    grid.dataSource = source;
    await settle(grid);
    await settle(grid);

    expect(source.calls).toHaveLength(0);
    expect(root(grid).querySelector('.load-panel')).toBeNull();
  });

  it('warns when items and dataSource are both set, and applyChanges without dataSource', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await createGrid({ columns: columns(), items: makePeople(3) });

    grid.applyChanges({ add: makePeople(1) });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('applyChanges'));

    grid.dataSource = new FakeSource([], 1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('dataSource'));
    error.mockRestore();
    warn.mockRestore();
  });
});

describe('dataSource (remote operations)', () => {
  it('loads visible blocks with skeleton rows, aborts on sort and drops late answers', async () => {
    const source = new FakeSource(makePeople(10_000), 40);
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = true;
      element.pageSize = 50;
    });

    expect(source.calls[0].options).toMatchObject({ skip: 0, take: 50, requireTotalCount: true });
    expect(grid.getTotalCount()).toBe(10_000);
    expect(root(grid).querySelector('table')!.getAttribute('aria-rowcount')).toBe(String(10_000 + 1));

    // Rola ao meio: linhas-esqueleto, depois o bloco da janela.
    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;
    scroller.scrollTop = 48 * 5000;
    await settle(grid);
    expect(skeletonRows(grid)).toBeGreaterThan(0);
    expect(root(grid).querySelector('tr.skeleton-row')!.getAttribute('aria-busy')).toBe('true');

    await waitFor(() => source.calls.some(call => (call.options.skip ?? 0) >= 4900));
    await waitFor(() => skeletonRows(grid) === 0);
    expect(firstCells(grid).some(text => text.startsWith('Name 05'))).toBe(true);

    // Ordenar aborta o que está em voo e pede de novo com `sort`.
    scroller.scrollTop = 48 * 8000;
    await settle(grid);
    await waitFor(() => source.calls.some(call => !call.settled));
    const inFlight = source.calls.filter(call => !call.settled);
    grid.sortColumn(grid.columns[0], 'desc');
    await settle(grid);

    expect(inFlight.every(call => call.signal.aborted)).toBe(true);
    const sorted = source.calls.at(-1)!;
    expect(sorted.options.sort).toEqual([{ path: 'name', order: 'desc' }]);
    expect(Object.isFrozen(sorted.options)).toBe(true);
    await waitFor(() => !root(grid).querySelector('.load-panel') && skeletonRows(grid) === 0);
  });

  it('ignores a slow answer of a previous query (response race)', async () => {
    const source = new FakeSource(makePeople(200), 10);
    source.ignoreAbort = true;
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = true;
    });

    // O pedido do filtro "Chile" é lento; o do "Brazil" chega antes.
    source.latencyOf = options => JSON.stringify(options.filter).includes('Chile') ? 200 : 10;
    grid.filterValue = ['country', '=', 'Chile'];
    await settle(grid);
    grid.filterValue = ['country', '=', 'Brazil'];
    await settle(grid);

    await waitFor(() => source.calls.every(call => call.settled), 2000);
    await settle(grid);

    expect(new Set(dataRows(grid).map(tr => cellText(tr.querySelectorAll('td[part~=cell]')[1])))).toEqual(new Set(['Brazil']));
  });

  it('shows the error bar and retries', async () => {
    const source = new FakeSource(makePeople(30), 10);
    source.fail = 1;
    const onError = vi.fn();
    const grid = await createGrid({ columns: columns() });

    grid.addEventListener('u-grid-load-error', onError);
    grid.dataSource = source;
    await waitFor(() => !!root(grid).querySelector('[part=error-row]'));
    await settle(grid);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].detail.error).toEqual(new Error('Server error'));
    expect(root(grid).querySelector('[part=error-row]')!.getAttribute('role')).toBe('alert');

    root(grid).querySelector<HTMLButtonElement>('[part=retry-button]')!.click();
    await waitFor(() => !root(grid).querySelector('[part=error-row]') && dataRows(grid).length > 0);
    expect(source.calls).toHaveLength(2);
  });

  it('loads groups lazily and the rows of an expanded group by groupPath', async () => {
    const source = new FakeSource(makePeople(300), 10);
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = { grouping: true };
      element.summary = { group: [{ column: 'age', type: 'max' }], total: [{ column: 'age', type: 'sum' }] };
    });

    grid.groupColumn(grid.columns[1]);
    await waitFor(() => groupToggles(grid).length === 3);
    await settle(grid);

    const groupCall = source.calls.at(-1)!;
    expect(groupCall.options).toMatchObject({
      group: [{ path: 'country', order: 'asc', expanded: false }],
      groupPath: null,
      requireGroupCount: true,
      groupSummary: [{ path: 'age', type: 'max' }],
    });
    expect(grid.getSummaryValues()[0].value).toBe(makePeople(300).reduce((sum, person) => sum + person.age, 0));
    expect(grid.getSummaryValues(['Brazil'])[0].value).toBe(69);

    grid.expandGroup(['Brazil']);
    await waitFor(() => source.calls.some(call => call.options.groupPath?.[0] === 'Brazil'));
    await waitFor(() => skeletonRows(grid) === 0 && dataRows(grid).length > 0);

    const rowsCall = source.calls.find(call => call.options.groupPath?.[0] === 'Brazil')!;
    // Paginação local: o grupo inteiro numa chamada.
    expect(rowsCall.options).toMatchObject({ groupPath: ['Brazil'] });
    expect(rowsCall.options.skip).toBeUndefined();
    // A coluna agrupada sai das células: os nomes são os de id % 3 = 1 (Brazil).
    expect(firstCells(grid).every(name => Number(name.slice(5)) % 3 === 1)).toBe(true);
  });

  it('grows in infinite scrolling with an unknown row count', async () => {
    const source = new FakeSource(makePeople(120), 10);
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = true;
      element.scrollMode = 'infinite';
      element.pageSize = 50;
    });

    expect(source.calls[0].options.requireTotalCount).toBe(false);
    expect(root(grid).querySelector('table')!.getAttribute('aria-rowcount')).toBe('-1');
    expect(grid.getTotalCount()).toBe(-1);

    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;

    for (let i = 0; i < 4 && grid.getTotalCount() < 0; i++) {
      scroller.scrollTop = scroller.scrollHeight;
      await settle(grid);
      await waitFor(() => source.calls.every(call => call.settled));
      await settle(grid);
    }

    expect(grid.getTotalCount()).toBe(120);
    expect(root(grid).querySelector('table')!.getAttribute('aria-rowcount')).toBe('121');
  });
});

describe('paging', () => {
  it('pages local rows with an accessible pager and PageUp/PageDown', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: makePeople(95),
      configure: element => {
        element.keyExpr = 'id';
        element.paging = true;
        element.pageSize = 10;
      },
    });
    const pages: GridPageChangeEventDetail[] = [];
    grid.addEventListener('u-grid-page-change', event => pages.push(event.detail));

    const pager = root(grid).querySelector('nav[part=pager]')!;
    expect(pager.getAttribute('aria-label')).toBe('Pagination');
    expect(pager.querySelector('[part=page-info]')!.textContent).toBe('Page 1 of 10 (95 items)');
    expect(dataRows(grid)).toHaveLength(10);
    expect(pager.querySelector('[aria-current=page]')!.textContent).toBe('1');
    expect(pager.querySelector<HTMLButtonElement>('button[aria-label="Previous page"]')!.disabled).toBe(true);

    pager.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    await settle(grid);

    expect(grid.pageIndex).toBe(1);
    expect(pages).toEqual([{ pageIndex: 1, previousPageIndex: 0, pageSize: 10, previousPageSize: 10, source: 'user' }]);
    expect(firstCells(grid)[0]).toBe('Name 00010');
    // `aria-rowindex` real (página 2, 1ª linha = 11ª de dados, depois do cabeçalho).
    expect(dataRows(grid)[0].getAttribute('aria-rowindex')).toBe('12');

    grid.focusCell(12);
    await settle(grid);
    await key(grid, 'PageDown');
    expect(grid.pageIndex).toBe(2);
    expect(firstCells(grid)[0]).toBe('Name 00020');

    const select = pager.querySelector<HTMLSelectElement>('select[part=page-size-select]')!;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    await settle(grid);
    expect(grid.pageSize).toBe(50);
    expect(grid.pageIndex).toBe(0);

    // Índice além do fim pelo setter: limitado em silêncio.
    pages.length = 0;
    grid.pageIndex = 7;
    await settle(grid);
    expect(grid.pageIndex).toBe(1);
    expect(pages).toEqual([]);

    // As linhas encolheram (novos `items`): limitado com evento `api`.
    grid.items = makePeople(30);
    await settle(grid);
    expect(grid.pageIndex).toBe(0);
    expect(pages).toEqual([{ pageIndex: 0, previousPageIndex: 1, pageSize: 50, previousPageSize: 50, source: 'api' }]);

    // Sem o atributo, as opções de tamanho voltam ao padrão.
    grid.setAttribute('page-size-options', '5, 15');
    await settle(grid);
    expect(grid.pageSizeOptions).toEqual([5, 15]);
    grid.removeAttribute('page-size-options');
    expect(grid.pageSizeOptions).toEqual([10, 20, 50, 100]);
  });

  it('asks a remote source only for the page', async () => {
    const source = new FakeSource(makePeople(1000), 5);
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = true;
      element.paging = true;
      element.pageSize = 25;
      element.pageIndex = 3;
    });

    await waitFor(() => source.calls.some(call => call.options.skip === 75));
    await waitFor(() => skeletonRows(grid) === 0);
    expect(firstCells(grid)[0]).toBe('Name 00075');
    expect(root(grid).querySelector('[part=page-info]')!.textContent).toBe('Page 4 of 40 (1,000 items)');
  });
});

describe('applyChanges', () => {
  it('updates, removes and adds by key keeping selection, focus and expansion', async () => {
    const people = makePeople(60);
    const source = new FakeSource(people, 5);
    const grid = await createSourceGrid(source, element => {
      element.selectionMode = 'multiple';
    });

    grid.groupColumn(grid.columns[1]);
    await settle(grid);
    grid.expandGroup(['Brazil']);
    await settle(grid);
    grid.selectRows([1, 4]);
    grid.focusCell(4);
    await settle(grid);

    grid.applyChanges({
      update: [{ ...people[4], name: 'Updated' }],
      remove: [7],
      add: [{ id: 100, name: 'New', country: 'Brazil', age: 1 }],
    });
    await settle(grid);

    expect(source.calls).toHaveLength(1);
    expect(grid.selectedKeys).toEqual([1, 4]);
    expect(grid.focusedRowKey).toBe(4);
    expect(grid.isGroupExpanded(['Brazil'])).toBe(true);
    expect(grid.getSelectedItems().map(person => person.name)).toEqual(['Name 00001', 'Updated']);

    expect(firstCells(grid)).toContain('Updated');
    expect(firstCells(grid)).not.toContain('Name 00007');
    expect(grid.getTotalCount()).toBe(60);
    // Novo no fim do grupo (sem reordenar); o removido não está mais nas linhas.
    expect(grid.focusCell(100)).toBe(true);
    expect(grid.focusCell(7)).toBe(false);
  });

  it('patches loaded blocks of a remote source', async () => {
    const people = makePeople(100);
    const source = new FakeSource(people, 5);
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = true;
    });

    grid.applyChanges({ update: [{ ...people[0], name: 'Patched' }] });
    await settle(grid);
    expect(firstCells(grid)[0]).toBe('Patched');
    expect(source.calls).toHaveLength(1);

    grid.applyChanges({ remove: [0] });
    await settle(grid);
    await waitFor(() => source.calls.length === 2 && source.calls[1].settled);
  });

  it('needs keyExpr to update or remove', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const grid = await createGrid({ columns: columns() });

    grid.dataSource = new FakeSource(makePeople(2), 1);
    grid.applyChanges({ remove: [1] });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('keyExpr'));
    error.mockRestore();
  });

  it('refresh() reloads and resolves after the answer', async () => {
    const source = new FakeSource(makePeople(10), 20);
    const grid = await createSourceGrid(source);

    await grid.refresh();
    expect(source.calls).toHaveLength(2);
    expect(source.calls[1].settled).toBe(true);
  });
});

describe('remote options', () => {
  it('sends the filter, the search and the sorting as data', async () => {
    const source = new FakeSource(makePeople(30), 5);
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = { filtering: true, sorting: true };
    });

    grid.sortColumn(grid.columns[2], 'desc');
    grid.filterValue = ['age', '>', 30];
    grid.searchText = 'Bra';
    await settle(grid);
    await waitFor(() => source.calls.every(call => call.settled));

    const options: GridLoadOptions = source.calls.at(-1)!.options;
    expect(options.sort).toEqual([{ path: 'age', order: 'desc' }]);
    expect(options.filterValue).toEqual(['age', '>', 30]);
    expect(options.searchText).toBe('Bra');
    expect(options.filter).toEqual(grid.getCombinedFilter());
    expect(options.skip).toBeUndefined();
  });
});

describe('acessibilidade da frente 08', () => {
  const axeViolations = async (grid: DataGrid) => {
    const { default: axe } = await import('axe-core');
    const result = await axe.run(grid, { resultTypes: ['violations'] });
    return result.violations.map(violation => `${violation.id}: ${violation.nodes.length}`);
  };

  it('pager, load panel, skeleton rows and error bar pass axe', async () => {
    const source = new FakeSource(makePeople(500), 300);
    const grid = await createGrid({
      columns: columns(),
      configure: element => {
        element.keyExpr = 'id';
        element.remoteOperations = true;
        element.paging = true;
        element.selectionMode = 'multiple';
        element.showCheckboxes = true;
        element.dataSource = source;
      },
    });

    // Carregando (painel) e, depois, página remota com esqueleto.
    expect(root(grid).querySelector('[part=load-panel]')!.getAttribute('aria-hidden')).toBe('true');
    expect(await axeViolations(grid)).toEqual([]);
    await waitFor(() => !root(grid).querySelector('.load-panel'));
    // Lento o bastante para o esqueleto ainda estar na tela com a máquina ocupada.
    source.latency = 1500;
    grid.pageIndex = 4;
    await settle(grid);
    expect(skeletonRows(grid)).toBeGreaterThan(0);
    expect(root(grid).querySelector('tr.skeleton-row td[part~=cell]')!.textContent).toContain('Loading');
    expect(await axeViolations(grid)).toEqual([]);
    await waitFor(() => skeletonRows(grid) === 0, 5000);

    source.fail = 1;
    source.latency = 5;
    grid.sortColumn(grid.columns[0], 'desc');
    await waitFor(() => !!root(grid).querySelector('[part=error-row]'));
    await settle(grid);
    expect(await axeViolations(grid)).toEqual([]);
  });

  it('keeps the focus on the pager when a button gets disabled or the numbers move', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: makePeople(95),
      configure: element => {
        element.keyExpr = 'id';
        element.paging = true;
        element.pageSize = 10;
      },
    });
    const pager = () => root(grid).querySelector('nav[part=pager]')!;
    const pageButton = (n: string) => [...pager().querySelectorAll<HTMLButtonElement>('.pager-number')].find(button => button.textContent === n)!;

    // Número que desloca a janela (1–5 → 3–7): o foco fica na página atual.
    pageButton('5').focus();
    pageButton('5').click();
    await settle(grid);
    expect(root(grid).activeElement?.getAttribute('aria-current')).toBe('page');
    expect(root(grid).activeElement?.textContent).toBe('5');
    expect(root(grid).activeElement?.getAttribute('aria-label')).toBe('Page 5');

    // "Last" fica desabilitado: o foco vai à página atual, não ao <body>.
    const last = pager().querySelector<HTMLButtonElement>('button[aria-label="Last page"]')!;
    last.focus();
    last.click();
    await settle(grid);
    expect(last.disabled).toBe(true);
    expect(root(grid).activeElement?.textContent).toBe('10');
  });

  it('announces the filter count only after a remote answer, and page changes asked by the user', async () => {
    const source = new FakeSource(makePeople(90), 50);
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = { filtering: true };
      element.paging = true;
      element.pageSize = 10;
      element.showFilterRow = true;
    });
    const marks = new RegExp(`[${String.fromCharCode(0x200B, 0x2060)}]`, 'g');
    const status = () => root(grid).querySelector('[role=status][aria-live]')!.textContent.replace(marks, '').trim();

    root(grid).querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    await settle(grid);
    expect(status()).toBe('Page 2 of 9 (90 items)');

    // Gesto de filtro: a contagem sai depois da resposta (não a velha).
    const input = root(grid).querySelector<HTMLInputElement>('[part~=filter-editor]')!;
    input.value = '00001';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    await waitFor(() => source.calls.length > 1 && source.calls.every(call => call.settled));
    await settle(grid);
    expect(status()).toBe('Rows: 1');
  });

  it('PageDown on a remote page keeps the focus while the skeleton turns into data', async () => {
    const source = new FakeSource(makePeople(300), 80);
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = true;
      element.paging = true;
      element.pageSize = 10;
    });

    grid.focusCell(2);
    await settle(grid);
    await key(grid, 'PageDown');
    expect(grid.pageIndex).toBe(1);
    expect(root(grid).activeElement?.closest('tr')?.classList.contains('skeleton-row')).toBe(true);

    await waitFor(() => skeletonRows(grid) === 0);
    await settle(grid);
    expect(root(grid).activeElement?.closest('tr')?.getAttribute('aria-rowindex')).toBe('14');
    expect(grid.focusedRowKey).toBe(12);
  });
});

describe('exportação com chave e fonte de dados', () => {
  it('selectedOnly and Ctrl+C use keyExpr keys', async () => {
    const people = makePeople(20);
    const grid = await createGrid({
      columns: columns(),
      items: people,
      configure: element => {
        element.keyExpr = 'id';
        element.selectionMode = 'multiple';
      },
    });

    grid.selectRows([2, 5]);
    // Objetos novos, mesmas chaves: a seleção vale para a exportação.
    grid.items = people.map(person => ({ ...person }));
    await settle(grid);

    const data = await grid.getExportData({ selectedOnly: true });
    expect(data.rows.map(row => (row as { item: Person }).item.id)).toEqual([2, 5]);
  });

  it('a single-load source exports every row; a remote one only the loaded rows, in order', async () => {
    const single = await createSourceGrid(new FakeSource(makePeople(120), 5));
    expect((await single.getExportData()).rows).toHaveLength(120);
    single.remove();

    const source = new FakeSource(makePeople(1000), 5);
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = true;
      element.pageSize = 50;
    });

    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;
    scroller.scrollTop = 48 * 600;
    await settle(grid);
    await waitFor(() => source.calls.every(call => call.settled) && skeletonRows(grid) === 0);

    const calls = source.calls.length;
    const rows = (await grid.getExportData()).rows;
    const ids = rows.map(row => (row as { item: Person }).item.id);

    expect(source.calls).toHaveLength(calls);
    expect(ids.slice(0, 50)).toEqual(Array.from({ length: 50 }, (_, id) => id));
    expect(ids.length).toBeLessThan(1000);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);

    // Agrupado no servidor: sem linhas de grupo, a coluna agrupada vira coluna.
    grid.groupColumn(grid.columns[1]);
    await waitFor(() => source.calls.every(call => call.settled) && root(grid).querySelectorAll('tr.group-row').length === 3);
    grid.expandGroup(['Brazil']);
    await waitFor(() => source.calls.every(call => call.settled) && skeletonRows(grid) === 0);

    const grouped = await grid.getExportData();
    expect(grouped.rows.every(row => row.rowType !== 'group')).toBe(true);
    expect(grouped.columns.map(column => column.label)).toContain('Country');
    expect(grouped.rows.filter(row => row.rowType === 'data').every(row => (row.item as Person).country === 'Brazil')).toBe(true);
  });
});

describe('master-detail com chave e fonte remota (frente 10)', () => {
  const detailRows = (grid: DataGrid) => [...root(grid).querySelectorAll<HTMLTableRowElement>('tr.detail-row:not(.pinned)')];

  it('expandRow uses keyExpr keys and the expansion survives new objects', async () => {
    const people = makePeople(30);
    const grid = await createGrid({
      columns: columns(),
      items: people,
      configure: element => {
        element.keyExpr = 'id';
        element.detailRenderer = (item: Person) => `Detail of ${item.name}`;
      },
    });
    const onExpand = vi.fn();
    grid.addEventListener('u-grid-row-expansion-change', onExpand);

    grid.expandRow(3);
    await settle(grid);
    expect(grid.isRowExpanded(3)).toBe(true);
    expect(onExpand.mock.calls[0][0].detail.rowKey).toBe(3);
    expect(detailRows(grid).map(tr => tr.textContent.trim())).toEqual(['Detail of Name 00003']);

    grid.items = people.map(person => ({ ...person, name: `${person.name}!` }));
    await settle(grid);
    expect(detailRows(grid).map(tr => tr.textContent.trim())).toEqual(['Detail of Name 00003!']);

    // O botão de expandir também usa a chave.
    root(grid).querySelectorAll<HTMLButtonElement>('[part~=detail-toggle-button]')[5].click();
    await settle(grid);
    expect(grid.isRowExpanded(5)).toBe(true);
    expect(onExpand.mock.calls.at(-1)![0].detail.rowKey).toBe(5);
  });

  it('remote blocks with skeleton rows coexist with variable-height detail rows', async () => {
    const source = new FakeSource(makePeople(5000), 20);
    const grid = await createSourceGrid(source, element => {
      element.remoteOperations = true;
      element.pageSize = 50;
      element.detailRenderer = (item: Person) => html`<div style="height: 150px">Detail ${item.id}</div>`;
    });

    grid.expandRow(2);
    await settle(grid);
    await settle(grid);

    const detail = detailRows(grid)[0];
    expect(detail.textContent.trim()).toBe('Detail 2');
    expect(detail.getBoundingClientRect().height).toBeGreaterThan(140);

    // Rola para longe (esqueleto, blocos novos) e volta: o detalhe medido continua.
    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;
    scroller.scrollTop = 48 * 3000;
    await settle(grid);
    expect(skeletonRows(grid)).toBeGreaterThan(0);
    await waitFor(() => source.calls.every(call => call.settled) && skeletonRows(grid) === 0);

    grid.expandRow(2998);
    await settle(grid);
    await settle(grid);
    expect(detailRows(grid).some(tr => tr.textContent.trim() === 'Detail 2998')).toBe(true);

    scroller.scrollTop = 0;
    await settle(grid);
    await waitFor(() => skeletonRows(grid) === 0);
    expect(detailRows(grid)[0].textContent.trim()).toBe('Detail 2');
    expect(dataRows(grid).find(tr => !tr.classList.contains('detail-row'))!.getAttribute('aria-rowindex')).toBe('2');
    expect(grid.getTotalCount()).toBe(5000);
  });
});
