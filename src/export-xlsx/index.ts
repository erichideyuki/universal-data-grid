/* eslint-disable no-bitwise -- flags e bordas no protocolo do motor, cores 0xRRGGBB. */
/**
 * Exportação em Excel (frente 29): `@universal-material/data-grid/export-xlsx`.
 *
 * O xlsx é escrito pelo `uo-xlsx` do Universal Office (crate Rust) num
 * motor WebAssembly (`grid-xlsx.wasm`, crate `xlsx/`) num Web Worker: lê o
 * que o usuário vê em blocos (`_exportStream`), decide valor, formato e
 * estilo de cada célula, aplica `customizeCell`, serializa e manda ao motor;
 * o arquivo volta no fim. O `.wasm` e o worker só são baixados ao exportar.
 *
 * As formas com o ExcelJS no 2º argumento (frente 12) continuam, obsoletas,
 * em `legacy.ts`.
 */
import { downloadBlob } from '../export/download.js';
import { contrast as contrastOf, parseColor as parseCssColor, Writer } from '../export/serialize.js';
import { createSlicer, yieldToHost } from '../export/slice.js';
import type { GridExportColumn, GridExporter, GridExportLink, GridExportProgress, GridExportRow } from '../export/types.js';
import type { GridColumnAlignment, GridColumnDef } from '../grid-column-def.js';
import type { DataGrid } from '../grid.js';
import { columnText } from '../row-model/columns.js';
import { toDate, toNumber } from '../row-model/format.js';
import { LruCache } from '../row-model/lru.js';
import { localClient, workerClient, type XlsxClient } from './client.js';
import { XlsxEngineCode, XlsxEngineError } from './engine.js';
import { datePatternOf, numberFormatOf } from './formats.js';
import { exportXlsxWithExcelJS, XLSX_TYPE } from './legacy.js';
import type {
  ExcelJSModule,
  GridXlsxBorder,
  GridXlsxCell,
  GridXlsxCellStyle,
  GridXlsxDownloadOptions,
  GridXlsxExcelJSOptions,
  GridXlsxExporterOptions,
  GridXlsxOptions,
  WorkbookOf,
  WorksheetOf,
} from './types.js';

export type { GridExportCellStyle, GridExportLink } from '../export/types.js';
export type {
  ExcelJSCell,
  ExcelJSModule,
  ExcelJSRow,
  ExcelJSWorkbook,
  ExcelJSWorksheet,
  GridXlsxBorder,
  GridXlsxBorderSides,
  GridXlsxCell,
  GridXlsxCellStyle,
  GridXlsxDownloadOptions,
  GridXlsxExcelJSOptions,
  GridXlsxExporterOptions,
  GridXlsxOptions,
  WorkbookOf,
  WorksheetOf,
} from './types.js';

/** Pasta dos assets no bundle autocontido (`dist/export-xlsx.min.js` → `./export-xlsx/`); no ESM, indefinido. */
declare const __U_GRID_ASSETS__: string | undefined;

// ------------------------------------------------------------------ padrões

const WHITE = 0xffffff;
/** Cor de hiperlink do Excel: 5,9:1 sobre branco, 3,6:1 contra o texto preto vizinho (sem sublinhado ainda, é a pista). */
const LINK_COLOR = 0x0563c1;
/** Cor de link num fundo escuro (8,7:1 sobre #000080). */
const LINK_COLOR_ON_DARK = 0x9dc3e6;
/** Cor "automática" do texto no Excel. */
const BLACK = 0x000000;
const HEADER_FILL = 0xe6e6e6;
const MIN_CONTRAST = 4.5;
/** Linhas por bloco no worker e na thread principal (lá cada bloco é uma chamada síncrona). */
const BATCH_ROWS = 500;
const LOCAL_BATCH_ROWS = 100;
/** Estilos novos por bloco (o protocolo conta em `u16`). */
const MAX_BLOCK_STYLES = 60_000;
const PROGRESS_MS = 250;
/** Orçamento de uma fatia de serialização na thread principal (ms de relógio). */
const XLSX_SLICE_MS = 4;
const MAX_OUTLINE = 7;
const MAX_NUMFMT = 255;

// ------------------------------------------------------------------ avisos limitados

const warned = new LruCache<string, true>(64);

const warnOnce = (key: string, message: string) => {
  if (!warned.get(key)) {
    warned.set(key, true);
    console.warn(`<u-grid> xlsx: ${message}`);
  }
};

let warnedExcelJS = false;

const warnExcelJS = () => {
  if (!warnedExcelJS) {
    warnedExcelJS = true;
    console.warn('<u-grid> xlsx: passing ExcelJS to exportXlsx/downloadXlsx/createXlsxExporter is deprecated: call them without it '
      + '(the grid writes the file itself, with bands, a frozen header and customizeCell). The ExcelJS forms will be removed in the next major version.');
  }
};

// ------------------------------------------------------------------ cores (com cache: o mapa de calor repete poucas cores em muitas células)

const colors = new LruCache<string, number | null>(256);

const parseColor = (color: string | undefined | null): number | undefined => {
  if (!color) {
    return undefined;
  }

  let rgb = colors.get(color);

  if (rgb === undefined) {
    rgb = parseCssColor(color) ?? null;
    colors.set(color, rgb);
  }

  return rgb ?? undefined;
};

const contrasts = new LruCache<number, number>(256);

const contrast = (a: number, b: number): number => {
  const key = a * 0x1000000 + b;
  let ratio = contrasts.get(key);

  if (ratio === undefined) {
    ratio = contrastOf(a, b);
    contrasts.set(key, ratio);
  }

  return ratio;
};

const isExcelJS = (value: unknown): value is ExcelJSModule =>
  !!value && typeof (value as Partial<ExcelJSModule>).Workbook === 'function';

// ------------------------------------------------------------------ estilos

/** Alinhamento no protocolo do motor. */
const Align = { None: 0, Left: 1, Center: 2, Right: 3, Start: 4, End: 5, CenterContinuous: 6 } as const;
type AlignCode = typeof Align[keyof typeof Align];

interface Edge {
  medium: boolean;
  color?: number;
}

/** Estilo normalizado (cores em RGB), o mesmo `Style` do `uo-xlsx`. */
interface StyleSpec {
  bold?: boolean;
  italic?: boolean;
  color?: number;
  fill?: number;
  align?: AlignCode;
  wrap?: boolean;
  /** esquerda, direita, cima, baixo (físicos) */
  borders?: [Edge | undefined, Edge | undefined, Edge | undefined, Edge | undefined];
  numFmt?: string | null;
}

const edgeKey = (e: Edge | undefined): string => e ? `${e.medium ? 'm' : 't'}${e.color ?? ''}` : '';

/**
 * Estilos do arquivo: cada descrição nova ganha o próximo número local (1, 2…;
 * 0 = padrão) e vai no próximo bloco, antes das linhas que a usam.
 */
class StyleTable {
  readonly #ids = new Map<string, number>();
  #next = 1;
  readonly #pending = new Writer();
  #count = 0;

  get pendingCount(): number {
    return this.#count;
  }

  id(s: StyleSpec): number {
    const flags = (s.bold ? 1 : 0) | (s.italic ? 2 : 0) | (s.color !== undefined ? 4 : 0) | (s.fill !== undefined ? 8 : 0)
      | (s.wrap ? 16 : 0) | (s.numFmt ? 32 : 0);
    const b = s.borders;
    const key = `${flags}|${s.align ?? 0}|${s.color ?? ''}|${s.fill ?? ''}|${b ? b.map(edgeKey).join(',') : ''}|${s.numFmt ?? ''}`;
    let id = this.#ids.get(key);

    if (id !== undefined) {
      return id;
    }

    if (flags === 0 && !s.align && !b?.some(Boolean)) {
      this.#ids.set(key, 0);
      return 0;
    }

    id = this.#next++;
    this.#ids.set(key, id);
    const w = this.#pending;
    w.u8(flags);
    w.u8(s.align ?? 0);

    if (s.color !== undefined) {
      w.u32(s.color);
    }

    if (s.fill !== undefined) {
      w.u32(s.fill);
    }

    const sides = b ? b.reduce((mask, e, i) => mask | (e ? 1 << i : 0), 0) : 0;
    w.u8(sides);

    for (const e of b ?? []) {
      if (e) {
        w.u8(e.medium ? 1 : 0);
        w.u8(e.color !== undefined ? 1 : 0);

        if (e.color !== undefined) {
          w.u32(e.color);
        }
      }
    }

    if (s.numFmt) {
      w.str(s.numFmt);
    }

    this.#count++;
    return id;
  }

  /** Os estilos novos desde o último bloco (e recomeça). */
  take(): { count: number; bytes: Uint8Array } {
    const out = { count: this.#count, bytes: this.#pending.take() };
    this.#count = 0;
    return out;
  }
}

const ALIGN_OF: Record<GridColumnAlignment, AlignCode> = { start: Align.None, center: Align.Center, end: Align.End };
const ALIGNMENT_OF: Partial<Record<AlignCode, GridColumnAlignment>> = {
  [Align.Center]: 'center',
  [Align.CenterContinuous]: 'center',
  [Align.Start]: 'start',
  [Align.Left]: 'start',
  [Align.End]: 'end',
  [Align.Right]: 'end',
};

const hex = (rgb: number) => `#${rgb.toString(16).padStart(6, '0')}`;

/** O estilo interno como o hospedeiro o vê em `customizeCell`. */
const publicStyle = (s: StyleSpec): GridXlsxCellStyle => {
  const style: GridXlsxCellStyle = {};

  if (s.bold) {
    style.bold = true;
  }

  if (s.italic) {
    style.italic = true;
  }

  if (s.color !== undefined) {
    style.color = hex(s.color);
  }

  if (s.fill !== undefined) {
    style.backgroundColor = hex(s.fill);
  }

  const alignment = s.align ? ALIGNMENT_OF[s.align] : undefined;

  if (alignment) {
    style.alignment = alignment;
  }

  if (s.wrap) {
    style.wrap = true;
  }

  return style;
};

const lineOf = (value: boolean | GridXlsxBorder | undefined): Edge | undefined => {
  if (value === true) {
    return { medium: false };
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const color = parseColor(value.color);

  if (value.color && color === undefined) {
    warnOnce(`color:${value.color}`, `"${value.color}" is not a color; the border is automatic.`);
  }

  return { medium: value.style === 'medium', ...color !== undefined ? { color } : {} };
};

type Borders = NonNullable<StyleSpec['borders']>;

const bordersOf = (border: GridXlsxCellStyle['border'], rtl: boolean): Borders | undefined => {
  if (!border) {
    return undefined;
  }

  if (border === true) {
    const line = { medium: false };
    return [line, line, line, line];
  }

  if (typeof border !== 'object') {
    return undefined;
  }

  if ('top' in border || 'bottom' in border || 'start' in border || 'end' in border) {
    if ('color' in border || 'style' in border) {
      warnOnce('border-mix', 'a border has sides (top, bottom, start, end) and color/style together; color/style were ignored (set them per side).');
    }

    const start = lineOf(border.start);
    const end = lineOf(border.end);
    return [rtl ? end : start, rtl ? start : end, lineOf(border.top), lineOf(border.bottom)];
  }

  const line = lineOf(border as GridXlsxBorder);
  return [line, line, line, line];
};

/** Estilo do hospedeiro → normalizado, com a regra de contraste do PDF (a cor reprovada sai, com aviso). */
const specOf = (style: GridXlsxCellStyle | null | undefined, numFmt: string | null, span: boolean, rtl: boolean, link = false): StyleSpec => {
  const s = style ?? {};
  let color = parseColor(s.color);
  let fill = parseColor(s.backgroundColor);

  if (s.color && color === undefined) {
    warnOnce(`color:${s.color}`, `"${s.color}" is not a color; it was ignored.`);
  }

  if (s.backgroundColor && fill === undefined) {
    warnOnce(`color:${s.backgroundColor}`, `"${s.backgroundColor}" is not a color; it was ignored.`);
  }

  const background = fill ?? WHITE;

  if (color !== undefined && contrast(color, background) < MIN_CONTRAST) {
    warnOnce(`cell:${color}:${background}`, 'a cell color has a contrast below 4.5:1 with its background; the automatic color was used.');
    color = undefined;
  }

  // link sem cor (do hospedeiro, ou a dele reprovada): a cor de link do Excel, ou a clara num fundo escuro
  if (color === undefined && link) {
    color = [LINK_COLOR, LINK_COLOR_ON_DARK].find(c => contrast(c, background) >= MIN_CONTRAST);
  }

  // texto automático (preto) reprovado num fundo escuro: branco antes de tirar o fundo
  if (color === undefined && contrast(BLACK, background) < MIN_CONTRAST) {
    if (contrast(WHITE, background) >= MIN_CONTRAST) {
      color = WHITE;
    } else {
      warnOnce(`fill:${background}`, 'a cell background has a contrast below 4.5:1 with both black and white text; it was ignored.');
      fill = undefined;
    }
  }

  let code = numFmt;

  if (code !== null && (typeof code !== 'string' || code.length === 0 || code.length > MAX_NUMFMT)) {
    warnOnce('numfmt', 'a number format must be a string of 1 to 255 characters; General was used.');
    code = null;
  }

  const alignment = s.alignment ? ALIGN_OF[s.alignment] : undefined;

  return {
    bold: !!s.bold,
    italic: !!s.italic,
    color,
    fill,
    // "centralizar" numa célula que abrange várias (banda, rótulo de grupo) é "centralizar na seleção", sem mesclar
    align: alignment === Align.Center && span ? Align.CenterContinuous : s.alignment === 'start' ? Align.Start : alignment ?? Align.None,
    wrap: !!s.wrap,
    borders: s.border ? bordersOf(s.border, rtl) : undefined,
    numFmt: code,
  };
};

// ------------------------------------------------------------------ células

type CellValue = string | number | boolean | Date | null;

/** Escreve uma célula: `kind`, estilo, valor e link (protocolo de `xlsx/src/lib.rs`). */
const emit = (w: Writer, value: CellValue, style: number, link?: string): void => {
  const flag = link ? 0x80 : 0;

  if (typeof value === 'string' && value !== '') {
    w.u8(1 | flag);
    w.u32(style);
    w.str(value);
  } else if (typeof value === 'number') {
    w.u8(2 | flag);
    w.u32(style);
    w.f64(value);
  } else if (typeof value === 'boolean') {
    w.u8((value ? 4 : 3) | flag);
    w.u32(style);
  } else if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // relógio de parede: a planilha não tem fuso
    w.u8(5 | flag);
    w.u32(style);
    w.u32(value.getFullYear());
    w.u8(value.getMonth() + 1);
    w.u8(value.getDate());
    w.u8(value.getHours());
    w.u8(value.getMinutes());
    w.u8(value.getSeconds());
    w.u16(value.getMilliseconds());
  } else {
    w.u8(flag);
    w.u32(style);
  }

  if (link) {
    w.str(link);
  }
};

/** O que a célula de `customizeCell` só lê (`band`: só na célula de banda). */
type CellBase = Pick<GridXlsxCell, 'rowType' | 'row' | 'column' | 'columnIndex' | 'columnSpan' | 'headerRow' | 'value'> & { band?: GridColumnDef };

/** A célula de `customizeCell`. */
class XlsxCell implements GridXlsxCell {
  readonly rowType: GridXlsxCell['rowType'];
  readonly row: GridExportRow | null;
  readonly column: GridExportColumn | null;
  readonly band: GridColumnDef | null;
  readonly columnIndex: number;
  readonly columnSpan: number;
  readonly headerRow: number;
  readonly value: unknown;
  cellValue: CellValue;
  numFmt: string | null;
  style: GridXlsxCellStyle;
  link?: GridExportLink;
  #text: string;

  constructor(
    base: CellBase,
    cellValue: CellValue,
    text: string,
    numFmt: string | null,
    style: GridXlsxCellStyle,
  ) {
    this.rowType = base.rowType;
    this.row = base.row;
    this.column = base.column;
    this.band = base.band ?? null;
    this.columnIndex = base.columnIndex;
    this.columnSpan = base.columnSpan;
    this.headerRow = base.headerRow;
    this.value = base.value;
    this.cellValue = cellValue;
    this.#text = text;
    this.numFmt = numFmt;
    this.style = style;
  }

  get text(): string {
    return this.#text;
  }

  set text(text: string) {
    this.#text = typeof text === 'string' ? text : String(text ?? '');
    this.cellValue = this.#text;
    this.numFmt = null;
  }
}

/** Como gravar os dados de uma coluna: tipado (com `numFmt`) ou o texto exibido. */
interface ColumnPlan {
  type: 'text' | 'number' | 'boolean' | 'date';
  numFmt: string | null;
  align: AlignCode;
  /** estilo dos valores tipados (com o formato) */
  typed: number;
  /** estilo do texto (sem formato) */
  plain: number;
}

const planOf = (column: GridExportColumn, language: string | undefined, styles: StyleTable): ColumnPlan => {
  const { dataType } = column;
  const definition = column.column;
  const align = ALIGN_OF[column.alignment] ?? Align.None;
  const plain = styles.id({ align });
  const text: ColumnPlan = { type: 'text', numFmt: null, align, typed: plain, plain };
  // O texto depende do item ou é ícone/texto traduzido: grava o que a tela mostra.
  const ownBooleanText = dataType === 'boolean' && (definition.booleanDisplay || definition.trueText || definition.falseText);

  if (!dataType || dataType === 'string' || definition.displayValue || typeof definition.format === 'function' || ownBooleanText) {
    return text;
  }

  // número, data e booleano no início como na tela (o "Geral" do Excel os alinharia à direita ou ao centro)
  const typedAlign = align === Align.None ? Align.Start : align;

  if (dataType === 'boolean') {
    return { ...text, type: 'boolean', align: typedAlign, typed: styles.id({ align: typedAlign }) };
  }

  const numFmt = (dataType === 'number' ? numberFormatOf(definition.format, language) : datePatternOf(dataType, language)) ?? null;
  return { type: dataType === 'number' ? 'number' : 'date', numFmt, align: typedAlign, typed: styles.id({ align: typedAlign, numFmt }), plain };
};

/** Valor tipado da célula de dados; o texto exibido quando o valor não é do tipo da coluna. */
const typedValue = (plan: ColumnPlan, value: unknown, shown: string): CellValue => {
  switch (plan.type) {
    case 'number': {
      const numeric = toNumber(value);

      if (typeof numeric === 'bigint') {
        return Number.isSafeInteger(Number(numeric)) ? Number(numeric) : shown || null;
      }

      return numeric !== undefined && Number.isFinite(numeric) ? numeric : shown || null;
    }

    case 'boolean':
      return typeof value === 'boolean' ? value : shown || null;

    case 'date':
      return toDate(value) ?? (shown || null);

    default:
      return shown || null;
  }
};

const isTyped = (value: CellValue) => typeof value === 'number' || value instanceof Date;

// ------------------------------------------------------------------ contexto

interface Context {
  title: string;
  sheetName: string;
  fallbackName: string;
  language: string;
  rtl: boolean;
  columns: GridExportColumn[];
  rows: Iterator<GridExportRow>;
  totalCount: number;
  maxLevel: number;
  /** Colunas fixas no início, seguidas (congeladas e títulos de linha). */
  fixedStart: number;
  /** Bandas acima de cada coluna (de cima para baixo), quando `includeBands`. */
  chains: GridColumnDef[][];
  numberLanguage: string | undefined;
}

const validLanguage = (language: string | undefined): string | undefined => {
  if (!language) {
    return undefined;
  }

  try {
    return Intl.getCanonicalLocales(language)[0];
  } catch {
    return undefined;
  }
};

const isGrid = (source: unknown): source is DataGrid =>
  !!source && typeof (source as Partial<DataGrid>)._exportStream === 'function';

const contextOf = (grid: DataGrid, options: GridXlsxOptions): Context => {
  if (!isGrid(grid)) {
    throw new TypeError('<u-grid> xlsx: exportXlsx needs a <u-grid> element.');
  }

  const stream = grid._exportStream(options);
  const translation = grid._exportTranslation;
  const name = grid._exportName.trim();
  const fallback = translation.exportDefaultTitle;
  const bands = options.includeBands !== false && options.includeHeaders !== false;
  const language = validLanguage(options.language);

  if (options.language && !language) {
    warnOnce(`lang:${options.language}`, `"${options.language}" is not a valid language tag; the language of the grid was used.`);
  }

  let fixedStart = 0;

  while (fixedStart < stream.columns.length && grid._fixedOf(stream.columns[fixedStart].column) === 'start') {
    fixedStart++;
  }

  return {
    title: options.title?.trim() || name || fallback,
    sheetName: options.sheetName?.trim() || name || fallback,
    fallbackName: fallback,
    language: language ?? validLanguage(grid._exportLanguages.content) ?? 'en',
    rtl: (options.direction ?? getComputedStyle(grid).direction) === 'rtl',
    columns: stream.columns,
    rows: stream.rows,
    totalCount: stream.totalCount,
    maxLevel: Math.min(MAX_OUTLINE, stream.maxLevel),
    fixedStart,
    chains: bands ? stream.columns.map(column => grid._bandChainOf(column.column)) : stream.columns.map(() => []),
    numberLanguage: language ?? grid.language,
  };
};

const configOf = (ctx: Context, headerRows: number, freeze: boolean): Uint8Array => {
  const w = new Writer();
  w.u8(2);
  w.str(ctx.title);
  w.str(ctx.language);
  w.str(ctx.sheetName);
  w.str(ctx.fallbackName);
  w.u8((ctx.rtl ? 1 : 0) | (freeze ? 2 : 0));
  w.u8(headerRows);
  w.u8(ctx.maxLevel);
  w.u16(Math.min(ctx.fixedStart, 0xffff));
  w.u16(ctx.columns.length);

  for (const c of ctx.columns) {
    w.f32(c.width ?? 0);
  }

  return w.take();
};

// ------------------------------------------------------------------ exportação

/** A pasta de `assetsUrl` (relativa ao documento; com a `/` final que faltar). */
const assetsOf = (assetsUrl: string | URL): URL => {
  const url = new URL(assetsUrl, typeof document === 'undefined' ? undefined : document.baseURI);

  if (!url.pathname.endsWith('/')) {
    url.pathname += '/';
  }

  return url;
};

const wasmUrl = (options: GridXlsxOptions): string =>
  options.assetsUrl
    ? new URL('grid-xlsx.wasm', assetsOf(options.assetsUrl)).href
    : typeof __U_GRID_ASSETS__ === 'string'
      ? new URL(__U_GRID_ASSETS__ + 'grid-xlsx.wasm', import.meta.url).href
      : new URL('./grid-xlsx.wasm', import.meta.url).href;

const clientOf = async (options: GridXlsxOptions): Promise<XlsxClient> => {
  const wasm = wasmUrl(options);
  const factory = options.worker;

  if (factory === false || (typeof factory !== 'function' && typeof Worker === 'undefined')) {
    return localClient(wasm);
  }

  // `new URL('./…', import.meta.url)` literal: os bundlers (Vite, webpack, esbuild) copiam o arquivo
  const worker = typeof factory === 'function'
    ? factory()
    : options.assetsUrl
      ? new Worker(new URL('worker.js', assetsOf(options.assetsUrl)), { type: 'module' })
      : typeof __U_GRID_ASSETS__ === 'string'
        ? new Worker(new URL(__U_GRID_ASSETS__ + 'worker.js', import.meta.url), { type: 'module' })
        : new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

  try {
    return await workerClient(worker, wasm);
  } catch (error) {
    worker.terminate();
    throw error;
  }
};

const rethrow = (error: unknown): never => {
  if (error instanceof XlsxEngineError) {
    throw error.code === XlsxEngineCode.Limit
      ? new RangeError(`<u-grid> xlsx: ${error.message} (a limit of Excel).`)
      : new Error(`<u-grid> xlsx: ${error.message}`);
  }

  throw error;
};

/** Faixas de uma linha de banda: `[início, fim)` e a banda (`undefined` = sem banda nesse nível). */
const bandRuns = (chains: GridColumnDef[][], depth: number): { start: number; end: number; band: GridColumnDef | undefined }[] => {
  const runs: { start: number; end: number; band: GridColumnDef | undefined }[] = [];

  for (let i = 0; i < chains.length;) {
    const band = chains[i][depth];
    let j = i + 1;

    while (j < chains.length && chains[j][depth] === band) {
      j++;
    }

    runs.push({ start: i, end: j, band });
    i = j;
  }

  return runs;
};

const exportXlsxFile = async (grid: DataGrid, options: GridXlsxOptions): Promise<Blob> => {
  const signal = options.signal;
  signal?.throwIfAborted();

  if (options.customize) {
    warnOnce('customize', '"customize" only works with the deprecated ExcelJS forms and was ignored; use "customizeCell".');
  }

  const ctx = contextOf(grid, options);
  const customize = typeof options.customizeCell === 'function' ? options.customizeCell : null;
  const headers = options.includeHeaders !== false;
  const depth = headers ? Math.max(0, ...ctx.chains.map(chain => chain.length)) : 0;
  const headerRows = headers ? depth + 1 : 0;
  const rtl = ctx.rtl;
  const n = ctx.columns.length;

  const styles = new StyleTable();
  const plans = ctx.columns.map(column => planOf(column, ctx.numberLanguage, styles));
  const headerSpec = (align: AlignCode): StyleSpec => ({ bold: true, fill: HEADER_FILL, align });
  const groupLabelSpec: StyleSpec = { bold: true, align: Align.CenterContinuous };
  const groupCellSpecs = plans.map(plan => ({ bold: true, align: plan.align }));
  const footerSpecs = plans.map(plan => ({ align: plan.align }));
  const totalSpecs = plans.map(plan => ({ bold: true, align: plan.align }));
  const groupLabel = styles.id(groupLabelSpec);
  const groupCell = groupCellSpecs.map(spec => styles.id(spec));
  const footerCell = footerSpecs.map(spec => styles.id(spec));
  const totalCell = totalSpecs.map(spec => styles.id(spec));

  /** `customizeCell` sobre a célula; devolve valor, estilo e link finais. */
  const custom = (
    base: CellBase,
    value: CellValue,
    text: string,
    numFmt: string | null,
    spec: StyleSpec,
  ): { value: CellValue; style: number; link?: string; spec: StyleSpec } => {
    const cell = new XlsxCell(base, value, text, numFmt, publicStyle(spec));
    customize!(cell);
    let link: string | undefined;

    if (cell.link) {
      const url = String(cell.link.url ?? '').trim();

      if ((/^(https?:|mailto:)/i).test(url)) {
        link = url;
      } else {
        warnOnce(`link:${url.slice(0, 20)}`, `link "${url.slice(0, 40)}" was ignored (only http:, https: and mailto:).`);
      }
    }

    const final = specOf(cell.style, cell.numFmt, base.columnSpan > 1, rtl, !!link);
    let out = cell.cellValue;

    if (out !== null && typeof out !== 'string' && typeof out !== 'number' && typeof out !== 'boolean' && !(out instanceof Date)) {
      warnOnce('cell-value', 'cellValue must be a string, number, boolean, Date or null; the text was used.');
      out = cell.text;
    }

    return { value: out, style: styles.id(final), link, spec: final };
  };

  const client = await clientOf(options);
  const onAbort = () => client.dispose();
  signal?.addEventListener('abort', onAbort, { once: true });
  const batchRows = client.local ? LOCAL_BATCH_ROWS : BATCH_ROWS;
  let rowCount = 0;
  let lastProgress = 0;

  const progress = (force = false) => {
    const now = performance.now();

    if (options.onProgress && !signal?.aborted && (force || now - lastProgress >= PROGRESS_MS)) {
      lastProgress = now;

      try {
        options.onProgress({ rowCount, totalCount: Math.max(ctx.totalCount, rowCount), pageCount: 0 } satisfies GridExportProgress);
      } catch (error) {
        console.error('<u-grid> xlsx: onProgress failed.', error);
      }
    }
  };

  let file: Uint8Array;

  try {
    await client.begin(configOf(ctx, headerRows, headerRows > 0 && options.freezeHeader !== false));
    const w = new Writer();
    let count = 0;
    // Um bloco em voo: o worker escreve um enquanto a thread principal serializa o próximo.
    const pipe: { inflight: Promise<void> | null } = { inflight: null };

    const flush = async () => {
      const { count: styleCount, bytes: styleBytes } = styles.take();
      const rows = w.take();
      const block = new Uint8Array(2 + styleBytes.length + 4 + rows.length);
      const view = new DataView(block.buffer);
      view.setUint16(0, styleCount, true);
      block.set(styleBytes, 2);
      view.setUint32(2 + styleBytes.length, count, true);
      block.set(rows, 6 + styleBytes.length);
      count = 0;

      if (pipe.inflight) {
        await pipe.inflight;
      }

      signal?.throwIfAborted();
      const inflight = client.append(block).then(() => progress());
      // Falha do bloco em voo: tratada aqui e relançada no próximo `await` (sem "unhandled rejection").
      inflight.catch(() => undefined);
      pipe.inflight = inflight;

      if (client.local) {
        await inflight;
        pipe.inflight = null;
        await yieldToHost();
      }
    };

    const row = (level: number, cells: number) => {
      w.u8(Math.min(MAX_OUTLINE, level));
      w.u16(cells);
      count++;
    };

    // cabeçalho: bandas (de cima para baixo) e a linha das colunas
    for (let d = 0; d < depth; d++) {
      row(0, n);

      for (const run of bandRuns(ctx.chains, d)) {
        const span = run.end - run.start;

        if (!run.band) {
          // sem banda neste nível: célula de cabeçalho vazia (o fundo continua)
          const filler = styles.id(headerSpec(Align.None));

          for (let i = run.start; i < run.end; i++) {
            emit(w, null, filler, undefined);
          }

          continue;
        }

        const label = columnText(run.band);
        // o alinhamento da banda, como na tela (padrão `start`); `center` centraliza na seleção
        const alignment = run.band.alignment ?? 'start';
        let spec = headerSpec(alignment === 'center' ? span > 1 ? Align.CenterContinuous : Align.Center : ALIGN_OF[alignment] ?? Align.None);
        let value: CellValue = label;
        let style = styles.id(spec);
        let link: string | undefined;

        if (customize) {
          ({ value, style, link, spec } = custom(
            { rowType: 'header', row: null, column: ctx.columns[run.start], band: run.band, columnIndex: run.start, columnSpan: span, headerRow: d, value: label },
            label,
            label,
            null,
            spec,
          ));
        }

        emit(w, value, style, link);

        // o resto da faixa: vazias com o mesmo estilo ("centralizar na seleção" atravessa só células assim)
        for (let i = run.start + 1; i < run.end; i++) {
          emit(w, null, style);
        }
      }
    }

    if (headers) {
      row(0, n);

      for (const [i, column] of ctx.columns.entries()) {
        const spec = headerSpec(plans[i].align);

        if (customize) {
          const c = custom({ rowType: 'header', row: null, column, columnIndex: i, columnSpan: 1, headerRow: depth, value: column.label }, column.label, column.label, null, spec);
          emit(w, c.value, c.style, c.link);
        } else {
          emit(w, column.label, styles.id(spec));
        }
      }
    }

    const slicer = createSlicer(XLSX_SLICE_MS);
    let next = ctx.rows.next();

    while (!next.done) {
      const r = next.value;

      switch (r.rowType) {
        case 'data': {
          row(r.level, n);

          for (let i = 0; i < n; i++) {
            const plan = plans[i];
            const shown = r.texts[i] ?? '';
            const value = typedValue(plan, r.values[i], shown);
            const typed = isTyped(value) || typeof value === 'boolean';

            if (customize) {
              const c = custom(
                { rowType: 'data', row: r, column: ctx.columns[i], columnIndex: i, columnSpan: 1, headerRow: -1, value: r.values[i] },
                value,
                shown,
                typed ? plan.numFmt : null,
                { align: plan.align, numFmt: typed ? plan.numFmt : null },
              );
              emit(w, c.value, c.style, c.link);
            } else {
              emit(w, value, typed ? plan.typed : plan.plain);
            }
          }

          rowCount++;
          break;
        }

        case 'group': {
          // rótulo em texto na 1ª coluna ("País: Brasil (3)"), centralizado sobre as vazias à frente, sem mesclar
          let span = 1;

          while (span < n && !r.texts[span]) {
            span++;
          }

          row(r.level, Math.max(n, 1));
          let label: { value: CellValue; style: number; link?: string; spec: StyleSpec } = { value: r.label, style: groupLabel, spec: groupLabelSpec };

          if (customize) {
            label = custom({ rowType: 'group', row: r, column: null, columnIndex: -1, columnSpan: span, headerRow: -1, value: r.value }, r.label, r.label, null, groupLabelSpec);
          }

          emit(w, label.value, label.style, label.link);

          // dentro da faixa do rótulo: vazias com o estilo final dele (a centralização atravessa só
          // células assim); o `customizeCell` já viu a faixa inteira no rótulo (`columnSpan`)
          for (let i = 1; i < span; i++) {
            emit(w, null, label.style);
          }

          for (let i = span; i < n; i++) {
            const text = r.texts[i] ?? '';

            if (customize) {
              const c = custom({ rowType: 'group', row: r, column: ctx.columns[i], columnIndex: i, columnSpan: 1, headerRow: -1, value: r.summaries[i] }, text || null, text, null, groupCellSpecs[i]);
              emit(w, c.value, c.style, c.link);
            } else {
              emit(w, text || null, groupCell[i]);
            }
          }

          break;
        }

        default: {
          if (r.rowType !== 'group-footer' && r.rowType !== 'total') {
            const type = String((r as { rowType?: unknown }).rowType);
            warnOnce(`row:${type}`, `rows of type "${type}" are not supported and were left out.`);
            break;
          }

          const total = r.rowType === 'total';

          row(r.level, n);

          for (let i = 0; i < n; i++) {
            const text = r.texts[i] ?? '';

            if (customize) {
              const c = custom(
                { rowType: r.rowType, row: r, column: ctx.columns[i], columnIndex: i, columnSpan: 1, headerRow: -1, value: r.summaries[i] },
                text || null,
                text,
                null,
                total ? totalSpecs[i] : footerSpecs[i],
              );
              emit(w, c.value, c.style, c.link);
            } else {
              emit(w, text || null, total ? totalCell[i] : footerCell[i]);
            }
          }

        }
      }

      if (count >= batchRows || styles.pendingCount >= MAX_BLOCK_STYLES) {
        await flush();
      }

      // o relógio é lido a cada 256 unidades: com `customizeCell` a unidade é a célula, senão ~8 células
      let pause: Promise<void> | undefined;

      for (let k = customize ? n : n >> 3; k >= 0 && !pause; k--) {
        pause = slicer.tick();
      }

      if (pause) {
        await pause;
        signal?.throwIfAborted();
      }

      next = ctx.rows.next();
    }

    await flush();

    if (pipe.inflight) {
      await pipe.inflight;
    }

    const result = await client.finish();
    signal?.throwIfAborted();
    file = result.file;

    if (result.stats.droppedLinks) {
      warnOnce('dropped-links', `${result.stats.droppedLinks} link(s) were left out (not http:, https: or mailto:, or longer than 2,079 characters).`);
    }

    if (result.stats.cutTexts) {
      warnOnce('cut-texts', `${result.stats.cutTexts} text(s) longer than 32,767 characters (the limit of an Excel cell) were cut.`);
    }

    progress(true);
  } catch (error) {
    client.dispose();

    if (signal?.aborted) {
      throw signal.reason;
    }

    return rethrow(error);
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }

  client.dispose();

  return new Blob([file as BlobPart], { type: XLSX_TYPE });
};

// ------------------------------------------------------------------ API

/* eslint-disable prefer-arrow/prefer-arrow-functions, no-redeclare, padding-line-between-statements -- sobrecargas (a forma com o ExcelJS é obsoleta) */

/**
 * The Excel file of what the user sees: visible columns in the current
 * order, filter, sorting, groups (with the row outline of Excel), group
 * footers, totals and bands, with a frozen header. Numbers, dates and
 * booleans are typed cells with a number format close to the column
 * `format`; columns with `displayValue`, a `format` function,
 * `booleanDisplay` or their own `trueText`/`falseText` are written as their
 * displayed text. Text is always a text cell (never a formula). Written in a
 * Web Worker by a WebAssembly engine; the `.wasm` and the worker load on the
 * first export.
 */
export function exportXlsx(grid: DataGrid, options?: GridXlsxOptions): Promise<Blob>;
/**
 * The file through the ExcelJS module the host passes.
 * @deprecated Call `exportXlsx(grid, options)` without ExcelJS: the grid writes the file itself (bands, frozen header, `customizeCell`).
 */
export function exportXlsx<M extends ExcelJSModule>(grid: DataGrid, excelJS: M, options?: GridXlsxExcelJSOptions<WorkbookOf<M>, WorksheetOf<M>>): Promise<Blob>;
export function exportXlsx(grid: DataGrid, second?: unknown, third?: unknown): Promise<Blob> {
  return exportEither(grid, second, third);
}

/** As duas formas: com o ExcelJS (obsoleta) ou pelo motor. */
const exportEither = (grid: DataGrid, second: unknown, third: unknown): Promise<Blob> => {
  if (isExcelJS(second)) {
    warnExcelJS();
    return exportXlsxWithExcelJS(grid, second, (third ?? {}) as GridXlsxExcelJSOptions);
  }

  return exportXlsxFile(grid, second ?? {});
};

/** Builds the file (`exportXlsx`) and downloads it as `fileName` (default `export.xlsx`). */
export function downloadXlsx(grid: DataGrid, options?: GridXlsxDownloadOptions): Promise<void>;
/**
 * Builds the file through the ExcelJS module the host passes and downloads it.
 * @deprecated Call `downloadXlsx(grid, options)` without ExcelJS.
 */
export function downloadXlsx<M extends ExcelJSModule>(
  grid: DataGrid,
  excelJS: M,
  options?: GridXlsxExcelJSOptions<WorkbookOf<M>, WorksheetOf<M>> & { fileName?: string },
): Promise<void>;
export async function downloadXlsx(grid: DataGrid, second?: unknown, third?: unknown): Promise<void> {
  const options = ((isExcelJS(second) ? third : second) ?? {}) as { fileName?: string };
  downloadBlob(await exportEither(grid, second, third), options.fileName || 'export.xlsx');
}

/**
 * The Excel entry of the grid export UI: `grid.xlsxExporter =
 * createXlsxExporter(options)` (with `export-formats="… xlsx"`). The grid
 * passes `selectedOnly`, a `signal` (cancel, disconnect) and `onProgress`
 * (shown in the export button).
 */
export function createXlsxExporter(options?: GridXlsxExporterOptions): GridExporter;
/**
 * The Excel entry of the grid export UI through the ExcelJS module the host passes.
 * @deprecated Call `createXlsxExporter(options)` without ExcelJS.
 */
export function createXlsxExporter<M extends ExcelJSModule>(
  excelJS: M,
  options?: Omit<GridXlsxExcelJSOptions<WorkbookOf<M>, WorksheetOf<M>>, 'selectedOnly' | 'signal'> & { fileName?: string },
): GridExporter;
export function createXlsxExporter(first?: unknown, second?: unknown): GridExporter {
  if (isExcelJS(first)) {
    const excelJS = first;
    const options = (second ?? {}) as GridXlsxExcelJSOptions & { fileName?: string };
    warnExcelJS();

    return (grid, { selectedOnly, signal }) => downloadXlsx(grid, excelJS, { ...options, selectedOnly, signal });
  }

  const options = (first ?? {}) as GridXlsxExporterOptions;

  return (grid, { selectedOnly, signal, onProgress }) => downloadXlsx(grid, {
    ...options,
    selectedOnly,
    signal,
    onProgress: progress => {
      options.onProgress?.(progress);
      onProgress?.(progress);
    },
  });
}

/* eslint-enable prefer-arrow/prefer-arrow-functions, no-redeclare, padding-line-between-statements */
