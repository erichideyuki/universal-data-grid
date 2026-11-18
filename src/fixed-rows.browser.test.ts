/**
 * Frente 20: linhas fixas no topo e no fundo (`fixedTopItems` /
 * `fixedBottomItems`): render sticky, fora do row model, índices ARIA,
 * teclado (sequência visual, PageUp/PageDown por blocos), foco, exportação.
 */
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { DataGrid, GridColumnDef, GridFocusChangeEventDetail } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';

afterEach(cleanup);

interface Row {
  id: number;
  name: string;
  team: string;
  amount: number;
}

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Name ${id}`, team: `T${id % 3}`, amount: id * 10 }));

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'team', label: 'Team' },
  { path: 'amount', label: 'Amount', dataType: 'number' },
];

const topItems = (): Row[] => [{ id: -1, name: 'Target', team: 'ZZ', amount: 999 }, { id: -2, name: 'Last year', team: 'AA', amount: 1 }];
const bottomItems = (): Row[] => [{ id: -3, name: 'Average', team: 'MM', amount: 50 }];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;

const fixedRows = (grid: DataGrid, side: 'top' | 'bottom'): HTMLTableRowElement[] =>
  [...root(grid).querySelectorAll<HTMLTableRowElement>(`tbody.fixed-${side}-rows > tr`)];

const fixedNames = (grid: DataGrid, side: 'top' | 'bottom'): string[] =>
  fixedRows(grid, side).map(tr => tr.querySelectorAll('td[part~=cell]')[0].textContent.trim());

const active = (grid: DataGrid): HTMLElement => root(grid).activeElement as HTMLElement;

const key = async (grid: DataGrid, name: string, init: KeyboardEventInit = {}): Promise<void> => {
  active(grid).dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const create = (count = 50, configure?: (grid: DataGrid) => void, height = '400px'): Promise<DataGrid> => createGrid({
  columns: columns(),
  items: rows(count),
  height,
  configure: grid => {
    grid.fixedTopItems = topItems();
    grid.fixedBottomItems = bottomItems();
    grid.keyExpr = 'id';
    configure?.(grid);
  },
});

/** Linha (`<tr>`) da célula ativa. */
const activeRow = (grid: DataGrid): HTMLTableRowElement => active(grid).closest('tr')!;

const focusFirstHeader = async (grid: DataGrid): Promise<void> => {
  root(grid).querySelector<HTMLElement>('thead th[data-col]')!.focus();
  await settle(grid);
};

describe('linhas fixas: render', () => {
  it('ficam em rowgroups próprios, com nome, parts e índices na ordem visual', async () => {
    const grid = await create(5, g => g.summary = { total: [{ column: 'amount', type: 'sum' }] });

    const [topGroup, body, bottomGroup] = [...root(grid).querySelectorAll('table > tbody')];
    expect(topGroup.classList.contains('fixed-top-rows')).toBe(true);
    expect(body.classList.contains('body-rows')).toBe(true);
    expect(bottomGroup.classList.contains('fixed-bottom-rows')).toBe(true);
    expect(topGroup.getAttribute('role')).toBe('rowgroup');
    expect(topGroup.getAttribute('aria-label')).toBe('Pinned rows at top');
    expect(bottomGroup.getAttribute('aria-label')).toBe('Pinned rows at bottom');
    expect(topGroup.getAttribute('part')).toBe('fixed-top-row-group');
    expect(fixedRows(grid, 'top')[0].getAttribute('part')).toContain('fixed-row fixed-top-row');
    expect(fixedRows(grid, 'bottom')[0].getAttribute('part')).toContain('fixed-row fixed-bottom-row');

    expect(fixedNames(grid, 'top')).toEqual(['Target', 'Last year']);
    expect(fixedNames(grid, 'bottom')).toEqual(['Average']);

    // Cabeçalho (1), fixas do topo (2, 3), corpo (4..8), fixas do fundo (9), totais (10).
    const indices = [...root(grid).querySelectorAll('table tr[aria-rowindex]')].map(tr => Number(tr.getAttribute('aria-rowindex')));
    expect(indices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(root(grid).querySelector('table')!.getAttribute('aria-rowcount')).toBe('10');
    expect(fixedRows(grid, 'top')[0].hasAttribute('aria-selected')).toBe(false);
  });

  it('não entram em ordenação, filtro, agrupamento, paginação nem contagem', async () => {
    const grid = await create(30, g => {
      g.paging = true;
      g.pageSize = 10;
    });

    grid.sortColumn(grid.columns[0], 'desc');
    grid.searchText = 'Name 2';
    await settle(grid);
    expect(fixedNames(grid, 'top')).toEqual(['Target', 'Last year']);
    expect(fixedNames(grid, 'bottom')).toEqual(['Average']);
    expect(grid.getTotalCount()).toBe(11);
    // Sem realce da busca nas fixas.
    expect(root(grid).querySelector('tbody.fixed-rows .search-highlight')).toBeNull();

    grid.searchText = '';
    grid.pageIndex = 2;
    await settle(grid);
    expect(fixedNames(grid, 'top')).toEqual(['Target', 'Last year']);

    grid.groupColumn(grid.columns[1]);
    await settle(grid);
    expect(root(grid).querySelectorAll('tbody.fixed-rows .group-row')).toHaveLength(0);
    expect(fixedRows(grid, 'top')[0].getAttribute('aria-level')).toBe('1');
    expect(root(grid).querySelector('table')!.getAttribute('role')).toBe('treegrid');
  });

  it('ficam presas ao rolar (abaixo do cabeçalho e acima dos totais)', async () => {
    const grid = await create(500, g => g.summary = { total: [{ column: 'amount', type: 'sum' }] }, '700px');
    const thead = root(grid).querySelector('thead')!;
    const tfoot = root(grid).querySelector('tfoot')!;
    const [topGroup] = root(grid).querySelectorAll<HTMLElement>('tbody.fixed-top-rows');
    const [bottomGroup] = root(grid).querySelectorAll<HTMLElement>('tbody.fixed-bottom-rows');

    grid._scrollContainerRef.value!.scrollTop = 5000;
    await settle(grid);

    expect(Math.abs(topGroup.getBoundingClientRect().top - thead.getBoundingClientRect().bottom)).toBeLessThan(1);
    expect(Math.abs(bottomGroup.getBoundingClientRect().bottom - tfoot.getBoundingClientRect().top)).toBeLessThan(1);
  });

  it('ocupando mais da metade da área (zoom alto), deixam de ser sticky', async () => {
    const grid = await create(50, g => {
      g.fixedTopItems = rows(3);
      g.fixedBottomItems = rows(3);
    }, '256px');

    expect(root(grid).querySelector('.container')!.classList.contains('fixed-rows-scroll')).toBe(true);
    expect(getComputedStyle(root(grid).querySelector('tbody.fixed-top-rows')!).position).toBe('static');

    grid.style.height = '1200px';
    await settle(grid);
    await settle(grid);
    expect(root(grid).querySelector('.container')!.classList.contains('fixed-rows-scroll')).toBe(false);
  });

  it('não selecionam, não editam e não expandem; caixa e botões vazios mas navegáveis', async () => {
    const grid = await create(5, g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
      g.editMode = 'cell';
      g.allowEditing = true;
      g.allowRemoving = true;
    });
    const fixed = fixedRows(grid, 'top')[0];

    expect(fixed.querySelector('.selection-cell [role=checkbox]')).toBeNull();
    expect(fixed.querySelector('.selection-cell')!.getAttribute('role')).toBe('gridcell');
    expect(fixed.querySelector('.command-cell button')).toBeNull();
    expect(grid.editCell(-1, grid.columns[0])).toBe(false);

    const cell = fixed.querySelectorAll<HTMLElement>('td[part~=cell]')[0];
    cell.focus();
    await settle(grid);
    await key(grid, 'Enter');
    expect(root(grid).querySelector('.cell-editor')).toBeNull();
    await key(grid, ' ');
    expect(grid.selectedKeys).toEqual([]);

    grid.selectAll();
    await settle(grid);
    expect(grid.selectedKeys).toHaveLength(5);
  });
});

describe('linhas fixas: teclado e foco', () => {
  it('↓ do cabeçalho passa pelas fixas do topo, o corpo, as do fundo e os totais', async () => {
    const grid = await create(3, g => g.summary = { total: [{ column: 'amount', type: 'sum' }] });
    const events: GridFocusChangeEventDetail[] = [];
    grid.addEventListener('u-grid-focus-change', event => events.push(event.detail));
    await focusFirstHeader(grid);

    const visited: string[] = [];

    for (let i = 0; i < 7; i++) {
      await key(grid, 'ArrowDown');
      const tr = activeRow(grid);
      visited.push(tr.closest('tfoot') ? 'totals' : tr.querySelectorAll('td[part~=cell]')[0].textContent.trim());
    }

    expect(visited).toEqual(['Target', 'Last year', 'Name 0', 'Name 1', 'Name 2', 'Average', 'totals']);
    expect(events[0]).toMatchObject({ rowKey: -1, rowFixed: 'top', previousRowFixed: null, cellType: 'data' });
    expect(events.find(event => event.rowKey === 0)).toMatchObject({ rowFixed: null, previousRowFixed: 'top' });
    expect(events.find(event => event.rowKey === -3)).toMatchObject({ rowFixed: 'bottom' });

    // ↑ volta pelo mesmo caminho.
    await key(grid, 'ArrowUp');
    await key(grid, 'ArrowUp');
    expect(activeRow(grid).querySelectorAll('td[part~=cell]')[0].textContent).toBe('Name 2');
  });

  it('focusedRowKey é null numa fixa; focusCell com rowFixed foca a fixa', async () => {
    const grid = await create(5);

    expect(grid.focusCell(-2, grid.columns[1], { rowFixed: 'top' })).toBe(true);
    await settle(grid);
    expect(activeRow(grid).closest('tbody')!.classList.contains('fixed-top-rows')).toBe(true);
    expect(active(grid).textContent.trim()).toBe('AA');
    expect(grid.focusedRowKey).toBeNull();

    // Sem a opção, só o corpo.
    expect(grid.focusCell(-2)).toBe(false);
    expect(grid.focusCell(-3, undefined, { rowFixed: 'top' })).toBe(false);
    expect(grid.focusCell(2)).toBe(true);
    await settle(grid);
    expect(grid.focusedRowKey).toBe(2);
  });

  it('andar pelas fixas não muda a rolagem do corpo; voltar ao corpo revela a linha', async () => {
    const grid = await create(500, undefined, '600px');
    const scroller = grid._scrollContainerRef.value!;

    expect(grid.focusCell(200)).toBe(true);
    await settle(grid);
    const scrolled = scroller.scrollTop;
    expect(scrolled).toBeGreaterThan(0);

    expect(grid.focusCell(-1, undefined, { rowFixed: 'top' })).toBe(true);
    await settle(grid);
    await key(grid, 'ArrowDown');
    expect(scroller.scrollTop).toBe(scrolled);
    expect(grid.focusedRowKey).toBeNull();

    // ↓ na última fixa do topo vai à 1ª do corpo e rola ao começo.
    await key(grid, 'ArrowDown');
    expect(grid.focusedRowKey).toBe(0);
    expect(scroller.scrollTop).toBe(0);
  });

  it('a célula ativa nunca fica debaixo do que gruda (3+3 fixas e totais)', async () => {
    const grid = await create(300, g => {
      g.fixedTopItems = rows(3).map(row => ({ ...row, id: -10 - row.id }));
      g.fixedBottomItems = rows(3).map(row => ({ ...row, id: -20 - row.id }));
      g.summary = { total: [{ column: 'amount', type: 'sum' }] };
    }, '600px');

    const visible = (): boolean => {
      const cell = active(grid);
      const rect = cell.getBoundingClientRect();
      return grid.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('td, th') === cell;
    };

    expect(grid.focusCell(0)).toBe(true);
    await settle(grid);

    for (const name of ['ArrowDown', 'PageDown', 'PageDown', 'ArrowDown', 'PageUp', 'ArrowUp']) {
      await key(grid, name);
      expect(visible(), name).toBe(true);
    }

    await key(grid, 'End', { ctrlKey: true });
    expect(active(grid).closest('tfoot')).not.toBeNull();
    expect(visible()).toBe(true);
  });

  it('PageUp/PageDown andam por blocos sem atravessar um de uma vez', async () => {
    const grid = await create(200, g => g.summary = { total: [{ column: 'amount', type: 'sum' }] }, '700px');

    const where = (): string => {
      const tr = activeRow(grid);
      return tr.closest('tfoot') ? 'totals' : tr.closest('tbody.fixed-top-rows') ? 'top' : tr.closest('tbody.fixed-bottom-rows') ? 'bottom' : 'body';
    };

    expect(grid.focusCell(-1, undefined, { rowFixed: 'top' })).toBe(true);
    await settle(grid);
    await key(grid, 'PageDown');
    expect(where()).toBe('body');
    expect(grid.focusedRowKey).toBeGreaterThan(0);

    expect(grid.focusCell(199)).toBe(true);
    await settle(grid);
    await key(grid, 'PageDown');
    expect(where()).toBe('bottom');
    await key(grid, 'PageDown');
    expect(where()).toBe('totals');
    await key(grid, 'PageUp');
    expect(where()).toBe('bottom');
    await key(grid, 'PageUp');
    expect(where()).toBe('body');

    expect(grid.focusCell(0)).toBe(true);
    await settle(grid);
    await key(grid, 'PageUp');
    expect(where()).toBe('top');
    expect(active(grid).closest('tr')!.querySelectorAll('td[part~=cell]')[0].textContent).toBe('Last year');
    await key(grid, 'PageUp');
    expect(active(grid).closest('tr')!.querySelectorAll('td[part~=cell]')[0].textContent).toBe('Target');
  });

  it('a fixa focada que some passa o foco à mesma posição; lado vazio, à vizinha no corpo', async () => {
    const grid = await create(5);
    expect(grid.focusCell(-2, undefined, { rowFixed: 'top' })).toBe(true);
    await settle(grid);

    grid.fixedTopItems = [topItems()[0], { id: -9, name: 'New', team: 'NN', amount: 0 }];
    await settle(grid);
    expect(active(grid).textContent.trim()).toBe('New');

    grid.fixedTopItems = [];
    await settle(grid);
    expect(grid.focusedRowKey).toBe(0);
    expect(root(grid).activeElement).not.toBeNull();
  });

  it('Shift+↓ a partir de uma fixa seleciona só a linha de destino (âncora só no corpo)', async () => {
    const grid = await create(5, g => g.selectionMode = 'multiple');
    expect(grid.focusCell(-2, undefined, { rowFixed: 'top' })).toBe(true);
    await settle(grid);
    await key(grid, 'ArrowDown', { shiftKey: true });
    expect(grid.focusedRowKey).toBe(0);
    expect(grid.selectedKeys).toEqual([0]);
  });
});

describe('linhas fixas: exportação', () => {
  it('getExportData: topo antes do corpo, fundo antes dos totais; includeFixedRows e selectedOnly', async () => {
    const grid = await create(2, g => {
      g.summary = { total: [{ column: 'amount', type: 'sum' }] };
      g.selectionMode = 'multiple';
    });

    const data = await grid.getExportData();
    const labels = data.rows.map(row => row.rowType === 'data' ? `${row.texts[0]}:${row.fixed}` : row.rowType);
    expect(labels).toEqual(['Target:top', 'Last year:top', 'Name 0:null', 'Name 1:null', 'Average:bottom', 'total']);

    const without = await grid.getExportData({ includeFixedRows: false });
    expect(without.rows.map(row => row.rowType)).toEqual(['data', 'data', 'total']);

    grid.selectRows([1]);
    const selected = await grid.getExportData({ selectedOnly: true });
    expect(selected.rows.filter(row => row.rowType === 'data')).toHaveLength(1);
  });

  it('Ctrl+C numa célula fixa copia a célula', async () => {
    const grid = await create(2);
    fixedRows(grid, 'top')[0].querySelectorAll<HTMLElement>('td[part~=cell]')[1].focus();
    await settle(grid);

    let text = '';

    const listener = (event: ClipboardEvent) => {
      text = event.clipboardData!.getData('text/plain');
    };

    document.addEventListener('copy', listener);

    try {
      await userEvent.keyboard('{Control>}c{/Control}');
    } finally {
      document.removeEventListener('copy', listener);
    }

    expect(text).toBe('ZZ');
  });
});

describe('linhas fixas: axe', () => {
  for (const [label, configure] of [
    ['simples', (grid: DataGrid) => grid.summary = { total: [{ column: 'amount', type: 'sum' }] }],
    [
      'agrupado com caixas', (grid: DataGrid) => {
        grid.selectionMode = 'multiple';
        grid.showCheckboxes = true;
        grid.columns = [{ ...columns()[0] }, { ...columns()[1], groupIndex: 0 }, columns()[2]];
      },
    ],
    ['RTL', (grid: DataGrid) => grid.setAttribute('dir', 'rtl')],
  ] as const) {
    it(`sem violações: ${label}`, async () => {
      const grid = await create(5, configure);
      const result = await axe.run(grid, { resultTypes: ['violations'] });
      expect(result.violations.map(violation => violation.id)).toEqual([]);
    });
  }
});

describe('linhas fixas: roteiros extras', () => {
  it('sem sticky (zoom alto): focar uma fixa com o corpo rolado não a deixa sob o cabeçalho', async () => {
    const grid = await create(300, g => {
      g.fixedTopItems = rows(3).map(row => ({ ...row, id: -10 - row.id }));
      g.fixedBottomItems = rows(3).map(row => ({ ...row, id: -20 - row.id }));
      g.summary = { total: [{ column: 'amount', type: 'sum' }] };
    }, '300px');
    expect(root(grid).querySelector('.container')!.classList.contains('fixed-rows-scroll')).toBe(true);

    expect(grid.focusCell(150)).toBe(true);
    await settle(grid);

    const visible = (): boolean => {
      const cell = active(grid);
      const rect = cell.getBoundingClientRect();
      return grid.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('td, th') === cell;
    };

    expect(grid.focusCell(-11, undefined, { rowFixed: 'top' })).toBe(true);
    await settle(grid);
    await settle(grid);
    expect(visible()).toBe(true);

    expect(grid.focusCell(-21, undefined, { rowFixed: 'bottom' })).toBe(true);
    await settle(grid);
    await settle(grid);
    expect(visible()).toBe(true);
  });

  it('com paginação, PageDown numa fixa não troca de página', async () => {
    const grid = await create(100, g => {
      g.paging = true;
      g.pageSize = 10;
    }, '700px');
    expect(grid.focusCell(-1, undefined, { rowFixed: 'top' })).toBe(true);
    await settle(grid);
    await key(grid, 'PageDown');
    expect(grid.pageIndex).toBe(0);
    expect(activeRow(grid).closest('tbody.body-rows')).not.toBeNull();
  });

  it('com edição ligada, as células fixas são aria-readonly', async () => {
    const grid = await create(3, g => {
      g.allowEditing = true;
    });
    expect(fixedRows(grid, 'top')[0].querySelector('td[part~=cell]')!.getAttribute('aria-readonly')).toBe('true');
  });
});

describe('linhas fixas: barra e menu de contexto (frente 18)', () => {
  it('sem menu de contexto nas fixas (fica o do navegador); no corpo continua', async () => {
    const grid = await create(5, g => g.rowMenu = true, '700px');
    let opened = 0;
    grid.addEventListener('u-grid-context-menu-opening', () => opened++);

    const fire = (target: HTMLElement): MouseEvent => {
      const event = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 40, clientY: 40 });
      target.dispatchEvent(event);
      return event;
    };

    const fixedEvent = fire(fixedRows(grid, 'top')[0].querySelector<HTMLElement>('td[part~=cell]')!);
    await settle(grid);
    expect(opened).toBe(0);
    expect(fixedEvent.defaultPrevented).toBe(false);

    fire(root(grid).querySelector<HTMLElement>('tbody.body-rows td[part~=cell]')!);
    await settle(grid);
    expect(opened).toBe(1);
    await key(grid, 'Escape');

    expect(grid.focusCell(-1, undefined, { rowFixed: 'top' })).toBe(true);
    await settle(grid);
    await key(grid, 'F10', { shiftKey: true });
    expect(opened).toBe(1);
    expect(root(grid).querySelector('[role=menu]')).toBeNull();
  });

  it('com a barra (busca e exportação): as fixas do topo prendem logo abaixo do cabeçalho', async () => {
    const grid = await create(500, g => {
      g.showSearchPanel = true;
      g.exportFormats = ['csv'];
    }, '800px');
    const thead = root(grid).querySelector('thead')!;
    const topGroup = root(grid).querySelector<HTMLElement>('tbody.fixed-top-rows')!;

    grid._scrollContainerRef.value!.scrollTop = 4000;
    await settle(grid);
    expect(Math.abs(topGroup.getBoundingClientRect().top - thead.getBoundingClientRect().bottom)).toBeLessThan(1);

    // A busca da barra não filtra as fixas.
    grid.searchText = 'Name 3';
    await settle(grid);
    expect(fixedNames(grid, 'top')).toEqual(['Target', 'Last year']);
  });
});
