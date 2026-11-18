import type { nothing, TemplateResult } from 'lit';

import type { DataGrid } from './grid.js';

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

/**
 * Filter operation of a condition. Text operations (`contains`, `notcontains`,
 * `startswith`, `endswith`) and `=` on text ignore case and accents.
 */
export type GridFilterOperation =
  | '=' | '<>' | '<' | '<=' | '>' | '>='
  | 'contains' | 'notcontains' | 'startswith' | 'endswith'
  | 'between' | 'anyof' | 'noneof' | 'isblank' | 'isnotblank';

/**
 * One condition: `[path, operation, value]`. `path` is the column `path`;
 * `between` takes `[start, end]` (inclusive, either may be `null`), `anyof` /
 * `noneof` take a list, `isblank` / `isnotblank` take no value.
 */
export type GridFilterCondition =
  | readonly [path: string, operation: GridFilterOperation, value?: unknown]
  | readonly [path: string, value: unknown];

/**
 * Serializable filter expression (same shape as DevExtreme): a condition, a
 * negation `['!', expression]` or a group of expressions joined by `'and'` /
 * `'or'` (`and` binds tighter; two expressions in a row mean `and`).
 */
export type GridFilterExpression =
  | GridFilterCondition
  | readonly ['!', GridFilterExpression]
  | readonly (GridFilterExpression | 'and' | 'or')[];

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
  /**
   * Stable id of the column in the grid state (`getState`, `stateStorage`)
   * and in string column references (`summary` items look it up before
   * `path`). Default: `path`. A column without `name` and `path` is left out
   * of the state.
   */
  name?: string;
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
  /**
   * Builds the cell content: a Lit `TemplateResult` (recommended), a string
   * (text, never HTML) or an `HTMLElement` (placed in the grid's light DOM).
   * `null`, `undefined` and Lit's `nothing` render an empty cell. See `GridCellRenderer`.
   */
  renderer?: GridCellRenderer<TItem> | null;
  /** Builds the header label (sort arrow, filter button and resize handle stay). `label` is still required. */
  headerRenderer?: GridHeaderRenderer<TItem> | null;
  /** Builds the label of the group rows of this column (expand button and aligned summaries stay). */
  groupRenderer?: GridGroupRenderer<TItem> | null;
  /** Allows sorting from the header. Default: `true` when the column has a `path`, `valueGetter` or `comparator`. */
  sortable?: boolean | null;
  /** INITIAL sort direction; afterwards sorting is grid state (`sortColumn`, `getSorting`). */
  sortOrder?: GridSortOrder | null;
  /** Priority of the initial sort among columns (lower first). */
  sortIndex?: number | null;
  /** Custom ascending comparator. */
  comparator?: GridColumnComparator<TItem> | null;
  /**
   * Allows filtering by this column (filter row, header filter and, by
   * default, the search panel). Default: `true` when the column has a `path`
   * (the filter expression refers to columns by `path`).
   */
  filterable?: boolean | null;
  /**
   * Operations offered in the filter row operation menu (only the menu: the
   * header filter and `filterValue` are not checked). Default by data type.
   */
  filterOperations?: readonly GridFilterOperation[] | null;
  /** Operation of the filter row editor. Default: `contains` for text, `=` otherwise (or the first of `filterOperations`). */
  defaultFilterOperation?: GridFilterOperation | null;
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
  /**
   * Includes this column in exports (`exportCsv`, `getExportData`, the xlsx
   * adapter) and in Ctrl+C. Default: `true` when the column has a `path`,
   * `valueGetter` or `displayValue` (a `renderer`-only column has no text).
   */
  exportable?: boolean | null;
  /**
   * Allows editing the cells of this column (with `allowEditing` on the grid;
   * new rows with `allowAdding`). Default: `true` when the column has a
   * `path` or a `valueSetter`.
   */
  editable?: boolean | null;
  /**
   * Builds the editor of a cell instead of the built-in one (text, number,
   * date, checkbox). See `GridEditorRenderer`.
   */
  editorRenderer?: GridEditorRenderer<TItem> | null;
  /** Rules checked when a value is committed and before saving. See `GridValidationRule`. */
  validationRules?: readonly GridValidationRule<TItem>[] | null;
  /**
   * Writes an edited value into `data`, the pending change of the row (a
   * partial item owned by the grid). Default: sets `path` (dots create nested
   * objects). Set other fields too to edit computed columns.
   */
  valueSetter?: GridValueSetter<TItem> | null;
}

/** A column of the grid: its `name`, its `path` (first column with that name, else with that path) or the column itself. */
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

// --------------------------------------------------------------- renderers

/**
 * What a renderer returns. A Lit `TemplateResult` (recommended) or a string
 * (always text, never parsed as HTML) is rendered inside the grid's shadow
 * DOM — also on the server — and styled through the `part` names the
 * template declares (`u-grid::part(my-badge)`). An `HTMLElement` is placed
 * in the grid's light DOM and projected by a slot: page styles apply, but it
 * only renders in the browser (the server leaves the slot empty). `null`,
 * `undefined` and Lit's `nothing` render nothing. Return the same kind of
 * result on the server and on the client (don't branch on `typeof document`).
 */
export type GridRenderResult = TemplateResult | HTMLElement | string | typeof nothing | null | undefined;

/** Members shared by every renderer context. */
export interface GridRenderContextBase {
  /** The grid rendering the content (a renderer may be shared by several grids). */
  readonly grid: DataGrid;
  /**
   * Aborted when the grid discards this content (the row leaves the virtual
   * window, the detail is collapsed, the column or the renderer changes, the
   * grid is disconnected): unmount framework roots here. Created on first
   * access.
   */
  readonly signal: AbortSignal;
}

/** Context of a cell `renderer`. */
export interface GridCellRenderContext<TItem = any> extends GridRenderContextBase {
  /** The row item. */
  readonly item: TItem;
  /** Cell value (`valueGetter` or `path`). */
  readonly value: unknown;
  /** The text the native cell would show (`format`, `displayValue`, `emptyText`, boolean texts). */
  readonly text: string;
  /** The column of the cell. */
  readonly column: GridColumnDef<TItem>;
  /** Row key (without `keyExpr`, the item itself). */
  readonly rowKey: unknown;
}

/** Context of a `headerRenderer`. */
export interface GridHeaderRenderContext<TItem = any> extends GridRenderContextBase {
  /** The column of the header. */
  readonly column: GridColumnDef<TItem>;
}

/** Context of a `groupRenderer`. */
export interface GridGroupRenderContext<TItem = any> extends GridRenderContextBase {
  /** The grouped column. */
  readonly column: GridColumnDef<TItem>;
  /** Group value. */
  readonly value: unknown;
  /** Group value formatted as the grid shows it. */
  readonly text: string;
  /** Values of the group from the outermost level. */
  readonly groupPath: GridGroupPath;
  /** Grouping level (0-based). */
  readonly groupIndex: number;
  /** Rows in the group (after filtering). */
  readonly itemCount: number;
  /** Whether the group is expanded. */
  readonly expanded: boolean;
  /** Summaries shown in the group row text (`display: 'inline'`). */
  readonly summaries: readonly GridSummaryValue<TItem>[];
  /** The full label the grid would show (`"Country: Brazil (3, Sum of Population: 1,234)"`). */
  readonly defaultText: string;
}

/** Context of the grid `detailRenderer`. */
export interface GridDetailRenderContext<TItem = any> extends GridRenderContextBase {
  /** The master row item. */
  readonly item: TItem;
  /** Key of the master row. */
  readonly rowKey: unknown;
}

/** Context of the grid `noDataRenderer`. */
export interface GridNoDataRenderContext extends GridRenderContextBase {
  /** `true` when there are items but the filter or the search hides them all. */
  readonly filtered: boolean;
}

/**
 * Cell renderer: a pure function of the item and the column. It runs again
 * when the item, the column object or the language change and when the row
 * comes back to the virtual window — so it may run several times for the
 * same item —, never when selecting, focusing or sorting (nor when the item
 * is mutated).
 */
export type GridCellRenderer<TItem = any> = (item: TItem, ctx: GridCellRenderContext<TItem>) => GridRenderResult;

/** Header label renderer (runs again when the column or the language change). */
export type GridHeaderRenderer<TItem = any> = (ctx: GridHeaderRenderContext<TItem>) => GridRenderResult;

/** Group row label renderer (runs again when any member of the context changes). */
export type GridGroupRenderer<TItem = any> = (ctx: GridGroupRenderContext<TItem>) => GridRenderResult;

/** Detail row renderer (master-detail). `null` renders an empty detail row (the toggle stays). */
export type GridDetailRenderer<TItem = any> = (item: TItem, ctx: GridDetailRenderContext<TItem>) => GridRenderResult;

/** Empty state renderer (no rows to show). */
export type GridNoDataRenderer = (ctx: GridNoDataRenderContext) => GridRenderResult;

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

/**
 * A coluna entra na exportação e na área de transferência?
 * @internal
 */
export const isColumnExportable = (column: GridColumnDef): boolean =>
  column.exportable ?? (!!column.path || !!column.valueGetter || !!column.displayValue);

/**
 * A coluna pode ser filtrada pelo usuário? (a expressão aponta a coluna pelo `path`)
 * @internal
 */
export const isColumnFilterable = (column: GridColumnDef): boolean =>
  !!column.path && column.filterable !== false;

// ----------------------------------------------------------------- edição

/** Writes an edited `value` into `data` (the pending change of the row); `item` is the original row (empty object for new rows). */
export type GridValueSetter<TItem = any> = (data: Partial<TItem>, value: unknown, item: TItem) => void;

/** What a validation rule receives. */
export interface GridValidationContext<TItem = any> {
  /** The value being checked. */
  readonly value: unknown;
  /** The original row item (empty object for a new row). */
  readonly item: TItem;
  /** The pending change of the row (fields edited so far, this value included). */
  readonly data: Partial<TItem>;
  /** The column of the value. */
  readonly column: GridColumnDef<TItem>;
  /** Row key (a new row has an opaque provisional key). */
  readonly rowKey: unknown;
}

/** Members shared by every validation rule. */
export interface GridValidationRuleBase {
  /** Error text; default: the grid translation of the rule. */
  message?: string;
}

/** The value cannot be empty (`null`, `undefined`, `''`, or only spaces with `trim`). */
export interface GridRequiredRule extends GridValidationRuleBase {
  type: 'required';
  /** Spaces only count as empty. Default `true`. */
  trim?: boolean;
}

/** A number or date between `min` and `max` (inclusive). */
export interface GridRangeRule extends GridValidationRuleBase {
  type: 'range';
  min?: number | Date;
  max?: number | Date;
}

/** Text length between `min` and `max` characters. */
export interface GridStringLengthRule extends GridValidationRuleBase {
  type: 'stringLength';
  min?: number;
  max?: number;
}

/** The text matches `pattern`; a string matches the whole value, like the HTML `pattern` attribute. */
export interface GridPatternRule extends GridValidationRuleBase {
  type: 'pattern';
  pattern: RegExp | string;
}

/** An e-mail address (the rule of `<input type="email">`). */
export interface GridEmailRule extends GridValidationRuleBase {
  type: 'email';
}

/**
 * Host check: return `true` (valid), `false` (invalid, `message` or the
 * default text) or an error text; or a promise of it (server check). The
 * `signal` aborts when the value changes again or the edit ends: a stale
 * answer is ignored.
 */
export interface GridCustomRule<TItem = any> extends GridValidationRuleBase {
  type: 'custom';
  validate: (ctx: GridValidationContext<TItem>, signal: AbortSignal) => boolean | string | Promise<boolean | string>;
}

/**
 * A validation rule of `validationRules`. Empty values only fail `required`
 * (and `custom`, which always runs).
 */
export type GridValidationRule<TItem = any> =
  | GridRequiredRule
  | GridRangeRule
  | GridStringLengthRule
  | GridPatternRule
  | GridEmailRule
  | GridCustomRule<TItem>;

/** Context of an `editorRenderer`. */
export interface GridEditorRenderContext<TItem = any> extends GridRenderContextBase {
  /** The original row item (empty object for a new row). */
  readonly item: TItem;
  /** The value being edited (pending, not yet saved). */
  readonly value: unknown;
  /** The pending change of the row. */
  readonly data: Partial<TItem>;
  /** The column of the cell. */
  readonly column: GridColumnDef<TItem>;
  /** Row key (a new row has an opaque provisional key). */
  readonly rowKey: unknown;
  /** Accessible name for the editor (the column label). */
  readonly label: string;
  /** The value failed a validation rule. */
  readonly invalid: boolean;
  /** Error text of the value (`''` when valid). */
  readonly errorMessage: string;
  /**
   * Id of the element with the error text, for `aria-describedby` — only for
   * editors rendered in the grid's shadow DOM (`TemplateResult`). For an
   * `HTMLElement` editor the grid places the text in its light DOM and sets
   * `aria-label`, `aria-invalid` and `aria-describedby` when missing.
   */
  readonly describedBy: string;
  /** Changes the edited value (the grid validates it on commit). */
  setValue(value: unknown): void;
  /** Commits the value (like Enter, without moving). */
  commit(): void;
  /** Discards the value and closes the editor (like Esc). */
  cancel(): void;
}

/**
 * Editor of a cell: focus goes to the first focusable element it renders.
 * It runs when the editor opens and again when the validity of the value
 * changes (`invalid`, `errorMessage`): keep the value in `setValue`.
 * The grid handles Enter, Tab and Esc unless the editor calls
 * `preventDefault()` on the `keydown` (a combobox that uses Enter).
 */
export type GridEditorRenderer<TItem = any> = (item: TItem, ctx: GridEditorRenderContext<TItem>) => GridRenderResult;

/**
 * A coluna é editável (sem olhar o `allowEditing` do grid)? Padrão: com
 * `path` ou `valueSetter`.
 * @internal
 */
export const isColumnEditable = (column: GridColumnDef): boolean =>
  column.editable ?? (!!column.path || !!column.valueSetter);
