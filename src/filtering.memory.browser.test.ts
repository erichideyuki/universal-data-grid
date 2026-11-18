/**
 * Vazamento de memória do filtro (spec 04 + regra da spec 14): timers de
 * digitação (linha de filtro e busca), a filtragem em fatias, os listeners
 * de documento do menu de operação e do popover do cabeçalho e o estado por
 * coluna não podem segurar o grid, os `items` nem as colunas. Cada cenário
 * roda dentro de uma função e devolve só `WeakRef`s (ver `src/test/leak.ts`);
 * só eventos sintéticos.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { SYNC_FILTER_LIMIT } from './features/filtering.js';
import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { aliveAfterGc, expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, n) => ({
    name: `Name ${(n * 7919 + seed) % count}`,
    city: ['Lima', 'Rio', 'São Paulo'][n % 3],
    amount: (n * 37 + seed) % 101,
  }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'city', label: 'City' },
  { path: 'amount', label: 'Amount' },
];

const root = (grid: DataGrid) => grid.shadowRoot!;

const click = (target: Element) => target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));

const input = (target: HTMLInputElement, value: string) => {
  target.value = value;
  target.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};

const header = (grid: DataGrid, label: string) =>
  [...root(grid).querySelectorAll<HTMLElement>('th.header-column')].find(th => th.querySelector('.header-text')!.textContent === label)!;

const configure = (grid: DataGrid) => {
  grid.showFilterRow = true;
  grid.showSearchPanel = true;
  grid.headerFilter = true;
};

/** Usa todos os caminhos do filtro e deixa timers, menu e popover pendentes. */
const exerciseFilter = async (grid: DataGrid): Promise<void> => {
  const onChange = () => undefined;
  document.addEventListener('u-grid-filter-change', onChange);

  const editor = root(grid).querySelector<HTMLInputElement>('tr.filter-row .filter-editor')!;
  const search = root(grid).querySelector<HTMLInputElement>('.search-input')!;

  input(editor, 'Name 1');
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
  await settle(grid);

  click(header(grid, 'City').querySelector('.header-filter-button')!);
  await settle(grid);
  root(grid).querySelector<HTMLInputElement>('.header-filter-list input')!.click();
  click(root(grid).querySelector('.header-filter-ok')!);
  await settle(grid);

  grid.getCombinedFilter();
  grid.clearFilter();
  await settle(grid);

  // Pendentes na remoção: debounce da linha e da busca, menu e popover abertos.
  input(editor, 'Name 2');
  input(search, 'lima');
  click(root(grid).querySelector('.filter-operation-button')!);
  await settle(grid);
  click(header(grid, 'Amount').querySelector('.header-filter-button')!);
  await settle(grid);

  expect(grid._memoryStats.filterTimers).toBeGreaterThan(0);
  expect(grid._memoryStats.headerFilterOpen).toBe(1);

  document.removeEventListener('u-grid-filter-change', onChange);
};

describe('memória do filtro', () => {
  it('grid filtrado (linha, menu, cabeçalho, busca, API) e removido com timers pendentes é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(300);
      const columns = makeColumns();
      const grid = await createGrid({ columns, items, height: '300px', configure });

      await exerciseFilter(grid);
      grid.remove();
      expect(grid._memoryStats.filterTimers).toBe(0);

      return track({ grid, items, item: items[0], columns, column: columns[1] });
    };

    await expectCollected(await scenario());
  });

  it('grid removido no meio de uma filtragem em fatias é coletado (o timer da fatia é solto)', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(SYNC_FILTER_LIMIT + 50_000);
      const grid = await createGrid({ columns: makeColumns(), items, height: '300px' });

      grid.searchText = 'lima';
      await new Promise(resolve => requestAnimationFrame(resolve));
      grid.searchText = 'rio';
      grid.remove();
      expect(grid._memoryStats.filterTimers).toBe(0);

      return track({ grid, items });
    };

    await expectCollected(await scenario());
  });

  it('grid de vida longa: colunas removidas saem do estado da linha de filtro e do popover', async () => {
    const columns = makeColumns();
    const grid = await createGrid({ columns, items: makeItems(200), height: '300px', configure });

    const dropColumn = async (): Promise<Tracked> => {
      const extra: GridColumnDef = { path: 'amount', label: 'Extra', filterOperations: ['=', '<'] };
      grid.columns = [...columns, extra];
      await settle(grid);

      const cells = root(grid).querySelectorAll('tr.filter-row td.filter-cell');
      const editor = cells[cells.length - 1].querySelector<HTMLInputElement>('.filter-editor')!;

      input(editor, '5');
      click(header(grid, 'Extra').querySelector('.header-filter-button')!);
      await settle(grid);

      grid.columns = columns;
      await settle(grid);

      expect(grid._memoryStats.filterRowState).toBe(0);
      expect(grid._memoryStats.filterTimers).toBe(0);
      expect(grid._memoryStats.headerFilterOpen).toBe(0);

      return track({ extra });
    };

    await expectCollected(await dropColumn());
  });

  it('filtrar repetidamente num grid de vida longa não cresce heap, nós nem listeners', async () => {
    const columns = makeColumns();
    const grid = await createGrid({ columns, items: makeItems(2000), height: '300px', configure });
    let firstItems: Tracked | undefined;

    const round = async (n: number): Promise<void> => {
      const items = makeItems(2000, n);
      firstItems ??= track({ items });
      grid.items = items;
      grid.filterValue = [['amount', '>', n % 50], 'and', ['city', 'anyof', ['Lima', 'Rio']]];
      grid.searchText = `Name ${n}`;
      await settle(grid);

      click(header(grid, 'City').querySelector('.header-filter-button')!);
      await settle(grid);
      click(root(grid).querySelector('.header-filter-cancel')!);
      click(root(grid).querySelector('.filter-operation-button')!);
      await settle(grid);
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      grid.clearFilter();
      await settle(grid);
    };

    for (let n = 0; n < 3; n++) {
      await round(n);
    }

    const statsBefore = grid._memoryStats;
    const before = await measureHeap();

    for (let n = 3; n < 30; n++) {
      await round(n);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(grid._memoryStats.filterRowState).toBeLessThanOrEqual(statsBefore.filterRowState);
    expect(grid._memoryStats.filterTimers).toBe(0);
    expect(grid._memoryStats.headerFilterOpen).toBe(0);
    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
    expect(await aliveAfterGc(firstItems!)).toEqual([]);
  }, 120_000);
});
