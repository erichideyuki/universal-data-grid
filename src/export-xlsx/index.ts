/**
 * Adaptador opcional de Excel (frente 12): `@universal-material/data-grid/export-xlsx`.
 *
 * O grid NÃO depende do ExcelJS: o hospedeiro importa a biblioteca e a
 * injeta (`exportXlsx(grid, ExcelJS)`). Este módulo só usa a API pública do
 * grid (`getExportData`) e tipos estruturais mínimos do ExcelJS — os
 * genéricos devolvem ao hospedeiro os tipos reais do módulo que ele passou.
 */
import { downloadBlob } from '../export/download.js';
import type { GridExportColumn, GridExportOptions, GridExportRow } from '../export/types.js';
import type { DataGrid } from '../grid.js';
import { toDate, toNumber } from '../row-model/format.js';
import { datePatternOf, numberFormatOf } from './formats.js';

/** The part of an ExcelJS cell the adapter writes. */
export interface ExcelJSCell {
  value: unknown;
  numFmt?: string;
}

/** The part of an ExcelJS row the adapter writes. */
export interface ExcelJSRow {
  outlineLevel?: number;
  font?: unknown;
  getCell(index: number): ExcelJSCell;
}

/** The part of an ExcelJS worksheet the adapter uses. */
export interface ExcelJSWorksheet {
  addRow(values: unknown[]): ExcelJSRow;
  getColumn(index: number): { width?: number };
  mergeCells(top: number, left: number, bottom: number, right: number): void;
  properties: { outlineLevelRow?: number };
}

/** The part of an ExcelJS workbook the adapter uses. */
export interface ExcelJSWorkbook {
  addWorksheet(name?: string): ExcelJSWorksheet;
  xlsx: { writeBuffer(): Promise<ArrayBuffer | ArrayBufferView> };
}

/** The ExcelJS module (`import ExcelJS from 'exceljs'`), injected by the host. */
export interface ExcelJSModule {
  Workbook: new () => ExcelJSWorkbook;
}

/** Workbook type of the injected module. */
export type WorkbookOf<M extends ExcelJSModule> = InstanceType<M['Workbook']>;

/** Worksheet type of the injected module. */
export type WorksheetOf<M extends ExcelJSModule> = ReturnType<WorkbookOf<M>['addWorksheet']>;

/** Options of `exportXlsx()`. */
export interface GridXlsxOptions<TWorkbook = ExcelJSWorkbook, TWorksheet = ExcelJSWorksheet> extends GridExportOptions {
  /** Worksheet name. Default `Sheet1`. */
  sheetName?: string;
  /** First row with the column labels (bold). Default `true`. */
  includeHeaders?: boolean;
  /** Called after the rows are written and before the file is built: style or add to the sheet. */
  customize?: ((worksheet: TWorksheet, workbook: TWorkbook) => void | Promise<void>) | null;
}

/** Options of `downloadXlsx()`. */
export interface GridXlsxDownloadOptions<TWorkbook = ExcelJSWorkbook, TWorksheet = ExcelJSWorksheet> extends GridXlsxOptions<TWorkbook, TWorksheet> {
  /** Name of the downloaded file. Default `export.xlsx`. */
  fileName?: string;
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Níveis de outline que o Excel aceita. */
const MAX_OUTLINE = 7;

/** px → largura de coluna do Excel (caracteres do "0" na fonte padrão). */
const PX_PER_CHAR = 7;

/**
 * The rows the user sees (`grid.getExportData(options)`) in an Excel file:
 * header, group rows with the row outline of Excel, group footers and
 * totals. Numbers, dates and booleans are typed cells with a number format
 * close to the column `format`; columns with `displayValue`, a `format`
 * function or `booleanDisplay` are written as their displayed text. Text is
 * always a text cell (never a formula).
 */
export const exportXlsx = async <M extends ExcelJSModule>(
  grid: DataGrid,
  excelJS: M,
  options: GridXlsxOptions<WorkbookOf<M>, WorksheetOf<M>> = {},
): Promise<Blob> => {
  const data = await grid.getExportData(options);
  options.signal?.throwIfAborted();

  const workbook = new excelJS.Workbook() as WorkbookOf<M>;
  const worksheet = workbook.addWorksheet(options.sheetName || 'Sheet1') as WorksheetOf<M>;

  writeSheet(worksheet, data.columns, data.rows, grid.language, options.includeHeaders !== false);
  await options.customize?.(worksheet, workbook);
  options.signal?.throwIfAborted();

  const buffer = await workbook.xlsx.writeBuffer();

  return new Blob([buffer as BlobPart], { type: XLSX_TYPE });
};

/** Builds the file (`exportXlsx`) and downloads it as `fileName` (default `export.xlsx`). */
export const downloadXlsx = async <M extends ExcelJSModule>(
  grid: DataGrid,
  excelJS: M,
  options: GridXlsxDownloadOptions<WorkbookOf<M>, WorksheetOf<M>> = {},
): Promise<void> => {
  downloadBlob(await exportXlsx(grid, excelJS, options), options.fileName || 'export.xlsx');
};

// ----------------------------------------------------------------- planilha

/** Como gravar cada coluna: tipado (com `numFmt`) ou o texto exibido. */
interface CellWriter {
  write(value: unknown, text: string): unknown;
  numFmt?: string;
}

const writeSheet = (
  worksheet: ExcelJSWorksheet,
  columns: readonly GridExportColumn[],
  rows: readonly GridExportRow[],
  language: string | undefined,
  headers: boolean,
): void => {
  const writers = columns.map(column => writerOf(column, language));
  const count = Math.max(columns.length, 1);
  let index = 0;
  let outline = 0;

  const add = (values: unknown[], level = 0, bold = false): ExcelJSRow => {
    const row = worksheet.addRow(values);
    index++;

    if (level) {
      row.outlineLevel = Math.min(level, MAX_OUTLINE);
      outline = Math.max(outline, row.outlineLevel);
    }

    if (bold) {
      row.font = { bold: true };
    }

    return row;
  };

  if (headers) {
    add(columns.map(column => column.label), 0, true);
  }

  for (const row of rows) {
    switch (row.rowType) {
      case 'data': {
        const added = add(row.values.map((value, i) => writers[i].write(value, row.texts[i])), row.level);

        writers.forEach((writer, i) => {
          if (writer.numFmt && added.getCell(i + 1).value !== null) {
            added.getCell(i + 1).numFmt = writer.numFmt;
          }
        });
        break;
      }

      case 'group': {
        add([row.label, ...row.texts.slice(1).map(textCell)], row.level, true);

        // Rótulo mesclado sobre as colunas quando não há resumo alinhado (como o DevExtreme).
        if (count > 1 && row.texts.every(text => !text)) {
          worksheet.mergeCells(index, 1, index, count);
        }

        break;
      }

      default:
        add(row.texts.map(textCell), row.level, row.rowType === 'total');
    }
  }

  columns.forEach((column, i) => {
    if (column.width) {
      worksheet.getColumn(i + 1).width = Math.max(Math.round(column.width / PX_PER_CHAR), 4);
    }
  });

  if (outline) {
    worksheet.properties.outlineLevelRow = outline;
  }
};

const textCell = (text: string): string | null => text === '' ? null : text;

const writerOf = (column: GridExportColumn, language: string | undefined): CellWriter => {
  const { dataType } = column;
  const definition = column.column;
  const text: CellWriter = { write: (_, value) => textCell(value) };

  // O texto depende do item ou é ícone/texto traduzido: grava o que a tela mostra.
  if (!dataType || dataType === 'string' || definition.displayValue || typeof definition.format === 'function' || (dataType === 'boolean' && definition.booleanDisplay)) {
    return text;
  }

  const format = definition.format;

  if (dataType === 'number') {
    return {
      numFmt: numberFormatOf(format, language),
      write: (value, shown) => {
        const numeric = toNumber(value);

        if (typeof numeric === 'bigint') {
          return Number.isSafeInteger(Number(numeric)) ? Number(numeric) : textCell(shown);
        }

        return numeric !== undefined && Number.isFinite(numeric) ? numeric : textCell(shown);
      },
    };
  }

  if (dataType === 'boolean') {
    return { write: (value, shown) => typeof value === 'boolean' ? value : textCell(shown) };
  }

  return {
    numFmt: datePatternOf(dataType, language),
    write: (value, shown) => {
      const date = toDate(value);
      return date ? excelDate(date) : textCell(shown);
    },
  };
};

/**
 * O ExcelJS grava a data pelo instante UTC; a planilha não tem fuso, então
 * passa a hora LOCAL como se fosse UTC (senão 00:00 em UTC-3 vira 03:00).
 */
const excelDate = (date: Date): Date =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()));
