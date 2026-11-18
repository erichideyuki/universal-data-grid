/**
 * Vazamento de memória da exportação e da área de transferência (frente 12
 * + regra da spec 14): o instantâneo da exportação, a exportação abortada no
 * meio (promessa pendente em fatias), o download (URL de objeto + timer) e o
 * `copy` não podem segurar o grid, os `items` nem as colunas.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, n) => ({ region: `R${(n + seed) % 4}`, name: `N${n}`, amount: (n * 37 + seed) % 101 }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'region', label: 'Region', groupIndex: 0 },
  { path: 'name', label: 'Name' },
  { path: 'amount', label: 'Amount', format: { minimumFractionDigits: 2 } },
];

/** `copy` sintético numa célula de dados (o mesmo caminho do Ctrl+C). */
const copyFromCell = (grid: DataGrid): DataTransfer => {
  const clipboardData = new DataTransfer();
  const cell = grid.shadowRoot!.querySelector<HTMLElement>('tbody tr[data-index] td[role=gridcell]:not(.grouping-cell)')
    ?? grid.shadowRoot!.querySelector<HTMLElement>('tbody td[role=gridcell]')!;
  cell.focus();
  cell.dispatchEvent(new ClipboardEvent('copy', { clipboardData, bubbles: true, composed: true, cancelable: true }));
  return clipboardData;
};

/** Usa os caminhos da frente: dados, CSV (todas as opções), download, cópia e cópia cancelada. */
const exercise = async (grid: DataGrid): Promise<void> => {
  const onCopying = (event: Event) => event.preventDefault();

  await grid.getExportData();
  await grid.getExportData({ selectedOnly: true, includeGroups: false });
  await grid.exportCsv({ rawValues: true, separator: ';' });
  await grid.downloadCsv({ fileName: 'x.csv' });
  grid.selectAll();
  await settle(grid);
  copyFromCell(grid);
  grid.addEventListener('u-grid-copying', onCopying);
  copyFromCell(grid);
  grid.removeEventListener('u-grid-copying', onCopying);
  grid.clearSelection();
  await settle(grid);
  copyFromCell(grid);
};

describe('memória da exportação e da área de transferência', () => {
  // O download clica num <a>: sem navegar de verdade no teste.
  const stubClick = () => vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

  it('grid exportado, copiado e com exportação abortada no meio é coletado com items e colunas', async () => {
    const click = stubClick();

    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(5000);
      const columns = makeColumns();
      const grid = await createGrid({ columns, items, height: '300px', configure: g => g.selectionMode = 'multiple' });

      await exercise(grid);

      // Exportação pendente (em fatias: precisa passar de uma fatia) abortada depois de remover o grid.
      const big = makeItems(100_000);
      grid.items = big;
      await settle(grid);
      const controller = new AbortController();
      const pending = grid.exportCsv({ signal: controller.signal }).catch((error: unknown) => error);
      grid.remove();
      controller.abort();
      expect(await pending).toMatchObject({ name: 'AbortError' });

      return track({ grid, items, item: items[0], big, columns, column: columns[1] });
    };

    try {
      await expectCollected(await scenario());
    } finally {
      click.mockRestore();
    }
  });

  it('exportar e copiar repetidamente num grid de vida longa não cresce heap, nós nem listeners', async () => {
    const click = stubClick();
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(3000), height: '300px', configure: g => g.selectionMode = 'multiple' });

    try {
      for (let n = 0; n < 3; n++) {
        await exercise(grid);
      }

      // Os timers de revogação das URLs (1 s) terminam antes de medir.
      await new Promise(resolve => setTimeout(resolve, 1100));
      const before = await measureHeap();

      for (let n = 0; n < 15; n++) {
        await exercise(grid);
      }

      await new Promise(resolve => setTimeout(resolve, 1100));
      const delta = heapDelta(before, await measureHeap());
      const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

      expect(delta.jsHeapUsed, report).toBeLessThan(512 * 1024);
      expect(delta.nodes, report).toBeLessThan(30);
      expect(delta.listeners, report).toBeLessThan(30);
    } finally {
      click.mockRestore();
    }
  }, 120_000);
});
