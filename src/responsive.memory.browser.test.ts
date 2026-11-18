/**
 * Vazamento de memória da frente 21 (regra da spec 14): o responsivo usa o
 * `ResizeObserver` que o grid já tem (solto no disconnect) e um temporizador
 * do anúncio (limpo no disconnect). Grid redimensionado, com linhas
 * adaptativas abertas e renderer com `HTMLElement`/`signal`, é coletado com
 * colunas, itens e renderers; redimensionar muitas vezes num grid de vida
 * longa não cresce.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, type Tracked, track } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, n) => ({ id: n + seed, name: `Name ${n + seed}`, city: `City ${n}`, amount: n, note: `Note ${n}` }));

type Item = ReturnType<typeof makeItems>[number];

const makeColumns = (aborted: { count: number }): GridColumnDef<Item>[] => [
  { path: 'id', label: 'Id', width: 120 },
  { path: 'name', label: 'Name', width: 160 },
  { path: 'city', label: 'City', width: 160, hidingPriority: 1 },
  {
    path: 'amount',
    label: 'Amount',
    width: 160,
    hidingPriority: 0,
    renderer: (item, ctx) => {
      const element = document.createElement('b');
      element.textContent = String(item.amount);
      ctx.signal.addEventListener('abort', () => {
        aborted.count++;
      });
      return element;
    },
  },
  { path: 'note', label: 'Note', width: 160, hidingPriority: 2 },
];

const resize = async (grid: DataGrid, width: number): Promise<void> => {
  grid.style.width = `${width}px`;
  await settle(grid);
  await settle(grid);
};

const exercise = async (grid: DataGrid): Promise<void> => {
  await resize(grid, 360);
  grid.expandRow(grid.items[0]);
  grid.expandRow(grid.items[2]);
  await settle(grid);
  grid.focusCell(grid.items[0], 'amount');
  await settle(grid);
  await resize(grid, 1200);
  await resize(grid, 500);
  grid.collapseRow(grid.items[2]);
  await settle(grid);
};

describe('memória do responsivo', () => {
  it('grid redimensionado com linhas adaptativas é coletado; temporizador e light DOM limpos', async () => {
    const aborted = { count: 0 };

    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(500);
      const columns = makeColumns(aborted);
      const grid = await createGrid({
        columns,
        items,
        setBeforeConnect: true,
        configure: g => {
          g.style.width = '1200px';
          g.autoHideColumns = true;
        },
      });

      await exercise(grid);
      expect(grid.getAdaptiveColumns().length).toBeGreaterThan(0);
      grid.remove();
      expect(grid._memoryStats.adaptiveTimers).toBe(0);
      expect(grid._memoryStats.observedDetails).toBe(0);
      expect(grid.querySelectorAll('[slot]')).toHaveLength(0);

      return track({ grid, items, item: items[0], columns, column: columns[3] });
    };

    await expectCollected(await scenario());
    expect(aborted.count).toBeGreaterThan(0);
  });

  it('redimensionar muitas vezes num grid de vida longa não cresce heap, nós nem listeners', async () => {
    const grid = await createGrid({
      columns: makeColumns({ count: 0 }),
      items: makeItems(2000),
      setBeforeConnect: true,
      configure: g => {
        g.style.width = '1200px';
        g.autoHideColumns = true;
      },
    });

    for (let n = 0; n < 2; n++) {
      await exercise(grid);
    }

    const lightBefore = grid.childElementCount;
    const before = await measureHeap();

    for (let n = 0; n < 8; n++) {
      await exercise(grid);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(grid.childElementCount).toBe(lightBefore);
    expect(grid._memoryStats.adaptiveColumns).toBeLessThanOrEqual(6);
    expect(delta.jsHeapUsed, report).toBeLessThan(768 * 1024);
    expect(delta.nodes, report).toBeLessThan(60);
    expect(delta.listeners, report).toBeLessThan(30);
  }, 180_000);
});
