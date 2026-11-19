import type { GridColumnAlignment } from '../grid-column-def.js';
import type { GridExportColumn, GridExportOptions, GridExportProgress, GridExportRow } from '../export/types.js';

/** A font for the PDF. Every font is embedded (subset); the order is the fallback order per character. */
export interface GridPdfFont {
  /**
   * The font file (TrueType, OpenType or a TrueType collection): bytes or a
   * URL to fetch. The buffer is copied, never transferred or changed.
   */
  source: ArrayBuffer | Uint8Array | string | URL;
  /** Default `'normal'`. Without a bold font, bold text uses the regular one. */
  weight?: 'normal' | 'bold';
  /** Default `'normal'`. */
  style?: 'normal' | 'italic';
}

/** `'table'`: one table, groups as rows. `'sections'`: one titled section per first-level group. `'list'`: a flat list (grouped columns first). */
export type GridPdfLayout = 'table' | 'sections' | 'list';

/** `'auto'`: Letter where it is the usual paper (US, CA, MX, …), A4 elsewhere. */
export type GridPdfPaperSize = 'auto' | 'a4' | 'letter' | 'legal' | 'a3';

/** `'auto'`: landscape when the columns do not fit in portrait. */
export type GridPdfOrientation = 'auto' | 'portrait' | 'landscape';

/**
 * Colors (any CSS color) and text size of the PDF. Text colors must keep a
 * contrast of at least 4.5:1 with every background: a color that does not is
 * replaced by the default (with a warning).
 */
export interface GridPdfTheme {
  /** Text size in pt. Default 8, minimum 6. */
  fontSize?: number;
  color?: string;
  headerBackgroundColor?: string;
  groupBackgroundColor?: string;
  stripedBackgroundColor?: string;
  summaryBackgroundColor?: string;
  lineColor?: string;
}

/** Style of one PDF cell (`customizeCell`). */
export interface GridPdfCellStyle {
  bold?: boolean;
  italic?: boolean;
  /** Text color (CSS). Must keep a contrast of 4.5:1 with the background. */
  color?: string;
  /** Background color (CSS). */
  backgroundColor?: string;
  /** Logical alignment of the text (`start`/`end` follow the direction). */
  alignment?: GridColumnAlignment;
}

/** An image in a cell, above its text. Sizes in pt. */
export interface GridPdfImage {
  data: Uint8Array;
  format: 'png' | 'jpeg';
  width: number;
  height: number;
  /** Text alternative (required). `''` marks the image as decorative. */
  alt: string;
}

/** A link on the cell text (`http:`, `https:` or `mailto:` only). */
export interface GridPdfLink {
  url: string;
  /** Accessible description of the link target when the cell text alone is not enough. */
  description?: string;
}

/**
 * A cell of the PDF, passed to `customizeCell` before it is laid out: change
 * `text`, `lang`, `style`, `image` or `link`. Called for header, data, group,
 * group footer and totals cells (not for the title nor the line of hidden
 * columns). Synchronous.
 */
export interface GridPdfCell<TItem = any> {
  readonly rowType: GridExportRow['rowType'] | 'header';
  /** The exported row (`null` in the header). */
  readonly row: GridExportRow<TItem> | null;
  /** The column (`null` for the label cell of a group row). */
  readonly column: GridExportColumn<TItem> | null;
  /** Index in `columns` (`-1` for the label cell of a group row). */
  readonly columnIndex: number;
  /** Cell value (in the header, the column label). */
  readonly value: unknown;
  text: string;
  /** Language of the text (BCP 47) when it differs from the document. The grid does not guess languages from scripts. */
  lang?: string;
  style: GridPdfCellStyle;
  image?: GridPdfImage;
  link?: GridPdfLink;
}

/** Progress of `exportPdf` (`onProgress`). */
export type GridPdfProgress = GridExportProgress;

/** Options of `exportPdf()`. */
export interface GridPdfOptions extends Omit<GridExportOptions, 'includeGroups'> {
  /** The fonts (required, not empty), in fallback order per character. */
  fonts: readonly GridPdfFont[];
  /** Default `'table'`. `'sections'` without grouping is `'table'`; `'list'` is `includeGroups: false`. */
  layout?: GridPdfLayout;
  /** Document title (metadata, shown by the reader, and the heading of page 1). Default: the accessible name of the grid, else "Data". */
  title?: string;
  /** Language of the document (BCP 47). Default: the language of the grid. */
  language?: string;
  /** Default: the direction of the grid. `rtl` mirrors the table. */
  direction?: 'ltr' | 'rtl';
  paperSize?: GridPdfPaperSize;
  orientation?: GridPdfOrientation;
  /** Columns that do not fit the page move to a "Label: value" line under each row (rule of `hidingPriority`). Default: `autoHideColumns` of the grid. */
  autoHideColumns?: boolean;
  /** Alternate row backgrounds. Default: `striped` of the grid. */
  striped?: boolean;
  theme?: GridPdfTheme;
  /** "Page X of Y" in the footer. Default `true`. */
  includePageNumbers?: boolean;
  /** Bookmarks for the first-level groups. Default `true` when the rows are grouped. */
  bookmarks?: boolean;
  customizeCell?: ((cell: GridPdfCell) => void) | null;
  /** Called about every 250 ms and once at the end (never after an abort). */
  onProgress?: ((progress: GridPdfProgress) => void) | null;
  /**
   * Generate in a Web Worker (default `true` when `Worker` exists), on the
   * main thread in time slices (`false`), or in the worker a factory returns
   * (CDN, strict CSP: a Blob URL).
   */
  worker?: boolean | (() => Worker);
  /** Where `grid-pdf.wasm` and `worker.js` are. Default: next to this module. */
  assetsUrl?: string | URL;
}

/** Options of `downloadPdf()`. */
export interface GridPdfDownloadOptions extends GridPdfOptions {
  /** Name of the downloaded file. Default `export.pdf`. */
  fileName?: string;
}

/** Options of `createPdfExporter()`: those of `downloadPdf` without `selectedOnly` and `signal` (set by the grid). */
export type GridPdfExporterOptions = Omit<GridPdfDownloadOptions, 'selectedOnly' | 'signal'>;
