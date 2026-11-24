/**
 * Formas OBSOLETAS do adaptador de Excel (frente 12, obsoletas na spec 29):
 * `exportXlsx(grid, ExcelJS, options)` com o ExcelJS injetado pelo
 * hospedeiro. Ficam até a próxima major com SÓ as opções de antes (sem
 * bandas, sem congelar, sem `customizeCell`). Só usa a API pública do grid
 * (`getExportData`) e tipos estruturais mínimos do ExcelJS.
 */
import type { GridExportColumn, GridExportRow } from '../export/types.js';
import type { DataGrid } from '../grid.js';
import { toDate, toNumber } from '../row-model/format.js';
import { datePatternOf, numberFormatOf } from './formats.js';
import type { ExcelJSModule, ExcelJSRow, ExcelJSWorksheet, GridXlsxExcelJSOptions, WorkbookOf, WorksheetOf } from './types.js';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Níveis de outline que o Excel aceita. */
const MAX_OUTLINE = 7;

/** px → largura de coluna do Excel (caracteres do "0" na fonte padrão). */
const PX_PER_CHAR = 7;

/** Opções só da forma nova: a obsoleta as ignora (com aviso uma vez por módulo). */
const NEW_ONLY = ['title', 'includeBands', 'freezeHeader', 'autoFilter', 'direction', 'dateFormat', 'customizeCell', 'onProgress', 'worker', 'assetsUrl'] as const;
let warnedIgnored = false;

/** O arquivo pelo ExcelJS do hospedeiro (forma obsoleta de `exportXlsx`). */
export const exportXlsxWithExcelJS = async <M extends ExcelJSModule>(
  grid: DataGrid,
  excelJS: M,
  options: GridXlsxExcelJSOptions<WorkbookOf<M>, WorksheetOf<M>> = {},
): Promise<Blob> => {
  const ignored = NEW_ONLY.filter(key => (options as Record<string, unknown>)[key] !== undefined);

  if (ignored.length && !warnedIgnored) {
    warnedIgnored = true;
    console.warn(`<u-grid> xlsx: ${ignored.join(', ')} only work without ExcelJS (exportXlsx(grid, options)); they were ignored.`);
  }

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
  const ownBooleanText = dataType === 'boolean' && (definition.booleanDisplay || definition.trueText || definition.falseText);

  if (!dataType || dataType === 'string' || definition.displayValue || typeof definition.format === 'function' || ownBooleanText) {
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
