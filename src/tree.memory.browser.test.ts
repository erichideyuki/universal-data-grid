/**
 * Vazamento de memória da frente 25 (regra da spec 14): cargas de filhos
 * pendentes (`AbortController`, promessas de `expandNode`), o temporizador
 * do anúncio de carga e o índice da árvore não podem segurar o grid, a fonte
 * nem os itens; num grid de vida longa, expandir/recolher e filtrar não
 * cresce.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { GridDataSource, GridLoadOptions, GridLoadResult } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

interface TreeItem {
  id: number;
  parentId: number | null;
  name: string;
}

/** `count` raízes com 5 filhos cada (2 níveis). */
const makeItems = (count: number): TreeItem[] => {
  const items: TreeItem[] = [];

  for (let root = 0; root < count; root++) {
    const id = root * 10;
    items.push({ id, parentId: null, name: `Root ${root}` });

    for (let child = 1; child <= 5; child++) {
      items.push({ id: id + child, parentId: id, name: `Child ${root}.${child}` });
    }
  }

  return items;
};

const makeColumns = (): GridColumnDef[] => [{ path: 'name', label: 'Name' }];

/** Fonte de árvore com latência; guarda os sinais para conferir o aborto. */
class TreeSource implements GridDataSource<TreeItem> {
  /** Sinal do último pedido (só ele: guardar todos seguraria os listeners). */
  lastSignal: AbortSignal | undefined;
  latency = 5;
  readonly #items: TreeItem[];

  constructor(items: TreeItem[]) {
    this.#items = items;
  }

  load(options: GridLoadOptions, signal: AbortSignal): Promise<GridLoadResult<TreeItem>> {
    this.lastSignal = signal;
    const parents = options.tree?.parentKeys ?? [];

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve({ data: this.#items.filter(item => parents.includes(item.parentId)) });
      }, this.latency);

      const abort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };

      signal.addEventListener('abort', abort, { once: true });
    });
  }
}

const treeConfig = (items: TreeItem[], source?: TreeSource) => ({
  columns: makeColumns(),
  height: '300px',
  setBeforeConnect: true,
  configure: (grid: import('./grid.js').DataGrid) => {
    grid.treeMode = 'flat';
    grid.keyExpr = 'id';
    grid.parentKeyExpr = 'parentId';

    if (source) {
      grid.hasChildrenExpr = (item: TreeItem) => item.parentId === null;
      grid.dataSource = source;
    }
  },
  items: source ? undefined : items,
});

describe('memória da árvore', () => {
  it('grid removido com cargas de filhos em voo aborta tudo e é coletado com a fonte e os itens', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(50);
      const columns = makeColumns();
      const source = new TreeSource(items);
      const grid = await createGrid(treeConfig(items, source));
      await new Promise(resolve => setTimeout(resolve, 30));
      await settle(grid);

      source.latency = 10_000;
      const pending = [grid.expandNode(0), grid.expandNode(10)];
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(grid._memoryStats.treeLoads).toBe(2);

      grid.remove();

      expect(grid._memoryStats.treeLoads).toBe(0);
      expect(grid._memoryStats.treeTimers).toBe(0);
      expect(await Promise.all(pending)).toEqual([false, false]);
      expect(source.lastSignal!.aborted).toBe(true);

      return track({ grid, source, items, item: items[0], columns });
    };

    await expectCollected(await scenario());
  });

  it('grid local com árvore expandida e filtrada é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(200);
      const grid = await createGrid(treeConfig(items));
      grid.expandAllNodes();
      grid.searchText = 'Child 3';
      await settle(grid);
      grid.remove();

      return track({ grid, items, item: items[0] });
    };

    await expectCollected(await scenario());
  });

  it('vida longa: expandir/recolher, filtrar e carregar filhos não cresce', async () => {
    const items = makeItems(2000);
    const source = new TreeSource(items);
    const grid = await createGrid(treeConfig(items, source));
    await new Promise(resolve => setTimeout(resolve, 30));
    await settle(grid);

    const cycle = async (n: number): Promise<void> => {
      await grid.expandNode((n % 40) * 10);
      grid.collapseNode((n % 40) * 10);
      grid.searchText = n % 2 ? `Root ${n % 7}` : '';
      await settle(grid);
    };

    for (let n = 0; n < 10; n++) {
      await cycle(n);
    }

    const before = await measureHeap();

    for (let n = 10; n < 40; n++) {
      await cycle(n);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(grid._memoryStats.treeLoads).toBe(0);
    expect(grid._memoryStats.treeTimers).toBe(0);
    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
  }, 60_000);
});
