/** Sort direction: ascending or descending. */
export type GridSortOrder = 'asc' | 'desc';

/** A column of the current sorting and its direction (`getSorting()`). */
export interface GridSort {
  column: GridColumnDef;
  order: GridSortOrder;
}

/**
 * Custom comparator of a column, in ascending order (the grid applies the
 * direction). Receives the cell values and the row items.
 */
export type GridColumnComparator<TItem = any> = (a: any, b: any, itemA: TItem, itemB: TItem) => number;

/** Data type of a column; without `dataType`, inferred from the first non-null value. */
export type GridColumnDataType = 'string' | 'number' | 'date' | 'datetime' | 'boolean';

/** Logical alignment: `start`/`end` follow the direction (RTL). */
export type GridColumnAlignment = 'start' | 'center' | 'end';

/** Boolean as text (`trueText`/`falseText`) or as a read-only check icon. */
export type GridColumnBooleanDisplay = 'text' | 'icon';

/** Formats a cell value into its displayed text. */
export type GridColumnFormatter<TItem = any> = (value: unknown, item: TItem) => string;

/** `Intl` number/date options or a formatter function. */
export type GridColumnFormat<TItem = any> = Intl.NumberFormatOptions | Intl.DateTimeFormatOptions | GridColumnFormatter<TItem>;

/** Side a column is fixed to (logical: mirrors in RTL). */
export type GridColumnFixed = 'start' | 'end' | null;

/**
 * Column definition (the `columns` property of `<u-grid>`). Mirrors the
 * `<u-grid-column>` element: same names, types and defaults. `TItem` types
 * the row item in the callbacks.
 */
export interface GridColumnDef<TItem = any> {
  /** Width in px. */
  width?: number | null;
  /** Minimum width in px (also when resizing and auto-sizing). */
  minWidth?: number | null;
  /** INITIAL grouping level; afterwards grouping is grid state (`groupColumn`, `ungroupColumn`). */
  groupIndex?: number | null;
  /** Header label. */
  label?: string;
  /** Dot path of the cell value in the row item (`"address.city"`). */
  path?: string;
  /** Data type; without it, inferred from the first non-null value. */
  dataType?: GridColumnDataType | null;
  /** `Intl` options or a formatter function. */
  format?: GridColumnFormat<TItem> | null;
  /** Logical alignment; default by data type (numbers at the end). */
  alignment?: GridColumnAlignment | null;
  /** Cell value used to group, sort and filter. Default: read `path`. */
  valueGetter?: ((item: TItem) => unknown) | null;
  /** Displayed text (cell and group row); wins over `format`. */
  displayValue?: ((value: unknown, item: TItem) => string) | null;
  /** Boolean as text (default) or icon; the icon has the text as its accessible name. */
  booleanDisplay?: GridColumnBooleanDisplay | null;
  /** Wraps the text in several lines instead of an ellipsis. */
  wrap?: boolean;
  /** Text for empty values (`null`/`undefined`). */
  emptyText?: string | null;
  /** Builds the cell content; `null` renders an empty cell. */
  renderer?: ((item: TItem) => HTMLElement | null) | null;
  /** Allows sorting from the header. Default: `true` when the column has a `path`, `valueGetter` or `comparator`. */
  sortable?: boolean | null;
  /** INITIAL sort direction; afterwards sorting is grid state (`sortColumn`, `getSorting`). */
  sortOrder?: GridSortOrder | null;
  /** Priority of the initial sort among columns (lower first). */
  sortIndex?: number | null;
  /** Custom ascending comparator. */
  comparator?: GridColumnComparator<TItem> | null;
  /** `false` prevents resizing this column even with `column-resizing`. */
  resizable?: boolean | null;
  /** Maximum width in px when resizing and auto-sizing. */
  maxWidth?: number | null;
  /** Fixes the column at the start or end of the scrollable area. */
  fixed?: GridColumnFixed;
  /** INITIAL visibility (default `true`); afterwards the user changes it in the chooser. */
  visible?: boolean | null;
  /** `false` removes the column from the chooser (the user cannot hide it). */
  showInChooser?: boolean | null;
}

/**
 * A coluna pode ser ordenada pelo usuário?
 * @internal
 */
export const isColumnSortable = (column: GridColumnDef): boolean =>
  column.sortable ?? (!!column.path || !!column.valueGetter || !!column.comparator);
