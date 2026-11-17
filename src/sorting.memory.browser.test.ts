/**
 * Vazamento de memória da ordenação (spec 03 + regra da spec 14): o estado
 * de ordenação (`#sorting`), o cache de postos (`#rankCache`), o listener de
 * `down` do limiar de arrasto e os eventos não podem segurar o grid, os
 * `items` nem as colunas. Cada cenário roda dentro de uma função e devolve
 * só `WeakRef`s — ver `src/test/leak.ts`.
 *
 * Só eventos sintéticos: o `userEvent` do Vitest (Playwright) mantém vivo o
 * último elemento sob o mouse — até um `<div>` solto —, o que mascararia o
 * resultado.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { aliveAfterGc, expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, n) => ({
    region: `R${n % 3}`,
    name: `Name ${(n * 7919 + seed) % count}`,
    amount: (n * 37 + seed) % 101,
  }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'region', label: 'Region', groupIndex: 0, sortOrder: 'desc' },
  { path: 'name', label: 'Name', sortOrder: 'asc' },
  { path: 'amount', label: 'Amount', comparator: (a: number, b: number) => a - b },
];

const header = (grid: DataGrid, label: string): HTMLElement =>
  [...grid.shadowRoot!.querySelectorAll<HTMLElement>('th.header-column')]
    .find(th => th.querySelector('.header-text')!.textContent === label)!;

const click = async (grid: DataGrid, target: HTMLElement, init: MouseEventInit = {}): Promise<void> => {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, ...init }));
  await settle(grid);
};

const pointer = (type: string, target: EventTarget, x: number, y: number): void => {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
  }));
};

/** Arrasta `source` até `target` (interactjs de verdade) e solta com o clique final no cabeçalho. */
const dragHeader = async (grid: DataGrid, source: HTMLElement, target: HTMLElement): Promise<void> => {
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const x = from.left + 10;
  const y = from.top + from.height / 2;

  pointer('pointerdown', source, x, y);
  pointer('pointermove', source, x + 6, y);
  pointer('pointermove', document, x + 30, y);
  await new Promise(resolve => requestAnimationFrame(resolve));
  pointer('pointermove', document, to.right - 5, y);
  await new Promise(resolve => requestAnimationFrame(resolve));
  pointer('pointerup', document, to.right - 5, y);
  source.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await settle(grid);
};

/** Usa todos os caminhos da ordenação: gestos, chip, teclado, arrasto, API e eventos. */
const exerciseSorting = async (grid: DataGrid, columns: GridColumnDef[]): Promise<void> => {
  const onSorting = (event: Event) => (event as CustomEvent).detail.sorting.length > 4 && event.preventDefault();
  const onChange = () => undefined;
  grid.addEventListener('u-grid-sorting', onSorting);
  document.addEventListener('u-grid-sort-change', onChange);

  await click(grid, header(grid, 'Name'));
  await click(grid, header(grid, 'Amount'), { shiftKey: true });
  await click(grid, header(grid, 'Name'), { ctrlKey: true });
  header(grid, 'Amount').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await settle(grid);
  await click(grid, grid.shadowRoot!.querySelector<HTMLElement>('.group')!);
  const before = grid.getSorting().length;
  await dragHeader(grid, header(grid, 'Name'), header(grid, 'Amount'));
  expect(grid._regularColumns.map(c => c.label)).toEqual(['Amount', 'Name']);
  expect(grid.getSorting()).toHaveLength(before);

  grid.sortBy(columns[1], 'desc', { append: true });
  grid.getSorting();
  await settle(grid);
  grid.clearSorting();
  await settle(grid);

  document.removeEventListener('u-grid-sort-change', onChange);
};

describe('memória da ordenação', () => {
  it('grid ordenado (gestos, chip, arrasto, API, eventos) e removido é coletado com items e colunas', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(400);
      const columns = makeColumns();
      const grid = await createGrid({ columns, items, height: '300px', configure: g => g.sorting = 'multiple' });

      await exerciseSorting(grid, columns);
      grid.remove();

      return track({ grid, items, item: items[0], columns, sortedColumn: columns[1], comparatorColumn: columns[2] });
    };

    await expectCollected(await scenario());
  });

  it('grid de vida longa: items trocados e colunas removidas não ficam presos no estado/cache de ordenação', async () => {
    const columns = makeColumns();
    const grid = await createGrid({ columns, items: makeItems(500), height: '300px', configure: g => g.sorting = 'multiple' });

    const replaceItems = async (): Promise<Tracked> => {
      const items = makeItems(500, 17);
      grid.items = items;
      grid.sortBy(columns[1], 'desc');
      grid.sortBy(columns[2], 'asc', { append: true });
      await settle(grid);
      grid.items = makeItems(500, 33);
      await settle(grid);

      return track({ items, item: items[0] });
    };

    await expectCollected(await replaceItems());

    const dropColumn = async (): Promise<Tracked> => {
      const extra: GridColumnDef = { path: 'name', label: 'Extra', sortOrder: 'desc' };
      grid.columns = [...columns, extra];
      await settle(grid);
      grid.sortBy(extra, 'asc', { append: true });
      await settle(grid);
      expect(grid.getSorting().some(s => s.column === extra)).toBe(true);

      grid.columns = columns;
      await settle(grid);
      expect(grid.getSorting().some(s => s.column === extra)).toBe(false);

      return track({ extra });
    };

    await expectCollected(await dropColumn());
    expect(grid.isConnected).toBe(true);
  });

  it('ordenar repetidamente num grid de vida longa não cresce heap, listeners nem cache de postos', async () => {
    const columns = makeColumns();
    const grid = await createGrid({ columns, items: makeItems(2000), height: '300px', configure: g => g.sorting = 'multiple' });

    let firstItems: Tracked | undefined;

    const round = async (n: number): Promise<void> => {
      const items = makeItems(2000, n);
      firstItems ??= track({ items });
      grid.items = items;
      await settle(grid);

      for (const label of ['Name', 'Amount', 'Name']) {
        await click(grid, header(grid, label));
        await click(grid, header(grid, label), { shiftKey: true });
      }

      await click(grid, grid.shadowRoot!.querySelector<HTMLElement>('.group')!);
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

    // Postos só das colunas ordenadas com os items atuais (o comparador próprio não usa postos).
    expect(grid._memoryStats.sortRanks).toBeLessThanOrEqual(Math.max(statsBefore.sortRanks, 1));
    expect(grid._memoryStats.dragAndDrop).toBe(statsBefore.dragAndDrop);
    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
    expect(await aliveAfterGc(firstItems!)).toEqual([]);
  }, 120_000);
});
