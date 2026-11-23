import type { GridExportCellStyle, GridExportColumn, GridExportLink, GridExportOptions, GridExportProgress, GridExportRow } from '../export/types.js';

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
  /** Text color (CSS). Default `#1a1a1a`. */
  color?: string;
  /** Background of the header row (CSS). Default `#e6e6e6`. */
  headerBackgroundColor?: string;
  /** Background of group rows (CSS). Default `#f0f0f0`. */
  groupBackgroundColor?: string;
  /** Background of every other data row when `striped` (CSS). Default `#f7f7f7`. */
  stripedBackgroundColor?: string;
  /** Background of group footer and totals rows (CSS). Default `#ececec`. */
  summaryBackgroundColor?: string;
  /** Color of the table rules (CSS). Default `#8a8a8a`. */
  lineColor?: string;
}

/** Style of one PDF cell (`customizeCell`): the shared {@link GridExportCellStyle}. */
export type GridPdfCellStyle = GridExportCellStyle;

/** An image in a cell, above its text. Sizes in pt. */
export interface GridPdfImage {
  /** The PNG or JPEG file (copied). */
  data: Uint8Array;
  /** Format of `data`. */
  format: 'png' | 'jpeg';
  /** Width in pt (shrinks to the column). */
  width: number;
  /** Height in pt. */
  height: number;
  /** Text alternative (required). `''` marks the image as decorative. */
  alt: string;
}

/** A link on the cell text (`http:`, `https:` or `mailto:` only). */
/** A link on the cell text: the shared {@link GridExportLink}. */
export type GridPdfLink = GridExportLink;

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
  /** Text drawn in the cell (wraps; never cut). */
  text: string;
  /** Language of the text (BCP 47) when it differs from the document. The grid does not guess languages from scripts. */
  lang?: string;
  /** Style of the cell (replace the object or change its fields). */
  style: GridPdfCellStyle;
  /** An image above the text (`alt` required). */
  image?: GridPdfImage;
  /** Makes the cell text a link (underlined; the PDF annotation is tagged). */
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
  /** Default `'auto'`: Letter in the US, Canada, Mexico…, A4 elsewhere (from the language region). */
  paperSize?: GridPdfPaperSize;
  /** Default `'auto'`: landscape when the columns do not fit in portrait. */
  orientation?: GridPdfOrientation;
  /** Columns that do not fit the page move to a "Label: value" line under each row (rule of `hidingPriority`). Default: `autoHideColumns` of the grid. */
  autoHideColumns?: boolean;
  /** Alternate row backgrounds. Default: `striped` of the grid. */
  striped?: boolean;
  /** Font size and colors (text colors below 4.5:1 contrast fall back to the default, with a warning). */
  theme?: GridPdfTheme;
  /** "Page X of Y" in the footer. Default `true`. */
  includePageNumbers?: boolean;
  /** Bookmarks for the first-level groups. Default `true` when the rows are grouped. */
  bookmarks?: boolean;
  /** Changes each cell before it is laid out (style, image, link, language); see {@link GridPdfCell}. */
  customizeCell?: ((cell: GridPdfCell) => void) | null;
  /** Called about every 250 ms and once at the end (never after an abort). */
  onProgress?: ((progress: GridPdfProgress) => void) | null;
  /**
   * Generate in Web Workers (default `true` when `Worker` exists), on the
   * main thread in time slices (`false`), or in the workers a factory returns
   * (CDN, strict CSP: a Blob URL of `worker.js`). The factory is called twice
   * per export (an engine worker and an assembler that compresses in
   * parallel) and must return a new `Worker` each time.
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
