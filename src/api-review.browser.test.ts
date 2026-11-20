/**
 * Revisão da API pública (spec 15): nomes novos, aliases antigos com aviso
 * de deprecação, eventos e parts novos.
 */
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import { resolveGridTranslation, setGridTranslation } from './grid-i18n.js';
import type {
  DataGrid,
  GridColumnFixedChangeEventDetail,
  GridColumnReorderEventDetail,
  GridGroupEventDetail,
  GridSortEventDetail,
} from './grid.js';
import { cleanup, createGrid, headerLabels, settle } from './test/fixture.js';
import { expectCollected, track, type Tracked } from './test/leak.js';

let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
  cleanup();
});

const columns = (): GridColumnDef[] => [
  { path: 'a', label: 'A' },
  { path: 'b', label: 'B' },
  { path: 'c', label: 'C' },
];

const items = () => [{ a: 2, b: 'x', c: true }, { a: 1, b: 'y', c: false }];

/** Grid declarativo a partir de HTML (atributos como o autor da página escreveria). */
const fromMarkup = async (markup: string): Promise<DataGrid> => {
  const host = document.createElement('div');
  host.innerHTML = markup;
  const grid = host.querySelector('u-grid')!;
  grid.style.cssText = 'display:block;height:300px';
  document.body.append(grid);
  grid.items = items();
  await settle(grid);
  return grid;
};

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const warned = (text: string) => warn.mock.calls.filter(([message]) => String(message).includes(text)).length;

describe('atributos do <u-grid>', () => {
  it('kebab-case: row-height, show-row-lines, show-column-lines', async () => {
    const grid = await fromMarkup('<u-grid row-height="40" show-row-lines="false" show-column-lines></u-grid>');

    expect([grid.rowHeight, grid.showRowLines, grid.showColumnLines]).toEqual([40, false, true]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('atributos minúsculos antigos ainda funcionam, com aviso uma vez por instância', async () => {
    const grid = await fromMarkup('<u-grid rowheight="36" showrowlines="false" showcolumnlines></u-grid>');

    expect([grid.rowHeight, grid.showRowLines, grid.showColumnLines]).toEqual([36, false, true]);
    expect(warned('"rowheight attribute" is deprecated')).toBe(1);
    expect(warned('"showrowlines attribute" is deprecated')).toBe(1);

    grid.setAttribute('rowheight', '50');
    expect(grid.rowHeight).toBe(50);
    expect(warned('"rowheight attribute" is deprecated')).toBe(1);
  });

  it('booleanos com padrão true desligam com "false"; sem atributo = padrão', async () => {
    const grid = await fromMarkup('<u-grid show-group-panel="false" show-column-headers="false"></u-grid>');

    expect([grid.showGroupPanel, grid.showColumnHeaders, grid.showRowLines]).toEqual([false, false, true]);
    expect(root(grid).querySelector('.group-container')).toBeNull();
    expect(root(grid).querySelector('thead')).toBeNull();

    grid.setAttribute('show-group-panel', '');
    expect(grid.showGroupPanel).toBe(true);
    grid.setAttribute('show-group-panel', 'false');
    grid.removeAttribute('show-group-panel');
    expect(grid.showGroupPanel).toBe(true);

    grid.setAttribute('striped', 'false');
    expect(grid.striped).toBe(false);
    grid.setAttribute('striped', '');
    expect(grid.striped).toBe(true);
  });

  it('items não tem atributo', async () => {
    const host = document.createElement('div');
    host.innerHTML = '<u-grid items=\'[{"a":1}]\'></u-grid>';
    const grid = host.querySelector('u-grid')!;
    document.body.append(grid);
    await settle(grid);

    expect(grid.items).toEqual([]);
  });

  it('sortMode / sort-mode; sorting é alias com aviso', async () => {
    const grid = await fromMarkup('<u-grid sort-mode="multiple"></u-grid>');
    expect(grid.sortMode).toBe('multiple');

    grid.sorting = 'none';
    expect(grid.sortMode).toBe('none');
    expect(grid.sorting).toBe('none');
    expect(warned('"sorting" is deprecated, use "sortMode"')).toBe(1);

    const legacy = await fromMarkup('<u-grid sorting="multiple"></u-grid>');
    expect(legacy.sortMode).toBe('multiple');
  });
});

describe('atributos do <u-grid-column>', () => {
  it('type no lugar de data-type; data-type ainda funciona, com aviso', async () => {
    const grid = await fromMarkup(`
      <u-grid>
        <u-grid-column path="a" type="number">A</u-grid-column>
        <u-grid-column path="b" data-type="string">B</u-grid-column>
      </u-grid>`);
    const [a, b] = grid.querySelectorAll('u-grid-column');

    expect([a.dataType, b.dataType]).toEqual(['number', 'string']);
    expect(warned('"data-type attribute" is deprecated, use "type attribute"')).toBe(1);
  });

  it('wrap="false" desliga', async () => {
    const grid = await fromMarkup('<u-grid><u-grid-column path="a" wrap="false">A</u-grid-column></u-grid>');

    expect(grid.querySelector('u-grid-column')!.wrap).toBe(false);
  });

  it('mudar groupIndex depois de renderizada reagrupa, com aviso e sem u-grid-group-change', async () => {
    const grid = await fromMarkup('<u-grid><u-grid-column path="a">A</u-grid-column><u-grid-column path="b">B</u-grid-column></u-grid>');
    const column = grid.querySelector('u-grid-column')!;
    const events: Event[] = [];
    grid.addEventListener('u-grid-group-change', event => events.push(event));

    column.groupIndex = 0;
    await settle(grid);
    expect(grid.getGrouping()).toEqual([column]);
    expect(warned('changing groupIndex after the column is rendered')).toBe(1);

    column.groupIndex = null;
    await settle(grid);
    expect(grid.getGrouping()).toEqual([]);
    expect(events).toEqual([]);
  });
});

describe('métodos', () => {
  it('sortColumn; sortBy é alias com aviso; source no detail', async () => {
    const grid = await createGrid({ columns: columns(), items: items() });
    const details: GridSortEventDetail[] = [];
    grid.addEventListener('u-grid-sort-change', event => details.push(event.detail));

    grid.sortColumn(grid.columns[0], 'asc');
    grid.sortBy(grid.columns[0], 'desc');

    expect(grid.getSorting()).toEqual([{ column: grid.columns[0], order: 'desc' }]);
    expect(details.map(detail => detail.source)).toEqual(['api', 'api']);
    expect(warned('"sortBy()" is deprecated, use "sortColumn()"')).toBe(1);

    root(grid).querySelectorAll<HTMLElement>('th.header-column')[1].click();
    await settle(grid);
    expect(details.at(-1)?.source).toBe('user');
  });

  it('groupColumn (índice opcional), ungroupColumn, getGrouping e u-grid-group-change', async () => {
    const grid = await createGrid({ columns: columns(), items: items() });
    const [a, b] = grid.columns;
    const details: GridGroupEventDetail[] = [];
    grid.addEventListener('u-grid-group-change', event => details.push(event.detail));

    grid.groupColumn(a);
    grid.groupColumn(b);
    grid.groupColumn(b, 0);
    await settle(grid);

    const grouping = grid.getGrouping();
    expect(grouping).toEqual([b, a]);
    grouping.pop();
    expect(grid.getGrouping()).toEqual([b, a]);

    grid.ungroupColumn(b);
    grid.ungroupColumn(b);
    await settle(grid);
    expect(grid.getGrouping()).toEqual([a]);
    expect(headerLabels(grid)).toEqual(['C', 'B']);

    grid.moveColumn(a, 0);
    await settle(grid);
    expect(grid.getGrouping()).toEqual([]);

    expect(details.map(({ grouping: now, previous, source }) => [now.length, previous.length, source])).toEqual([
      [1, 0, 'api'],
      [2, 1, 'api'],
      [2, 2, 'api'],
      [1, 2, 'api'],
      [0, 1, 'api'],
    ]);

    grid._userGroupColumn(a, 0);
    expect(details.at(-1)).toEqual({ grouping: [a], previous: [], source: 'user' });
  });

  it('openColumnChooser / closeColumnChooser; showColumnChooser é alias com aviso', async () => {
    const grid = await createGrid({ columns: columns(), items: items() });
    const chooser = () => root(grid).querySelector('.column-chooser');

    grid.openColumnChooser();
    await settle(grid);
    expect(chooser()).not.toBeNull();

    grid.closeColumnChooser();
    await settle(grid);
    expect(chooser()).toBeNull();

    grid.showColumnChooser();
    await settle(grid);
    expect(chooser()).not.toBeNull();
    expect(warned('"showColumnChooser()" is deprecated, use "openColumnChooser()"')).toBe(1);
  });
});

/** Fixa pelo submenu "Fixar coluna ▸" do menu do cabeçalho (o seletor não tem mais botões de fixar). */
const pinFromMenu = async (grid: DataGrid, column: GridColumnDef, side: 'Pin to start' | 'Pin to end' | 'Unpin'): Promise<void> => {
  grid.openContextMenu({ column });
  await settle(grid);
  const parent = [...root(grid).querySelectorAll<HTMLElement>('.context-menu-panel [role=menuitem]')].find(item => item.textContent.trim() === 'Pin column')!;
  parent.click();
  await settle(grid);
  [...root(grid).querySelectorAll<HTMLElement>('.context-menu-panel-submenu [role=menuitemradio]')].find(item => item.textContent.trim() === side)!.click();
  await settle(grid);
};

describe('eventos', () => {
  it('u-grid-column-fixed-change ao fixar pelo menu do cabeçalho', async () => {
    const grid = await createGrid({ columns: columns(), items: items() });
    const details: GridColumnFixedChangeEventDetail[] = [];
    grid.addEventListener('u-grid-column-fixed-change', event => details.push(event.detail));

    await pinFromMenu(grid, grid.columns[0], 'Pin to end');

    expect(details).toEqual([{ column: grid.columns[0], fixed: 'end', previousFixed: null }]);
  });

  it('u-grid-column-reorder traz index e previousIndex (fromIndex/toIndex seguem)', async () => {
    const grid = await createGrid({ columns: columns(), items: items() });
    const details: GridColumnReorderEventDetail[] = [];
    grid.addEventListener('u-grid-column-reorder', event => details.push(event.detail));

    grid._userMoveColumn(grid.columns[2], 0);

    expect(details).toEqual([{ column: grid.columns[2], band: null, index: 0, previousIndex: 2, fromIndex: 2, toIndex: 0 }]);
  });
});

describe('CSS', () => {
  it('part="cell" em toda célula de dados; vazio só com no-data', async () => {
    const grid = await createGrid({ columns: columns(), items: items() });

    expect(root(grid).querySelectorAll('td[part="cell"]')).toHaveLength(6);

    grid.items = [];
    await settle(grid);
    expect(root(grid).querySelector('[part~="cell"]')).toBeNull();
    expect(root(grid).querySelector('[part="no-data"]')).not.toBeNull();
  });

  it('custom properties novas e antigas (fallback)', async () => {
    const grid = await createGrid({ columns: columns(), items: items() });
    const td = () => getComputedStyle(root(grid).querySelector('td[part="cell"]')!);
    const th = () => getComputedStyle(root(grid).querySelector('th')!);

    grid.style.setProperty('--u-td-font-size', '11px');
    grid.style.setProperty('--u-th-font-size', '9px');
    expect([td().fontSize, th().fontSize]).toEqual(['11px', '9px']);

    grid.style.setProperty('--u-grid-cell-font-size', '13px');
    grid.style.setProperty('--u-grid-header-cell-font-size', '12px');
    grid.style.setProperty('--u-grid-header-cell-height', '60px');
    expect([td().fontSize, th().fontSize, th().height]).toEqual(['13px', '12px', '60px']);

    grid.style.setProperty('--u-grid-header-height', '70px');
    const host = getComputedStyle(root(grid).querySelector('.container')!);
    expect(host.getPropertyValue('--_header-height').trim()).toBe('70px');
    expect(th().height).toBe('60px');

    grid.style.setProperty('--u-grid-toolbar-height', '64px');
    expect(getComputedStyle(root(grid).querySelector('.container')!).getPropertyValue('--_header-height')
      .trim()).toBe('64px');
  });

  // Regressão: o tema do Universal Material define --u-table-cell-padding no :root e ele anulava o longhand novo.
  it('longhands de padding vencem os atalhos antigos (tema no :root)', async () => {
    const page = document.documentElement.style;
    page.setProperty('--u-table-cell-padding', '13px 16px');

    try {
      const grid = await createGrid({ columns: columns(), items: items() });
      const td = () => getComputedStyle(root(grid).querySelector('td[part="cell"]')!);
      const th = () => getComputedStyle(root(grid).querySelector('th')!);

      // Sem longhand o atalho antigo vale.
      page.setProperty('--u-table-cell-padding', '10px 20px');
      expect([td().padding, th().padding]).toEqual(['10px 20px', '10px 20px']);

      grid.style.setProperty('--u-grid-cell-block-padding', '6px');
      expect([td().padding, th().padding]).toEqual(['6px 16px', '6px 16px']);

      grid.style.removeProperty('--u-grid-cell-block-padding');
      grid.style.setProperty('--u-grid-cell-inline-padding', '8px');
      expect(td().padding).toBe('13px 8px');

      // Também vence o atalho antigo das células de dados; o atalho novo vence tudo.
      grid.style.setProperty('--u-grid-data-cell-padding', '1px');
      expect(td().padding).toBe('13px 8px');
      grid.style.setProperty('--u-grid-cell-padding', '2px 3px');
      expect(td().padding).toBe('2px 3px');
    } finally {
      page.removeProperty('--u-table-cell-padding');
    }
  });
});

describe('i18n', () => {
  it('chaves renomeadas; setGridTranslation aceita as antigas com aviso', async () => {
    setGridTranslation('x-legacy', { pinStart: 'P0', unpin: 'U0', clearSorting: 'C0' });
    setGridTranslation('x-legacy', { pinEnd: 'P1', fixEnd: 'F1' });

    const grid = await createGrid({ columns: columns(), items: items(), configure: g => g.language = 'x-legacy' });
    grid.openContextMenu({ column: grid.columns[0] });
    await settle(grid);
    root(grid).querySelector<HTMLElement>('.context-menu-panel [aria-haspopup=menu]')!.click();
    await settle(grid);

    const radios = [...root(grid).querySelectorAll<HTMLElement>('.context-menu-panel-submenu [role=menuitemradio]')].map(item => item.textContent.trim());
    expect(radios.slice(0, 2)).toEqual(['P0', 'F1']);
    expect(warned('"pinStart" is deprecated, use "fixStart"')).toBe(1);
  });

  it('groupPanelMenu → groupPanelMenuLabel: alias com aviso; a nova vence', () => {
    setGridTranslation('x-legacy-menu', { groupPanelMenu: 'Old menu' });
    setGridTranslation('x-legacy-menu-both', { groupPanelMenu: 'Old', groupPanelMenuLabel: 'New' });

    expect(resolveGridTranslation('x-legacy-menu').groupPanelMenuLabel).toBe('Old menu');
    expect(resolveGridTranslation('x-legacy-menu-both').groupPanelMenuLabel).toBe('New');
    expect('groupPanelMenu' in resolveGridTranslation('x-legacy-menu')).toBe(false);
    expect(warned('"groupPanelMenu" is deprecated, use "groupPanelMenuLabel"')).toBe(1);
  });
});

describe('memória', () => {
  it('grid usado com a API nova e removido é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const grid = await createGrid({ columns: columns(), items: items(), configure: g => g.columnChooser = true });
      const listener = () => undefined;
      grid.addEventListener('u-grid-group-change', listener);
      grid.addEventListener('u-grid-column-fixed-change', listener);

      grid.groupColumn(grid.columns[0]);
      grid.sortColumn(grid.columns[1], 'desc');
      await pinFromMenu(grid, grid.columns[2], 'Pin to end');
      grid.openColumnChooser();
      await settle(grid);
      grid.closeColumnChooser();
      grid.ungroupColumn(grid.columns[0]);
      await settle(grid);

      const tracked = track({ grid, column: grid.columns[0] });
      grid.remove();
      return tracked;
    };

    await expectCollected(await scenario());
  });
});
