/**
 * Vazamento de memória da frente 20 (regra da spec 14): linhas fixas e
 * linhas inteiras (`rowRenderer` com `HTMLElement` no light DOM e
 * `signal`) não podem segurar o grid, os itens nem os renderers; num grid
 * de vida longa os resultados do `rowRenderer` ficam limitados às linhas
 * renderizadas. Cada cenário roda numa função e devolve só `WeakRef`s.
 */
import { html } from 'lit';

import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef, GridRowRenderer } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { aliveAfterGc, expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, n) => ({ id: n + seed, name: `Name ${n + seed}`, wide: n % 7 === 3 }));

type Item = ReturnType<typeof makeItems>[number];

const makeColumns = (): GridColumnDef<Item>[] => [
  { path: 'id', label: 'Id', dataType: 'number' },
  { path: 'name', label: 'Name' },
];

/** Linha inteira: metade template, metade `HTMLElement` (light DOM), com `signal`. */
const makeRenderer = (aborted: { count: number }): GridRowRenderer<Item> => (item, ctx) => {
  if (!item.wide) {
    return false;
  }

  if (item.id % 2) {
    return html`<div class="wide">${item.name}</div>`;
  }

  const element = document.createElement('div');
  element.textContent = item.name;
  ctx.signal.addEventListener('abort', () => {
    aborted.count++;
  });
  return element;
};

const scrollBodyTo = async (grid: DataGrid, top: number): Promise<void> => {
  grid._scrollContainerRef.value!.scrollTop = top;
  grid._scrollContainerRef.value!.dispatchEvent(new Event('scroll'));
  await settle(grid);
};

const exercise = async (grid: DataGrid): Promise<void> => {
  await scrollBodyTo(grid, 48 * 400);
  await scrollBodyTo(grid, 48 * 900);
  await scrollBodyTo(grid, 0);
  grid.sortColumn(grid.columns[0], 'desc');
  await settle(grid);
  grid.focusCell(grid.fixedTopItems[0]?.id, undefined, { rowFixed: 'top' });
  await settle(grid);
  grid.clearSorting();
  await settle(grid);
};

describe('memória das linhas fixas e da linha inteira', () => {
  it('grid com fixas e linhas inteiras é coletado com itens e renderers; o light DOM é limpo', async () => {
    const aborted = { count: 0 };

    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(2000);
      const fixedTop = makeItems(2, -10).map(item => ({ ...item, wide: true }));
      const fixedBottom = makeItems(2, -20);
      const renderer = makeRenderer(aborted);
      const grid = await createGrid({
        columns: makeColumns(),
        items,
        height: '600px',
        configure: g => {
          g.keyExpr = 'id';
          g.fixedTopItems = fixedTop;
          g.fixedBottomItems = fixedBottom;
          g.rowRenderer = renderer as GridRowRenderer;
        },
      });

      await exercise(grid);
      expect(grid.querySelectorAll('[slot]').length).toBeGreaterThan(0);
      grid.remove();
      expect(grid.querySelectorAll('[slot]')).toHaveLength(0);
      expect(grid._memoryStats.rowRenders).toBe(0);
      expect(grid._memoryStats.observedFixedSections).toBe(0);

      return track({ grid, items, item: items[3], fixedTop, fixedItem: fixedTop[0], fixedBottom, renderer });
    };

    await expectCollected(await scenario());
    expect(aborted.count).toBeGreaterThan(0);
  });

  it('grid de vida longa: fixas, itens e renderers trocados são soltos', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(1000), height: '600px', configure: g => {
      g.rowRenderer = makeRenderer({ count: 0 }) as GridRowRenderer;
      g.fixedTopItems = makeItems(2, -10);
    } });

    const replace = async (): Promise<Tracked> => {
      const items = makeItems(1000, 5);
      const fixedTop = makeItems(3, -30).map(item => ({ ...item, wide: true }));
      const renderer = makeRenderer({ count: 0 });
      grid.items = items;
      grid.fixedTopItems = fixedTop;
      grid.rowRenderer = renderer as GridRowRenderer;
      await settle(grid);
      await exercise(grid);

      grid.items = makeItems(1000, 9);
      grid.fixedTopItems = makeItems(1, -40);
      grid.rowRenderer = makeRenderer({ count: 0 }) as GridRowRenderer;
      await settle(grid);

      return track({ items, item: items[3], fixedTop, fixedItem: fixedTop[0], renderer });
    };

    await expectCollected(await replace());
    expect(grid.isConnected).toBe(true);
  });

  it('usar repetidamente não cresce heap, light DOM nem os resultados guardados', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(3000), height: '600px', configure: g => {
      g.rowRenderer = makeRenderer({ count: 0 }) as GridRowRenderer;
      g.fixedTopItems = makeItems(2, -10);
      g.fixedBottomItems = makeItems(2, -20);
    } });
    let firstItems: Tracked | undefined;

    const round = async (n: number): Promise<void> => {
      const items = makeItems(3000, n);
      firstItems ??= track({ items });
      grid.items = items;
      grid.fixedTopItems = makeItems(2, -10 - n);
      await settle(grid);
      await exercise(grid);
    };

    for (let n = 0; n < 3; n++) {
      await round(n);
    }

    const lightBefore = grid.childElementCount;
    const rendersBefore = grid._memoryStats.rowRenders;
    const before = await measureHeap();

    for (let n = 3; n < 15; n++) {
      await round(n);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;
    const stats = grid._memoryStats;

    expect(stats.rowRenders).toBeLessThanOrEqual(Math.max(rendersBefore, 40));
    expect(stats.primitiveFullWidthSizes).toBe(0);
    expect(grid.childElementCount).toBe(lightBefore);
    expect(delta.jsHeapUsed, report).toBeLessThan(768 * 1024);
    expect(delta.nodes, report).toBeLessThan(60);
    expect(delta.listeners, report).toBeLessThan(30);
    expect(await aliveAfterGc(firstItems!)).toEqual([]);
  }, 180_000);
});
