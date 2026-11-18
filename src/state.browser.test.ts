/**
 * Estado e persistência (frente 11): ida e volta, storage (local e
 * próprio, síncrono e assíncrono), estado corrompido/malicioso, coluna
 * removida, `setState` parcial, evento com debounce, foco e anúncios.
 */
import { html } from 'lit';

import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid, GridState, GridStateChangeEventDetail, GridStateStorage } from './grid.js';
import { cleanup, createGrid, dataRows, groupLabels, headerLabels, settle } from './test/fixture.js';

const KEY = 'u-grid-state-test';

const columns = (): GridColumnDef[] => [
  { path: 'id', label: 'Id', dataType: 'number' },
  { path: 'country', label: 'Country' },
  { path: 'city', label: 'City' },
  { path: 'year', label: 'Year', dataType: 'number' },
  { path: 'day', label: 'Day', dataType: 'date' },
];

const countries = ['Brazil', 'Chile', 'Argentina'];

const items = Array.from({ length: 60 }, (_, index) => ({
  id: index + 1,
  country: countries[index % 3],
  city: `City ${index % 7}`,
  year: 2000 + (index % 5),
  day: new Date(Date.UTC(2020, 0, 1 + (index % 4))),
}));

const root = (grid: DataGrid) => grid.shadowRoot!;
const liveRegion = (grid: DataGrid) => root(grid).querySelector<HTMLElement>('[role=status]')!;
const byPath = (grid: DataGrid, path: string) => grid.columns.find(column => column.path === path)!;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Grid pronto com dados e chave; `configure` roda antes de conectar. */
const makeGrid = (configure?: (grid: DataGrid) => void) => createGrid({
  columns: columns(),
  items,
  setBeforeConnect: true,
  configure: grid => {
    grid.keyExpr = 'id';
    grid.selectionMode = 'multiple';
    grid.stateChangeDelay = 10;
    configure?.(grid);
  },
});

/** Mexe em todas as partes do estado, como o usuário/hospedeiro faria. */
const exercise = async (grid: DataGrid): Promise<void> => {
  grid.moveColumn(byPath(grid, 'year'), 0);
  grid.setColumnWidth(byPath(grid, 'city'), 222);
  grid._userSetVisible(byPath(grid, 'id'), false);
  grid._userSetFixed(byPath(grid, 'year'), 'start');
  grid.groupColumn(byPath(grid, 'country'));
  grid.groupColumn(byPath(grid, 'day'));
  grid.sortColumn(byPath(grid, 'year'), 'desc');
  grid.sortColumn(byPath(grid, 'city'), 'asc', { append: true });
  grid.filterValue = [['year', '>=', 2001]];
  grid.searchText = 'city';
  grid.collapseAllGroups(1);
  await settle(grid);
  grid.expandGroup(['Chile']);
  grid.expandGroup(['Brazil', new Date(Date.UTC(2020, 0, 2))]);
  grid.collapseGroup(['Argentina']);
  grid.selectRows([3, 7, 9]);
  grid.paging = true;
  grid.pageSize = 10;
  await settle(grid);
};

beforeEach(() => {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
});

describe('getState / setState', () => {
  it('ida e volta completa: todas as partes, via JSON, em outro grid', async () => {
    const a = await makeGrid();
    await exercise(a);

    const state = a.getState();

    expect(state).toEqual({
      version: 1,
      columns: [
        { name: 'year', width: null, visible: true, fixed: 'start', groupIndex: null, sortOrder: 'desc', sortIndex: 0 },
        { name: 'id', width: null, visible: false, fixed: null, groupIndex: null, sortOrder: null, sortIndex: null },
        { name: 'city', width: 222, visible: true, fixed: null, groupIndex: null, sortOrder: 'asc', sortIndex: 1 },
        { name: 'country', width: null, visible: true, fixed: null, groupIndex: 0, sortOrder: null, sortIndex: null },
        { name: 'day', width: null, visible: true, fixed: null, groupIndex: 1, sortOrder: null, sortIndex: null },
      ],
      filterValue: [['year', '>=', 2001]],
      searchText: 'city',
      groupExpansion: {
        all: null,
        levels: [null, false],
        expanded: [['Chile'], ['Brazil', '2020-01-02T00:00:00.000Z']],
        collapsed: [],
      },
      selectedKeys: [3, 7, 9],
      rowExpansion: { expanded: [], collapsed: [] },
      pageIndex: 0,
      pageSize: 10,
    });
    // `collapseGroup(['Argentina'])` = padrão do nível 0 (recolhido): não entra.

    const b = await createGrid({ columns: columns(), items, setBeforeConnect: true, configure: g => {
      g.keyExpr = 'id';
      g.selectionMode = 'multiple';
      g.paging = true;
    } });

    b.setState(JSON.parse(JSON.stringify(state)) as GridState);
    await settle(b);

    expect(b.getState()).toEqual(state);
    expect(headerLabels(b)).toEqual(headerLabels(a));
    expect(groupLabels(b)).toEqual(groupLabels(a));
    expect(b.getSorting().map(s => [s.column.path, s.order])).toEqual([['year', 'desc'], ['city', 'asc']]);
    expect(b.getGrouping().map(c => c.path)).toEqual(['country', 'day']);
    expect(b.selectedKeys).toEqual([3, 7, 9]);
    expect(b.isGroupExpanded(['Brazil', new Date(Date.UTC(2020, 0, 2))])).toBe(true);
    expect(b.isGroupExpanded(['Brazil', new Date(Date.UTC(2020, 0, 3))])).toBe(false);
  });

  it('master-detail: linhas expandidas por chave (e recolhidas com auto-expand-rows)', async () => {
    const grid = await makeGrid(g => {
      g.detailRenderer = () => html`<p>detail</p>`;
    });

    grid.expandRow(2);
    grid.expandRow(5);
    await settle(grid);
    expect(grid.getState().rowExpansion).toEqual({ expanded: [2, 5], collapsed: [] });

    const other = await makeGrid(g => {
      g.detailRenderer = () => html`<p>detail</p>`;
      g.autoExpandRows = true;
    });

    other.collapseRow(4);
    await settle(other);
    expect(other.getState().rowExpansion).toEqual({ expanded: [], collapsed: [4] });

    other.setState({ version: 1, rowExpansion: { expanded: [], collapsed: [1, 2] } }, { partial: true });
    expect(other.isRowExpanded(1)).toBe(false);
    expect(other.isRowExpanded(4)).toBe(true);
  });

  it('sem keyExpr: seleção e detalhe ficam fora (a chave seria o próprio item)', async () => {
    const grid = await createGrid({ columns: columns(), items, setBeforeConnect: true, configure: g => g.selectionMode = 'multiple' });

    grid.selectRows([items[0]]);
    const state = grid.getState();

    expect(state.selectedKeys).toBeUndefined();
    expect(state.rowExpansion).toBeUndefined();
    expect(JSON.stringify(state)).not.toContain('City 0');
  });

  it('coluna removida é ignorada; coluna nova (fora do estado) vai ao fim, como na definição', async () => {
    const grid = await makeGrid();

    grid.setState({
      version: 1,
      columns: [{ name: 'gone', width: 300, groupIndex: 0 }, { name: 'city' }, { name: 'country', width: 150 }, { name: 'year', sortOrder: 'asc' }],
    });
    await settle(grid);

    expect(headerLabels(grid)).toEqual(['City', 'Country', 'Year', 'Id', 'Day']);
    expect(grid.getGrouping()).toEqual([]);
    expect(grid.getState().columns!.find(c => c.name === 'country')!.width).toBe(150);
    expect(grid.getSorting().map(s => s.column.path)).toEqual(['year']);
  });

  it('`partial`: só as chaves presentes mudam; sem `partial` o resto volta ao inicial', async () => {
    const grid = await makeGrid(g => {
      g.searchText = 'City 1';
    });

    grid.sortColumn(byPath(grid, 'year'), 'desc');
    grid.filterValue = [['year', '=', 2002]];
    grid.selectRows([1]);
    await settle(grid);

    grid.setState({ version: 1, searchText: 'City 2' }, { partial: true });
    await settle(grid);

    expect(grid.searchText).toBe('City 2');
    expect(grid.filterValue).toEqual([['year', '=', 2002]]);
    expect(grid.getSorting()).toHaveLength(1);
    expect(grid.selectedKeys).toEqual([1]);

    grid.setState({ version: 1, pageSize: 50 });
    await settle(grid);

    // Inicial = definições + o que o hospedeiro deu antes de conectar.
    expect(grid.searchText).toBe('City 1');
    expect(grid.filterValue).toBeNull();
    expect(grid.getSorting()).toEqual([]);
    expect(grid.selectedKeys).toEqual([]);
    expect(grid.pageSize).toBe(50);
  });

  it('`resetState` volta tudo ao inicial (definições e propriedades do hospedeiro)', async () => {
    const grid = await makeGrid(g => {
      g.pageSize = 10;
    });

    await exercise(grid);
    grid.pageSize = 20;
    grid.resetState();
    await settle(grid);

    expect(headerLabels(grid)).toEqual(['Id', 'Country', 'City', 'Year', 'Day']);
    expect(grid.getGrouping()).toEqual([]);
    expect(grid.getSorting()).toEqual([]);
    expect(grid.filterValue).toBeNull();
    expect(grid.searchText).toBe('');
    expect(grid.selectedKeys).toEqual([]);
    expect(grid.pageSize).toBe(10);
    expect(grid.getState().groupExpansion).toEqual({ all: null, levels: [], expanded: [], collapsed: [] });
  });

  it('estado inválido é ignorado com aviso e nada muda', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await makeGrid();

    grid.sortColumn(byPath(grid, 'year'), 'asc');
    const before = grid.getState();

    grid.setState({ version: 1, columns: [{ name: 'year', width: 'wide' }] } as unknown as GridState);
    grid.setState({ version: 9 } as unknown as GridState);
    grid.setState(null as unknown as GridState);
    await settle(grid);

    expect(grid.getState()).toEqual(before);
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('`pageSize` fora das opções do pager é ignorado', async () => {
    const grid = await makeGrid(g => {
      g.paging = true;
    });

    grid.setState({ version: 1, pageSize: 99_999 }, { partial: true });
    expect(grid.pageSize).toBe(20);

    grid.setState({ version: 1, pageSize: 50 }, { partial: true });
    expect(grid.pageSize).toBe(50);
  });

  it('`name` identifica a coluna (duas com o mesmo path) e resolve o `summary`', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await createGrid({
      columns: [
        { path: 'year', name: 'year-a', label: 'A', dataType: 'number' },
        { path: 'year', name: 'year-b', label: 'B', dataType: 'number', width: 90 },
        { label: 'No id' },
      ],
      items,
      setBeforeConnect: true,
      configure: g => {
        g.summary = { total: [{ column: 'year-b', type: 'max', label: 'Max B' }] };
      },
    });

    grid.setState({ version: 1, columns: [{ name: 'year-b', width: 140 }, { name: 'year-a', visible: false }] });
    await settle(grid);

    expect(headerLabels(grid)).toEqual(['B', 'No id']);
    expect(grid.getState().columns!.map(c => c.name)).toEqual(['year-b', 'year-a']);
    expect(grid.getSummaryValues()[0].item.column).toBe('year-b');
    expect(root(grid).querySelector('.total-row')!.textContent).toContain('Max B');
    expect(warn.mock.calls.some(([message]) => String(message).includes('without "name" or "path"'))).toBe(true);
  });

  it('`<u-grid-column name>` (declarativo)', async () => {
    const grid = document.createElement('u-grid');
    grid.innerHTML = '<u-grid-column path="a" name="first">A</u-grid-column><u-grid-column path="a" name="second">A2</u-grid-column>';
    document.body.append(grid);
    await settle(grid);

    grid.setState({ version: 1, columns: [{ name: 'second' }, { name: 'first' }] });
    await settle(grid);

    expect(headerLabels(grid)).toEqual(['A2', 'A']);
  });
});

describe('u-grid-state-change', () => {
  it('uma vez por rajada, com as origens; não dispara se voltou ao mesmo estado', async () => {
    const grid = await makeGrid(g => {
      g.stateChangeDelay = 400;
    });
    const events: GridStateChangeEventDetail[] = [];
    grid.addEventListener('u-grid-state-change', event => events.push(event.detail));

    grid.sortColumn(byPath(grid, 'year'), 'asc');
    await settle(grid);
    grid.searchText = 'City';
    await settle(grid);
    // Gesto do usuário (clique no cabeçalho do Country).
    root(grid).querySelectorAll<HTMLElement>('th.header-column .header-text')[1].click();
    await settle(grid);
    await wait(500);

    expect(events).toHaveLength(1);
    expect([...events[0].sources].sort()).toEqual(['api', 'user']);
    expect(events[0].state.searchText).toBe('City');
    expect(events[0].state.columns!.find(c => c.name === 'country')!.sortOrder).toBe('asc');

    grid.searchText = 'x';
    await settle(grid);
    grid.searchText = 'City';
    await settle(grid);
    await wait(500);

    expect(events).toHaveLength(1);
  });

  it('setState dispara (origem api); setters também', async () => {
    const grid = await makeGrid();
    const events: GridStateChangeEventDetail[] = [];
    grid.addEventListener('u-grid-state-change', event => events.push(event.detail));

    grid.setState({ version: 1, searchText: 'City 3' }, { partial: true });
    await settle(grid);
    await wait(40);

    expect(events.map(e => e.sources)).toEqual([['api']]);
  });
});

describe('stateStorage', () => {
  const saved = (): GridState => JSON.parse(localStorage.getItem(KEY)!) as GridState;

  it('local: restaura antes do 1º render de dados (sem piscar) e grava depois de mudar', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 1,
      columns: [{ name: 'year', sortOrder: 'desc', sortIndex: 0 }, { name: 'country', groupIndex: 0 }],
      groupExpansion: { all: true, levels: [], expanded: [], collapsed: [['Chile']] },
    }));

    const grid = document.createElement('u-grid');
    const firstRenders: string[][] = [];

    grid.style.display = 'block';
    grid.style.height = '400px';
    grid.columns = columns();
    grid.items = items;
    grid.stateStorage = 'local';
    grid.stateStorageKey = KEY;
    grid.stateChangeDelay = 10;

    const events: GridStateChangeEventDetail[] = [];
    grid.addEventListener('u-grid-state-change', event => events.push(event.detail));
    document.body.append(grid);
    await grid.updateComplete;
    // O 1º render já é o restaurado.
    firstRenders.push(groupLabels(grid));
    await settle(grid);

    expect(firstRenders[0].slice(0, 2)).toEqual(['Country: Argentina', 'Country: Brazil']);
    expect(dataRows(grid)[0].textContent).toContain('2004');
    expect(grid.isGroupExpanded(['Chile'])).toBe(false);
    expect(grid.isGroupExpanded(['Brazil'])).toBe(true);

    await wait(40);
    // A restauração avisa ("pronto") e não grava de volta.
    expect(events.map(e => e.sources)).toEqual([['storage']]);

    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    grid.ungroupColumn(byPath(grid, 'country'));
    await settle(grid);
    await wait(40);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(saved().columns!.find(c => c.name === 'country')!.groupIndex).toBeNull();
  });

  it('session + attributes; gravação pendente sai no disconnect', async () => {
    const grid = await createGrid({
      columns: columns(),
      items,
      setBeforeConnect: true,
      configure: g => {
        g.setAttribute('state-storage', 'session');
        g.setAttribute('state-storage-key', KEY);
        g.setAttribute('state-change-delay', '5000');
      },
    });

    grid.sortColumn(byPath(grid, 'city'), 'desc');
    await settle(grid);
    expect(sessionStorage.getItem(KEY)).toBeNull();

    grid.remove();

    const state = JSON.parse(sessionStorage.getItem(KEY)!) as GridState;
    expect(state.columns!.find(c => c.name === 'city')!.sortOrder).toBe('desc');
    expect(grid._memoryStats.stateTimers).toBe(0);
    expect(grid._memoryStats.pageHideListeners).toBe(0);
  });

  it('pagehide grava a rajada pendente', async () => {
    const grid = await makeGrid(g => {
      g.stateStorage = 'local';
      g.stateStorageKey = KEY;
      g.stateChangeDelay = 5000;
    });

    grid.searchText = 'City 5';
    await settle(grid);
    window.dispatchEvent(new PageTransitionEvent('pagehide'));

    expect(saved().searchText).toBe('City 5');
    expect(grid._memoryStats.stateTimers).toBe(0);
  });

  it.each([
    ['JSON quebrado', '{"version":1,'],
    ['tipo errado', '{"version":1,"columns":"year"}'],
    ['versão desconhecida', '{"version":99}'],
    ['protótipo', '{"version":1,"__proto__":{"polluted":true},"columns":[{"name":"year","__proto__":{"x":1},"width":-5}]}'],
    ['texto', '"<img src=x onerror=alert(1)>"'],
    ['enorme', JSON.stringify({ version: 1, selectedKeys: new Array(1_000_001).fill(1) })],
  ])('storage corrompido/malicioso (%s): aviso, estado inicial, render normal', async (_, text) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(KEY, text);

    const grid = await makeGrid(g => {
      g.stateStorage = 'local';
      g.stateStorageKey = KEY;
    });

    expect(warn).toHaveBeenCalled();
    expect(headerLabels(grid)).toEqual(['Id', 'Country', 'City', 'Year', 'Day']);
    expect(dataRows(grid).length).toBeGreaterThan(0);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(root(grid).querySelector('img')).toBeNull();
  });

  it('storage que lança (acesso negado) não quebra o grid', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    const grid = await makeGrid(g => {
      g.stateStorage = 'local';
      g.stateStorageKey = KEY;
    });

    grid.sortColumn(byPath(grid, 'year'), 'asc');
    await settle(grid);
    await wait(40);

    expect(dataRows(grid).length).toBeGreaterThan(0);
    expect(warn.mock.calls.map(([message]) => String(message)).join('\n')).toMatch(/could not read[\s\S]*could not write/);
  });

  it('sem chave: aviso e desligado', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await makeGrid(g => {
      g.stateStorage = 'local';
    });

    expect(warn.mock.calls.some(([message]) => String(message).includes('state-storage-key'))).toBe(true);
    expect(grid._memoryStats.pageHideListeners).toBe(0);
  });

  it('setState antes de conectar dispensa a leitura do storage', async () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, searchText: 'from storage' }));
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    const grid = await makeGrid(g => {
      g.stateStorage = 'local';
      g.stateStorageKey = KEY;
      g.setState({ version: 1, searchText: 'explicit' });
    });

    expect(grid.searchText).toBe('explicit');
    expect(getItem).not.toHaveBeenCalled();
  });

  it('trocar a chave relê; reconectar não relê', async () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, searchText: 'one' }));
    localStorage.setItem(`${KEY}-2`, JSON.stringify({ version: 1, searchText: 'two' }));

    const grid = await makeGrid(g => {
      g.stateStorage = 'local';
      g.stateStorageKey = KEY;
    });

    expect(grid.searchText).toBe('one');

    grid.searchText = 'typed';
    grid.remove();
    document.body.append(grid);
    await settle(grid);
    expect(grid.searchText).toBe('typed');

    grid.stateStorageKey = `${KEY}-2`;
    await settle(grid);
    expect(grid.searchText).toBe('two');
    localStorage.removeItem(`${KEY}-2`);
  });
});

describe('stateStorage próprio (assíncrono)', () => {
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  };

  it('enquanto carrega: sem linhas, aria-busy, rowcount -1, painel; depois o estado, sem piscar', async () => {
    const load = deferred<GridState | null>();
    const save = vi.fn();
    const storage: GridStateStorage = { load: () => load.promise, save };

    const grid = await makeGrid(g => {
      g.stateStorage = storage;
    });
    const table = root(grid).querySelector('table')!;

    expect(dataRows(grid)).toHaveLength(0);
    expect(root(grid).querySelector('.no-data-row')).toBeNull();
    expect(table.getAttribute('aria-busy')).toBe('true');
    expect(table.getAttribute('aria-rowcount')).toBe('-1');
    expect(root(grid).querySelector('[part~="load-panel"]')).not.toBeNull();
    expect(getComputedStyle(root(grid).querySelector('.scroll-container')!).visibility).toBe('hidden');
    expect((await axe.run(grid, { resultTypes: ['violations'] })).violations.map(v => v.id)).toEqual([]);

    load.resolve({ version: 1, columns: [{ name: 'year', sortOrder: 'desc' }] });
    await settle(grid);

    expect(table.getAttribute('aria-busy')).toBeNull();
    expect(root(grid).querySelector('[part~="load-panel"]')).toBeNull();
    expect(headerLabels(grid)[0]).toBe('Year');
    expect(dataRows(grid)[0].textContent).toContain('2004');

    await wait(40);
    expect(save).not.toHaveBeenCalled();

    grid.sortColumn(byPath(grid, 'year'), 'asc');
    await settle(grid);
    await wait(40);
    expect(save).toHaveBeenCalledTimes(1);
    expect((save.mock.calls[0][0] as GridState).columns![0].sortOrder).toBe('asc');
  });

  it('"Carregando" é anunciado uma vez só depois de 300 ms', async () => {
    const load = deferred<GridState | null>();
    const grid = await makeGrid(g => {
      g.stateStorage = { load: () => load.promise, save: () => undefined };
    });

    expect(liveRegion(grid).textContent).toBe('');
    await wait(400);
    expect(liveRegion(grid).textContent).toBe('Loading…');

    load.resolve(null);
    await settle(grid);
    expect(dataRows(grid).length).toBeGreaterThan(0);
    expect(grid._memoryStats.loadTimers).toBe(0);
  });

  it('load() que rejeita ou lança: aviso, estado inicial, render normal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rejected = await makeGrid(g => {
      g.stateStorage = { load: () => Promise.reject(new Error('offline')), save: () => undefined };
    });

    await settle(rejected);
    expect(dataRows(rejected).length).toBeGreaterThan(0);
    expect(root(rejected).querySelector('table')!.getAttribute('aria-busy')).toBeNull();

    const thrown = await makeGrid(g => {
      g.stateStorage = {
        load: () => {
          throw new Error('broken');
        },
        save: () => undefined,
      };
    });

    expect(dataRows(thrown).length).toBeGreaterThan(0);
    expect(warn.mock.calls.map(([message]) => String(message)).join('\n')).toMatch(/rejected[\s\S]*failed/);
  });

  it('setState durante a carga vence o que chegar depois', async () => {
    const load = deferred<GridState | null>();
    const grid = await makeGrid(g => {
      g.stateStorage = { load: () => load.promise, save: () => undefined };
    });

    grid.setState({ version: 1, searchText: 'City 4' });
    await settle(grid);
    load.resolve({ version: 1, searchText: 'late' });
    await settle(grid);

    expect(grid.searchText).toBe('City 4');
    expect(dataRows(grid).length).toBeGreaterThan(0);
  });

  it('save() que rejeita só avisa', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await makeGrid(g => {
      g.stateStorage = { load: () => null, save: () => Promise.reject(new Error('quota')) };
    });

    grid.sortColumn(byPath(grid, 'year'), 'asc');
    await settle(grid);
    await wait(40);

    expect(warn.mock.calls.some(([message]) => String(message).includes('save() failed'))).toBe(true);
  });
});

describe('acessibilidade da restauração', () => {
  it('foco no grid + setState que oculta a coluna ativa: foco realocado no grid, nada anunciado', async () => {
    const grid = await makeGrid();
    const cell = dataRows(grid)[1].querySelectorAll<HTMLElement>('td[role=gridcell]')[2];

    cell.focus();
    await settle(grid);
    const before = liveRegion(grid).textContent;

    grid.setState({ version: 1, columns: [{ name: 'city', visible: false }], searchText: 'City 1', filterValue: [['year', '>', 2000]] }, { partial: true });
    await settle(grid);
    await wait(50);

    expect(grid.shadowRoot!.activeElement).not.toBeNull();
    expect(grid.shadowRoot!.activeElement!.closest('table')).not.toBeNull();
    expect(liveRegion(grid).textContent).toBe(before);
  });

  it('foco fora do grid: setState não puxa o foco', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    const grid = await makeGrid();

    button.focus();
    grid.setState({ version: 1, columns: [{ name: 'year', sortOrder: 'asc' }, { name: 'country', groupIndex: 0 }] });
    await settle(grid);

    expect(document.activeElement).toBe(button);
    expect(liveRegion(grid).textContent).toBe('');
    button.remove();
  });

  it('filtro digitado pendente não sobrescreve nem anuncia depois do setState', async () => {
    const grid = await makeGrid(g => {
      g.showSearchPanel = true;
    });
    const input = root(grid).querySelector<HTMLInputElement>('.search-input')!;

    input.value = 'City 6';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    grid.setState({ version: 1, searchText: 'City 2' }, { partial: true });
    await wait(600);
    await settle(grid);

    expect(grid.searchText).toBe('City 2');
    expect(liveRegion(grid).textContent).toBe('');
  });

  it('popover do funil fecha quando o setState oculta a coluna dele', async () => {
    const grid = await makeGrid(g => {
      g.headerFilter = true;
    });

    root(grid).querySelectorAll<HTMLElement>('.header-filter-button')[2].click();
    await settle(grid);
    expect(root(grid).querySelector('[part~="header-filter"]')).not.toBeNull();

    grid.setState({ version: 1, columns: [{ name: 'city', visible: false }] }, { partial: true });
    await settle(grid);

    expect(root(grid).querySelector('[part~="header-filter"]')).toBeNull();
  });
});
