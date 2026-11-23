/* eslint-disable no-bitwise -- bits de estilo das células no protocolo do motor. */
/**
 * Exportação em PDF (frente 26): `@universal-material/data-grid/export-pdf`.
 *
 * PDF marcado (alvo PDF/UA-1) gerado por um motor WebAssembly (crate `pdf/`)
 * num Web Worker: lê o que o usuário vê em blocos (`_exportStream`), aplica
 * `customizeCell`, serializa e manda ao motor; o arquivo volta em blocos.
 * O `.wasm` e o worker só são baixados ao exportar.
 */
import { downloadBlob } from '../export/download.js';
import { type ExportTexts, exportTranslation } from '../export/i18n.js';
import { contrast, parseColor, Writer } from '../export/serialize.js';
import { createSlicer } from '../export/slice.js';
import type { GridExportColumn, GridExportData, GridExporter, GridExportRow } from '../export/types.js';
import type { DataGrid } from '../grid.js';
import { LruCache } from '../row-model/lru.js';
import { type Client, localClient, workerClient } from './client.js';
import { EngineCode, EngineError, readFileUrl } from './engine.js';
import type {
  GridPdfCell,
  GridPdfCellStyle,
  GridPdfDownloadOptions,
  GridPdfExporterOptions,
  GridPdfFont,
  GridPdfOptions,
  GridPdfPaperSize,
  GridPdfProgress,
} from './types.js';

export type { GridExportCellStyle } from '../export/types.js';
export type {
  GridPdfCell,
  GridPdfCellStyle,
  GridPdfDownloadOptions,
  GridPdfExporterOptions,
  GridPdfFont,
  GridPdfImage,
  GridPdfLayout,
  GridPdfLink,
  GridPdfOptions,
  GridPdfOrientation,
  GridPdfPaperSize,
  GridPdfProgress,
  GridPdfTheme,
} from './types.js';

/** Some characters have no glyph in any of the `fonts`: the PDF would lose them (PDF/UA). Add a font that covers them. */
export class GridPdfMissingGlyphError extends Error {
  /** The code points without a glyph. */
  readonly codePoints: readonly number[];

  constructor(codePoints: readonly number[]) {
    const list = codePoints.slice(0, 12).map(cp => `U+${cp.toString(16).toUpperCase()
      .padStart(4, '0')}`)
      .join(', ');
    super(`No font covers ${codePoints.length} character(s): ${list}${codePoints.length > 12 ? ', …' : ''}. Add a font for them to "fonts".`);
    this.name = 'GridPdfMissingGlyphError';
    this.codePoints = Object.freeze([...codePoints]);
  }
}

// ------------------------------------------------------------------ padrões

const PAPER: Record<Exclude<GridPdfPaperSize, 'auto'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a3: [841.89, 1190.55],
};

/** Regiões que usam Carta (Letter). */
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'PR', 'GT', 'CR', 'PA', 'DO', 'SV', 'NI', 'HN', 'BO', 'BZ']);

const THEME = {
  color: 0x1a1a1a,
  headerBackgroundColor: 0xe6e6e6,
  groupBackgroundColor: 0xf0f0f0,
  stripedBackgroundColor: 0xf7f7f7,
  summaryBackgroundColor: 0xececec,
  lineColor: 0x8a8a8a,
};

const WHITE = 0xffffff;
const MIN_CONTRAST = 4.5;
const MARGIN = 36;
const BATCH_ROWS = 2000;
const PROGRESS_MS = 250;
/** Orçamento de uma fatia de serialização na thread principal (ms de relógio). */
const PDF_SLICE_MS = 4;
/** Tamanho da fonte do grid quando não há grid (px). */
const GRID_FONT_PX = 14;
/** Largura de coluna sem largura conhecida (px), como a regra da spec 21. */
const DEFAULT_COLUMN_PX = 150;

// ------------------------------------------------------------------ avisos limitados

const warned = new LruCache<string, true>(64);

const warnOnce = (key: string, message: string) => {
  if (!warned.get(key)) {
    warned.set(key, true);
    console.warn(`<u-grid> PDF: ${message}`);
  }
};

// ------------------------------------------------------------------ fontes

/** Fontes lidas (cópias), por origem: limitado. */
const fontCache = new LruCache<unknown, Promise<Uint8Array>>(8);

const loadFont = (font: GridPdfFont, signal: AbortSignal | null | undefined): Promise<Uint8Array> => {
  const source = font.source;
  const key = typeof source === 'string' || source instanceof URL ? String(source) : source;
  let bytes = fontCache.get(key);

  if (!bytes) {
    bytes = (async () => {
      if (typeof source === 'string' || source instanceof URL) {
        const href = String(source);

        if (href.startsWith('file:')) {
          return readFileUrl(href);
        }

        const response = await fetch(source, { signal: signal ?? undefined });

        if (!response.ok) {
          throw new Error(`could not load font ${String(source)} (${response.status})`);
        }

        return new Uint8Array(await response.arrayBuffer());
      }

      // cópia: o buffer do hospedeiro nunca é transferido nem mudado
      return source instanceof Uint8Array ? source.slice() : new Uint8Array(source.slice(0));
    })();
    bytes.catch(() => fontCache.delete(key));
    fontCache.set(key, bytes);
  }

  return bytes;
};

const validate = (options: GridPdfOptions | GridPdfExporterOptions): void => {
  if (!options || !Array.isArray(options.fonts) || options.fonts.length === 0) {
    throw new TypeError('<u-grid> PDF: "fonts" must be a non-empty array of fonts.');
  }

  options.fonts.forEach((font, i) => {
    const s = font?.source;

    if (!(s instanceof ArrayBuffer || s instanceof Uint8Array || typeof s === 'string' || s instanceof URL)) {
      throw new TypeError(`<u-grid> PDF: fonts[${i}].source must be an ArrayBuffer, a Uint8Array or a URL.`);
    }
  });

  if (options.layout && !['table', 'sections', 'list'].includes(options.layout)) {
    throw new TypeError(`<u-grid> PDF: unknown layout "${options.layout}".`);
  }
};

// ------------------------------------------------------------------ contexto

interface Context {
  title: string;
  language: string;
  textLanguage: string;
  rtl: boolean;
  translation: ExportTexts;
  striped: boolean;
  autoHide: boolean;
  gridFontPx: number;
  columns: GridExportColumn[];
  rows: Iterator<GridExportRow>;
  totalCount: number;
}

const isGrid = (source: DataGrid | GridExportData): source is DataGrid =>
  typeof (source as Partial<DataGrid>)._exportStream === 'function';

const validLanguage = (language: string | undefined): string | undefined => {
  if (!language) {
    return undefined;
  }

  try {
    return Intl.getCanonicalLocales(language)[0];
  } catch {
    warnOnce(`lang:${language}`, `"${language}" is not a valid language tag; it was ignored.`);
    return undefined;
  }
};

const contextOf = (source: DataGrid | GridExportData, options: GridPdfOptions): Context => {
  const includeGroups = options.layout !== 'list';

  if (isGrid(source)) {
    const stream = source._exportStream({ ...options, includeGroups });
    const { content, text } = source._exportLanguages;
    const language = validLanguage(options.language) ?? validLanguage(content) ?? 'en';
    const translation = source._exportTranslation;
    const style = getComputedStyle(source);

    return {
      title: options.title?.trim() || source._exportName.trim() || translation.pdfDefaultTitle,
      language,
      textLanguage: text,
      rtl: (options.direction ?? style.direction) === 'rtl',
      translation,
      striped: options.striped ?? source.striped,
      autoHide: options.autoHideColumns ?? source.autoHideColumns,
      gridFontPx: parseFloat(style.fontSize) || GRID_FONT_PX,
      columns: stream.columns,
      rows: stream.rows,
      totalCount: stream.totalCount,
    };
  }

  const language = validLanguage(options.language) ?? 'en';
  const translation = exportTranslation(language);

  return {
    title: options.title?.trim() || translation.pdfDefaultTitle,
    language,
    textLanguage: language,
    rtl: options.direction === 'rtl',
    translation,
    striped: !!options.striped,
    autoHide: !!options.autoHideColumns,
    gridFontPx: GRID_FONT_PX,
    columns: source.columns,
    rows: source.rows[Symbol.iterator](),
    totalCount: source.rows.filter(row => row.rowType === 'data').length,
  };
};

// ------------------------------------------------------------------ configuração

const paperOf = (size: GridPdfPaperSize | undefined, language: string): [number, number] => {
  if (size && size !== 'auto') {
    return PAPER[size] ?? PAPER.a4;
  }

  let region: string | undefined;

  try {
    region = new Intl.Locale(language).maximize().region;
  } catch {
    region = undefined;
  }

  return region && LETTER_REGIONS.has(region) ? PAPER.letter : PAPER.a4;
};

interface Theme {
  color: number;
  header: number;
  group: number;
  stripe: number;
  summary: number;
  line: number;
}

/** Tema com contraste: a cor reprovada volta ao padrão (com aviso). */
const themeOf = (options: GridPdfOptions): Theme => {
  const t = options.theme ?? {};

  const pick = (name: keyof typeof THEME): number => {
    const value = t[name];

    if (value === undefined) {
      return THEME[name];
    }

    const parsed = parseColor(value);

    if (parsed === undefined) {
      warnOnce(`color:${value}`, `"${value}" is not a color; the default ${name} was used.`);
      return THEME[name];
    }

    return parsed;
  };

  let color = pick('color');

  if (contrast(color, WHITE) < MIN_CONTRAST) {
    warnOnce(`theme-color:${color}`, 'theme.color has a contrast below 4.5:1 with the page; the default was used.');
    color = THEME.color;
  }

  const background = (name: keyof typeof THEME): number => {
    const bg = pick(name);

    if (contrast(color, bg) < MIN_CONTRAST) {
      warnOnce(`theme-${name}:${bg}`, `theme.${name} has a contrast below 4.5:1 with the text; the default was used.`);
      return THEME[name];
    }

    return bg;
  };

  return {
    color,
    header: background('headerBackgroundColor'),
    group: background('groupBackgroundColor'),
    stripe: background('stripedBackgroundColor'),
    summary: background('summaryBackgroundColor'),
    line: pick('lineColor'),
  };
};

const ALIGN = { start: 0, left: 0, center: 1, end: 2, right: 2 } as const;

const configOf = (ctx: Context, options: GridPdfOptions, theme: Theme): Uint8Array => {
  const w = new Writer();
  const fontSize = Math.max(6, options.theme?.fontSize ?? 8);
  const [pw, ph] = paperOf(options.paperSize, ctx.language);
  const scale = fontSize / ctx.gridFontPx;
  const anyPriority = ctx.columns.some(c => Number.isFinite(c.column.hidingPriority));
  w.u8(1);
  w.str(ctx.title);
  w.str(ctx.language);
  w.str(ctx.textLanguage);
  w.u8(ctx.rtl ? 1 : 0);
  w.u8(options.layout === 'sections' ? 1 : options.layout === 'list' ? 2 : 0);
  w.f32(pw);
  w.f32(ph);
  w.u8(options.orientation === 'portrait' ? 1 : options.orientation === 'landscape' ? 2 : 0);
  w.f32(MARGIN);
  w.f32(fontSize);
  w.u32((options.includePageNumbers !== false ? 1 : 0)
    | (options.bookmarks !== false ? 2 : 0)
    | (ctx.striped ? 4 : 0)
    | (ctx.autoHide ? 8 : 0)
    | (anyPriority ? 16 : 0));

  for (const c of [theme.color, theme.header, theme.group, theme.stripe, theme.summary, theme.line]) {
    w.u32(c);
  }

  w.str(ctx.translation.pdfPageNumber);
  w.str(ctx.translation.adaptiveLabelSeparator);
  w.str(ctx.translation.pdfTotalRow);
  w.u16(ctx.columns.length);

  for (const c of ctx.columns) {
    const px = c.width ?? Math.max(Number(c.column.minWidth) || 0, DEFAULT_COLUMN_PX);
    w.str(c.label);
    w.f32(px * scale);
    w.u8(ALIGN[c.alignment as keyof typeof ALIGN] ?? 0);
    w.i32(Number.isFinite(c.column.hidingPriority) ? Math.trunc(c.column.hidingPriority!) : -2147483648);
    w.u8(c.column.fixed ? 1 : 0);
  }

  return w.take();
};

// ------------------------------------------------------------------ células

interface Pending {
  images: Map<Uint8Array, number>;
  client: Client;
  /** O motor numera as imagens na ordem de chegada: o id é conhecido sem esperar. */
  nextImage: number;
  /** Registros de imagem em voo (os erros aparecem no próximo bloco). */
  registering: Promise<number>[];
}

const rowBackground = (rowType: GridPdfCell['rowType'], theme: Theme): number[] =>
  rowType === 'header' ? [theme.header] : rowType === 'group' ? [theme.group] : rowType === 'data' ? [WHITE, theme.stripe] : [theme.summary];

/** Célula sem `customizeCell` (o caso comum): só texto e negrito. */
const writePlain = (w: Writer, text: string, bold: boolean): void => {
  w.u16(bold ? 1 : 0);
  w.str(text);
};

/** Aplica `customizeCell` e escreve a célula (síncrono: a imagem nova é registrada sem esperar). */
const writeCell = (
  w: Writer,
  pending: Pending,
  theme: Theme,
  options: GridPdfOptions,
  base: Omit<GridPdfCell, 'text' | 'style'> & { text: string; style: GridPdfCellStyle },
): void => {
  if (!options.customizeCell) {
    writePlain(w, base.text, !!base.style.bold);
    return;
  }

  const cell: GridPdfCell = { ...base, style: { ...base.style } };
  options.customizeCell?.(cell);
  const text = typeof cell.text === 'string' ? cell.text : String(cell.text ?? '');
  const style = cell.style ?? {};
  let color = parseColor(style.color);
  let bg = parseColor(style.backgroundColor);
  const finalBgs = bg !== undefined ? [bg] : rowBackground(base.rowType, theme);
  const finalColor = color ?? theme.color;

  if (finalBgs.some(b => contrast(finalColor, b) < MIN_CONTRAST)) {
    warnOnce(`cell:${finalColor}:${finalBgs.join()}`, 'a cell color has a contrast below 4.5:1 with its background; the theme colors were used.');
    color = undefined;

    if (bg !== undefined && contrast(theme.color, bg) < MIN_CONTRAST) {
      bg = undefined;
    }
  }

  const lang = validLanguage(cell.lang);
  let image: number | undefined;
  let alt = '';

  if (cell.image) {
    const img = cell.image;

    if (!(img.data instanceof Uint8Array) || (img.format !== 'png' && img.format !== 'jpeg')) {
      warnOnce('image-format', 'customizeCell image needs "data" (Uint8Array) and "format" (png or jpeg); it was ignored.');
    } else if (typeof img.alt !== 'string') {
      warnOnce('image-alt', 'customizeCell image without "alt" was ignored (use "" for a decorative image).');
    } else if ((base.rowType === 'header' || base.rowType === 'group') && !text && !img.alt.trim()) {
      warnOnce('image-header', 'an image in a header or group cell needs a text or a non-empty "alt"; it was ignored.');
    } else {
      let id = pending.images.get(img.data);

      if (id === undefined) {
        // as mensagens ao motor são em ordem: a imagem chega antes do bloco que a usa
        id = pending.nextImage++;
        const registering = pending.client.addImage(img.data, img.format === 'jpeg' ? 1 : 0, Math.max(1, img.width || 0), Math.max(1, img.height || 0));
        registering.catch(() => undefined);
        pending.registering.push(registering);
        pending.images.set(img.data, id);
      }

      image = id;
      alt = img.alt;
    }
  }

  let link: [string, string] | undefined;

  if (cell.link) {
    const url = String(cell.link.url ?? '').trim();
    const description = String(cell.link.description ?? '');

    if (!(/^(https?:|mailto:)/i).test(url)) {
      warnOnce(`link:${url.slice(0, 20)}`, `link "${url.slice(0, 40)}" was ignored (only http:, https: and mailto:).`);
    } else if (!text && !alt && !description) {
      warnOnce('link-text', 'a link without text, alt or description was ignored.');
    } else {
      link = [url, description];
    }
  }

  const align = style.alignment ? ALIGN[style.alignment as keyof typeof ALIGN] + 1 : 0;
  const flags = (style.bold ? 1 : 0)
    | (style.italic ? 2 : 0)
    | (color !== undefined ? 4 : 0)
    | (bg !== undefined ? 8 : 0)
    | (lang ? 16 : 0)
    | (image !== undefined ? 32 : 0)
    | (link ? 64 : 0)
    | (align << 8);
  w.u16(flags);
  w.str(text);

  if (color !== undefined) {
    w.u32(color);
  }

  if (bg !== undefined) {
    w.u32(bg);
  }

  if (lang) {
    w.str(lang);
  }

  if (image !== undefined) {
    w.u32(image);
    w.str(alt);
  }

  if (link) {
    w.str(link[0]);
    w.str(link[1]);
  }
};

const KIND = { data: 0, group: 1, 'group-footer': 2, total: 3 } as const;

// ------------------------------------------------------------------ exportação

/** Pasta dos assets no bundle autocontido (`dist/export-pdf.min.js` → `./export-pdf/`); no ESM, indefinido. */
declare const __U_GRID_ASSETS__: string | undefined;

const clientOf = async (options: GridPdfOptions): Promise<Client> => {
  // `new URL('./…', import.meta.url)` literal: os bundlers (Vite, webpack, esbuild) copiam o arquivo
  const wasm = options.assetsUrl
    ? new URL('grid-pdf.wasm', options.assetsUrl).href
    : typeof __U_GRID_ASSETS__ === 'string'
      ? new URL(__U_GRID_ASSETS__ + 'grid-pdf.wasm', import.meta.url).href
      : new URL('./grid-pdf.wasm', import.meta.url).href;
  const factory = options.worker;

  if (factory === false || (typeof factory !== 'function' && typeof Worker === 'undefined')) {
    return localClient(wasm);
  }

  // dois workers: o motor (layout) e o montador (deflate e escrita), em paralelo
  const create = typeof factory === 'function'
    ? factory
    : () => options.assetsUrl
      ? new Worker(new URL('worker.js', options.assetsUrl), { type: 'module' })
      : typeof __U_GRID_ASSETS__ === 'string'
        ? new Worker(new URL(__U_GRID_ASSETS__ + 'worker.js', import.meta.url), { type: 'module' })
        : new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const engine = create();
  let assembler: Worker | undefined;

  try {
    assembler = create();
    return await workerClient(engine, assembler, wasm);
  } catch (error) {
    engine.terminate();
    assembler?.terminate();
    throw error;
  }
};

const rethrow = (error: unknown): never => {
  if (error instanceof EngineError && error.code === EngineCode.MissingGlyph) {
    throw new GridPdfMissingGlyphError(error.message.split(',').filter(Boolean)
      .map(hex => parseInt(hex, 16)));
  }

  throw error;
};

/**
 * The PDF of what the user sees (with a grid: visible columns in the current
 * order, filter, sorting, groups and summaries) or of ready data: a tagged PDF
 * (PDF/UA-1 target) with the given fonts embedded. Runs in a Web Worker; the
 * `.wasm` and the worker load on the first export.
 */
export const exportPdf = async (source: DataGrid | GridExportData, options: GridPdfOptions): Promise<Blob> => {
  validate(options);
  const signal = options.signal;
  signal?.throwIfAborted();
  const ctx = contextOf(source, options);
  const theme = themeOf(options);
  const fonts = await Promise.all(options.fonts.map(font => loadFont(font, signal)));
  signal?.throwIfAborted();
  const client = await clientOf(options);
  const onAbort = () => client.dispose();
  signal?.addEventListener('abort', onAbort, { once: true });
  const parts: Blob[] = [];

  const keep = (chunks: Uint8Array[]) => {
    for (const chunk of chunks) {
      parts.push(new Blob([chunk as BlobPart]));
    }
  };

  let pageCount = 0;
  let rowCount = 0;
  let lastProgress = 0;

  const progress = (force = false) => {
    const now = performance.now();

    if (options.onProgress && !signal?.aborted && (force || now - lastProgress >= PROGRESS_MS)) {
      lastProgress = now;

      try {
        options.onProgress({ rowCount, totalCount: Math.max(ctx.totalCount, rowCount), pageCount } satisfies GridPdfProgress);
      } catch (error) {
        console.error('<u-grid> PDF: onProgress failed.', error);
      }
    }
  };

  try {
    for (const [i, bytes] of fonts.entries()) {
      const font = options.fonts[i];
      await client.addFont(bytes, font.weight === 'bold', font.style === 'italic');
    }

    await client.begin(configOf(ctx, options, theme));
    const pending: Pending = { images: new Map(), client, nextImage: 0, registering: [] };
    const w = new Writer();
    let count = 0;
    // Um bloco em voo: o worker faz o layout de um enquanto a thread principal serializa o próximo.
    let inflight: Promise<void> | null = null;
    // o bloco começa pelo total de linhas, preenchido no envio
    w.u32(0);

    const flush = async (last: boolean) => {
      w.setU32(0, count);
      const data = w.take();
      w.u32(0);
      count = 0;

      if (pending.registering.length) {
        const registering = pending.registering;
        pending.registering = [];
        await Promise.all(registering);
      }

      if (inflight) {
        await inflight;
      }

      signal?.throwIfAborted();
      inflight = client.rows(data, last).then(r => {
        keep(r.chunks);
        pageCount = r.pages;
        progress();
      });
      // Falha do bloco em voo: tratada aqui e relançada no próximo `await` (sem "unhandled rejection").
      inflight.catch(() => undefined);

      if (last) {
        await inflight;
        inflight = null;
      }
    };

    // cabeçalho
    w.u8(4);
    w.u8(0);
    w.u16(ctx.columns.length);

    for (const [i, column] of ctx.columns.entries()) {
      writeCell(w, pending, theme, options, { rowType: 'header', row: null, column, columnIndex: i, value: column.label, text: column.label, style: { bold: true } });
    }

    count++;

    const groupText: string[] = [];
    // fatia menor que a do CSV: a thread principal também recebe os blocos do worker (Blobs,
    // repasse ao montador) e o GC desses objetos cai nas mesmas tarefas
    const slicer = createSlicer(PDF_SLICE_MS);
    let next = ctx.rows.next();

    while (!next.done) {
      const row = next.value;
      const kind = KIND[row.rowType];

      if (kind === undefined) {
        warnOnce(`row:${String(row.rowType)}`, `rows of type "${String(row.rowType)}" are not supported and were left out.`);
        next = ctx.rows.next();
        continue;
      }

      w.u8(kind);
      w.u8(Math.min(255, row.level));

      if (row.rowType === 'group') {
        groupText[row.level] = row.text;
        groupText.length = row.level + 1;
        w.u16(1 + ctx.columns.length);
        writeCell(w, pending, theme, options, { rowType: 'group', row, column: null, columnIndex: -1, value: row.value, text: row.label, style: { bold: true } });

        for (const [i, column] of ctx.columns.entries()) {
          writeCell(w, pending, theme, options, { rowType: 'group', row, column, columnIndex: i, value: row.summaries[i], text: row.texts[i] ?? '', style: {} });
        }
      } else if (row.rowType === 'data' && !options.customizeCell) {
        // caminho rápido (o caso comum): só os textos, sem objetos por célula
        const texts = row.texts;
        const n = ctx.columns.length;
        w.u16(n);

        for (let i = 0; i < n; i++) {
          writePlain(w, texts[i] ?? '', false);
        }

        rowCount++;
      } else {
        const total = row.rowType === 'total';
        w.u16(ctx.columns.length);

        for (const [i, column] of ctx.columns.entries()) {
          let text = row.texts[i] ?? '';

          // 1ª célula do rodapé de grupo: o grupo (cabeçalho de linha no PDF)
          if (i === 0 && !text && row.rowType === 'group-footer') {
            text = groupText[Math.max(0, row.level - 1)] ?? '';
          }

          const value = row.rowType === 'data' ? row.values[i] : row.summaries[i];
          writeCell(w, pending, theme, options, { rowType: row.rowType, row, column, columnIndex: i, value, text, style: { bold: total } });
        }

        if (row.rowType === 'data') {
          rowCount++;
        }
      }

      count++;

      if (count >= BATCH_ROWS) {
        await flush(false);
      }

      const pause = slicer.tick();

      if (pause) {
        await pause;
        signal?.throwIfAborted();
      }

      next = ctx.rows.next();
    }

    await flush(true);
    keep(await client.finish());
    signal?.throwIfAborted();
    progress(true);
  } catch (error) {
    client.dispose();

    if (signal?.aborted) {
      throw signal.reason;
    }

    rethrow(error);
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }

  client.dispose();

  return new Blob(parts, { type: 'application/pdf' });
};

/** Builds the PDF (`exportPdf`) and downloads it as `fileName` (default `export.pdf`). */
export const downloadPdf = async (source: DataGrid | GridExportData, options: GridPdfDownloadOptions): Promise<void> => {
  downloadBlob(await exportPdf(source, options), options.fileName || 'export.pdf');
};

/**
 * The PDF entry of the grid export UI: `grid.pdfExporter =
 * createPdfExporter({ fonts })` (with `export-formats="… pdf"`). The grid
 * passes `selectedOnly`, a `signal` (cancel, disconnect) and `onProgress`
 * (shown in the export button). Options are checked now (`TypeError`).
 */
export const createPdfExporter = (options: GridPdfExporterOptions): GridExporter => {
  validate(options);

  return (grid, { selectedOnly, signal, onProgress }) => downloadPdf(grid, {
    ...options,
    selectedOnly,
    signal,
    onProgress: progress => {
      options.onProgress?.(progress);
      onProgress?.(progress);
    },
  });
};
