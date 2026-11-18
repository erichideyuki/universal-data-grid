/**
 * Vazamento de memória dos resumos e grupos (spec 07 + regra da spec 14):
 * resumos (definições, funções próprias, valores), estado de expansão, o
 * listener de `pointerdown` do menu do painel e o `Intl.ListFormat` não
 * podem segurar o grid, os `items`, as colunas nem o `summary`. Cada
 * cenário roda dentro de uma função e devolve só `WeakRef`s.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef, GridSummary } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { aliveAfterGc, expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, n) => ({
    region: `R${(n + seed) % 4}`,
    city: `C${(n * 7 + seed) % 9}`,
    amount: (n * 37 + seed) % 101,
  }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'region', label: 'Region', groupIndex: 0 },
  { path: 'city', label: 'City', groupIndex: 1, groupValueGetter: (item: { city: string }) => item.city.slice(0, 2) },
  { path: 'amount', label: 'Amount' },
];

const makeSummary = (): GridSummary => ({
  total: [{ column: 'amount', type: 'sum' }, { column: 'amount', type: values => values.length, label: 'N' }],
  group: [
    { column: 'amount', type: 'avg' },
    { column: 'amount', type: 'max', display: 'column' },
    { column: 'amount', type: 'count', display: 'footer' },
  ],
});

const press = async (grid: DataGrid, target: HTMLElement, key: string, init: KeyboardEventInit = {}): Promise<void> => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const chip = (grid: DataGrid) => grid.shadowRoot!.querySelector<HTMLElement>('.group')!;
const menuItems = (grid: DataGrid) => [...grid.shadowRoot!.querySelectorAll<HTMLElement>('[role=menuitem]')];

/** Usa os caminhos da frente: resumos, expansão por API e gesto, menu por teclado e mouse. */
const exercise = async (grid: DataGrid): Promise<void> => {
  const onExpansion = () => undefined;
  document.addEventListener('u-grid-group-expansion-change', onExpansion);

  grid.expandAllGroups();
  await settle(grid);
  grid.collapseAllGroups(1);
  grid.expandGroup(['R1', 'C1']);
  grid.shadowRoot!.querySelector<HTMLElement>('button.group-toggle')!.click();
  await settle(grid);
  grid.getSummaryValues();
  grid.getSummaryValues(['R0']);

  await press(grid, chip(grid), 'F10', { shiftKey: true });
  // "Recolher todos" (último item do menu do chip).
  menuItems(grid).at(-1)!.click();
  await settle(grid);
  chip(grid).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 10, clientY: 10 }));
  await settle(grid);
  await press(grid, menuItems(grid)[0], 'Escape');

  document.removeEventListener('u-grid-group-expansion-change', onExpansion);
};

describe('memória dos resumos e grupos', () => {
  it('grid com resumos, expansão e menu (aberto ao remover) é coletado com items, colunas e summary', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(400);
      const columns = makeColumns();
      const summary = makeSummary();
      const grid = await createGrid({ columns, items, height: '300px', configure: g => g.summary = summary });

      await exercise(grid);
      // Menu aberto na remoção: o listener do documento tem de sair no disconnect.
      await press(grid, chip(grid), 'ContextMenu');
      expect(menuItems(grid).length).toBeGreaterThan(0);
      grid.remove();

      return track({ grid, items, item: items[0], columns, rangeColumn: columns[1], summary, aggregator: summary.total![1].type as object });
    };

    await expectCollected(await scenario());
  });

  it('grid de vida longa: summary e items trocados são soltos', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(300), height: '300px', configure: g => g.summary = makeSummary() });

    const replace = async (): Promise<Tracked> => {
      const items = makeItems(300, 5);
      const summary = makeSummary();
      grid.items = items;
      grid.summary = summary;
      grid.expandAllGroups();
      await settle(grid);

      grid.items = makeItems(300, 9);
      grid.summary = makeSummary();
      await settle(grid);

      return track({ items, item: items[0], summary, aggregator: summary.total![1].type as object });
    };

    await expectCollected(await replace());
    expect(grid.isConnected).toBe(true);
  });

  it('usar repetidamente não cresce heap, listeners nem o mapa de expansão', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(2000), height: '300px', configure: g => g.summary = makeSummary() });
    let firstItems: Tracked | undefined;

    const round = async (n: number): Promise<void> => {
      const items = makeItems(2000, n);
      firstItems ??= track({ items });
      grid.items = items;
      grid.summary = makeSummary();
      await settle(grid);
      await exercise(grid);
    };

    for (let n = 0; n < 3; n++) {
      await round(n);
    }

    const statsBefore = grid._memoryStats;
    const before = await measureHeap();

    for (let n = 3; n < 25; n++) {
      await round(n);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(grid._memoryStats.expansion).toBeLessThanOrEqual(statsBefore.expansion);
    expect(grid._memoryStats.dragAndDrop).toBe(statsBefore.dragAndDrop);
    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
    expect(await aliveAfterGc(firstItems!)).toEqual([]);
  }, 120_000);
});
