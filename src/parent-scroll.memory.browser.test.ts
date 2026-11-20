/**
 * Vazamento de memória da frente 27 (regra da spec 14): com o contêiner
 * externo o grid registra `scroll`/`scrollend` nele (ou na janela),
 * `resize` na janela, `ResizeObserver` no contêiner e um
 * `IntersectionObserver` nas linhas renderizadas. Tudo sai no disconnect e
 * ao trocar de contêiner: o grid removido é coletado mesmo com o contêiner
 * vivo, e trocar de contêiner muitas vezes num grid de vida longa não cresce.
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
  window.scrollTo({ top: 0, behavior: 'instant' });
});

const makeItems = (count: number) => Array.from({ length: count }, (_, id) => ({ id, name: `Name ${id}`, amount: id }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'id', label: 'Id', width: 120, fixed: 'start' },
  { path: 'name', label: 'Name', width: 400 },
  { path: 'amount', label: 'Amount', width: 400 },
];

const holder = (): HTMLDivElement => {
  const element = document.createElement('div');
  element.id = `outer-${holders.length}`;
  element.style.cssText = 'height:400px;width:600px;overflow:auto';
  element.append(Object.assign(document.createElement('div'), { style: 'height:200px' }));
  document.body.append(element);
  holders.push(element);
  return element;
};

const exercise = async (grid: DataGrid, scroller: HTMLElement | Window): Promise<void> => {
  for (const top of [2000, 9000, 300]) {
    scroller.scrollTo({ top, left: top / 10, behavior: 'instant' });
    await settle(grid);
  }

  grid.focusCell(400);
  await settle(grid);
  await settle(grid);
};

describe('memória da rolagem por contêiner externo', () => {
  for (const port of ['element', 'window'] as const) {
    it(`${port}: grid removido é coletado com o contêiner vivo; nada fica pendurado`, async () => {
      const outer = holder();

      const scenario = async (): Promise<Tracked> => {
        const items = makeItems(2000);
        const columns = makeColumns();
        const grid = document.createElement('u-grid');
        grid.keyExpr = 'id';
        grid.columns = columns;
        grid.items = items;
        grid.setAttribute('scroll-container', port === 'element' ? outer.id : 'window');
        outer.append(grid);
        await settle(grid);
        await exercise(grid, port === 'element' ? outer : window);

        expect(grid._memoryStats.scrollPortAttached).toBe(1);
        expect(grid._memoryStats.scrollPortObservedRows).toBeGreaterThan(0);
        grid.remove();
        expect(grid._memoryStats.scrollPortAttached).toBe(0);
        expect(grid._memoryStats.scrollPortObservedRows).toBe(0);
        expect(grid._memoryStats.scrollEndWaits).toBe(0);

        return track({ grid, items, item: items[0], columns });
      };

      await expectCollected(await scenario());
    });
  }

  it('trocar de contêiner muitas vezes num grid de vida longa não cresce heap, nós nem listeners', async () => {
    const outers = [holder(), holder()];
    const grid = document.createElement('u-grid');
    grid.keyExpr = 'id';
    grid.columns = makeColumns();
    grid.items = makeItems(5000);
    outers[0].append(grid);
    grid.scrollContainerElement = outers[0];
    await settle(grid);

    const cycle = async (n: number): Promise<void> => {
      const target = outers[n % 2];
      target.append(grid);
      grid.scrollContainerElement = n % 3 === 2 ? window : target;
      await settle(grid);
      await exercise(grid, n % 3 === 2 ? window : target);
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

    expect(grid._memoryStats.scrollPortObservedRows).toBeLessThan(60);
    expect(grid._memoryStats.scrollEndWaits).toBe(0);
    expect(delta.jsHeapUsed, report).toBeLessThan(768 * 1024);
    expect(delta.nodes, report).toBeLessThan(60);
    expect(delta.listeners, report).toBeLessThan(30);
  }, 180_000);
});
