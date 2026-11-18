/**
 * Vazamento de memória do estado (frente 11 + regra da spec 14): o
 * temporizador da rajada, o listener de `pagehide`, a leitura assíncrona
 * pendente e os estados aplicados não podem segurar o grid, os `items` nem
 * as colunas; um grid de vida longa que salva/restaura muito não cresce.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid, GridState } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

const KEY = 'u-grid-state-memory';

afterEach(() => {
  cleanup();
  localStorage.removeItem(KEY);
});

const makeColumns = (): GridColumnDef[] => [
  { path: 'id', label: 'Id', dataType: 'number' },
  { path: 'city', label: 'City' },
  { path: 'amount', label: 'Amount', dataType: 'number' },
];

const makeItems = (count: number) =>
  Array.from({ length: count }, (_, n) => ({ id: n, city: ['Lima', 'Rio', 'Quito'][n % 3], amount: (n * 37) % 101 }));

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const configure = (storage: DataGrid['stateStorage']) => (grid: DataGrid) => {
  grid.keyExpr = 'id';
  grid.selectionMode = 'multiple';
  grid.stateStorage = storage;
  grid.stateStorageKey = KEY;
  grid.stateChangeDelay = 5_000;
};

/** Mexe no estado e deixa a rajada pendente (temporizador armado). */
const exerciseState = async (grid: DataGrid): Promise<void> => {
  const [, city, amount] = grid.columns;

  grid.sortColumn(amount, 'desc');
  grid.groupColumn(city);
  grid.selectRows([1, 2, 3]);
  grid.setState({ version: 1, searchText: 'Rio' }, { partial: true });
  grid.getState();
  await settle(grid);
};

describe('memória do estado', () => {
  it('grid com storage local e rajada pendente, removido, é coletado (temporizador e pagehide soltos)', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(500);
      const columns = makeColumns();
      const grid = await createGrid({ columns, items, setBeforeConnect: true, configure: configure('local') });

      await exerciseState(grid);
      expect(grid._memoryStats.stateTimers).toBe(1);
      expect(grid._memoryStats.pageHideListeners).toBe(1);

      grid.remove();

      expect(grid._memoryStats.stateTimers).toBe(0);
      expect(grid._memoryStats.pageHideListeners).toBe(0);
      // Gravou a rajada pendente ao sair.
      expect((JSON.parse(localStorage.getItem(KEY)!) as GridState).searchText).toBe('Rio');

      return track({ grid, items, columns });
    };

    await expectCollected(await scenario());
  });

  it('grid esperando um load() que nunca responde, removido, é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(200);
      const storage = { load: () => new Promise<GridState | null>(() => undefined), save: () => undefined };
      const grid = await createGrid({ columns: makeColumns(), items, setBeforeConnect: true, configure: configure(storage) });

      expect(grid.shadowRoot!.querySelector('table')!.getAttribute('aria-busy')).toBe('true');
      await wait(350);
      grid.remove();
      await settle(grid);

      expect(grid._memoryStats.loadTimers).toBe(0);
      return track({ grid, items, storage });
    };

    await expectCollected(await scenario());
  });

  it('grid de vida longa: salvar/restaurar repetido não cresce', async () => {
    const grid = await createGrid({
      columns: makeColumns(),
      items: makeItems(2_000),
      setBeforeConnect: true,
      configure: target => {
        configure('local')(target);
        target.stateChangeDelay = 0;
      },
    });

    const round = async (n: number): Promise<void> => {
      await exerciseState(grid);
      const state = grid.getState();

      grid.resetState();
      await settle(grid);
      grid.setState(JSON.parse(JSON.stringify({ ...state, searchText: `R${n % 3}` })) as GridState);
      grid.stateStorageKey = KEY;
      await settle(grid);
      await wait(5);
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
    const stats = grid._memoryStats;

    expect(stats.stateTimers).toBe(0);
    expect(stats.pendingStates).toBe(0);
    expect(stats.pageHideListeners).toBe(1);
    expect(stats.expansion).toBeLessThanOrEqual(statsBefore.expansion);
    expect(stats.warnedState).toBeLessThanOrEqual(statsBefore.warnedState);
    expect(stats.selectedKeys).toBeLessThanOrEqual(statsBefore.selectedKeys);
    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
  }, 120_000);
});
