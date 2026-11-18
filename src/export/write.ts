/**
 * Escritores de texto da exportação (frente 12): CSV em blocos (sem travar a
 * interface) e o conteúdo da área de transferência (TSV + tabela HTML).
 */
import { BOM, CRLF, csvField, escapeFormula, escapeHtml, isFormulaEscaped, resolveSeparator, tsvField } from './csv.js';
import { type ExportColumnSource, exportRows, type ExportSource } from './rows.js';
import { createSlicer, type Slicer } from './slice.js';
import type { GridCsvOptions, GridExportRow } from './types.js';

/** Linhas de HTML da área de transferência; acima disso, só o TSV (montar a tabela custaria caro). */
export const CLIPBOARD_HTML_LIMIT = 10_000;

/**
 * Blobs de fatia juntados num só a cada tantos (juntar blobs não copia os
 * bytes; só encurta a lista). Cada fatia vira `Blob` na hora: codificar
 * pouco texto por vez evita uma pausa longa, e o texto sai do heap do JS.
 */
const PARTS_PER_BLOB = 64;

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/** Data local em ISO 8601 (`date`: só o dia; senão com a hora e o fuso). */
const isoDate = (date: Date, dateOnly: boolean): string => {
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  if (dateOnly) {
    return day;
  }

  const offset = -date.getTimezoneOffset();
  const zone = offset === 0
    ? 'Z'
    : `${offset > 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

  return `${day}T${time}${date.getMilliseconds() ? `.${pad(date.getMilliseconds(), 3)}` : ''}${zone}`;
};

/** Valor cru como texto (`rawValues`): número com `.`, data ISO 8601, booleano, vazio. */
export const rawText = (value: unknown, column: ExportColumnSource): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : isoDate(value, column.info.dataType === 'date');
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  return typeof value === 'object' ? JSON.stringify(value) ?? '' : String(value);
};

/** O valor tem texto confiável (número/data com a formatação embutida): fica sem o prefixo `'`. */
const isTrusted = (value: unknown, column: ExportColumnSource): boolean =>
  (typeof value === 'number' || typeof value === 'bigint' || value instanceof Date) && column.builtIn;

/** Campos de uma linha (texto ainda sem escape de CSV). */
const fieldsOf = (
  row: GridExportRow,
  columns: readonly ExportColumnSource[],
  escape: boolean,
  raw: boolean,
): string[] => {
  const guard = (text: string): string => escape ? escapeFormula(text) : text;

  switch (row.rowType) {
    case 'data':
      return row.texts.map((text, index) => {
        const column = columns[index];
        const value = row.values[index];
        const field = raw ? rawText(value, column) : text;

        return escape && !isTrusted(value, column) ? escapeFormula(field) : field;
      });
    case 'group':
      return row.texts.map((text, index) => guard(index ? text : row.label));
    default:
      return row.texts.map(guard);
  }
};

/** Linha do CSV (sem a quebra). */
const csvLine = (fields: readonly string[], separator: string): string =>
  fields.map(field => csvField(field, separator)).join(separator);

/** Para no ponto de corte se `signal` abortou (`AbortError`). */
const checkAborted = (signal: AbortSignal | null | undefined): void => {
  signal?.throwIfAborted();
};

/**
 * CSV (RFC 4180) do instantâneo, em fatias de tempo: cede a vez ao
 * navegador a cada `SLICE_MS` e confere o `signal` nessas pausas.
 */
export const writeCsv = async (
  source: ExportSource,
  options: GridCsvOptions,
  language: string | undefined,
  slicer: Slicer = createSlicer(),
): Promise<Blob> => {
  const { signal } = options;
  checkAborted(signal);

  const separator = resolveSeparator(options.separator, language);

  if (separator.length !== 1 || ['"', '\r', '\n'].includes(separator)) {
    throw new RangeError(`Invalid CSV separator: ${JSON.stringify(separator)} (one character other than a quote, CR or LF).`);
  }

  const escape = options.escapeFormulas !== false;
  const raw = options.rawValues === true;
  const columns = source.columns;
  let parts: BlobPart[] = [];
  let lines: string[] = [];

  if (options.bom !== false) {
    lines.push(BOM);
  }

  const flush = (): void => {
    if (lines.length) {
      parts.push(new Blob([lines.join('')]));
      lines = [];
    }

    if (parts.length >= PARTS_PER_BLOB) {
      parts = [new Blob(parts)];
    }
  };

  if (options.includeHeaders !== false) {
    lines.push(csvLine(columns.map(column => escape ? escapeFormula(column.info.label) : column.info.label), separator), CRLF);
  }

  for (const row of exportRows(source)) {
    lines.push(csvLine(fieldsOf(row, columns, escape, raw), separator), CRLF);

    const pause = slicer.tick();

    if (pause) {
      flush();
      await pause;
      checkAborted(signal);
    }
  }

  flush();
  return new Blob(parts, { type: 'text/csv;charset=utf-8' });
};

/** Todas as linhas do instantâneo, em fatias de tempo (`getExportData`). */
export const collectRows = async (source: ExportSource, signal: AbortSignal | null | undefined, slicer: Slicer = createSlicer()): Promise<GridExportRow[]> => {
  checkAborted(signal);

  const rows: GridExportRow[] = [];

  for (const row of exportRows(source)) {
    rows.push(row);

    const pause = slicer.tick();

    if (pause) {
      await pause;
      checkAborted(signal);
    }
  }

  return rows;
};

/** Conteúdo da área de transferência: TSV e tabela HTML (sem cabeçalho, fórmulas sempre protegidas). */
export interface ClipboardContent {
  text: string;
  html: string;
}

/** Direção e idioma do grid, levados para a `<table>` copiada. */
export interface ClipboardHtmlOptions {
  rtl?: boolean;
  lang?: string;
}

/**
 * Célula HTML. Texto protegido contra fórmula vai com
 * `mso-number-format:"\@"` (o Excel cola como célula de texto) e MANTÉM o
 * `'`: o LibreOffice ignora o `mso-number-format` na colagem e avaliaria o
 * `=` (spec 12, "Referência medida").
 */
const htmlCell = (field: string): string =>
  isFormulaEscaped(field)
    ? `<td style='mso-number-format:"\\@"'>${escapeHtml(field)}</td>`
    : `<td>${escapeHtml(field)}</td>`;

export const clipboardContent = (
  rows: readonly GridExportRow[],
  columns: readonly ExportColumnSource[],
  options: ClipboardHtmlOptions = {},
): ClipboardContent => {
  const lines: string[] = [];
  const htmlRows: string[] = [];
  const withHtml = rows.length <= CLIPBOARD_HTML_LIMIT;

  for (const row of rows) {
    const fields = fieldsOf(row, columns, true, false);
    lines.push(fields.map(tsvField).join('\t'));

    if (withHtml) {
      htmlRows.push(`<tr>${fields.map(htmlCell).join('')}</tr>`);
    }
  }

  const dir = options.rtl ? ' dir="rtl"' : '';
  const lang = options.lang ? ` lang="${escapeHtml(options.lang)}"` : '';

  return {
    text: lines.join(CRLF),
    html: withHtml ? `<table${dir}${lang}><tbody>${htmlRows.join('')}</tbody></table>` : '',
  };
};

/** Células de HTML na cópia de intervalos (frente 19); acima disso, só o TSV. */
export const CLIPBOARD_HTML_CELL_LIMIT = 100_000;

/** Um intervalo copiado: linhas de dados com as colunas dele (frente 19). */
export interface ClipboardBlock {
  rows: readonly GridExportRow[];
  columns: readonly ExportColumnSource[];
}

/**
 * Vários intervalos empilhados na vertical (na ordem dada, como o AG Grid):
 * mesmo TSV/HTML protegido da 12, uma `<table>` só.
 */
export const clipboardBlocks = (
  blocks: readonly ClipboardBlock[],
  cells: number,
  options: ClipboardHtmlOptions = {},
): ClipboardContent => {
  const lines: string[] = [];
  const htmlRows: string[] = [];
  const withHtml = cells <= CLIPBOARD_HTML_CELL_LIMIT;

  for (const { rows, columns } of blocks) {
    for (const row of rows) {
      const fields = fieldsOf(row, columns, true, false);
      lines.push(fields.map(tsvField).join('\t'));

      if (withHtml) {
        htmlRows.push(`<tr>${fields.map(htmlCell).join('')}</tr>`);
      }
    }
  }

  const dir = options.rtl ? ' dir="rtl"' : '';
  const lang = options.lang ? ` lang="${escapeHtml(options.lang)}"` : '';

  return {
    text: lines.join(CRLF),
    html: withHtml ? `<table${dir}${lang}><tbody>${htmlRows.join('')}</tbody></table>` : '',
  };
};
