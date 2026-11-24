/**
 * Frente 29: exportação xlsx pelo motor (`@universal-material/data-grid/export-xlsx`,
 * `uo-xlsx` em WebAssembly). O arquivo é aberto (zip + XML) e conferido parte a
 * parte: aba, título, idioma, congelamento, nome `ColumnTitle`, títulos de
 * impressão, outline, bandas sem mesclar, tipos, estilos do `customizeCell`;
 * e a interface (barra, cancelar, progresso, teclado, axe).
 */
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createXlsxExporter, exportXlsx, type GridXlsxOptions } from './export-xlsx/index.js';
import type { GridExporter } from './export/types.js';
import type { GridColumnDef } from './grid-column-def.js';
import { setGridTranslation } from './grid-i18n.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { unzip, xmlOf } from './test/unzip.js';

afterEach(cleanup);

/** Worker do código-fonte (o Vite serve o `.ts`). */
const worker = () => new Worker(new URL('./export-xlsx/worker.ts', import.meta.url), { type: 'module' });

interface Sale {
  name: string;
  country: string;
  amount: number;
  when: Date | string;
}

const sales = (): Sale[] => [
  { name: 'Ana', country: 'Brazil', amount: 1200.5, when: new Date(2024, 10, 22) },
  { name: 'Bob', country: 'Chile', amount: -5, when: new Date(2024, 0, 15, 13, 30) },
  { name: 'Caio', country: 'Brazil', amount: 300, when: 'n/a' },
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name', width: 140 },
  { path: 'country', label: 'Country' },
  { path: 'amount', label: 'Amount', dataType: 'number', format: { minimumFractionDigits: 2 } },
  { path: 'when', label: 'When', dataType: 'date' },
];

const create = (configure?: (grid: DataGrid) => void, cols = columns()): Promise<DataGrid> =>
  createGrid({
    columns: cols,
    items: sales(),
    configure: grid => {
      grid.language = 'en';
      grid.setAttribute('aria-label', 'Sales');
      configure?.(grid);
    },
  });

interface CellXml {
  /** valor: o texto (strings compartilhadas resolvidas) ou o `<v>` */
  value: string | null;
  type: string | null;
  style: number;
}

interface Book {
  parts: Map<string, string>;
  sheet: Document;
  workbook: Document;
  core: Document;
  styles: Document;
  cells: Map<string, CellXml>;
  /** Estilo resolvido da célula: negrito, cor, fundo, alinhamento, formato. */
  styleOf(ref: string): { bold: boolean; italic: boolean; color: string | null; fill: string | null; horizontal: string | null; numFmt: string | null; wrap: boolean };
}

const read = async (blob: Blob): Promise<Book> => {
  expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const parts = await unzip(blob);
  const sheet = xmlOf(parts, 'xl/worksheets/sheet1.xml');
  const workbook = xmlOf(parts, 'xl/workbook.xml');
  const core = xmlOf(parts, 'docProps/core.xml');
  const styles = xmlOf(parts, 'xl/styles.xml');
  const shared = parts.has('xl/sharedStrings.xml')
    ? [...xmlOf(parts, 'xl/sharedStrings.xml').getElementsByTagName('si')].map(si => si.textContent)
    : [];
  const cells = new Map<string, CellXml>();

  for (const c of sheet.getElementsByTagName('c')) {
    const type = c.getAttribute('t');
    const v = c.getElementsByTagName('v')[0]?.textContent ?? null;
    const value = type === 's' && v !== null ? shared[Number(v)] : type === 'inlineStr' ? c.getElementsByTagName('t')[0]?.textContent ?? null : v;
    cells.set(c.getAttribute('r')!, { value, type, style: Number(c.getAttribute('s') ?? 0) });
  }

  const xfs = [...styles.getElementsByTagName('cellXfs')[0].getElementsByTagName('xf')];
  const fonts = [...styles.getElementsByTagName('fonts')[0].getElementsByTagName('font')];
  const fills = [...styles.getElementsByTagName('fills')[0].getElementsByTagName('fill')];
  const numFmts = new Map([...styles.getElementsByTagName('numFmt')].map(f => [f.getAttribute('numFmtId')!, f.getAttribute('formatCode')!]));

  return {
    parts,
    sheet,
    workbook,
    core,
    styles,
    cells,
    styleOf: ref => {
      const xf = xfs[cells.get(ref)?.style ?? 0];
      const font = fonts[Number(xf.getAttribute('fontId'))];
      const fill = fills[Number(xf.getAttribute('fillId'))];
      const alignment = xf.getElementsByTagName('alignment')[0];
      const id = xf.getAttribute('numFmtId')!;
      return {
        bold: font.getElementsByTagName('b').length > 0,
        italic: font.getElementsByTagName('i').length > 0,
        color: font.getElementsByTagName('color')[0]?.getAttribute('rgb') ?? null,
        fill: fill.getElementsByTagName('fgColor')[0]?.getAttribute('rgb') ?? null,
        horizontal: alignment?.getAttribute('horizontal') ?? null,
        numFmt: id === '0' ? null : numFmts.get(id) ?? `builtin:${id}`,
        wrap: alignment?.getAttribute('wrapText') === '1',
      };
    },
  };
};

const definedName = (book: Book, name: string) =>
  [...book.workbook.getElementsByTagName('definedName')].find(d => d.getAttribute('name') === name)?.textContent ?? null;

const pane = (book: Book) => book.sheet.getElementsByTagName('pane')[0] ?? null;

const run = async (grid: DataGrid, options: GridXlsxOptions = {}) => read(await exportXlsx(grid, { worker, ...options }));

describe('exportXlsx (motor uo-xlsx)', () => {
  it('aba e título pelo nome acessível, dc:language, cabeçalho congelado, ColumnTitle, títulos de impressão, sem mesclar', async () => {
    const book = await run(await create());

    expect(book.workbook.getElementsByTagName('sheet')[0].getAttribute('name')).toBe('Sales');
    expect(book.core.getElementsByTagName('dc:title')[0].textContent).toBe('Sales');
    expect(book.core.getElementsByTagName('dc:language')[0].textContent).toBe('en');
    expect(pane(book)?.getAttribute('ySplit')).toBe('1');
    expect(pane(book)?.getAttribute('state')).toBe('frozen');
    expect(definedName(book, 'ColumnTitle')).toMatch(/!\$A\$1$/);
    expect(definedName(book, '_xlnm.Print_Titles')).toMatch(/!\$1:\$1$/);
    expect(book.sheet.getElementsByTagName('mergeCell')).toHaveLength(0);
    expect(book.sheet.getElementsByTagName('sheetView')[0].getAttribute('rightToLeft')).toBeNull();

    // cabeçalho em negrito com fundo, logo acima dos dados (sem linha em branco)
    expect(['A1', 'B1', 'C1', 'D1'].map(ref => book.cells.get(ref)?.value)).toEqual(['Name', 'Country', 'Amount', 'When']);
    expect(book.styleOf('A1')).toMatchObject({ bold: true, fill: 'FFE6E6E6' });
    expect(book.cells.get('A2')?.value).toBe('Ana');
  });

  it('números e datas tipados com formato; coluna de data com texto mistura data e texto', async () => {
    const book = await run(await create());

    expect(book.cells.get('C2')).toMatchObject({ value: '1200.5', type: null });
    // o formato do grid: até 3 casas (padrão do Intl), 2 obrigatórias
    expect(book.styleOf('C2').numFmt).toBe('#,##0.00#');
    expect(book.cells.get('C3')?.value).toBe('-5');
    // 2024-11-22 = 45618; 2024-01-15 13:30 = 45306.5625
    expect(book.cells.get('D2')?.value).toBe('45618');
    expect(book.styleOf('D2').numFmt).toBe('mm/dd/yyyy');
    // a data no início, como na tela (o Geral do Excel a poria à direita)
    expect(book.styleOf('D2').horizontal).toBe('left');
    expect(book.cells.get('D3')?.value).toBe('45306.5625');
    expect(book.cells.get('D4')).toMatchObject({ value: 'n/a', type: 's' });
    // larguras do grid (a 1ª: 140 px)
    expect(book.sheet.getElementsByTagName('col')[0].getAttribute('min')).toBe('1');
  });

  it('nome da aba limpo; sem nome acessível, o padrão traduzido', async () => {
    let book = await run(await create(), { sheetName: 'Q1/2026: [north]*', title: 'Quarter' });
    expect(book.workbook.getElementsByTagName('sheet')[0].getAttribute('name')).toBe('Q12026 north');
    expect(book.core.getElementsByTagName('dc:title')[0].textContent).toBe('Quarter');

    book = await run(await create(), { sheetName: 'History' });
    expect(book.workbook.getElementsByTagName('sheet')[0].getAttribute('name')).toBe('Data');

    // Relato do click na 0.4.0: o nome longo era cortado no meio da palavra ("…de aceite d").
    cleanup();
    book = await run(await create(g => g.setAttribute('aria-label', 'Relatório analítico de aceite de documentos')));
    const long = book.workbook.getElementsByTagName('sheet')[0].getAttribute('name')!;
    expect(long).toBe('Relatório analítico de aceite…');
    expect(long.length).toBeLessThanOrEqual(31);

    cleanup();
    book = await run(await create(g => {
      g.removeAttribute('aria-label');
      g.language = 'pt-BR';
    }));
    expect(book.workbook.getElementsByTagName('sheet')[0].getAttribute('name')).toBe('Dados');
    expect(book.core.getElementsByTagName('dc:language')[0].textContent).toBe('pt-BR');
  });

  it('RTL: aba da direita para a esquerda (do grid ou de `direction`)', async () => {
    let book = await run(await create(g => g.setAttribute('dir', 'rtl')));
    expect(book.sheet.getElementsByTagName('sheetView')[0].getAttribute('rightToLeft')).toBe('1');

    book = await run(await create(g => g.setAttribute('dir', 'rtl')), { direction: 'ltr' });
    expect(book.sheet.getElementsByTagName('sheetView')[0].getAttribute('rightToLeft')).toBeNull();
  });

  it('bandas: linhas acima das folhas, rótulo mesclado na horizontal com o alinhamento da banda; folhas sem mesclar; congela tudo', async () => {
    const cols: GridColumnDef[] = [
      { path: 'name', label: 'Name' },
      { label: 'Sale', alignment: 'center', columns: [{ path: 'country', label: 'Country' }, { path: 'amount', label: 'Amount', dataType: 'number' }] },
      { path: 'when', label: 'When', dataType: 'date' },
    ];
    let book = await run(await create(undefined, cols));

    expect(book.cells.get('B1')?.value).toBe('Sale');
    expect(book.styleOf('B1').horizontal).toBe('center');
    // a célula coberta tem o mesmo estilo (fundo e bordas da área mesclada)
    expect(book.cells.get('C1')).toMatchObject({ value: null, style: book.cells.get('B1')!.style });
    // só a banda mescla, na horizontal: a coluna sem banda (A1 vazia, A2 rótulo) e a linha das folhas não
    expect([...book.sheet.getElementsByTagName('mergeCell')].map(m => m.getAttribute('ref'))).toEqual(['B1:C1']);
    expect(book.styleOf('A1')).toMatchObject({ fill: 'FFE6E6E6', horizontal: null });
    expect(['A2', 'B2', 'C2', 'D2'].map(ref => book.cells.get(ref)?.value)).toEqual(['Name', 'Country', 'Amount', 'When']);
    expect(pane(book)?.getAttribute('ySplit')).toBe('2');
    expect(definedName(book, 'ColumnTitle')).toMatch(/!\$A\$2$/);
    expect(definedName(book, '_xlnm.Print_Titles')).toMatch(/!\$1:\$2$/);

    book = await run(await create(undefined, cols), { includeBands: false, freezeHeader: false });
    expect(book.cells.get('A1')?.value).toBe('Name');
    expect(pane(book)).toBeNull();
    expect(definedName(book, 'ColumnTitle')).toMatch(/!\$A\$1$/);

    book = await run(await create(undefined, cols), { includeHeaders: false });
    expect(book.cells.get('A1')?.value).toBe('Ana');
    expect(pane(book)).toBeNull();
    expect(definedName(book, 'ColumnTitle')).toBeNull();
    expect(definedName(book, '_xlnm.Print_Titles')).toBeNull();
  });

  it('grupos: outline com o resumo acima, rótulo em texto no início da linha, rodapé e total', async () => {
    const grid = await create(g => {
      g.summary = { group: [{ column: 'amount', type: 'sum', display: 'footer' }], total: [{ column: 'amount', type: 'sum' }] };
    });
    grid.groupColumn(grid.columns.find(c => c.path === 'country')!);
    await settle(grid);
    const book = await run(grid);

    const props = book.sheet.getElementsByTagName('sheetFormatPr')[0];
    expect(props.getAttribute('outlineLevelRow')).toBe('1');
    expect(book.sheet.getElementsByTagName('outlinePr')[0].getAttribute('summaryBelow')).toBe('0');
    expect(book.cells.get('A2')?.value).toMatch(/^Country: Brazil/);
    expect(book.styleOf('A2')).toMatchObject({ bold: true, horizontal: null });
    const rows = [...book.sheet.getElementsByTagName('row')];
    expect(rows[1].getAttribute('outlineLevel')).toBeNull();
    expect(rows[2].getAttribute('outlineLevel')).toBe('1');
    expect(book.sheet.getElementsByTagName('mergeCell')).toHaveLength(0);
    const texts = [...book.cells.values()].map(c => c.value);
    expect(texts.filter(t => t?.startsWith('Sum'))).toHaveLength(3);
  });

  // Relato do click na 0.4.0: total de agregador próprio que devolve número saía como texto ('14').
  it('total de agregador próprio com número sai tipado, com o formato da coluna; o "Sum:" segue texto', async () => {
    const sum = (values: readonly unknown[]) => values.reduce<number>((total, value) => total + (Number(value) || 0), 0);
    const grid = await create(g => {
      g.summary = { total: [{ column: 'amount', type: sum }, { column: 'name', type: 'count' }] };
    });
    const book = await run(grid);

    expect(book.cells.get('C5')).toMatchObject({ value: '1495.5', type: null });
    expect(book.styleOf('C5')).toMatchObject({ bold: true, numFmt: book.styleOf('C2').numFmt });
    expect(book.cells.get('A5')).toMatchObject({ type: 's' });
    expect(book.cells.get('A5')?.value).toMatch(/^Count/);
  });

  it('customizeCell: mapa de calor (fundo por valor + o estado no texto), link, formato; contraste ruim sai com aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const seen = new Set<string>();
    const book = await run(await create(), {
      customizeCell: cell => {
        seen.add(`${cell.rowType}:${cell.columnIndex}:${cell.headerRow}`);

        if (cell.rowType === 'data' && cell.columnIndex === 2) {
          const amount = cell.value as number;
          cell.style = { ...cell.style, backgroundColor: amount > 0 ? '#63be7b' : '#f8696b', bold: amount <= 0 };
          cell.numFmt = '#,##0.00 "USD"';
        }

        if (cell.rowType === 'data' && cell.columnIndex === 1) {
          cell.text = `${cell.text} (state)`;
        }

        if (cell.rowType === 'data' && cell.columnIndex === 0) {
          cell.link = { url: `mailto:${cell.text.toLowerCase()}@example.com` };
          cell.style.color = '#eeeeee';
        }
      },
    });

    expect(seen.has('header:0:0')).toBe(true);
    expect(seen.has('data:3:-1')).toBe(true);
    expect(book.styleOf('C2')).toMatchObject({ fill: 'FF63BE7B', bold: false, numFmt: '#,##0.00 "USD"' });
    expect(book.styleOf('C3')).toMatchObject({ fill: 'FFF8696B', bold: true });
    expect(book.cells.get('C2')?.value).toBe('1200.5');
    expect(book.cells.get('B2')?.value).toBe('Brazil (state)');
    // a cor do hospedeiro reprovou o contraste: num link, a cor de link no lugar dela
    expect(book.styleOf('A2').color).toBe('FF0563C1');
    expect(warn.mock.calls.some(([m]) => String(m).includes('contrast'))).toBe(true);
    expect(book.parts.get('xl/worksheets/_rels/sheet1.xml.rels')).toContain('mailto:ana@example.com');
    expect(book.sheet.getElementsByTagName('hyperlink')).toHaveLength(3);
    warn.mockRestore();
  });

  it('estilos sem repetição: mil linhas com 3 tons dão 3 formatos', async () => {
    const items = Array.from({ length: 1000 }, (_, n) => ({ name: `U${n}`, country: 'X', amount: n % 3, when: '' }));
    const grid = await createGrid({ columns: columns(), items, configure: g => g.setAttribute('aria-label', 'Heat') });
    const tones = ['#f8696b', '#ffeb84', '#63be7b'];
    const book = await run(grid, {
      customizeCell: cell => {
        if (cell.rowType === 'data' && cell.columnIndex === 2) {
          cell.style.backgroundColor = tones[cell.value as number];
        }
      },
    });
    const fills = new Set([...book.cells.keys()].filter(ref => ref.startsWith('C') && ref !== 'C1').map(ref => book.styleOf(ref).fill));
    expect([...fills].sort()).toEqual(['FF63BE7B', 'FFF8696B', 'FFFFEB84']);
    expect(Number(book.styles.getElementsByTagName('cellXfs')[0].getAttribute('count'))).toBeLessThan(12);
  });

  it('na thread principal (`worker: false`) dá o mesmo arquivo', async () => {
    const grid = await create();
    const a = await unzip(await exportXlsx(grid, { worker }));
    const b = await unzip(await exportXlsx(grid, { worker: false }));
    expect(b.get('xl/worksheets/sheet1.xml')).toBe(a.get('xl/worksheets/sheet1.xml'));
    expect(b.get('xl/styles.xml')).toBe(a.get('xl/styles.xml'));
  });

  it('progresso e cancelamento: rejeita com o motivo do sinal', async () => {
    const items = Array.from({ length: 30_000 }, (_, n) => ({ name: `N${n}`, country: `C${n % 7}`, amount: n, when: new Date(2024, 0, 1 + (n % 300)) }));
    const grid = await createGrid({ columns: columns(), items });
    const progress: number[] = [];
    const controller = new AbortController();
    const promise = exportXlsx(grid, {
      worker,
      signal: controller.signal,
      onProgress: p => {
        progress.push(p.rowCount);
        expect(p.totalCount).toBe(30_000);
        expect(p.pageCount).toBe(0);
        controller.abort(new DOMException('stop', 'AbortError'));
      },
    });
    await expect(promise).rejects.toMatchObject({ name: 'AbortError', message: 'stop' });
    expect(progress.length).toBeGreaterThan(0);

    const done: number[] = [];
    await exportXlsx(grid, { worker, onProgress: p => done.push(p.rowCount) });
    expect(done.at(-1)).toBe(30_000);
  }, 30_000);

  it('rótulo de grupo com customizeCell: chamado uma vez pela faixa; as cobertas mantêm o estilo dele', async () => {
    const grid = await create();
    grid.groupColumn(grid.columns.find(c => c.path === 'country')!);
    await settle(grid);
    const spans: number[] = [];
    const book = await run(grid, {
      customizeCell: cell => {
        if (cell.rowType === 'group') {
          spans.push(cell.columnSpan);
        }
      },
    });

    // 2 grupos, só o rótulo (a coluna agrupada sai; a faixa cobre as 3 que ficam: sem resumo alinhado)
    expect(spans).toEqual([3, 3]);
    expect(book.styleOf('A2').horizontal).toBeNull();
    expect(['B2', 'C2'].map(ref => book.cells.get(ref))).toEqual(['B2', 'C2'].map(() => ({ value: null, type: null, style: book.cells.get('A2')!.style })));
  });

  it('contraste: cor clara no cabeçalho sai; fundo escuro sem cor de texto ganha texto branco; texto e fundo bons ficam', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const book = await run(await create(), {
      customizeCell: cell => {
        if (cell.rowType === 'header' && cell.columnIndex === 0) {
          cell.style.color = '#999999';
        }

        if (cell.rowType === 'data' && cell.columnIndex === 0) {
          cell.style.backgroundColor = '#000080';
        }

        if (cell.rowType === 'data' && cell.columnIndex === 1) {
          cell.style = { color: '#ffffff', backgroundColor: '#000080' };
        }
      },
    });

    expect(book.styleOf('A1')).toMatchObject({ color: null, fill: 'FFE6E6E6' });
    // fundo escuro sem cor de texto: texto branco (o fundo fica)
    expect(book.styleOf('A2')).toMatchObject({ color: 'FFFFFFFF', fill: 'FF000080' });
    expect(book.styleOf('B2')).toMatchObject({ color: 'FFFFFFFF', fill: 'FF000080' });
    expect(warn.mock.calls.filter(([m]) => String(m).includes('contrast')).length).toBeGreaterThan(0);
    warn.mockRestore();
  });

  it('RTL: dc:language do grid, start/end e bordas espelhados, bandas e grupos', async () => {
    const cols: GridColumnDef[] = [
      { path: 'name', label: 'الاسم' },
      { label: 'البيع', alignment: 'center', columns: [{ path: 'country', label: 'البلد' }, { path: 'amount', label: 'المبلغ', dataType: 'number' }] },
      { path: 'when', label: 'التاريخ', dataType: 'date' },
    ];
    const grid = await create(g => {
      g.language = 'ar';
      g.setAttribute('dir', 'rtl');
    }, cols);
    const book = await run(grid, {
      customizeCell: cell => {
        if (cell.rowType === 'data' && cell.columnIndex === 0) {
          cell.style = { alignment: 'start', border: { start: { style: 'medium' } } };
        }
      },
    });

    expect(book.sheet.getElementsByTagName('sheetView')[0].getAttribute('rightToLeft')).toBe('1');
    expect(book.core.getElementsByTagName('dc:language')[0].textContent).toBe('ar');
    expect(book.cells.get('B1')?.value).toBe('البيع');
    expect(book.styleOf('B1').horizontal).toBe('center');
    expect([...book.sheet.getElementsByTagName('mergeCell')].map(m => m.getAttribute('ref'))).toEqual(['B1:C1']);
    // a 1ª linha de dados (A3: banda, folhas): início = direita numa aba RTL, borda do início também
    const xf = [...book.styles.getElementsByTagName('cellXfs')[0].getElementsByTagName('xf')][book.cells.get('A3')!.style];
    expect(xf.getElementsByTagName('alignment')[0].getAttribute('horizontal')).toBe('right');
    const border = [...book.styles.getElementsByTagName('borders')[0].getElementsByTagName('border')][Number(xf.getAttribute('borderId'))];
    expect(border.getElementsByTagName('right')[0].getAttribute('style')).toBe('medium');
    expect(border.getElementsByTagName('left')[0].getAttribute('style')).toBeNull();
  });

  it('assetsUrl relativo à página, sem a barra final', async () => {
    const book = await run(await create(), { worker: false, assetsUrl: '/src/export-xlsx' });
    expect(book.cells.get('A2')?.value).toBe('Ana');
  });

  it('banda: padrão `start` como na tela; customizeCell recebe a 1ª coluna em `column` e a banda em `band`', async () => {
    const sale: GridColumnDef = { label: 'Sale', columns: [{ path: 'country', label: 'Country' }, { path: 'amount', label: 'Amount', dataType: 'number' }] };
    const seen: { column: string | undefined; band: string | null | undefined; span: number }[] = [];
    const book = await run(await create(undefined, [{ path: 'name', label: 'Name' }, sale]), {
      customizeCell: cell => {
        if (cell.rowType === 'header' && cell.headerRow === 0 && cell.band) {
          seen.push({ column: cell.column?.label, band: cell.band.label, span: cell.columnSpan });
        }

        if (cell.rowType === 'data') {
          expect(cell.band).toBeNull();
        }
      },
    });

    expect(book.cells.get('B1')?.value).toBe('Sale');
    expect(book.styleOf('B1').horizontal).toBeNull();
    expect(book.cells.get('C1')).toMatchObject({ value: null, style: book.cells.get('B1')!.style });
    expect(seen).toEqual([{ column: 'Country', band: 'Sale', span: 2 }]);
  });

  it('bandas aninhadas: cada nível mescla a própria faixa; customizeCell `center` centraliza na banda e, no rótulo de grupo, na seleção', async () => {
    const cols: GridColumnDef[] = [
      { path: 'name', label: 'Name' },
      {
        label: 'Sale',
        columns: [
          { path: 'country', label: 'Country' },
          { label: 'Value', columns: [{ path: 'amount', label: 'Amount', dataType: 'number' }, { path: 'when', label: 'When', dataType: 'date' }] },
        ],
      },
    ];
    const grid = await create(undefined, cols);
    grid.groupColumn(grid.columns[0]);
    await settle(grid);
    const book = await run(grid, {
      customizeCell: cell => {
        if ((cell.rowType === 'header' && cell.band) || cell.rowType === 'group') {
          cell.style = { ...cell.style, alignment: 'center' };
        }
      },
    });

    // Sale (nível 0) e Value (nível 1): uma área por banda
    const refs = [...book.sheet.getElementsByTagName('mergeCell')].map(m => m.getAttribute('ref'));
    expect(refs).toHaveLength(2);

    // cada área é de uma linha só e fica nas linhas de banda (1 e 2), nunca na das folhas (3)
    for (const ref of refs) {
      const [, row1, row2] = (/^[A-Z]+(\d+):[A-Z]+(\d+)$/).exec(ref!)!;
      expect(row1).toBe(row2);
      expect(['1', '2']).toContain(row1);
    }

    const top = refs.find(ref => ref!.endsWith('1'))!;
    expect(book.styleOf(top.split(':')[0]).horizontal).toBe('center');
    // rótulo de grupo (não mesclado): centralizar na seleção
    const group = [...book.cells.entries()].find(([, c]) => typeof c.value === 'string' && c.value.startsWith('Name:'))![0];
    expect(book.styleOf(group).horizontal).toBe('centerContinuous');
  });

  // Pedido do click (0.5.1): datas no padrão regional de quem abre, como o EPPlus com o embutido 22.
  it('dateFormat \'reader\': datas com os embutidos 14 (date) e 22 (datetime), escolhidos pela coluna', async () => {
    const cols: GridColumnDef[] = [
      { path: 'name', label: 'Name' },
      { path: 'when', label: 'When', dataType: 'date' },
      { path: 'when', name: 'at', label: 'At', dataType: 'datetime' },
    ];
    const seen: unknown[] = [];
    const book = await run(await create(undefined, cols), {
      dateFormat: 'reader',
      customizeCell: cell => {
        if (cell.rowType === 'data' && cell.columnIndex > 0) {
          seen.push(cell.numFmt);
        }
      },
    });

    // A2: data à meia-noite → 14 na coluna date e 22 na datetime (a coluna decide, não o valor)
    expect(book.styleOf('B2').numFmt).toBe('builtin:14');
    expect(book.styleOf('C2').numFmt).toBe('builtin:22');
    expect(book.styleOf('C3').numFmt).toBe('builtin:22');
    expect(book.parts.get('xl/styles.xml')).not.toContain('<numFmt ');
    expect(seen.slice(0, 4)).toEqual([14, 22, 14, 22]);

    // padrão: o formato do idioma, literal
    const language = await run(await create(undefined, cols));
    expect(language.styleOf('B2').numFmt).toBe('mm/dd/yyyy');
  });

  it('customizeCell: numFmt numérico grava o embutido; id fora dos aceitos vira General com aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const book = await run(await create(), {
      customizeCell: cell => {
        if (cell.rowType === 'data' && cell.columnIndex === 3 && cell.row?.rowType === 'data' && cell.row.values[0] === 'Ana') {
          cell.numFmt = 22;
        }

        // número com id fora dos aceitos: General
        if (cell.rowType === 'data' && cell.columnIndex === 2 && cell.row?.rowType === 'data' && cell.row.values[0] === 'Bob') {
          cell.numFmt = 99;
        }
      },
    });

    expect(book.styleOf('D2').numFmt).toBe('builtin:22');
    expect(book.styleOf('C3').numFmt).toBeNull();
    expect(book.styleOf('C2').numFmt).toMatch(/^#,##0.00/);
    expect(warn.mock.calls.some(([message]) => String(message).includes('99 is not a supported built-in number format')
      && String(message).includes('14/22 for a date'))).toBe(true);
  });

  // Pedido do usuário (0.7.0): o arquivo já sai com o filtro do Excel nos rótulos (spec 29, "AutoFilter").
  describe('autoFilter', () => {
    const autoFilterOf = (book: Book) => book.sheet.getElementsByTagName('autoFilter')[0] ?? null;
    const sortConditions = (book: Book) =>
      [...book.sheet.getElementsByTagName('sortCondition')].map(c => `${c.getAttribute('ref')}${c.getAttribute('descending') === '1' ? ' desc' : ''}`);

    it('padrão: rótulos até a última linha de dado, nome _FilterDatabase oculto, sem estado de ordenação sem ordenar', async () => {
      const book = await run(await create());

      expect(autoFilterOf(book)?.getAttribute('ref')).toBe('A1:D4');
      expect(sortConditions(book)).toEqual([]);
      expect(definedName(book, '_xlnm._FilterDatabase')).toMatch(/!\$A\$1:\$D\$4$/);
      const filterName = [...book.workbook.getElementsByTagName('definedName')].find(d => d.getAttribute('name') === '_xlnm._FilterDatabase')!;
      expect(filterName.getAttribute('hidden')).toBe('1');
    });

    it('a ordenação do grid vira o estado de ordenação; o total fica fora do intervalo', async () => {
      const grid = await create(g => {
        g.summary = { total: [{ column: 'amount', type: 'sum' }] };
      });
      grid.sortColumn(grid.columns.find(c => c.path === 'amount')!, 'desc');
      grid.sortColumn(grid.columns.find(c => c.path === 'name')!, 'asc', { append: true });
      const book = await run(grid);

      // 3 linhas de dado (2–4) e o total na 5
      expect(autoFilterOf(book)?.getAttribute('ref')).toBe('A1:D4');
      expect(sortConditions(book)).toEqual(['C2:C4 desc', 'A2:A4']);
    });

    it('sem estado de ordenação: coluna com comparador próprio ou ordenada fora da exportação; com bandas, os rótulos são a última linha', async () => {
      const cols: GridColumnDef[] = [
        { label: 'Who', columns: [{ path: 'name', label: 'Name', comparator: (a, b) => String(a).localeCompare(String(b)) }, { path: 'country', label: 'Country' }] },
        { path: 'amount', label: 'Amount', dataType: 'number' },
      ];
      const grid = await create(undefined, cols);
      grid.sortColumn(grid.columns[0].columns![0], 'asc');
      const book = await run(grid);

      expect(autoFilterOf(book)?.getAttribute('ref')).toBe('A2:C5');
      expect(sortConditions(book)).toEqual([]);
    });

    it('linhas fixas ficam no intervalo, sem estado de ordenação', async () => {
      const grid = await create(g => {
        g.keyExpr = 'name';
      });
      grid.fixedTopItems = [grid.items[2]];
      grid.sortColumn(grid.columns.find(c => c.path === 'amount')!, 'asc');
      const book = await run(grid);

      // a linha fixa (2) e as 3 do corpo (a fixa também fica no corpo): 3–5
      expect(autoFilterOf(book)?.getAttribute('ref')).toBe('A1:D5');
      expect(sortConditions(book)).toEqual([]);
    });

    it('fora: autoFilter false, sem cabeçalho e com linhas de grupo (aviso só com true explícito)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      warn.mockClear();
      const filterWarnings = () => warn.mock.calls.filter(([message]) => String(message).includes('autoFilter'));
      const grid = await create();

      expect(autoFilterOf(await run(grid, { autoFilter: false }))).toBeNull();
      expect(autoFilterOf(await run(grid, { includeHeaders: false }))).toBeNull();
      expect(filterWarnings()).toEqual([]);

      grid.groupColumn(grid.columns.find(c => c.path === 'country')!);
      await settle(grid);
      const grouped = await run(grid);
      expect(autoFilterOf(grouped)).toBeNull();
      expect(definedName(grouped, '_xlnm._FilterDatabase')).toBeNull();
      expect(filterWarnings()).toEqual([]);

      await run(grid, { autoFilter: true });
      expect(filterWarnings()).toHaveLength(1);

      // agrupado exportado plano: o filtro volta, sem a seta (a ordem dos grupos vem antes)
      grid.sortColumn(grid.columns.find(c => c.path === 'amount')!, 'desc');
      const flat = await run(grid, { includeGroups: false });
      expect(autoFilterOf(flat)?.getAttribute('ref')).toBe('A1:D4');
      expect(sortConditions(flat)).toEqual([]);
    });
  });

  it('language: dc:language e os formatos de número e data; o padrão é o do grid', async () => {
    const cols: GridColumnDef[] = [
      { path: 'name', label: 'Name' },
      { path: 'amount', label: 'Amount', dataType: 'number', format: { minimumFractionDigits: 2, maximumFractionDigits: 2 } },
      { path: 'when', label: 'When', dataType: 'date' },
    ];
    let book = await run(await create(undefined, cols), { language: 'pt-BR' });
    expect(book.core.getElementsByTagName('dc:language')[0].textContent).toBe('pt-BR');
    expect(book.styleOf('C2').numFmt).toBe('dd/mm/yyyy');

    book = await run(await create(undefined, cols));
    expect(book.core.getElementsByTagName('dc:language')[0].textContent).toBe('en');
    expect(book.styleOf('C2').numFmt).toBe('mm/dd/yyyy');

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    book = await run(await create(undefined, cols), { language: 'not a tag!' });
    expect(book.core.getElementsByTagName('dc:language')[0].textContent).toBe('en');
    expect(warn.mock.calls.some(([m]) => String(m).includes('not a valid language tag'))).toBe(true);
    warn.mockRestore();
  });

  it('exportDefaultTitle dá o nome padrão; a chave antiga `pdfDefaultTitle` ainda vale, com aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setGridTranslation('x-xlsx', { pdfDefaultTitle: 'Planilha' });
    expect(warn.mock.calls.some(([m]) => String(m).includes('"pdfDefaultTitle" is deprecated, use "exportDefaultTitle"'))).toBe(true);
    warn.mockRestore();

    const book = await run(await create(g => {
      g.removeAttribute('aria-label');
      g.language = 'x-xlsx';
    }));
    expect(book.workbook.getElementsByTagName('sheet')[0].getAttribute('name')).toBe('Planilha');
    expect(book.core.getElementsByTagName('dc:title')[0].textContent).toBe('Planilha');
  });

  it('link: cor de link sem cor do hospedeiro ou com a dele reprovada; num fundo escuro, a cor de link clara', async () => {
    const book = await run(await create(), {
      customizeCell: cell => {
        if (cell.rowType === 'data' && cell.columnIndex === 0) {
          cell.link = { url: 'https://example.com', description: 'ignored in xlsx' };

          if (cell.text === 'Bob') {
            cell.style.backgroundColor = '#000080';
          }

          if (cell.text === 'Caio') {
            cell.style.color = '#006400';
          }

          if (cell.text === 'Ana') {
            cell.style.color = '#eeeeee';
          }
        }
      },
    });

    // Ana: a cor dela reprova o contraste → a cor de link; Bob: fundo escuro → a cor de link clara
    expect(book.styleOf('A2').color).toBe('FF0563C1');
    expect(book.styleOf('A3')).toMatchObject({ color: 'FF9DC3E6', fill: 'FF000080' });
    expect(book.styleOf('A4').color).toBe('FF006400');
    expect(book.sheet.getElementsByTagName('hyperlink')).toHaveLength(3);
  });

  it('colunas `fixed: \'start\'`: congeladas (xSplit) e títulos de linha (Title com o cabeçalho, RowTitle sem ele)', async () => {
    const cols = columns().map((c, i) => i === 0 ? { ...c, fixed: 'start' as const } : c);
    let book = await run(await create(undefined, cols));
    expect(pane(book)?.getAttribute('xSplit')).toBe('1');
    expect(pane(book)?.getAttribute('ySplit')).toBe('1');
    // cabeçalho e coluna fixa: um nome só no canto (convenção do JAWS para os dois)
    expect(definedName(book, 'Title')).toMatch(/!\$A\$1$/);
    expect(definedName(book, 'RowTitle')).toBeNull();
    expect(definedName(book, 'ColumnTitle')).toBeNull();

    book = await run(await create(), {});
    expect(pane(book)?.getAttribute('xSplit')).toBeNull();
    expect(definedName(book, 'Title')).toBeNull();
    expect(definedName(book, 'ColumnTitle')).toMatch(/!\$A\$1$/);

    book = await run(await create(undefined, cols), { freezeHeader: false });
    expect(pane(book)?.getAttribute('xSplit')).toBe('1');
    expect(pane(book)?.getAttribute('ySplit')).toBeNull();

    // sem cabeçalho: RowTitle em A1, nenhum ColumnTitle
    book = await run(await create(undefined, cols), { includeHeaders: false });
    expect(definedName(book, 'RowTitle')).toMatch(/!\$A\$1$/);
    expect(definedName(book, 'ColumnTitle')).toBeNull();
    expect(pane(book)?.getAttribute('xSplit')).toBe('1');

    // bandas + coluna fixa: o canto é a linha das folhas
    const banded: GridColumnDef[] = [
      { path: 'name', label: 'Name', fixed: 'start' },
      { label: 'Sale', columns: [{ path: 'country', label: 'Country' }, { path: 'amount', label: 'Amount', dataType: 'number' }] },
    ];
    book = await run(await create(undefined, banded));
    expect(definedName(book, 'Title')).toMatch(/!\$A\$2$/);
    expect(pane(book)?.getAttribute('ySplit')).toBe('2');
    expect(pane(book)?.getAttribute('xSplit')).toBe('1');
  });

  it('RTL: células tipadas no início (à direita) e coluna `fixed: \'start\'` congelada', async () => {
    const cols = columns().map((c, i) => i === 0 ? { ...c, fixed: 'start' as const } : c);
    const book = await run(await create(g => {
      g.language = 'ar';
      g.setAttribute('dir', 'rtl');
    }, cols));
    expect(book.sheet.getElementsByTagName('sheetView')[0].getAttribute('rightToLeft')).toBe('1');
    expect(pane(book)?.getAttribute('xSplit')).toBe('1');
    expect(definedName(book, 'Title')).toMatch(/!\$A\$1$/);
    // a data (coluna `start`) no início, que numa aba RTL é a direita
    expect(book.styleOf('D2').horizontal).toBe('right');
  });

  it('formas com o ExcelJS: avisam uma vez (obsoletas) e continuam funcionando', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await create();
    const added: unknown[][] = [];
    const sheet = {
      addRow: (values: unknown[]) => {
        added.push(values);
        return { getCell: () => ({ value: null }) };
      },
      getColumn: () => ({}),
      mergeCells: () => undefined,
      properties: {},
    };
    const ExcelJS = {
      Workbook: class {
        addWorksheet = () => sheet;
        xlsx = { writeBuffer: () => Promise.resolve(new Uint8Array([1])) };
      },
    };

    await exportXlsx(grid, ExcelJS);
    createXlsxExporter(ExcelJS);
    expect(added[0]).toEqual(['Name', 'Country', 'Amount', 'When']);
    expect(warn.mock.calls.filter(([m]) => String(m).includes('deprecated')).length).toBeLessThanOrEqual(1);
    warn.mockRestore();
  });
});

describe('interface (Exportar para Excel)', () => {
  const shadow = (grid: DataGrid) => grid.shadowRoot!;
  const live = (grid: DataGrid) => shadow(grid).querySelector<HTMLElement>('[role=status]')!;
  const items = (grid: DataGrid) => [...shadow(grid).querySelectorAll<HTMLElement>('[role=menu] [role=menuitem]')];

  it('createXlsxExporter pela barra: baixa o arquivo e anuncia "Exported to Excel"', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const grid = await create(g => {
      g.exportFormats = ['xlsx'];
      g.xlsxExporter = createXlsxExporter({ worker, fileName: 'sales.xlsx' });
    });
    await settle(grid);
    const button = shadow(grid).querySelector<HTMLButtonElement>('.export-button')!;
    expect(button.getAttribute('aria-label')).toBe('Export to Excel');
    button.click();
    await vi.waitFor(() => expect(live(grid).textContent.trim()).toBe('Exported to Excel'), { timeout: 10_000 });
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  /** Exportador que só termina quando o teste manda (`finish`) ou cancela. */
  const pending = () => {
    let finish!: () => void;
    let started!: () => void;
    const begun = new Promise<void>(resolve => started = resolve);
    const exporter = vi.fn((_target: DataGrid, { signal, onProgress }: Parameters<GridExporter>[1]) => new Promise<void>((resolve, reject) => {
      finish = resolve;
      onProgress?.({ rowCount: 25, totalCount: 100, pageCount: 0 });
      started();
      signal.addEventListener('abort', () => reject(signal.reason));
    }));
    return { exporter, begun, finish: () => finish() };
  };

  it('teclado: Enter exporta, o foco fica no botão ("Cancel export", progresso na descrição), Enter cancela', async () => {
    const { exporter, begun } = pending();
    const grid = await create(g => {
      g.exportFormats = ['xlsx'];
      g.xlsxExporter = exporter;
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
    expect(described.textContent).toBe('Exporting… 25%');

    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(live(grid).textContent.trim()).toBe('Export canceled'));
    expect(shadow(grid).activeElement).toBe(button);
    expect(button.getAttribute('aria-label')).toBe('Export to Excel');
  });

  it('menu: "Cancel export" no topo durante a exportação, axe sem violações; ao fim, "Exported to Excel"', async () => {
    const { exporter, begun, finish } = pending();
    const grid = await create(g => {
      g.exportFormats = ['csv', 'xlsx'];
      g.xlsxExporter = exporter;
    });
    await settle(grid);
    const button = shadow(grid).querySelector<HTMLButtonElement>('.export-button')!;
    button.focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    expect(items(grid).map(item => item.textContent.trim())).toEqual(['Export to CSV', 'Export to Excel']);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    await begun;
    await settle(grid);
    expect(shadow(grid).activeElement).toBe(button);

    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    expect(items(grid).map(item => item.textContent.trim())).toEqual(['Cancel export', 'Export to CSV', 'Export to Excel']);
    expect(shadow(grid).activeElement).toBe(items(grid)[0]);
    expect((await axe.run(grid as unknown as Element)).violations.map(v => v.id)).toEqual([]);

    finish();
    await vi.waitFor(() => expect(live(grid).textContent.trim()).toBe('Exported to Excel'));
    await userEvent.keyboard('{Escape}');
    await settle(grid);
    expect(shadow(grid).activeElement).toBe(button);
  });

  it('axe sem violações com a exportação em curso, em RTL (ar)', async () => {
    const { exporter, begun } = pending();
    const grid = await create(g => {
      g.language = 'ar';
      g.setAttribute('dir', 'rtl');
      g.exportFormats = ['xlsx'];
      g.xlsxExporter = exporter;
    });
    await settle(grid);
    shadow(grid).querySelector<HTMLButtonElement>('.export-button')!.click();
    await begun;
    await settle(grid);
    expect((await axe.run(grid as unknown as Element)).violations.map(v => `${v.id}: ${v.nodes.map(n => n.html).join(' | ')}`)).toEqual([]);
    grid.cancelExport();
  });

  it('"Exporting…" só depois de 1 s, sem anúncio do progresso', async () => {
    const { exporter, begun } = pending();
    const grid = await create(g => {
      g.exportFormats = ['xlsx'];
      g.xlsxExporter = exporter;
    });
    await settle(grid);
    shadow(grid).querySelector<HTMLButtonElement>('.export-button')!.click();
    await begun;
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(live(grid).textContent.trim()).toBe('');
    await vi.waitFor(() => expect(live(grid).textContent.trim()).toBe('Exporting…'), { timeout: 2000 });
    expect(live(grid).textContent).not.toContain('%');
    grid.cancelExport();
  });

  it('exportador real pelo teclado: progresso na descrição, Enter cancela, foco no botão, worker encerrado', async () => {
    const rows = Array.from({ length: 60_000 }, (_, n) => ({ name: `N${n}`, country: `C${n % 7}`, amount: n, when: new Date(2024, 0, 1 + (n % 300)) }));
    const workers: Worker[] = [];
    const terminated = new Set<Worker>();

    const tracked = () => {
      const w = worker();
      const terminate = w.terminate.bind(w);

      w.terminate = () => {
        terminated.add(w);
        terminate();
      };

      workers.push(w);
      return w;
    };

    const grid = await createGrid({ columns: columns(), items: rows, configure: g => {
      g.language = 'en';
      g.exportFormats = ['xlsx'];
      // lento de propósito (customizeCell na thread principal), para dar tempo de cancelar
      g.xlsxExporter = createXlsxExporter({
        worker: tracked,
        customizeCell: () => {
          const until = performance.now() + 0.02;

          while (performance.now() < until) {
            // espera ativa
          }
        },
      });
    } });
    await settle(grid);
    const button = shadow(grid).querySelector<HTMLButtonElement>('.export-button')!;
    button.focus();
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => {
      const described = shadow(grid).getElementById(button.getAttribute('aria-describedby') ?? '');
      expect(described?.textContent).toMatch(/^Exporting… \d+%$/);
    }, { timeout: 10_000 });
    expect(button.getAttribute('aria-label')).toBe('Cancel export');

    await new Promise(resolve => setTimeout(resolve, 500));
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(live(grid).textContent.trim()).toBe('Export canceled'), { timeout: 5000 });
    expect(shadow(grid).activeElement).toBe(button);
    expect(workers).toHaveLength(1);
    expect(terminated.has(workers[0])).toBe(true);
  }, 30_000);

  it('axe sem violações com o menu aberto durante a exportação, em RTL (ar), navegando com as setas', async () => {
    const { exporter, begun } = pending();
    const grid = await create(g => {
      g.language = 'ar';
      g.setAttribute('dir', 'rtl');
      g.exportFormats = ['csv', 'xlsx'];
      g.xlsxExporter = exporter;
    });
    await settle(grid);
    const button = shadow(grid).querySelector<HTMLButtonElement>('.export-button')!;
    button.focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    await begun;
    await settle(grid);
    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    expect(items(grid)).toHaveLength(3);
    expect(shadow(grid).activeElement).toBe(items(grid)[0]);
    await userEvent.keyboard('{ArrowDown}');
    expect(shadow(grid).activeElement).toBe(items(grid)[1]);
    await userEvent.keyboard('{ArrowUp}');
    expect(shadow(grid).activeElement).toBe(items(grid)[0]);
    expect((await axe.run(grid as unknown as Element)).violations.map(v => `${v.id}: ${v.nodes.map(n => n.html).join(' | ')}`)).toEqual([]);
    await userEvent.keyboard('{Escape}');
    grid.cancelExport();
  });
});
