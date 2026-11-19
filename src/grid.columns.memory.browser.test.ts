/**
 * Vazamento de memória dos recursos de coluna (frente 06, spec 14): alças de
 * redimensionar, seletor de colunas (popover + listener no `document` +
 * dropzone do interactjs), `ResizeObserver` e sombras das fixas. Cada
 * cenário roda dentro de uma função e devolve só `WeakRef`s.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const COLUMN_COUNT = 16;

const makeColumns = (): GridColumnDef[] => Array.from({ length: COLUMN_COUNT }, (_, i): GridColumnDef => ({
  path: `c${i}`,
  label: `Column ${i}`,
  width: i === 3 ? null : 110,
  minWidth: 50,
  fixed: i === 0 ? 'start' : i === COLUMN_COUNT - 1 ? 'end' : null,
}));

const makeItems = (count: number, seed = 0): Record<string, string>[] =>
  Array.from({ length: count }, (_, n) =>
    Object.fromEntries(Array.from({ length: COLUMN_COUNT }, (__, c) => [`c${c}`, `value ${n + seed}.${c}`])));

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const handles = (grid: DataGrid) => [...root(grid).querySelectorAll<HTMLElement>('.resize-handle')];
const headers = (grid: DataGrid) => [...root(grid).querySelectorAll<HTMLElement>('th.header-column')];
const chooser = (grid: DataGrid) => root(grid).querySelector<HTMLElement>('.column-chooser');

const createColumnGrid = (columns: GridColumnDef[], items: unknown[]): Promise<DataGrid> =>
  createGrid({
    columns,
    items,
    height: '300px',
    configure: grid => {
      grid.style.width = '700px';
      grid.columnResizing = true;
      grid.columnChooser = true;
      grid.columnAutoWidth = true;
    },
  });

// ------------------------------------------------------------- ponteiro sintético

const pointer = (type: string, target: EventTarget, x: number, y: number, pointerId = 1): void => {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
  }));
};

const center = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

/** Arrasta a alça `delta` px (sem soltar se `release` for falso). */
const dragHandle = async (grid: DataGrid, handle: HTMLElement, delta: number, release = true): Promise<void> => {
  const { x, y } = center(handle);

  pointer('pointerdown', handle, x, y, 7);
  pointer('pointermove', handle, x + delta / 2, y, 7);
  pointer('pointermove', handle, x + delta, y, 7);
  await settle(grid);

  if (release) {
    pointer('pointerup', handle, x + delta, y, 7);
    await settle(grid);
  }
};

/** Arrasto de verdade (interactjs) de um cabeçalho até o seletor aberto. */
const dragHeaderToChooser = async (grid: DataGrid, header: HTMLElement): Promise<void> => {
  const start = center(header);

  pointer('pointerdown', header, start.x, start.y);
  pointer('pointermove', header, start.x + 5, start.y + 5);
  pointer('pointermove', document, start.x + 30, start.y + 10);
  await new Promise(resolve => requestAnimationFrame(resolve));

  const drop = center(chooser(grid)!);
  pointer('pointermove', document, drop.x, drop.y);
  await new Promise(resolve => requestAnimationFrame(resolve));
  pointer('pointerup', document, drop.x, drop.y);
  await settle(grid);
};

const key = (target: HTMLElement, name: string, init: KeyboardEventInit = {}): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, ...init }));
};

/** Fixa/solta pelo submenu "Fixar coluna ▸" do menu do cabeçalho. */
const pinFromMenu = async (grid: DataGrid, column: GridColumnDef, side: string): Promise<void> => {
  grid.openContextMenu({ column });
  await settle(grid);
  root(grid).querySelector<HTMLElement>('.context-menu-panel [aria-haspopup=menu]')!.click();
  await settle(grid);
  [...root(grid).querySelectorAll<HTMLElement>('.context-menu-panel-submenu [role=menuitemradio]')].find(item => item.textContent.trim() === side)!.click();
  await settle(grid);
};

const listBoxes = (grid: DataGrid) => [...chooser(grid)!.querySelectorAll<HTMLInputElement>('.column-chooser-list input[type=checkbox]')];

const scrollHorizontally = async (grid: DataGrid, left: number): Promise<void> => {
  const scroller = grid._scrollContainerRef.value!;
  scroller.scrollLeft = left;
  scroller.dispatchEvent(new Event('scroll'));
  await settle(grid);
};

/** Usa todos os recursos da frente uma vez (o grid continua conectado). */
const exercise = async (grid: DataGrid, columns: GridColumnDef[]): Promise<void> => {
  await dragHandle(grid, handles(grid)[1], 40);
  key(headers(grid)[2], 'ArrowRight', { altKey: true });
  await settle(grid);
  handles(grid)[2].dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  await settle(grid);
  grid.setColumnWidth(columns[4], 160);
  grid.autoSizeColumn(columns[5]);
  await settle(grid);

  await scrollHorizontally(grid, 400);
  await scrollHorizontally(grid, 0);

  // Fixar e soltar pelo menu do cabeçalho (submenu).
  await pinFromMenu(grid, columns[7], 'Pin to start');
  await pinFromMenu(grid, columns[7], 'Unpin');

  root(grid).querySelector<HTMLButtonElement>('.column-chooser-button')!.click();
  await settle(grid);
  listBoxes(grid)[6].click();
  await settle(grid);

  // Busca (anúncio com espera) e reordenar pelo teclado, ida e volta.
  const search = chooser(grid)!.querySelector<HTMLInputElement>('.column-chooser-search')!;
  search.value = 'col';
  search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settle(grid);
  search.value = '';
  search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settle(grid);
  key(listBoxes(grid)[7], 'ArrowDown', { altKey: true, shiftKey: true });
  await settle(grid);
  key(listBoxes(grid)[8], 'ArrowUp', { altKey: true, shiftKey: true });
  await settle(grid);
};

describe('memória: recursos de coluna', () => {
  it('grid redimensionado, rolado, com seletor usado e removido com o seletor aberto é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const columns = makeColumns();
      const items = makeItems(60);
      const grid = await createColumnGrid(columns, items);

      await exercise(grid, columns);

      // Arrastar um cabeçalho até o seletor oculta a coluna (dropzone do interactjs).
      const visibleBefore = headers(grid).length;
      await dragHeaderToChooser(grid, headers(grid)[2]);
      expect(headers(grid).length).toBe(visibleBefore - 1);

      key(chooser(grid)!, 'Escape');
      await settle(grid);
      expect(chooser(grid)).toBeNull();

      root(grid).querySelector<HTMLButtonElement>('.column-chooser-button')!.click();
      await settle(grid);
      const panel = chooser(grid)!;
      expect(panel.matches(':popover-open')).toBe(true);
      expect(grid._memoryStats.chooserDropzones).toBe(1);

      const handle = handles(grid)[0];
      grid.remove();
      await settle(grid);
      expect(grid._memoryStats.chooserDropzones).toBe(0);

      return track({ grid, columns, column: columns[2], items, item: items[0], panel, handle });
    };

    await expectCollected(await scenario());
  });

  it('remover o grid no meio de um redimensionamento libera o grid', async () => {
    const scenario = async (): Promise<Tracked> => {
      const columns = makeColumns();
      const items = makeItems(20);
      const grid = await createColumnGrid(columns, items);
      const handle = handles(grid)[1];

      await dragHandle(grid, handle, 60, false);
      expect(root(grid).querySelector('.container')!.classList.contains('resizing')).toBe(true);

      grid.remove();
      await settle(grid);
      // O ponteiro solto depois não acha mais sessão nem listener.
      pointer('pointerup', handle, 0, 0, 7);

      return track({ grid, columns, column: columns[1], items, handle });
    };

    await expectCollected(await scenario());
  });

  it('grid de vida longa: seletor, redimensionar e fixar repetidos não crescem', async () => {
    const columns = makeColumns();
    const grid = await createColumnGrid(columns, makeItems(80));

    const round = async (): Promise<void> => {
      await exercise(grid, columns);
      // volta ao estado inicial de visibilidade e fecha o seletor
      listBoxes(grid)[6].click();
      await settle(grid);
      key(chooser(grid)!, 'Escape');
      await settle(grid);
      grid.columns = [...columns];
      await settle(grid);
    };

    // Aquecimento: 6 rodadas (eram 3). Com as bandas (frente 13) o caminho de
    // \`columns = [...]\` compila mais código no 1º terço; medido na main e aqui,
    // a inclinação por rodada é a mesma (~2 KiB, JIT/IC), só o degrau inicial mudou.
    for (let i = 0; i < 6; i++) {
      await round();
    }

    const statsBefore = grid._memoryStats;
    const before = await measureHeap();

    for (let i = 0; i < 30; i++) {
      await round();
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;
    const stats = grid._memoryStats;

    // Tolerâncias da spec 14 (ver grid.memory.browser.test.ts).
    // Uma entrada por coluna definida em cada mapa, no máximo (oscila com a
    // coluna oculta da rodada, mas não cresce com as rodadas).
    expect(stats.columnState).toBeLessThanOrEqual(COLUMN_COUNT * 6);
    expect(stats.chooserDropzones).toBe(0);
    expect(stats.dragAndDrop).toBe(statsBefore.dragAndDrop);
    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
  }, 120_000);

  it('trocar as colunas solta o estado das antigas', async () => {
    const grid = await createColumnGrid(makeColumns(), makeItems(10));

    const replace = async (): Promise<Tracked> => {
      const old = grid.columns;
      grid.setColumnWidth(old[1], 200);
      await pinFromMenu(grid, old[2], 'Pin to end');
      grid.openColumnChooser();
      await settle(grid);
      key(chooser(grid)!, 'Escape');

      grid.columns = makeColumns();
      await settle(grid);

      return track({ columns: old, column: old[1], pinned: old[2] });
    };

    await expectCollected(await replace());
  });
});
