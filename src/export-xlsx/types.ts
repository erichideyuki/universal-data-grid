import type { GridExportCellStyle, GridExportColumn, GridExportLink, GridExportOptions, GridExportProgress, GridExportRow } from '../export/types.js';
import type { GridColumnDef } from '../grid-column-def.js';

/** The part of an ExcelJS cell the deprecated ExcelJS forms write. */
export interface ExcelJSCell {
  value: unknown;
  numFmt?: string;
}

/** The part of an ExcelJS row the deprecated ExcelJS forms write. */
export interface ExcelJSRow {
  outlineLevel?: number;
  font?: unknown;
  getCell(index: number): ExcelJSCell;
}

/** The part of an ExcelJS worksheet the deprecated ExcelJS forms use. */
export interface ExcelJSWorksheet {
  addRow(values: unknown[]): ExcelJSRow;
  getColumn(index: number): { width?: number };
  mergeCells(top: number, left: number, bottom: number, right: number): void;
  properties: { outlineLevelRow?: number };
}

/** The part of an ExcelJS workbook the deprecated ExcelJS forms use. */
export interface ExcelJSWorkbook {
  addWorksheet(name?: string): ExcelJSWorksheet;
  xlsx: { writeBuffer(): Promise<ArrayBuffer | ArrayBufferView> };
}

/** The ExcelJS module (`import ExcelJS from 'exceljs'`) of the deprecated ExcelJS forms. */
export interface ExcelJSModule {
  Workbook: new () => ExcelJSWorkbook;
}

/** Workbook type of the injected module. */
export type WorkbookOf<M extends ExcelJSModule> = InstanceType<M['Workbook']>;

/** Worksheet type of the injected module. */
export type WorksheetOf<M extends ExcelJSModule> = ReturnType<WorkbookOf<M>['addWorksheet']>;

/**
 * Options of the deprecated ExcelJS forms (`exportXlsx(grid, ExcelJS,
 * options)`): only what they always had. No bands, frozen header nor
 * `customizeCell`.
 * @deprecated Call `exportXlsx(grid, options)` without ExcelJS (see {@link GridXlsxOptions}).
 */
export interface GridXlsxExcelJSOptions<TWorkbook = ExcelJSWorkbook, TWorksheet = ExcelJSWorksheet> extends GridExportOptions {
  /** Worksheet name. Default `Sheet1`. */
  sheetName?: string;
  /** First row with the column labels (bold). Default `true`. */
  includeHeaders?: boolean;
  /** Called after the rows are written and before the file is built: style or add to the sheet. */
  customize?: ((worksheet: TWorksheet, workbook: TWorkbook) => void | Promise<void>) | null;
}

/** One side of a cell border. */
export interface GridXlsxBorder {
  /** Line color (CSS). Default: automatic (black). */
  color?: string;
  /** Default `'thin'`. */
  style?: 'thin' | 'medium';
}

/**
 * Borders per side: `start`/`end` follow the direction of the sheet; `true`
 * is a thin automatic line. Do not mix with the `color`/`style` of a single
 * {@link GridXlsxBorder} (they are ignored, with a warning).
 */
export interface GridXlsxBorderSides {
  top?: boolean | GridXlsxBorder;
  bottom?: boolean | GridXlsxBorder;
  start?: boolean | GridXlsxBorder;
  end?: boolean | GridXlsxBorder;
}

/** Style of one xlsx cell (`customizeCell`): the shared {@link GridExportCellStyle} and what only a sheet has. */
export interface GridXlsxCellStyle extends GridExportCellStyle {
  /** Wraps the text inside the cell (the row grows). */
  wrap?: boolean;
  /** Borders: `true` (thin, every side), one line for every side, or per side ({@link GridXlsxBorderSides}). */
  border?: boolean | GridXlsxBorder | GridXlsxBorderSides;
}

/**
 * A cell of the sheet, passed to `customizeCell` after the adapter chose its
 * value, number format and style: change `cellValue` (or `text`), `numFmt`,
 * `style` or `link`. The last write wins. Called for header, band, data,
 * group, group footer and totals cells. Synchronous.
 *
 * Color is never the only signal: when a background tells a state (a heat
 * map), write the state in the cell text too (`cell.text = '92% — overdue'`).
 */
export interface GridXlsxCell<TItem = any> {
  /** `'header'` includes the band rows (`headerRow` tells them apart). */
  readonly rowType: GridExportRow['rowType'] | 'header';
  /** The exported row (`null` in the header). */
  readonly row: GridExportRow<TItem> | null;
  /**
   * The export column (in a band cell, the first column of the band); `null` for the label cell of a
   * group row. Your definition is `column.column`: test `cell.column?.column.name` or `.path`.
   */
  readonly column: GridExportColumn<TItem> | null;
  /** The band of a band cell; `null` in every other cell. */
  readonly band: GridColumnDef<TItem> | null;
  /** Index in `columns` (in a band cell, of its first column); `-1` for the label cell of a group row. */
  readonly columnIndex: number;
  /**
   * Columns the cell spans (a band, the label of a group row); `1` otherwise.
   * A band cell is a merged range; a group label is never merged (`alignment:
   * 'center'` centers it across the row; `start`/`end` align it within the
   * first column). `customizeCell` is called once for the spanning cell, and
   * the empty cells it covers take its final style.
   */
  readonly columnSpan: number;
  /** Header row of the cell, `0` = the top one (bands first, column labels last); `-1` outside the header. */
  readonly headerRow: number;
  /** The source value (data cell: the cell value; header: the label; group label: the group value; summaries: the summary values). */
  readonly value: unknown;
  /**
   * What the cell holds: a string is a text cell (never a formula), a number,
   * a boolean, a date (wall clock, no time zone) or `null` (empty).
   */
  cellValue: string | number | boolean | Date | null;
  /**
   * Reading gives the text the grid displayed (not updated by writes to
   * `cellValue`); writing sets `cellValue` to the text and `numFmt` to `null`.
   */
  text: string;
  /**
   * Excel number format: a code (`'#,##0.00'`, `'dd/mm/yyyy'`, written as
   * is) or the id of a built-in date/time format (`14` short date, `22` date
   * and time, 15-21, 45-47), which Excel shows in the regional settings of
   * whoever opens the file. Other ids are ignored (with a warning): General,
   * or `14`/`22` for a `Date`.
   * `null` = General; a `Date` without a format gets `14` (midnight) or `22`.
   * With `dateFormat: 'reader'`, date columns read `14` or `22` here.
   */
  numFmt: string | number | null;
  /**
   * Style of the cell (replace the object or change its fields). Keep
   * `...cell.style` when replacing it: it carries the column alignment of
   * typed cells.
   */
  style: GridXlsxCellStyle;
  /**
   * A native hyperlink (`http:`, `https:`, `mailto:`; others are ignored
   * with a warning). Without a `style.color` of yours, or when yours fails the
   * contrast check, the cell gets the link color (`#0563c1`, or `#9dc3e6` on
   * a dark background); no underline yet (the writer has none).
   * `description` is ignored for now (no link tooltip yet).
   */
  link?: GridExportLink;
}

/** Options of `exportXlsx()`. The type parameters are deprecated (they only type the deprecated `customize`). */
export interface GridXlsxOptions<TWorkbook = ExcelJSWorkbook, TWorksheet = ExcelJSWorksheet> extends GridExportOptions {
  /**
   * Worksheet name. Default: the accessible name of the grid, else "Data"
   * (translated). Always cleaned (`[ ] : * ? / \` removed, 31 characters,
   * never `History`).
   */
  sheetName?: string;
  /** Document title (metadata). Default: the accessible name of the grid, else "Data" (translated). */
  title?: string;
  /**
   * Language of the file (BCP 47): `dc:language` and the number and date
   * formats. Default: the language of the grid.
   */
  language?: string;
  /**
   * Date and date-time columns: `'language'` (default) writes the order of
   * {@link GridXlsxOptions.language} (`dd/mm/yyyy` in `pt-BR`); `'reader'`
   * writes the Excel built-in formats `14` (date) and `22` (date and time),
   * which Excel shows in the regional settings of whoever opens the file,
   * chosen by the column (a midnight value of a date-time column keeps `22`).
   */
  dateFormat?: 'language' | 'reader';
  /** Header rows with the column labels (and the bands). Default `true`. */
  includeHeaders?: boolean;
  /**
   * Band rows above the column labels: each band label merged across its
   * columns (in its own row only; the column labels are never merged),
   * aligned by the band `alignment` (default `start`, as on screen). Default
   * `true`.
   */
  includeBands?: boolean;
  /**
   * Freezes every header row (bands and labels). Default `true`. Columns
   * fixed at the start (`fixed: 'start'`) are always frozen too.
   */
  freezeHeader?: boolean;
  /**
   * Excel filter buttons on the column labels (the last header row), over
   * the data rows (totals are left out), so whoever opens the file can sort
   * and filter it. The current grid sort is shown as the sort state (the
   * arrow) when every sort key is an exported column without its own
   * `comparator`, the grid is not grouped and there are no fixed rows (they
   * are inside the range, as data). Default `true`; left out without
   * headers or when the export has group rows or tree levels (sorting in
   * Excel would scramble them), with a warning only when set to `true`.
   * New form only (ignored by the deprecated ExcelJS forms).
   */
  autoFilter?: boolean;
  /** Default: the direction of the grid. `rtl` writes a right-to-left sheet; `start`/`end` follow it. */
  direction?: 'ltr' | 'rtl';
  /**
   * Changes each cell after the adapter chose its value, format and style
   * (see {@link GridXlsxCell}). Never let a color be the only signal: write
   * the state as text too. A text color below 4.5:1 contrast with the
   * background is dropped (with a warning); when the automatic black text
   * is below 4.5:1, the text turns white (only when white is below 4.5:1 too
   * is the background dropped, with a warning).
   */
  customizeCell?: ((cell: GridXlsxCell) => void) | null;
  /** Called about every 250 ms and once at the end (never after an abort); `pageCount` is always 0. */
  onProgress?: ((progress: GridExportProgress) => void) | null;
  /**
   * Write the file in a Web Worker (default `true` when `Worker` exists), on
   * the main thread in time slices (`false`), or in the worker a factory
   * returns (CDN, strict CSP: a Blob URL of `worker.js`). The factory is
   * called once per export and must return a new `Worker`.
   */
  worker?: boolean | (() => Worker);
  /** Where `grid-xlsx.wasm` and `worker.js` are. Default: next to this module. */
  assetsUrl?: string | URL;
  /**
   * Only the deprecated ExcelJS forms call it; without ExcelJS it is ignored (with a warning).
   * @deprecated Use `customizeCell`.
   */
  customize?: ((worksheet: TWorksheet, workbook: TWorkbook) => void | Promise<void>) | null;
}

/** Options of `downloadXlsx()`. The type parameters are deprecated (they only type the deprecated `customize`). */
export interface GridXlsxDownloadOptions<TWorkbook = ExcelJSWorkbook, TWorksheet = ExcelJSWorksheet> extends GridXlsxOptions<TWorkbook, TWorksheet> {
  /** Name of the downloaded file. Default `export.xlsx`. */
  fileName?: string;
}

/** Options of `createXlsxExporter()`: those of `downloadXlsx` without `selectedOnly` and `signal` (set by the grid). */
export type GridXlsxExporterOptions<TWorkbook = ExcelJSWorkbook, TWorksheet = ExcelJSWorksheet> = Omit<GridXlsxDownloadOptions<TWorkbook, TWorksheet>, 'selectedOnly' | 'signal'>;
