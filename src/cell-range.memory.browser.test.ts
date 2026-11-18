/**
 * Vazamento de memória da frente 19 (regra da spec 14): o arrasto registra
 * listeners na tabela e pede `requestAnimationFrame`; anúncio e resumo
 * esperam um timer; o resumo corre em fatias. Nada disso pode segurar o
 * grid removido, nem crescer num grid de vida longa. Só eventos sintéticos.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, dataRows, settle } from './test/fixture.js';
import { aliveAfterGc, expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, n) => ({ region: `R${(n + seed) % 3}`, name: `Name ${n + seed}`, amount: n }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'region', label: 'Region' },
  { path: 'name', label: 'Name' },
  { path: 'amount', label: 'Amount', dataType: 'number' },
];

const key = async (grid: DataGrid, name: string, init: KeyboardEventInit = {}): Promise<void> => {
  const target = grid.shadowRoot!.activeElement ?? grid.shadowRoot!.querySelector('table [tabindex="0"]')!;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const pointer = (type: string, target: Element, at: Element): void => {
  const box = at.getBoundingClientRect();
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerId: 3,
    pointerType: 'mouse',
    button: type === 'pointermove' ? -1 : 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
  }));
};

const cellOf = (grid: DataGrid, row: number, col: number): HTMLElement =>
  dataRows(grid)[row].querySelectorAll<HTMLElement>('td[data-col]')[col];

/** Arrasto (deixado no meio: o grid sai com ele em curso), teclado, cópia, resumo e Shift+F8. */
const exercise = async (grid: DataGrid, finishDrag: boolean): Promise<void> => {
  const onChange = () => undefined;
  grid.addEventListener('u-grid-cell-range-change', onChange);

  const table = grid.shadowRoot!.querySelector('table')!;
  const from = cellOf(grid, 0, 0);
  from.focus();
  await key(grid, 'ArrowDown', { shiftKey: true });
  await key(grid, 'a', { ctrlKey: true });
  await key(grid, 'F8', { shiftKey: true });
  await key(grid, 'ArrowRight');
  await key(grid, 'ArrowDown', { shiftKey: true });

  const clipboardData = new DataTransfer();
  grid.shadowRoot!.activeElement!.dispatchEvent(new ClipboardEvent('copy', { clipboardData, bubbles: true, composed: true, cancelable: true }));
  await grid.getCellRangeSummary();

  pointer('pointerdown', from, from);
  pointer('pointermove', table, cellOf(grid, 3, 2));
  await settle(grid);

  if (finishDrag) {
    pointer('pointerup', table, cellOf(grid, 3, 2));
    await settle(grid);
  }

  grid.removeEventListener('u-grid-cell-range-change', onChange);
};

describe('memória do intervalo de células', () => {
  it('grid com intervalo, arrasto em curso e anúncio pendente, removido, é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(800);
      const columns = makeColumns();
      const grid = await createGrid({
        columns,
        items,
        height: '300px',
        configure: g => {
          g.cellSelectionMode = 'multiple';
          g.showCellRangeSummary = true;
        },
      });

      await exercise(grid, false);
      expect(grid._memoryStats.rangeDrag).toBe(1);
      grid.remove();
      expect(grid._memoryStats.rangeDrag).toBe(0);
      expect(grid._memoryStats.rangeTimers).toBe(0);
      expect(grid._memoryStats.rangeSummaries).toBe(0);
      await new Promise(resolve => setTimeout(resolve, 300));

      return track({ grid, items, item: items[0], columns, column: columns[1] });
    };

    await expectCollected(await scenario());
  });

  it('vida longa: intervalos repetidos e trocas de items não crescem', async () => {
    const grid = await createGrid({
      columns: makeColumns(),
      items: makeItems(2000),
      height: '300px',
      configure: g => {
        g.cellSelectionMode = 'multiple';
        g.showCellRangeSummary = true;
      },
    });

    const swap = async (seed: number): Promise<Tracked> => {
      const items = makeItems(2000 + (seed % 2), seed);
      grid.items = items;
      await settle(grid);
      await exercise(grid, true);
      await key(grid, 'Escape');
      grid.clearCellRanges();
      grid.items = makeItems(2001, seed + 1);
      await settle(grid);

      return track({ items, item: items[0] });
    };

    await expectCollected(await swap(1));

    for (let n = 0; n < 6; n++) {
      await swap(10 + n * 3);
    }

    const before = await measureHeap();

    for (let n = 0; n < 15; n++) {
      await swap(100 + n * 3);
    }

    // Anúncio/resumo da última rodada: limitados pelo timer.
    await new Promise(resolve => setTimeout(resolve, 700));
    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(grid._memoryStats.rangeDrag).toBe(0);
    expect(grid._memoryStats.rangeTimers).toBe(0);
    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
    expect(await aliveAfterGc(await swap(500))).toEqual([]);
  }, 120_000);
});
