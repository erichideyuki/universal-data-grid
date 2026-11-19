/**
 * Vazamento de memória do menu do cabeçalho e do seletor (regra da spec 14):
 * o submenu "Fixar coluna ▸" aberto (popover, listener de documento), o
 * botão "⋮", a busca do seletor (timer do anúncio) e o arrasto pela alça
 * (listeners na alça com o ponteiro capturado) não podem segurar o grid, e o
 * uso repetido num grid de vida longa não cresce.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(() => {
  cleanup();
});

const makeItems = (count: number) =>
  Array.from({ length: count }, (_, n) => ({ id: n, region: `R${n % 4}`, name: `N${n}`, amount: (n * 37) % 101 }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'region', label: 'Region' },
  { path: 'name', label: 'Name' },
  { path: 'amount', label: 'Amount' },
  { path: 'id', label: 'Id' },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const chooser = (grid: DataGrid) => root(grid).querySelector<HTMLElement>('.column-chooser');

const key = async (grid: DataGrid, target: HTMLElement, name: string, init: KeyboardEventInit = {}): Promise<void> => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const configure = (grid: DataGrid): void => {
  grid.columnChooser = true;
  grid.columnResizing = true;
};

const typeSearch = async (grid: DataGrid, text: string): Promise<void> => {
  const search = chooser(grid)!.querySelector<HTMLInputElement>('.column-chooser-search')!;
  search.value = text;
  search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settle(grid);
};

/** Menu pelo "⋮", submenu aberto e fechado, fixar e soltar, seletor com busca, "Mostrar todas", reordenar (teclado e alça). */
const exercise = async (grid: DataGrid): Promise<void> => {
  const button = root(grid).querySelector<HTMLElement>('.column-header-menu-button')!;
  await key(grid, button, 'Enter');
  const pin = root(grid).querySelector<HTMLElement>('.context-menu-panel [aria-haspopup=menu]')!;
  pin.focus();
  await key(grid, pin, 'ArrowRight');
  root(grid).querySelector<HTMLElement>('.context-menu-panel-submenu [role=menuitemradio]')!.click();
  await settle(grid);

  root(grid).querySelector<HTMLElement>('.column-header-menu-button')!.click();
  await settle(grid);
  root(grid).querySelector<HTMLElement>('.context-menu-panel [aria-haspopup=menu]')!.click();
  await settle(grid);
  [...root(grid).querySelectorAll<HTMLElement>('.context-menu-panel-submenu [role=menuitemradio]')].at(-1)!.click();
  await settle(grid);

  grid.openColumnChooser();
  await settle(grid);
  await typeSearch(grid, 'n');
  await typeSearch(grid, '');
  // "Mostrar todas" desmarca (oculta todas menos a última) e marca de novo: a rodada volta ao estado de antes.
  const all = chooser(grid)!.querySelector<HTMLInputElement>('.column-chooser-all input')!;
  all.click();
  await settle(grid);
  all.click();
  await settle(grid);

  const boxes = () => [...chooser(grid)!.querySelectorAll<HTMLInputElement>('.column-chooser-list input')];
  await key(grid, boxes()[1], 'ArrowDown', { altKey: true, shiftKey: true });
  await key(grid, boxes()[2], 'ArrowUp', { altKey: true, shiftKey: true });

  const handle = chooser(grid)!.querySelector<HTMLElement>('.column-chooser-drag-handle')!;
  const pointer = (type: string) => handle.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, clientX: 4, clientY: 4,
  }));
  pointer('pointerdown');
  pointer('pointerup');
  await key(grid, chooser(grid)!, 'Escape');
};

describe('memória do menu do cabeçalho e do seletor', () => {
  it('grid removido com o submenu aberto, a busca esperando o anúncio e um arrasto da alça em curso é coletado', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(200);
      const columns = makeColumns();
      const grid = await createGrid({ columns, items, height: '300px', configure });

      await exercise(grid);

      // Submenu aberto ao remover (popover e listener de documento do menu).
      root(grid).querySelector<HTMLElement>('.column-header-menu-button')!.click();
      await settle(grid);
      root(grid).querySelector<HTMLElement>('.context-menu-panel [aria-haspopup=menu]')!.click();
      await settle(grid);
      const submenu = root(grid).querySelector<HTMLElement>('.context-menu-panel-submenu')!;
      expect(submenu.matches(':popover-open')).toBe(true);
      grid.remove();

      return track({ grid, items, item: items[0], columns, column: columns[1], submenu });
    };

    await expectCollected(await scenario());
  });

  it('seletor removido no meio da busca e do arrasto não deixa timer nem listener', async () => {
    const scenario = async (): Promise<Tracked> => {
      const columns = makeColumns();
      const grid = await createGrid({ columns, items: makeItems(20), height: '300px', configure });
      grid.openColumnChooser();
      await settle(grid);
      await typeSearch(grid, 'a');
      const handle = chooser(grid)!.querySelector<HTMLElement>('.column-chooser-drag-handle')!;
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, cancelable: true, pointerId: 2, isPrimary: true, button: 0 }));
      expect(grid._memoryStats.chooserTimers).toBe(2);

      grid.remove();
      expect(grid._memoryStats.chooserTimers).toBe(0);
      return track({ grid, columns, handle });
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

    for (let n = 0; n < 15; n++) {
      await exercise(grid);
    }

    await new Promise(resolve => setTimeout(resolve, 600));
    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
    expect(grid._memoryStats).toMatchObject({ menuTimers: 0, chooserTimers: 0 });
  }, 120_000);
});
