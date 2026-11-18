/**
 * Vazamento de memória da frente 08 (regra da spec 14): pedidos pendentes
 * (`AbortController`), o temporizador dos pedidos, o cache de blocos e os
 * eventos de carga não podem segurar o grid, a fonte nem os itens; num grid
 * de vida longa, trocar a consulta e rolar não cresce.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { BLOCK_CACHE_LIMIT } from './data/remote-loader.js';
import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { FakeSource, waitFor } from './test/fake-source.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { aliveAfterGc, expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Name ${id + seed}`, region: `R${(id + seed) % 3}` }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'region', label: 'Region' },
];

const scrollGridTo = async (grid: DataGrid, top: number): Promise<void> => {
  grid.shadowRoot!.querySelector<HTMLElement>('.scroll-container')!.scrollTop = top;
  await settle(grid);
};

describe('memória da fonte de dados', () => {
  it('grid removido com pedidos em voo aborta tudo e é coletado com a fonte e os itens', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(5000);
      const columns = makeColumns();
      const source = new FakeSource(items, 30);
      const onEvent = () => undefined;
      const grid = await createGrid({
        columns,
        height: '300px',
        configure: g => {
          g.keyExpr = 'id';
          g.remoteOperations = true;
          g.pageSize = 40;
          g.dataSource = source;
        },
      });

      for (const type of ['u-grid-loading', 'u-grid-load', 'u-grid-load-error']) {
        grid.addEventListener(type, onEvent);
      }

      await waitFor(() => source.calls.every(call => call.settled));
      await scrollGridTo(grid, 48 * 2000);
      await waitFor(() => source.calls.every(call => call.settled));
      source.fail = 1;
      grid.sortColumn(columns[0], 'desc');
      await waitFor(() => !!grid.shadowRoot!.querySelector('[part=error-row]'));
      grid.shadowRoot!.querySelector<HTMLButtonElement>('[part=retry-button]')!.click();
      await settle(grid);

      // Remove com pedido em voo.
      await waitFor(() => source.calls.every(call => call.settled));
      source.latency = 1000;
      await scrollGridTo(grid, 48 * 4000);
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(source.calls.some(call => !call.settled)).toBe(true);
      grid.remove();

      expect(grid._memoryStats.pendingLoads).toBe(0);
      expect(grid._memoryStats.loadTimers).toBe(0);
      expect(source.pendingTimers).toBe(0);
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(source.calls.filter(call => !call.settled)).toHaveLength(0);

      return track({ grid, source, items, item: items[0], columns, column: columns[1] });
    };

    await expectCollected(await scenario());
  });

  it('vida longa: consultas trocadas e rolagem mantêm o cache limitado e o heap estável', async () => {
    const items = makeItems(200_000);
    const source = new FakeSource(items, 1);
    const grid = await createGrid({
      columns: makeColumns(),
      height: '300px',
      configure: g => {
        g.keyExpr = 'id';
        g.remoteOperations = true;
        g.pageSize = 20;
        g.dataSource = source;
      },
    });

    const cycle = async (n: number): Promise<void> => {
      grid.filterValue = n % 2 ? ['region', '<>', `R${n % 3}`] : null;
      await settle(grid);

      for (const row of [n * 997 % 50_000, 120_000 + n * 13, 3]) {
        await scrollGridTo(grid, 48 * row);
      }

      await waitFor(() => source.calls.every(call => call.settled));
      await settle(grid);
    };

    for (let n = 0; n < 6; n++) {
      await cycle(n);
    }

    const before = await measureHeap();

    for (let n = 6; n < 26; n++) {
      await cycle(n);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(grid._memoryStats.cachedBlocks).toBeLessThanOrEqual(BLOCK_CACHE_LIMIT);
    expect(grid._memoryStats.pendingLoads).toBe(0);
    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);

    // Trocar a fonte solta o cache e a fonte velha.
    grid.dataSource = null;
    await settle(grid);
    expect(grid._memoryStats.cachedBlocks).toBe(0);
    expect(await aliveAfterGc(track({ source }))).toEqual(['source']);
  }, 120_000);
});
