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
  /**
   * Value used to GROUP by this column instead of the cell value: a range or
   * bucket (decade, initial letter). Groups are identified, sorted and shown
   * by the returned value; the column `dataType`, `comparator`, `format` and
   * `displayValue` do not apply to it. Return a string or a number.
   */
  groupValueGetter?: ((item: TItem) => unknown) | null;
  /**
   * Allows the user to group by this column (drag to the group panel).
   * Default: `true` when the column has a `path`, `valueGetter` or
   * `groupValueGetter`. Only limits the user: `groupColumn()` still works.
   */
  groupable?: boolean | null;
}

/** A column of the grid: its `path` (first column with that path) or the column itself. */
export type GridColumnRef<TItem = any> = string | GridColumnDef<TItem>;

/** Values of a group from the outermost level, e.g. `['Brazil', 'SP']`. */
export type GridGroupPath = readonly unknown[];

/** Built-in summary aggregates. `sum`/`min`/`max`/`avg` ignore empty values; `count` counts rows. */
export type GridSummaryType = 'sum' | 'min' | 'max' | 'avg' | 'count';

/** Custom aggregate: receives the column values and the row items of the group (or of all rows). */
export type GridSummaryAggregator<TItem = any> = (values: readonly unknown[], items: readonly TItem[]) => unknown;

/** `Intl` options or a function that formats the summary value. */
export type GridSummaryFormat = Intl.NumberFormatOptions | Intl.DateTimeFormatOptions | ((value: unknown) => string);

/** A summary (aggregate) of a column. */
export interface GridSummaryItem<TItem = any> {
  /** Column whose values are aggregated and under which the summary is shown. */
  column: GridColumnRef<TItem>;
  /** Built-in aggregate or a custom function. */
  type: GridSummaryType | GridSummaryAggregator<TItem>;
  /**
   * Replaces the aggregate name in the text (`"Total: 1,234"`). Without it a
   * custom aggregate shows `"{column}: {value}"` in group rows and only the
   * value in cells.
   */
  label?: string;
  /**
   * Formats the value. Default: the column `format` when it is `Intl`
   * options (a formatter function is not inherited); `count` uses the
   * integer format of the language.
   */
  format?: GridSummaryFormat | null;
  /** Identifies the summary in `getSummaryValues()`. */
  name?: string;
}

/** A summary of each group. */
export interface GridGroupSummaryItem<TItem = any> extends GridSummaryItem<TItem> {
  /**
   * Where it is shown: `inline` (default) in the group row text,
   * `column` in the group row under its column, `footer` in a footer row
   * after the group items.
   */
  display?: 'inline' | 'column' | 'footer';
}

/** The `summary` property of `<u-grid>`. */
export interface GridSummary<TItem = any> {
  /** Totals: a footer fixed at the bottom, under the columns. */
  total?: GridSummaryItem<TItem>[];
  /** Summaries of each group. */
  group?: GridGroupSummaryItem<TItem>[];
}

/** A computed summary (`getSummaryValues()`). */
export interface GridSummaryValue<TItem = any> {
  /** The summary definition. */
  item: GridSummaryItem<TItem>;
  /** Raw aggregate (without values: `sum` = `0`, the others `null`). */
  value: unknown;
  /** Formatted value, as shown. */
  text: string;
}

/**
 * O usuário pode agrupar pela coluna?
 * @internal
 */
export const isColumnGroupable = (column: GridColumnDef): boolean =>
  column.groupable ?? (!!column.path || !!column.valueGetter || !!column.groupValueGetter);

/**
 * A coluna pode ser ordenada pelo usuário?
 * @internal
 */
export const isColumnSortable = (column: GridColumnDef): boolean =>
  column.sortable ?? (!!column.path || !!column.valueGetter || !!column.comparator);
