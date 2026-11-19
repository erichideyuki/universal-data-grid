/**
 * Frente 26: exportação PDF (`@universal-material/data-grid/export-pdf`).
 * O PDF gerado é lido de volta com pdf.js: texto, árvore de estrutura,
 * idioma, título; e a interface (barra, cancelar, progresso).
 */
import axe from 'axe-core';
import * as pdfjs from 'pdfjs-dist';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createPdfExporter, exportPdf, type GridPdfFont, GridPdfMissingGlyphError } from './export-pdf/index.js';
import type { GridExporter } from './export/types.js';
import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';

afterEach(cleanup);

beforeAll(() => {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
});

const fontUrl = (name: string) => new URL(`./test/fonts/${name}`, import.meta.url).href;

const FONTS: GridPdfFont[] = [
  { source: fontUrl('NotoSans-Regular.subset.ttf') },
  { source: fontUrl('NotoSans-Bold.subset.ttf'), weight: 'bold' },
  { source: fontUrl('NotoSansArabic-Regular.subset.ttf') },
  { source: fontUrl('NotoSansHebrew-Regular.subset.ttf') },
];

/** Worker do código-fonte (o Vite serve o `.ts`). */
const worker = () => new Worker(new URL('./export-pdf/worker.ts', import.meta.url), { type: 'module' });

interface Sale {
  name: string;
  country: string;
  amount: number;
  note: string;
}

const sales = (): Sale[] => [
  { name: 'Ana', country: 'Brazil', amount: 1200.5, note: 'ok' },
  { name: 'محمد علي', country: 'Egypt', amount: -5, note: 'ملاحظة مهمة' },
  { name: 'Caio', country: 'Brazil', amount: 300, note: 'नमस्ते दुनिया' },
  { name: 'שלום', country: 'Israel', amount: 40, note: 'Order #123 — طلب جديد' },
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'country', label: 'Country' },
  { path: 'amount', label: 'Amount', format: { minimumFractionDigits: 2 } },
  { path: 'note', label: 'Note' },
];

const create = (configure?: (grid: DataGrid) => void): Promise<DataGrid> =>
  createGrid({
    columns: columns(),
    items: sales(),
    configure: grid => {
      grid.language = 'en';
      grid.setAttribute('aria-label', 'Sales');
      configure?.(grid);
    },
  });

interface Read {
  pages: number;
  text: string;
  roles: Record<string, number>;
  info: Record<string, unknown>;
  marked: boolean;
}

const read = async (blob: Blob): Promise<Read> => {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const roles: Record<string, number> = {};

  const walk = (node: { role?: string; children?: unknown[] } | null) => {
    if (!node) {
      return;
    }

    if (node.role) {
      roles[node.role] = (roles[node.role] ?? 0) + 1;
    }

    (node.children ?? []).forEach(child => walk(child as { role?: string; children?: unknown[] }));
  };

  let text = '';

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    text += `${(await page.getTextContent()).items.map(item => 'str' in item ? item.str : '').join(' ')}\n`;

    if (i === 1) {
      walk(await page.getStructTree());
    }
  }

  const meta = await doc.getMetadata();
  const mark = await doc.getMarkInfo();
  const result = { pages: doc.numPages, text, roles, info: meta.info as Record<string, unknown>, marked: !!mark?.Marked };
  await doc.destroy();
  return result;
};

describe('exportPdf', () => {
  it('gera um PDF marcado do que o usuário vê (título, idioma, tabela)', async () => {
    const grid = await create();
    const blob = await exportPdf(grid, { fonts: FONTS, worker });
    expect(blob.type).toBe('application/pdf');

    const pdf = await read(blob);
    expect(pdf.marked).toBe(true);
    expect(pdf.info.Title).toBe('Sales');
    expect(pdf.info.Language).toBe('en');
    expect(pdf.roles.Table).toBe(1);
    expect(pdf.roles.TH).toBeGreaterThanOrEqual(4);
    expect(pdf.roles.TD).toBeGreaterThanOrEqual(12);
    expect(pdf.text).toContain('Sales');
    expect(pdf.text).toContain('Amount');
    expect(pdf.text).toContain('1,200.50');
  });

  it('na thread principal (`worker: false`) dá o mesmo resultado', async () => {
    const grid = await create();
    const pdf = await read(await exportPdf(grid, { fonts: FONTS, worker: false }));
    expect(pdf.roles.Table).toBe(1);
    expect(pdf.text).toContain('Caio');
  });

  it('caractere sem glifo em nenhuma fonte rejeita com GridPdfMissingGlyphError', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: [{ name: '東京', country: 'Japan', amount: 1, note: '' }],
      configure: g => {
        g.language = 'en';
      },
    });

    const error = await exportPdf(grid, { fonts: FONTS, worker }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GridPdfMissingGlyphError);
    expect((error as GridPdfMissingGlyphError).codePoints).toEqual([0x4eac, 0x6771]);
  });

  it('opções inválidas: TypeError na configuração', () => {
    expect(() => createPdfExporter({ fonts: [] })).toThrow(TypeError);
    expect(() => createPdfExporter({ fonts: [{ source: 42 as never }] })).toThrow(TypeError);
  });

  it('abortar rejeita com o motivo do sinal', async () => {
    const grid = await create();
    const controller = new AbortController();
    const promise = exportPdf(grid, { fonts: FONTS, worker, signal: controller.signal });
    controller.abort(new DOMException('stop', 'AbortError'));
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('agrupado: linhas de grupo e total, marcadores', async () => {
    const grid = await create(g => {
      g.columns = columns().map(c => c.path === 'amount' ? { ...c, summaries: [{ type: 'sum' }] } : c);
    });
    grid.groupColumn(grid.columns.find(c => c.path === 'country')!);
    await settle(grid);

    const pdf = await read(await exportPdf(grid, { fonts: FONTS, worker }));
    expect(pdf.text).toContain('Brazil');
    expect(pdf.roles.TFoot ?? 0).toBeLessThanOrEqual(1);
  });

  it('customizeCell muda texto e estilo; contraste ruim cai no padrão com aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
    });
    const grid = await create();
    const pdf = await read(await exportPdf(grid, {
      fonts: FONTS,
      worker,
      customizeCell: cell => {
        if (cell.rowType === 'data' && cell.column?.label === 'Name') {
          cell.text = `${cell.text}!`;
          cell.style.color = '#eeeeee';
        }
      },
    }));
    expect(pdf.text).toContain('Ana!');
    expect(warn.mock.calls.some(([m]) => String(m).includes('contrast'))).toBe(true);
    warn.mockRestore();
  });
});

describe('interface (barra de exportação)', () => {
  it('formato pdf aparece com pdfExporter e exporta pela barra', async () => {
    const download = vi.fn();
    const grid = await create(g => {
      g.exportFormats = ['pdf'];

      g.pdfExporter = (target, { onProgress }) => {
        onProgress?.({ rowCount: 1, totalCount: 2, pageCount: 1 });
        download(target);
        return Promise.resolve();
      };
    });
    await settle(grid);

    const button = grid.shadowRoot!.querySelector<HTMLButtonElement>('.export-button')!;
    expect(button.getAttribute('aria-label')).toBe('Export to PDF');
    button.click();
    await vi.waitFor(() => expect(download).toHaveBeenCalledOnce());
  });

  it('cancelExport cancela sem u-grid-export-error', async () => {
    const errors = vi.fn();
    let started!: () => void;
    const begun = new Promise<void>(resolve => started = resolve);
    const grid = await create(g => {
      g.exportFormats = ['pdf'];
      g.pdfExporter = (_target, { signal }) => new Promise((_resolve, reject) => {
        started();
        signal.addEventListener('abort', () => reject(signal.reason));
      });
    });
    grid.addEventListener('u-grid-export-error', errors);
    await settle(grid);

    const button = grid.shadowRoot!.querySelector<HTMLButtonElement>('.export-button')!;
    button.click();
    await begun;
    await settle(grid);
    expect(button.getAttribute('aria-label')).toBe('Cancel export');
    grid.cancelExport();
    await vi.waitFor(() => expect(button.getAttribute('aria-label')).toBe('Export to PDF'));
    expect(errors).not.toHaveBeenCalled();
  });

  /** Exportador que só termina quando o teste manda (`finish`) ou cancela. */
  const pending = () => {
    let finish!: () => void;
    let started!: () => void;
    const begun = new Promise<void>(resolve => started = resolve);
    const exporter = vi.fn((_target: DataGrid, { signal, onProgress }: Parameters<GridExporter>[1]) => new Promise<void>((resolve, reject) => {
      finish = resolve;
      onProgress?.({ rowCount: 40, totalCount: 100, pageCount: 2 });
      started();
      signal.addEventListener('abort', () => reject(signal.reason));
    }));
    return { exporter, begun, finish: () => finish() };
  };

  const shadow = (grid: DataGrid) => grid.shadowRoot!;
  const live = (grid: DataGrid) => shadow(grid).querySelector<HTMLElement>('[role=status]')!;
  const items = (grid: DataGrid) => [...shadow(grid).querySelectorAll<HTMLElement>('[role=menu] [role=menuitem]')];

  it('teclado: Enter exporta, o foco fica no botão (agora "Cancel export", progresso na descrição), Enter cancela', async () => {
    const { exporter, begun } = pending();
    const grid = await create(g => {
      g.exportFormats = ['pdf'];
      g.pdfExporter = exporter;
    });
    await settle(grid);
    const button = shadow(grid).querySelector<HTMLButtonElement>('.export-button')!;
    button.focus();
    await userEvent.keyboard('{Enter}');
    await begun;
    await settle(grid);

    expect(shadow(grid).activeElement).toBe(button);
    expect(button.getAttribute('aria-label')).toBe('Cancel export');
    const described = shadow(grid).getElementById(button.getAttribute('aria-describedby')!)!;
    expect(described.textContent).toBe('Exporting… 40%');
    expect(described.getAttribute('lang')).toBe('en');

    // clique duplo / repetição de tecla logo depois de começar não cancela
    await userEvent.keyboard('{Enter}');
    await settle(grid);
    expect(button.getAttribute('aria-label')).toBe('Cancel export');

    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(live(grid).textContent.trim()).toBe('Export canceled'));
    expect(shadow(grid).activeElement).toBe(button);
    expect(button.getAttribute('aria-label')).toBe('Export to PDF');
  });

  it('menu: "Cancel export" no topo; acabar com o menu aberto não muda as posições (desabilita)', async () => {
    const { exporter, begun, finish } = pending();
    const grid = await create(g => {
      g.exportFormats = ['csv', 'pdf'];
      g.pdfExporter = exporter;
    });
    await settle(grid);
    const button = shadow(grid).querySelector<HTMLButtonElement>('.export-button')!;
    button.focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    items(grid).find(item => item.textContent.includes('PDF'))!.click();
    await begun;
    await settle(grid);

    button.focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    expect(items(grid).map(item => item.textContent.trim())).toEqual(['Cancel export', 'Export to CSV', 'Export to PDF']);
    expect(shadow(grid).activeElement).toBe(items(grid)[0]);
    expect((await axe.run(grid as unknown as Element)).violations.map(v => v.id)).toEqual([]);

    finish();
    await vi.waitFor(() => expect(live(grid).textContent.trim()).toBe('Exported to PDF'));
    await settle(grid);
    expect(items(grid).map(item => item.textContent.trim())).toEqual(['Cancel export', 'Export to CSV', 'Export to PDF']);
    expect(items(grid)[0].getAttribute('aria-disabled')).toBe('true');
    expect(items(grid)[1].getAttribute('aria-disabled')).toBe('false');
    expect(shadow(grid).activeElement).toBe(items(grid)[0]);

    await userEvent.keyboard('{Escape}');
    await settle(grid);
    expect(shadow(grid).activeElement).toBe(button);
    button.focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    expect(items(grid).map(item => item.textContent.trim())).toEqual(['Export to CSV', 'Export to PDF']);
  });

  it('axe sem violações com a exportação em curso, em RTL (ar)', async () => {
    const { exporter, begun } = pending();
    const grid = await create(g => {
      g.language = 'ar';
      g.setAttribute('dir', 'rtl');
      g.exportFormats = ['pdf'];
      g.pdfExporter = exporter;
    });
    await settle(grid);
    shadow(grid).querySelector<HTMLButtonElement>('.export-button')!.click();
    await begun;
    await settle(grid);
    expect((await axe.run(grid as unknown as Element)).violations.map(v => `${v.id}: ${v.nodes.map(n => n.html).join(' | ')}`)).toEqual([]);
    grid.cancelExport();
  });
});
