/**
 * Vazamento de memória das bandas e da virtualização de colunas (frente 13,
 * spec 14): `<slot>` + `slotchange` das bandas declarativas, listener de
 * rolagem horizontal, cache de irmãs, arrasto dos cabeçalhos de banda que
 * entram e saem do DOM ao rolar.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const BAND_SIZE = 10;
const BANDS = 12;

const makeColumns = (): GridColumnDef[] => Array.from({ length: BANDS }, (_, band): GridColumnDef => ({
  label: `Band ${band}`,
  fixed: band === 0 ? 'start' : null,
  columns: Array.from({ length: BAND_SIZE }, (__, i): GridColumnDef => ({ path: `c${band * BAND_SIZE + i}`, label: `C${band * BAND_SIZE + i}`, width: 90 })),
}));

const makeItems = (count: number): Record<string, string>[] =>
  Array.from({ length: count }, (_, n) =>
    Object.fromEntries(Array.from({ length: BANDS * BAND_SIZE }, (__, c) => [`c${c}`, `${n}.${c}`])));

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const key = (target: Element, keyName: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, composed: true, cancelable: true, ...init }));

/** Rola na horizontal, move uma banda pelo teclado e abre/fecha o seletor. */
const exercise = async (grid: DataGrid, step: number): Promise<void> => {
  const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;

  scroller.scrollLeft = (step % 4) * 2500;
  scroller.dispatchEvent(new Event('scroll'));
  await settle(grid);

  const band = root(grid).querySelectorAll<HTMLElement>('th.band-header')[1];
  band.focus();
  key(band, step % 2 ? 'ArrowLeft' : 'ArrowRight', { altKey: true, shiftKey: true });
  await settle(grid);

  grid.openColumnChooser();
  await settle(grid);
  root(grid).querySelector<HTMLInputElement>('.column-chooser-band .column-chooser-nested input')!.click();
  await settle(grid);
  root(grid).querySelector<HTMLInputElement>('.column-chooser-band .column-chooser-nested input')!.click();
  await settle(grid);
  grid.closeColumnChooser();
  await settle(grid);
};

describe('memória: bandas e virtualização de colunas', () => {
  it('grid com bandas virtualizadas removido é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const columns = makeColumns();
      const items = makeItems(40);
      const grid = await createGrid({ columns, items, height: '300px', configure: g => g.columnChooser = true });

      await exercise(grid, 1);
      const header = root(grid).querySelector('th.band-header')!;

      grid.remove();
      await settle(grid);
      expect(grid._memoryStats.chooserDropzones).toBe(0);

      return track({ grid, columns, band: columns[2], items, header });
    };

    await expectCollected(await scenario());
  });

  it('bandas declarativas (slot nas bandas) removidas são coletadas', async () => {
    const scenario = async (): Promise<Tracked> => {
      const grid = document.createElement('u-grid');
      grid.style.display = 'block';
      grid.style.height = '300px';
      grid.innerHTML = `
        <u-grid-column path="a">A</u-grid-column>
        <u-grid-column>Band<u-grid-column path="b">B</u-grid-column><u-grid-column path="c">C</u-grid-column></u-grid-column>`;
      document.body.append(grid);
      grid.items = [{ a: 1, b: 2, c: 3 }];
      await settle(grid);

      const band = grid.querySelectorAll('u-grid-column')[1];
      const nested = document.createElement('u-grid-column');
      nested.path = 'a';
      band.append(nested);
      await settle(grid);
      nested.remove();
      await settle(grid);

      grid.remove();
      await settle(grid);

      return track({ grid, band, nested });
    };

    await expectCollected(await scenario());
  });

  it('grid de vida longa: rolar, mover banda e seletor repetidos não crescem', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(80), height: '300px', configure: g => g.columnChooser = true });

    for (let i = 0; i < 4; i++) {
      await exercise(grid, i);
    }

    const statsBefore = grid._memoryStats;
    const before = await measureHeap();

    for (let i = 0; i < 40; i++) {
      await exercise(grid, i);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;
    const stats = grid._memoryStats;

    // Tolerâncias da spec 14 (ver grid.memory.browser.test.ts).
    expect(stats.chooserDropzones).toBe(0);
    expect(stats.dragAndDrop).toBeLessThanOrEqual(statsBefore.dragAndDrop + 5);
    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(60);
    expect(delta.listeners, report).toBeLessThan(30);
  }, 180_000);
});
