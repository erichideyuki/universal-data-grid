/**
 * Vazamento de memória da barra e dos menus (frente 18 + regra da spec 14):
 * listeners de documento dos menus abertos ao remover, popovers, timers
 * (busca por letra, toque longo, anúncio da exportação), a exportação em
 * curso (signal) e o conteúdo `renderer` da barra não podem segurar o grid.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const makeItems = (count: number) =>
  Array.from({ length: count }, (_, n) => ({ id: n, region: `R${n % 4}`, name: `N${n}`, amount: (n * 37) % 101 }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'region', label: 'Region' },
  { path: 'name', label: 'Name' },
  { path: 'amount', label: 'Amount' },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const menuItems = (grid: DataGrid) => [...root(grid).querySelectorAll<HTMLElement>('[role=menuitem]')];

const key = async (grid: DataGrid, target: HTMLElement, name: string, init: KeyboardEventInit = {}): Promise<void> => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const configure = (grid: DataGrid): void => {
  grid.keyExpr = 'id';
  grid.rowMenu = true;
  grid.columnChooser = true;
  grid.selectionMode = 'multiple';
  grid.exportFormats = ['csv', 'xlsx'];
  grid.xlsxExporter = () => Promise.resolve();
  grid.toolbarItems = [
    'groupPanel',
    'exportButton',
    'columnChooserButton',
    { text: 'Refresh', action: () => undefined, locateInMenu: 'always' },
    { renderer: () => document.createElement('input') },
  ];
};

/** Usa os caminhos da frente: menus de contexto (mouse e teclado, busca por letra), "mais", exportar, toque longo. */
const exercise = async (grid: DataGrid): Promise<void> => {
  const onOpening = (event: CustomEvent) => event.detail.menuItems.push({ text: 'Host', action: () => undefined });
  grid.addEventListener('u-grid-context-menu-opening', onOpening as EventListener);

  const cell = root(grid).querySelector<HTMLElement>('td[role=gridcell]')!;
  cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 10, clientY: 10 }));
  await settle(grid);
  await key(grid, menuItems(grid)[0], 'h');
  await key(grid, menuItems(grid)[0], 'Escape');

  const header = root(grid).querySelector<HTMLElement>('th.header-column')!;
  header.focus();
  await key(grid, header, 'F10', { shiftKey: true });
  await key(grid, menuItems(grid)[0], 'Escape');

  root(grid).querySelector<HTMLElement>('.toolbar-more-button')!.click();
  await settle(grid);
  menuItems(grid)[0].click();
  await settle(grid);

  root(grid).querySelector<HTMLElement>('.export-button')!.click();
  await settle(grid);
  menuItems(grid).find(item => item.textContent.includes('Excel'))!.click();
  await settle(grid);

  // Toque longo começado e cancelado pelo movimento.
  const touch = (type: string, x: number) => cell.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerType: 'touch', isPrimary: true, pointerId: 3, clientX: x, clientY: 10,
  }));
  touch('pointerdown', 10);
  touch('pointermove', 60);

  grid.removeEventListener('u-grid-context-menu-opening', onOpening as EventListener);
};

describe('memória da barra e dos menus', () => {
  it('grid com menu aberto, toque longo armado e exportação em curso ao remover é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(400);
      const columns = makeColumns();
      const grid = await createGrid({ columns, items, height: '300px', configure });

      await exercise(grid);

      // Ao remover: menu de contexto aberto (listener no documento), busca por letra pendente,
      // toque longo armado e exportação em curso (promessa que só termina no abort).
      let exportSignal: AbortSignal | undefined;

      grid.xlsxExporter = (_grid, { signal }) => {
        exportSignal = signal;
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
      };

      root(grid).querySelector<HTMLElement>('.export-button')!.click();
      await settle(grid);
      menuItems(grid).find(item => item.textContent.includes('Excel'))!.click();
      await settle(grid);

      const cell = root(grid).querySelector<HTMLElement>('td[role=gridcell]')!;
      cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 10, clientY: 10 }));
      await settle(grid);
      await key(grid, menuItems(grid)[0], 'c');
      cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerType: 'touch', isPrimary: true, pointerId: 4 }));
      expect(grid._memoryStats.longPressTimers).toBe(1);
      grid.remove();

      expect(exportSignal!.aborted).toBe(true);
      expect(grid._memoryStats).toMatchObject({ menuTimers: 0, longPressTimers: 0, exportTimers: 0 });

      return track({ grid, items, item: items[0], columns, column: columns[1] });
    };

    await expectCollected(await scenario());
  });

  it('usar repetidamente num grid de vida longa não cresce heap, nós nem listeners', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(2000), height: '300px', configure });

    for (let n = 0; n < 3; n++) {
      await exercise(grid);
    }

    await new Promise(resolve => setTimeout(resolve, 600));
    const before = await measureHeap();
    const stats = { ...grid._memoryStats };

    for (let n = 0; n < 15; n++) {
      await exercise(grid);
    }

    await new Promise(resolve => setTimeout(resolve, 600));
    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
    expect(grid._memoryStats.toolbarWidths).toBe(stats.toolbarWidths);
    expect(grid._memoryStats).toMatchObject({ menuTimers: 0, longPressTimers: 0, exportTimers: 0 });
  }, 120_000);
});
