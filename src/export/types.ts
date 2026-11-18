import type {
  GridColumnAlignment,
  GridColumnDataType,
  GridColumnDef,
  GridGroupPath,
  GridRowFixed,
  GridSummaryValue,
} from '../grid-column-def.js';
import type { DataGrid } from '../grid.js';

/** Options of `getExportData()`, `exportCsv()`, `downloadCsv()` and the xlsx adapter. */
export interface GridExportOptions {
  /**
   * Only the selected rows, in the current order and filter (not in the
   * selection order of `getSelectedItems()`); group counts and summaries are
   * computed over them. Default `false`.
   */
  selectedOnly?: boolean;
  /**
   * Group rows (`rowType: 'group'`) and indentation levels. `false` exports a
   * flat list in the current order with the grouped columns first. Default `true`.
   */
  includeGroups?: boolean;
  /** Group footers and totals (`group-footer` / `total` rows) and summaries in group rows. Default `true`. */
  includeSummaries?: boolean;
  /**
   * Fixed rows (`fixedTopItems` before the body rows, `fixedBottomItems`
   * before the totals; `rowType: 'data'` with `fixed`, `level: 0`).
   * Default `true`; `selectedOnly: true` leaves them out.
   */
  includeFixedRows?: boolean;
  /** Aborts the export: the promise rejects with an `AbortError`. */
  signal?: AbortSignal | null;
}

/** Options of `exportCsv()`. */
export interface GridCsvOptions extends GridExportOptions {
  /**
   * Field separator: one character other than `"`, CR and LF (a `RangeError`
   * otherwise). `auto` (default): `;` when the grid
   * language uses a decimal comma (what Excel expects there), `,` otherwise.
   */
  separator?: 'auto' | (string & {});
  /** UTF-8 byte order mark, so Excel opens the file as UTF-8. Default `true`. */
  bom?: boolean;
  /** First line with the column labels. Default `true`. */
  includeHeaders?: boolean;
  /**
   * Prefixes `'` to text starting with `=`, `+`, `-`, `@`, tab or CR, which a
   * spreadsheet would run as a formula (CSV injection). Numbers are not
   * prefixed. Default `true`.
   */
  escapeFormulas?: boolean;
  /**
   * Cell values instead of the displayed text: numbers with `.`, dates in
   * ISO 8601, booleans `true`/`false`, empty values as empty fields. Group
   * labels and summaries stay text. Default `false`.
   */
  rawValues?: boolean;
}

/** Options of `downloadCsv()`. */
export interface GridCsvDownloadOptions extends GridCsvOptions {
  /** Name of the downloaded file. Default `export.csv`. */
  fileName?: string;
}

/** An exported column (`GridExportData.columns`). */
export interface GridExportColumn<TItem = any> {
  column: GridColumnDef<TItem>;
  /** Header text. */
  label: string;
  /** Effective data type (declared or inferred). */
  dataType?: GridColumnDataType;
  /** Effective logical alignment. */
  alignment: GridColumnAlignment;
  /** Current width in px, when known. */
  width?: number;
}

/** A data row. `values[i]` / `texts[i]` belong to `columns[i]`. */
export interface GridExportDataRow<TItem = any> {
  rowType: 'data';
  /** Indentation level: the number of grouping levels above the row (0 without groups). */
  level: number;
  item: TItem;
  /** Cell values (`valueGetter` or `path`). */
  values: unknown[];
  /** Displayed texts (`displayValue` / `format`). */
  texts: string[];
  /** `'top'`/`'bottom'` for a fixed row (`fixedTopItems`/`fixedBottomItems`), `null` for a body row. */
  fixed: GridRowFixed;
}

/**
 * A group row. `summaries[i]` / `texts[i]` are the summaries shown under `columns[i]`
 * (`display: 'column'`); those of the first column, or of a column not exported, are part of `label`.
 */
export interface GridExportGroupRow<TItem = any> {
  rowType: 'group';
  /** Grouping level (0 = outermost). */
  level: number;
  groupPath: GridGroupPath;
  /** Grouped column. */
  column: GridColumnDef<TItem>;
  /** Group value. */
  value: unknown;
  /** Formatted group value (`"Brazil"`). */
  text: string;
  /** Whole group label with the count and inline summaries (`"Country: Brazil (3)"`). */
  label: string;
  /** Rows in the group. */
  itemCount: number;
  summaries: GridSummaryValue<TItem>[][];
  /** Summary texts of each column, joined with the list separator of the language as on screen. */
  texts: string[];
}

/** A group footer or the totals row. `summaries[i]` / `texts[i]` belong to `columns[i]`. */
export interface GridExportSummaryRow<TItem = any> {
  rowType: 'group-footer' | 'total';
  /** Indentation level: a group footer is at the level of its rows; totals at 0. */
  level: number;
  /** Group of the footer; `null` in the totals row. */
  groupPath: GridGroupPath | null;
  summaries: GridSummaryValue<TItem>[][];
  texts: string[];
}

/** A row of `GridExportData`, told apart by `rowType`. */
export type GridExportRow<TItem = any> = GridExportDataRow<TItem> | GridExportGroupRow<TItem> | GridExportSummaryRow<TItem>;

/** What `getExportData()` returns: the columns and rows the user sees, ready for any file format. */
export interface GridExportData<TItem = any> {
  /** Visible exportable columns in the current order (with `includeGroups: false`, the grouped columns first). */
  columns: GridExportColumn<TItem>[];
  rows: GridExportRow<TItem>[];
}

/** Formats offered by the export UI (`exportFormats`). May gain members in minor versions. */
export type GridExportFormat = 'csv' | 'xlsx';

/**
 * An export run by the grid UI (`xlsxExporter`): build and download the file
 * of what the user sees. Reject to report an error; honor `signal` (aborted
 * when the grid disconnects).
 */
export type GridExporter = (
  grid: DataGrid,
  options: { readonly selectedOnly: boolean; readonly signal: AbortSignal },
) => Promise<void>;

/** `detail` of `u-grid-exporting` and `u-grid-export`. */
export interface GridExportingEventDetail {
  readonly format: GridExportFormat;
  /** Only the selected rows ("Export selected rows"). */
  readonly selectedOnly: boolean;
}

/** `detail` of `u-grid-export`. */
export type GridExportEventDetail = GridExportingEventDetail;

/** `detail` of `u-grid-export-error`. */
export interface GridExportErrorEventDetail extends GridExportingEventDetail {
  readonly error: unknown;
}
