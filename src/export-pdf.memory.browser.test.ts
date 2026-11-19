/**
 * Vazamento da exportação PDF (frente 26 + spec 14): o grid exportado (pela
 * API e pela barra, com exportação cancelada no meio) é coletado com items e
 * colunas; os workers são encerrados; exportar repetidamente num grid de
 * vida longa não cresce heap, nós nem listeners.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPdfExporter, exportPdf, type GridPdfFont } from './export-pdf/index.js';
import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const FONTS: GridPdfFont[] = [
  { source: new URL('./test/fonts/NotoSans-Regular.subset.ttf', import.meta.url).href },
  { source: new URL('./test/fonts/NotoSans-Bold.subset.ttf', import.meta.url).href, weight: 'bold' },
];

const makeItems = (count: number) => Array.from({ length: count }, (_, n) => ({ region: `R${n % 4}`, name: `N${n}`, amount: (n * 37) % 101 }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'region', label: 'Region', groupIndex: 0 },
  { path: 'name', label: 'Name' },
  { path: 'amount', label: 'Amount', format: { minimumFractionDigits: 2 } },
];

/** Conta workers vivos (criados e não encerrados). */
const countWorkers = () => {
  let alive = 0;
  const Original = Worker;
  // eslint-disable-next-line prefer-arrow/prefer-arrow-functions -- chamado com `new`: precisa ser `function`
  const spy = vi.spyOn(window, 'Worker').mockImplementation(function (this: Worker, url: string | URL, options?: WorkerOptions) {
    const worker = new Original(url, options);
    alive++;
    const terminate = worker.terminate.bind(worker);

    worker.terminate = () => {
      alive--;
      terminate();
    };

    return worker;
  });
  return { alive: () => alive, restore: () => spy.mockRestore() };
};

const worker = () => new Worker(new URL('./export-pdf/worker.ts', import.meta.url), { type: 'module' });

describe('memória da exportação PDF', () => {
  const stubClick = () => vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

  it('grid exportado em PDF (API, barra e cancelada) é coletado; workers encerrados', async () => {
    const click = stubClick();
    const workers = countWorkers();

    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(3000);
      const columns = makeColumns();
      const grid: DataGrid = await createGrid({ columns, items, height: '300px', configure: g => {
        g.exportFormats = ['pdf'];
        g.pdfExporter = createPdfExporter({ fonts: FONTS, worker });
      } });

      await exportPdf(grid, { fonts: FONTS, worker });
      grid.shadowRoot!.querySelector<HTMLButtonElement>('.export-button')!.click();
      await vi.waitFor(() => expect(click).toHaveBeenCalled(), { timeout: 10_000 });

      // Exportação pendente cancelada e grid removido no meio.
      const controller = new AbortController();
      const pending = exportPdf(grid, { fonts: FONTS, worker, signal: controller.signal }).catch((error: unknown) => error);
      grid.remove();
      controller.abort();
      expect(await pending).toMatchObject({ name: 'AbortError' });

      return track({ grid, items, item: items[0], columns, column: columns[1] });
    };

    try {
      await expectCollected(await scenario());
      expect(workers.alive()).toBe(0);
    } finally {
      workers.restore();
      click.mockRestore();
    }
  }, 60_000);

  it('exportar repetidamente num grid de vida longa não cresce heap, nós nem listeners', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(2000), height: '300px' });
    await settle(grid);

    for (let n = 0; n < 3; n++) {
      await exportPdf(grid, { fonts: FONTS, worker });
    }

    const before = await measureHeap();

    for (let n = 0; n < 10; n++) {
      await exportPdf(grid, { fonts: FONTS, worker });
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(delta.jsHeapUsed, report).toBeLessThan(1024 * 1024);
    expect(delta.nodes, report).toBeLessThan(30);
    expect(delta.listeners, report).toBeLessThan(30);
  }, 120_000);
});
