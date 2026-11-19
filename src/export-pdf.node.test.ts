/**
 * Frente 26 no Node (SSR, servidor): importar a entrada não quebra e
 * `exportPdf` gera a partir de dados prontos (`GridExportData`) na thread
 * principal, com fontes e o `.wasm` lidos de `file:`.
 */
import { describe, expect, it } from 'vitest';

import { readFileUrl } from './export-pdf/engine.js';
import { exportPdf, GridPdfMissingGlyphError } from './export-pdf/index.js';
import type { GridExportData } from './export/types.js';

const font = (name: string) => new URL(`./test/fonts/${name}`, import.meta.url);

const data = (texts: string[][]): GridExportData => ({
  columns: [
    { column: { path: 'name' }, label: 'Name', alignment: 'start' },
    { column: { path: 'note' }, label: 'Note', alignment: 'start' },
  ],
  rows: texts.map(([a, b]) => ({ rowType: 'data', level: 0, item: {}, values: [a, b], texts: [a, b], fixed: null })),
});

describe('exportPdf no Node', () => {
  it('gera o PDF de dados prontos (worker: false)', async () => {
    const blob = await exportPdf(data([['Ana', 'ok'], ['محمد', 'שלום']]), {
      fonts: [
        { source: font('NotoSans-Regular.subset.ttf') },
        { source: await readFileUrl(font('NotoSans-Bold.subset.ttf').href), weight: 'bold' },
        { source: font('NotoSansArabic-Regular.subset.ttf') },
        { source: font('NotoSansHebrew-Regular.subset.ttf') },
      ],
      worker: false,
      title: 'Node',
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const head = new TextDecoder().decode(bytes.subarray(0, 8));
    const tail = new TextDecoder().decode(bytes.subarray(bytes.length - 6));
    expect(head).toBe('%PDF-1.7');
    expect(tail).toBe('%%EOF\n');
  });

  it('sem fonte para o texto: GridPdfMissingGlyphError', async () => {
    const error = await exportPdf(data([['東京', '']]), { fonts: [{ source: font('NotoSans-Regular.subset.ttf') }], worker: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GridPdfMissingGlyphError);
  });
});
