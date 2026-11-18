/**
 * Vazamento de memória da frente 05 (regra da spec 14): seleção por chave,
 * célula ativa (inclusive a linha "presa" fora da janela virtual), eventos e
 * teclado não podem segurar o grid, os `items` nem as colunas. Só eventos
 * sintéticos (o `userEvent` segura o último elemento sob o mouse).
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { aliveAfterGc, expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, n) => ({ region: `R${(n + seed) % 3}`, name: `Name ${n + seed}`, amount: n }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'region', label: 'Region' },
  { path: 'name', label: 'Name' },
  { path: 'amount', label: 'Amount' },
];

const key = async (grid: DataGrid, name: string, init: KeyboardEventInit = {}): Promise<void> => {
  const target = grid.shadowRoot!.activeElement ?? grid.shadowRoot!.querySelector('table [tabindex="0"]')!;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

/** Usa seleção (clique, caixa, teclado, API), navegação com virtualização e as alternativas ao arrasto. */
const exercise = async (grid: DataGrid): Promise<void> => {
  const onChange = () => undefined;
  grid.addEventListener('u-grid-selection-change', onChange);
  document.addEventListener('u-grid-focus-change', onChange);

  grid.focus();
  await key(grid, 'ArrowDown');
  await key(grid, ' ');
  await key(grid, 'ArrowDown', { shiftKey: true });
  await key(grid, 'a', { ctrlKey: true });
  await key(grid, 'PageDown');
  await key(grid, 'End', { ctrlKey: true });

  // Linha ativa sai da janela virtual (fica presa) e volta.
  const scroller = grid.shadowRoot!.querySelector<HTMLElement>('.scroll-container')!;
  scroller.scrollTop = 0;
  await settle(grid);
  await key(grid, 'Home', { ctrlKey: true });
  await key(grid, 'ArrowRight');

  // Alternativas ao arrasto: mover e agrupar pelo teclado; desagrupar pelo chip.
  await key(grid, 'ArrowRight', { altKey: true, shiftKey: true });
  await key(grid, 'g', { ctrlKey: true });
  const chip = grid.shadowRoot!.querySelector<HTMLElement>('.group')!;
  chip.focus();
  chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true, cancelable: true }));
  await settle(grid);
  await settle(grid);

  const checkbox = grid.shadowRoot!.querySelector<HTMLElement>('tbody .selection-cell')!;
  checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  grid.selectRows([grid.items[3]], { append: true });
  grid.focusCell(grid.items[5]);
  await settle(grid);

  grid.removeEventListener('u-grid-selection-change', onChange);
  document.removeEventListener('u-grid-focus-change', onChange);
};

describe('memória da seleção e do teclado', () => {
  it('grid com seleção, foco e teclado, removido, é coletado com items e colunas', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(800);
      const columns = makeColumns();
      const grid = await createGrid({
        columns,
        items,
        height: '300px',
        configure: g => {
          g.selectionMode = 'multiple';
          g.showCheckboxes = true;
        },
      });

      await exercise(grid);
      expect(grid.selectedKeys.length).toBeGreaterThan(0);
      grid.remove();
      // O virtualizador segura o grid até o timer de "fim da rolagem" (150 ms)
      // disparar: limitado, não é vazamento — espera antes de coletar.
      await new Promise(resolve => setTimeout(resolve, 300));

      return track({ grid, items, item: items[0], columns, column: columns[1] });
    };

    await expectCollected(await scenario());
  });

  it('vida longa: items trocados e seleção limpa soltam os objetos; uso repetido não cresce', async () => {
    const grid = await createGrid({
      columns: makeColumns(),
      items: makeItems(2000),
      height: '300px',
      configure: g => g.selectionMode = 'multiple',
    });

    const swap = async (seed: number): Promise<Tracked> => {
      const items = makeItems(2000, seed);
      grid.items = items;
      await settle(grid);
      grid.focus();
      await key(grid, 'ArrowDown');
      await key(grid, 'a', { ctrlKey: true });
      await key(grid, 'PageDown');
      grid.clearSelection();
      grid.items = makeItems(2000, seed + 1);
      await settle(grid);

      return track({ items, item: items[0] });
    };

    await expectCollected(await swap(1));

    // Aquecimento: JIT e caches internos do navegador estabilizam.
    for (let n = 0; n < 8; n++) {
      await swap(10 + n * 3);
    }

    const before = await measureHeap();

    for (let n = 0; n < 20; n++) {
      await swap(100 + n * 3);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(grid._memoryStats.selectedKeys).toBe(0);
    expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
    expect(await aliveAfterGc(await swap(500))).toEqual([]);
  }, 120_000);
});
