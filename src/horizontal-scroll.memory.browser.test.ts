/**
 * Vazamento de memória da frente 30 (regra da spec 14): no eixo `block` o
 * grid liga `scroll` nas faixas (cabeçalho, corpo, rodapé, barra própria),
 * `wheel` no cabeçalho e no rodapé e um `ResizeObserver` no corpo. Tudo sai
 * no disconnect e ao voltar para o eixo `both`: o grid removido é coletado e
 * alternar o eixo num grid de vida longa não cresce.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, type Tracked, track } from './test/leak.js';

import './grid.js';

const holders: HTMLElement[] = [];

afterEach(() => {
  holders.splice(0).forEach(holder => holder.remove());
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
});

const makeItems = (count: number) => Array.from({ length: count }, (_, id) => ({ id, name: `Name ${id}`, amount: id }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'id', label: 'Id', width: 120, fixed: 'start' },
  { path: 'name', label: 'Name', width: 400 },
  { path: 'amount', label: 'Amount', width: 400 },
  { path: 'name', label: 'Again' },
];

const holder = (): HTMLDivElement => {
  const element = document.createElement('div');
  element.id = `hs-outer-${holders.length}`;
  element.style.cssText = 'height:400px;width:600px;overflow:auto';
  document.body.append(element);
  holders.push(element);
  return element;
};

const exercise = async (grid: DataGrid, scroller: HTMLElement): Promise<void> => {
  const body = grid.shadowRoot!.querySelector<HTMLElement>('.band-body')!;
  const head = grid.shadowRoot!.querySelector<HTMLElement>('.band-head-rows')!;

  for (const top of [2000, 9000, 300]) {
    scroller.scrollTo({ top, behavior: 'instant' });
    body.scrollLeft = top / 10;
    await settle(grid);
  }

  head.dispatchEvent(new WheelEvent('wheel', { deltaX: 50, bubbles: true, cancelable: true }));
  grid.focusCell(400, 'name');
  await settle(grid);
  await settle(grid);
};

describe('memória das faixas do eixo block (spec 30)', () => {
  it('grid removido é coletado com o contêiner vivo; listeners das faixas soltos', async () => {
    const outer = holder();

    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(2000);
      const columns = makeColumns();
      const grid = document.createElement('u-grid');
      grid.keyExpr = 'id';
      grid.columns = columns;
      grid.items = items;
      grid.summary = { total: [{ column: 'amount', type: 'sum' }] };
      grid.setAttribute('scroll-container', outer.id);
      outer.append(grid);
      await settle(grid);
      await exercise(grid, outer);

      // Corpo, cabeçalho, rodapé e barra + o `ResizeObserver`.
      expect(grid._memoryStats.horizontalSyncListeners).toBeGreaterThanOrEqual(5);
      grid.remove();
      expect(grid._memoryStats.horizontalSyncListeners).toBe(0);
      expect(grid._memoryStats.scrollPortAttached).toBe(0);

      return track({ grid, items, item: items[0], columns });
    };

    await expectCollected(await scenario());
  });

  it('alternar o eixo e os totais num grid de vida longa não cresce heap, nós nem listeners', async () => {
    const outer = holder();
    const grid = document.createElement('u-grid');
    grid.keyExpr = 'id';
    grid.columns = makeColumns();
    grid.items = makeItems(5000);
    grid.scrollContainerElement = outer;
    outer.append(grid);
    await settle(grid);

    const cycle = async (n: number): Promise<void> => {
      grid.scrollContainerAxis = n % 3 === 2 ? 'both' : 'block';
      grid.summary = n % 2 ? { total: [{ column: 'amount', type: 'sum' }] } : null;
      await settle(grid);

      if (grid.scrollContainerAxis === 'block') {
        await exercise(grid, outer);
      }
    };

    for (let n = 0; n < 3; n++) {
      await cycle(n);
    }

    const before = await measureHeap();

    for (let n = 0; n < 12; n++) {
      await cycle(n);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(grid._memoryStats.horizontalSyncListeners).toBeLessThanOrEqual(5);
    expect(delta.jsHeapUsed, report).toBeLessThan(768 * 1024);
    expect(delta.nodes, report).toBeLessThan(60);
    expect(delta.listeners, report).toBeLessThan(30);
  }, 180_000);
});
