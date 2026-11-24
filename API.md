# `<u-grid>` API reference

The complete guide and API reference of [`@universal-material/data-grid`](https://github.com/erichideyuki/universal-data-grid#readme).
For live examples of every feature, see the [documentation site](https://universal-material.github.io/data-grid/).

---

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Use in the browser (no build step)](#use-in-the-browser-no-build-step)
- [Defining columns](#defining-columns)
- [Data types & formatting](#data-types--formatting)
- [Sorting](#sorting)
- [Filtering](#filtering) (filter row, search panel, header filter)
- [Grouping](#grouping)
- [Summaries](#summaries) (totals and group summaries)
- [Tree data](#tree-data) (nested or parent-key data, load-on-demand children, recursive selection)
- [Selection & keyboard](#selection--keyboard) (row selection, cell ranges, keyboard navigation, accessibility)
- [Data sources, keys & paging](#data-sources-keys--paging) (`keyExpr`, `dataSource`, remote operations, paging, infinite scrolling, scrolling with the page or a parent)
- [Column features](#column-features) (resizing, fixed columns, column chooser, auto width, bands, column virtualization, responsive columns)
- [Export & clipboard](#export--clipboard) (CSV, Excel, PDF, Ctrl+C)
- [Toolbar & context menus](#toolbar--context-menus) (built-in and custom toolbar items, "More actions", export button, context menus)
- [Templates & master-detail](#templates--master-detail) (cell, header, group, empty and detail renderers, fixed rows, full-width rows)
- [State persistence](#state-persistence) (`getState`/`setState`, `localStorage`/`sessionStorage` or your own storage)
- [Editing](#editing) (cell, row and batch modes, editors, validation, add and delete rows)
- [Internationalization (i18n)](#internationalization-i18n)
- [Appearance & behavior](#appearance--behavior)
- [Theming (CSS custom properties & parts)](#theming)
- [Server-side rendering](#server-side-rendering)
- [Using with frameworks](#using-with-frameworks)
- [API reference](#api-reference)
- [License](#license)

---

## Features

- **Row virtualization** — only visible rows are rendered, with no per-row cost when sorting,
  grouping or expanding, so the grid stays responsive with millions of rows (beyond the browser's
  maximum element height, the scroll range is scaled).
- **Sorting** — click a header to sort, Shift+click to sort by several columns, stable and fast
  (100,000 rows in under 200 ms), with keyboard and screen reader support.
- **Filtering** — filter row with an editor and operation menu per column, a search panel that
  ignores case and accents and highlights matches, and a header filter with the distinct values;
  one serializable DevExtreme-style expression (`filterValue`). A million rows filter without
  freezing the typing.
- **Grouping** — group by one or more columns (or by ranges: decade, initial letter), with
  expand/collapse (also all at once, by API or from the group panel menu), row counts,
  multi-level nesting and an expansion state that survives new data. Group interactively by
  dragging a column header into the header bar.
- **Summaries** — totals in a footer fixed at the bottom and per-group summaries (`sum`, `min`,
  `max`, `avg`, `count` or your own function), in the group row, under the columns or in a group
  footer. Computed in the same pass as the grouping (a million rows in a few hundred ms).
- **Tree data** — hierarchical rows from nested children or parent keys, with indent and expand
  buttons, filter modes that keep the ancestors, sorting per level, node summaries, recursive
  selection, add-child editing, children loaded on demand from a data source, and the WAI-ARIA
  treegrid keyboard — a million nodes in six levels expand and filter without freezing.
- **Data types & formatting** — number, date, date-time and boolean columns formatted with `Intl`
  in the grid's language, with per-column `format`, `alignment`, computed values and empty text.
- **Column reordering** — drag column headers to reorder them, or drag them in/out of the grouping
  area (or use the keyboard: `Alt+Shift+←/→`, `Ctrl+G`).
- **Selection & keyboard** — single or multiple row selection by key, with checkboxes and "select
  all"; spreadsheet-like cell ranges (drag, Shift+click, Shift+arrows, several ranges with Ctrl,
  across fixed columns, bands and millions of virtualized rows) with copy, paste into editable
  cells and a count/sum/average bar; full keyboard navigation (WAI-ARIA APG grid pattern) that
  survives virtualization; complete grid ARIA, checked with `axe-core`.
- **Data sources & paging** — row keys (`keyExpr`), a `dataSource` whose server can filter, sort,
  group, summarize and page (only the visible blocks load: millions of rows with skeleton rows), an
  accessible pager, infinite scrolling, a load panel, an error bar with "Retry", and incremental
  `applyChanges` that keeps selection, focus and expansion.
- **Column features** — resize by dragging (or with the keyboard), auto-size on double-click, fix
  columns to the start/end while scrolling horizontally, and show/hide columns in a column chooser.
- **Responsive columns** — columns hide by priority when the grid itself gets narrow (zoom, a
  side panel, a phone) and their values move to an expandable row below each row, keeping
  formatting, renderers, editing, the keyboard and screen readers; no horizontal scrolling at 400%
  zoom.
- **Multi-level headers & wide grids** — band columns (headers over groups of columns, any depth)
  that move, fix and hide as a block, and column virtualization: hundreds of columns × millions of
  rows scroll smoothly on both axes.
- **Export & clipboard** — CSV of what the user sees (columns, order, filter, groups, summaries,
  selected rows only), optional Excel (styled per cell, frozen header, no dependency) and accessible
  PDF entry points, export data for any other format, and Ctrl+C as text and HTML table. Spreadsheet formula injection is blocked
  by default; a million rows export without freezing the page.
- **Toolbar & context menus** — a configurable toolbar (built-in items, your buttons and content,
  overflow into "More actions", export button) and context menus on headers, the group panel and
  rows with built-in items you can add to, remove or replace; one keyboard model (`Shift+F10`, the
  menu key, arrows, type-ahead, `Esc`) and touch support (long press).
- **Templates & master-detail** — Lit templates (also server-rendered), text or elements for
  cells, headers, group rows and the empty state; expandable detail rows of any height (even a
  nested grid) without slowing down scrolling.
- **Editing** — cell, row and batch modes, built-in editors per data type (numbers in the
  language's format), your own editors, synchronous and server-side validation, add and delete rows
  with an accessible confirmation; the grid never mutates your items and hands you the changes to
  save on the server.
- **Internationalization** — a `language` property with built-in translations for 14 languages,
  automatic language detection, and hooks to override strings or set a global default.
- **Server-side rendering** — compatible with `@lit-labs/ssr` and client hydration.
- **Themeable** — extensive set of CSS custom properties and a few CSS `::part`s.
- **Framework agnostic** — it is a native custom element.

---

## Installation

```bash
npm i @universal-material/data-grid
```

The package is published on npm as modern **ESM** with TypeScript declarations. `lit`,
`@lit/context` and `interactjs` are regular dependencies, so your bundler
deduplicates them with the rest of your app. Importing the package registers the custom elements as
a side effect. To write templates for renderers, add `lit` (any 3.x) to your own dependencies
(`npm i lit`).

> Prefer no build step? See [Use in the browser (no build step)](#use-in-the-browser-no-build-step)
> to drop the grid into a plain HTML page with a `<script>` and an import map.

---

## Quick start

```ts
// Registers <u-grid> (and its internal elements) and exposes the public API.
import '@universal-material/data-grid';
import type { GridColumnDef } from '@universal-material/data-grid';
```

```html
<u-grid style="height: 600px"></u-grid>
```

```ts
const grid = document.querySelector('u-grid')!;

grid.columns = [
  { path: 'country', label: 'Country', groupIndex: 0, width: 240 },
  { path: 'code',    label: 'Code',    width: 120 },
  { path: 'year',    label: 'Year',    width: 120 },
  { path: 'population', label: 'Population', width: 220 },
];

grid.items = [
  { country: 'Afghanistan', code: 'AFG', year: 1960, population: 8996973 },
  { country: 'Afghanistan', code: 'AFG', year: 1961, population: 9169410 },
  // ...
];
```

> **Give the grid a height.** It fills its container (`height: 100%`), so its parent — or the grid
> itself — must have a defined height for the scroll area to work.

---

## Use in the browser (no build step)

The grid also ships as a **single self-contained ESM bundle** — everything (the components and all
their dependencies, including Lit) inlined into one file. Drop it into any HTML page with a
`<script type="module">`, no bundler required.

Load it straight from a CDN — [jsDelivr](https://www.jsdelivr.com/package/npm/@universal-material/data-grid)
or [unpkg](https://unpkg.com/@universal-material/data-grid/) — and use an **import map** to alias the
package name to that file. Your code stays identical to the npm version — swap the import map for a
bundler later and nothing else changes.

| CDN | URL |
| --- | --- |
| jsDelivr | `https://cdn.jsdelivr.net/npm/@universal-material/data-grid@0.3/dist/grid.min.js` |
| unpkg | `https://unpkg.com/@universal-material/data-grid@0.3/dist/grid.min.js` |

Pin a version (`@0.3`, `@0.3.0`) in production so a breaking release can't change the page under you (before 1.0, a new minor version may break).

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />

    <!-- Alias the package specifier to the self-contained bundle -->
    <script type="importmap">
      {
        "imports": {
          "@universal-material/data-grid": "https://cdn.jsdelivr.net/npm/@universal-material/data-grid@0.3/dist/grid.min.js"
        }
      }
    </script>

    <style>
      u-grid { height: 100vh; }
    </style>
  </head>
  <body>
    <u-grid auto-expand-groups></u-grid>

    <script type="module">
      // Registers <u-grid> and exposes the API — same import as via npm.
      import { setGridLanguage } from '@universal-material/data-grid';

      const grid = document.querySelector('u-grid');
      grid.columns = [
        { path: 'country', label: 'Country', groupIndex: 0, width: 240 },
        { path: 'code', label: 'Code', width: 120 },
        { path: 'year', label: 'Year', width: 120 },
        { path: 'population', label: 'Population', width: 220 },
      ];
      grid.items = [
        { country: 'Brazil', code: 'BRA', year: 2022, population: 215313498 },
        { country: 'Japan',  code: 'JPN', year: 2022, population: 124947000 },
      ];
    </script>
  </body>
</html>
```

Notes:

- **Import map alias** — mapping `@universal-material/data-grid` → the bundle URL lets you write the
  exact same `import` statements as in a bundler/npm setup. If you only need the elements (no named
  exports), you can skip the import map and just load the bundle for its side effects:
  `<script type="module" src="https://cdn.jsdelivr.net/npm/@universal-material/data-grid@0.3/dist/grid.min.js"></script>`.
- **Templates (`html`)** — the bundle keeps its copy of Lit to itself and does not export `html`.
  Renderers that return strings or elements need nothing else; for Lit templates, add `lit` (any
  3.x) to the import map — e.g. `"lit": "https://cdn.jsdelivr.net/npm/lit@3/+esm"` — and
  `import { html } from 'lit'`. A `TemplateResult` from that copy renders in the grid like one from
  the bundled copy (bindings, `@click` listeners, row data as text).
- **Self-hosting** — prefer not to depend on a CDN? After `npm i`, the same file is at
  `@universal-material/data-grid/grid.min.js` (`node_modules/@universal-material/data-grid/dist/grid.min.js`);
  copy it into your `public/`/static folder and point the import map at it.
- **Serve over HTTP** — module scripts and import maps don't work from `file://`, so open the page
  through a web server.

---

## Defining columns

There are two interchangeable ways to declare columns.

### 1. Via the `columns` property (recommended for framework/data-driven apps)

```ts
grid.columns = [
  { path: 'country', label: 'Country', groupIndex: 0, width: 240 },
  { path: 'population', label: 'Population', width: 220 },
];
```

### 2. Declaratively with `<u-grid-column>` children

The column **label is the element's text content**.

```html
<u-grid>
  <u-grid-column path="country" group-index="0" width="240">Country</u-grid-column>
  <u-grid-column path="code" width="120">Code</u-grid-column>
  <u-grid-column path="year" width="120">Year</u-grid-column>
  <u-grid-column path="population" width="220">Population</u-grid-column>
</u-grid>
```

`items` is always set as a property (`grid.items = [...]`).

### `GridColumnDef`

Both approaches map to the same shape:

```ts
interface GridColumnDef<TItem = any> {
  /** Nested columns: with at least one, this column is a band (see "Bands"). */
  columns?: readonly GridColumnDef<TItem>[] | null;
  /** Dot-path into each item, e.g. `"user.address.city"`. */
  path?: string;
  /** Stable id in the saved state, in string column references (summaries) and, without `path`, in filter conditions. Default: `path`. */
  name?: string;
  /** The column's name as text: header text (unless headerRenderer; empty: path, or the name of a column with a valueGetter) and its name in menus, chips, chooser, announcements and export (empty: path, then name, as is). With <u-grid-column>, the element's text content. */
  label?: string;
  /** Fixed column width in pixels. Omit for auto width (under virtual column rendering, or with scroll-container on the block axis: auto-size width or max(minWidth, 150) px). */
  width?: number | null;
  /** Minimum column width in pixels. */
  minWidth?: number | null;
  /** INITIAL grouping level (0-based); afterwards use groupColumn()/ungroupColumn(). */
  groupIndex?: number | null;
  /** 'string' | 'number' | 'date' | 'datetime' | 'boolean'. Inferred when omitted. */
  dataType?: GridColumnDataType | null;
  /** Intl.NumberFormat / Intl.DateTimeFormat options, or (value, item) => string. */
  format?: GridColumnFormat<TItem> | null;
  /** 'start' | 'center' | 'end' (logical: follows the text direction). */
  alignment?: GridColumnAlignment | null;
  /** Computes the cell value; used for display, grouping and sorting. */
  valueGetter?: ((item: TItem) => unknown) | null;
  /** Display text for a value; takes precedence over `format`. Also used in group rows. */
  displayValue?: ((value: unknown, item: TItem) => string) | null;
  /** 'text' (default: trueText/falseText), 'icon' (read-only check / cross) or 'check' (check for true, nothing visible for false). */
  booleanDisplay?: GridColumnBooleanDisplay | null;
  /** Text of true / false in this boolean column. Empty or null: the language's trueText / falseText. */
  trueText?: string | null;
  falseText?: string | null;
  /** Wrap long cell text over several lines instead of truncating with an ellipsis (cells only). */
  wrap?: boolean;
  /** Wrap the header label over several lines, between words. null: the grid's `headerWrap`; false turns it off here. */
  headerWrap?: boolean | null;
  /** Text shown for `null`/`undefined` values. Default: empty. */
  emptyText?: string | null;
  /** Cell content: (item, ctx) => template | string | element — see "Templates & master-detail". */
  renderer?: GridCellRenderer<TItem> | null;
  /** Header label content: (ctx) => template | string | element. `label` is still required. */
  headerRenderer?: GridHeaderRenderer<TItem> | null;
  /** Group row label content for this column: (ctx) => template | string | element. */
  groupRenderer?: GridGroupRenderer<TItem> | null;
  /** Lets the user sort by this column. Default: true when it has a `path`, `valueGetter` or `comparator`. */
  sortable?: boolean | null;
  /** Initial sort direction — see "Sorting". */
  sortOrder?: 'asc' | 'desc' | null;
  /** Priority of the initial sort among columns (lower first). */
  sortIndex?: number | null;
  /** Custom ascending comparator: (valueA, valueB, itemA, itemB) => number. */
  comparator?: ((a: any, b: any, itemA: TItem, itemB: TItem) => number) | null;
  /** `false` disables resizing for this column (when `column-resizing` is on). Default `true`. */
  resizable?: boolean | null;
  /** Maximum width in pixels for resizing and auto-sizing. */
  maxWidth?: number | null;
  /** Order in which the column hides when the grid is too narrow (`autoHideColumns`); lowest first. */
  hidingPriority?: number | null;
  /** Keep the column at the start or end while scrolling horizontally (mirrored in RTL). */
  fixed?: 'start' | 'end' | null;
  /** Initial visibility. Default `true`. */
  visible?: boolean | null;
  /** `false` hides the column from the column chooser. Default `true`. */
  showInChooser?: boolean | null;
  /** `false` removes this column's header menu ("⋮" and built-in items); drag alternatives stay while the column can be dragged. See "Header menu of one column". */
  headerMenu?: boolean | null;
  /** Value to GROUP by instead of the cell value (a range: decade, initial letter) — see "Grouping". */
  groupValueGetter?: ((item: TItem) => unknown) | null;
  /** Lets the user group by this column. Default: true when it has a `path`, `valueGetter` or `groupValueGetter`. */
  groupable?: boolean | null;
  /** Lets the user filter by this column (filter row, header filter, search). Default: true when it has a `path`. */
  filterable?: boolean | null;
  /** Operations of the filter row menu. Default by data type. */
  filterOperations?: readonly GridFilterOperation[] | null;
  /** Operation of the filter row editor. Default: 'contains' for text, '=' otherwise (outside `filterOperations`: the first of the list). */
  defaultFilterOperation?: GridFilterOperation | null;
  /** Include in exports and Ctrl+C. Default: true when it has a `path`, `valueGetter` or `displayValue`. */
  exportable?: boolean | null;
  /** Lets the user edit cells of this column (with `allowEditing`). Default: true when it has a `path` or `valueSetter`. */
  editable?: boolean | null;
  /** Cell editor: (item, ctx) => template | string | element — see "Editing". */
  editorRenderer?: GridEditorRenderer<TItem> | null;
  /** Rules checked on commit and before saving — see "Editing". */
  validationRules?: readonly GridValidationRule<TItem>[] | null;
  /** Writes an edited value into the pending change: (data, value, item) => void. Default: sets `path`. */
  valueSetter?: GridValueSetter<TItem> | null;
}
```

`TItem` (default `any`) types the row item in the callbacks: `GridColumnDef<Order>[]`.

`<u-grid-column>` (class `DataGridColumn`) has the same options with the same property names. The
primitive ones are kebab-case attributes (`min-width`, `group-index`, `empty-text`, …); `dataType`
is the `type` attribute (`data-*` attributes belong to the page author). Boolean options turn off
with `"false"`: `visible="false"`, `resizable="false"`, `sortable="false"`, `groupable="false"`,
`show-in-chooser="false"`, `header-menu="false"`, `wrap="false"`, `filterable="false"`, `exportable="false"`, `editable="false"`. `filter-operations` takes a space separated list.

`path` supports nested access via dots. Missing values resolve to an empty string.

---

## Data types & formatting

Each column has a data type. Set it with `dataType`, or let the grid infer it from the first
non-null value (`number`/`bigint` → `number`, `boolean` → `boolean`, `Date` → `date`, anything else
→ `string`). ISO strings are **not** inferred as dates — declare `dataType: 'date'` for them.

| `dataType` | Accepted values | Default display | Default `alignment` |
| ---------- | --------------- | --------------- | ------------------- |
| `string` | anything | the value as text | `start` |
| `number` | `number`, `bigint`, numeric strings | `Intl.NumberFormat` without grouping (`1234.5`, `1234,5` in `de`) | `end` |
| `date` | `Date`, epoch milliseconds, ISO strings | numeric date (`1/15/2024`, `15.1.2024`) | `start` |
| `datetime` | same as `date` | numeric date + hours:minutes | `start` |
| `boolean` | `true` / `false` | translated `trueText` / `falseText` | `center` |

Formatting uses the grid's effective `language` (the same one used for the built-in strings), so
switching `language` reformats every cell. Values that cannot be converted to the column type
(for example `"not a date"` in a `date` column) are shown as-is. ISO dates without a time
(`"2024-03-05"`) are read as local dates, so the day never shifts with the time zone.

```ts
grid.columns = [
  { path: 'name', label: 'Name' },
  // Intl.NumberFormat options (these replace the default, so grouping is back on).
  { path: 'price', label: 'Price', format: { style: 'currency', currency: 'EUR' } },
  { path: 'createdAt', label: 'Created', dataType: 'datetime', emptyText: '—' },
  { path: 'birthday', label: 'Birthday', dataType: 'date', format: { day: 'numeric', month: 'long' } },
  { path: 'active', label: 'Active' }, // inferred boolean → "True"/"False" (translated)
  // Computed value: also what the grid groups by.
  { label: 'Total', valueGetter: (o) => o.price * o.quantity, format: { maximumFractionDigits: 2 } },
  // Full control over the text (cells and group rows).
  { path: 'status', label: 'Status', displayValue: (value, item) => `${value} (${item.owner})` },
  { path: 'notes', label: 'Notes', wrap: true, minWidth: 200 },
];
```

Display text is resolved in this order: `displayValue` → `emptyText` (for `null`/`undefined`) →
`format` function → `format` options / type default. `Intl` formatters are cached per language and
options (bounded LRU cache, so ever-changing options never grow memory). Invalid `format` options fall back to the type default instead of throwing.

Boolean columns can show a read-only icon instead of text with `booleanDisplay: 'icon'` (a check for
`true`, a cross for `false`). The icon's accessible name is the translated `trueText`/`falseText`, so
screen readers announce the same text as in text mode. Empty values still use `emptyText`, group
rows keep the text, and `displayValue` or a `format` function switch the column back to text.

`booleanDisplay: 'check'` draws only the check for `true`: `false` shows nothing, and its text stays
in the cell for screen readers (visually hidden), so the cell is never read as empty. Use it for
columns that are never empty — a `null` cell (`emptyText`) and a `false` one look alike.

Each boolean column can have its own texts with `trueText` / `falseText` (`true-text` /
`false-text`): they replace the language's in the cell, the icon name, the group row, the filters,
copy/paste, summaries and the exports. Use words, not symbols (a screen reader reads "✓" as "check
mark"). For every column at once, override the language instead:
`setGridTranslation('pt', { trueText: 'Sim', falseText: 'Não' })`.

`alignment` is logical: `end` is the right edge in LTR and the left edge in RTL. The header follows
the column alignment. Cells that do not wrap are truncated with an ellipsis and show the full text
as a tooltip (`title`) when hovered.

Declaratively, primitive options are kebab-case attributes; functions and `format` are properties:

```html
<u-grid-column path="createdAt" type="datetime" empty-text="—" min-width="160">Created</u-grid-column>
<u-grid-column path="notes" alignment="center" wrap>Notes</u-grid-column>
<u-grid-column path="active" boolean-display="icon">Active</u-grid-column>
<u-grid-column path="required" boolean-display="check" true-text="Required" false-text="Optional">Required</u-grid-column>
```

---

## Sorting

Click a column header to sort by it. Clicking again toggles between ascending and descending; the
grid never mutates your `items` array.

| Gesture | `sort-mode="single"` (default) | `sort-mode="multiple"` |
| ------- | ---------------------------- | -------------------- |
| Click | Sort by this column only (asc → desc → asc). | Same. |
| Shift+click | Same as click. | Add this column to the sort (or toggle it, keeping its priority). |
| Ctrl+click / Cmd+click | Remove this column from the sort. | Same. |

With `sort-mode="none"` the headers are not clickable (the API below still works). Headers are
focusable: `Enter` or `Space` behave like a click, with the same modifiers. Sorted headers show an
arrow and — when more than one column is sorted — their priority number; `aria-sort` is set on
them and a polite live region announces the change ("Sorted by Year, descending").

```html
<u-grid sort-mode="multiple">
  <u-grid-column path="country" sort-order="asc" sort-index="0">Country</u-grid-column>
  <u-grid-column path="year" sort-order="desc" sort-index="1">Year</u-grid-column>
  <u-grid-column path="notes" sortable="false">Notes</u-grid-column>
</u-grid>
```

- **Initial sort** — `sortOrder` (`sort-order`) and `sortIndex` (`sort-index`) on a column define
  the *initial* sort. After that the sort is grid state: read it with `getSorting()`; re-assigning
  the same column objects does not reset it.
- **Order** — the same as grouping: numbers and dates by value, text in natural order for the grid
  language (values are converted to the column `dataType` first), empty values first in ascending order (last in descending). Sorting is stable: rows
  with equal values keep their original order.
- **Custom comparator** — `comparator(a, b, itemA, itemB)` receives the two cell values and the two
  row items and returns a negative number, zero or a positive number for *ascending* order; the grid
  reverses it for descending.

  ```ts
  const priority = { low: 0, medium: 1, high: 2 };
  grid.columns = [
    { path: 'priority', label: 'Priority', comparator: (a, b) => priority[a] - priority[b] },
  ];
  ```

- **Groups** — rows are sorted inside their groups. Groups follow the direction of their grouping
  column (ascending by default); click the group chip in the grouping bar (or focus it and press
  `Enter`/`Space`) to toggle it. Sorting by another column keeps the group direction.
- **Dragging** — dragging a header to reorder or group it never sorts.

### Sorting API

```ts
grid.sortColumn(column, 'desc');                   // sort by this column only
grid.sortColumn(column, 'asc', { append: true });  // add it to the current sort
grid.sortColumn(column, null);                     // remove it from the sort
grid.clearSorting();
grid.getSorting();                                 // [{ column, order: 'asc' | 'desc' }, ...]
```

For a grouped column, `sortColumn` sets the direction of its groups. The API works in every
`sortMode`.

### Sorting events

Both events bubble and cross the shadow root (`composed`) and fire for user gestures **and** API
calls. `detail` is `{ sorting: GridSort[]; previous: GridSort[]; source: 'user' | 'api' }`, where
`GridSort` is `{ column, order }`. Initial sorting from the column definitions fires nothing.

| Event | When |
| ----- | ---- |
| `u-grid-sorting` | **Before** the sort changes. Cancelable: `event.preventDefault()` keeps the current sort. |
| `u-grid-sort-change` | After the sort changed. |

```ts
grid.addEventListener('u-grid-sorting', event => {
  if (event.detail.sorting.length > 2) {
    event.preventDefault(); // allow at most two sorted columns
  }
});
```

---

## Filtering

Three ways to filter, all off by default and all writing to one serializable expression,
`filterValue`:

```html
<u-grid show-filter-row show-search-panel header-filter></u-grid>
```

- **Filter row** (`show-filter-row`) — a row below the headers with an editor per filterable column,
  chosen by `dataType`: text, number, date (applies when the date is confirmed) and a three-state
  select for booleans. Text and numbers apply 300 ms after the last key (or at once on `Enter`).
  The button before the editor opens the operation menu (`Alt+↓` from the editor also opens it;
  arrows, `Home`/`End`, `Enter` and `Esc` work inside); **Reset** removes the condition.
- **Search panel** (`show-search-panel`) — a search box in the bar above the table. It searches the
  displayed text of the visible filterable columns, ignoring case and accents (`sao` finds
  "São Paulo"), and highlights the matches with `<mark part="search-highlight">` (built as text
  nodes — row data is never parsed as HTML). Custom `renderer` cells are searched but not
  highlighted.
- **Header filter** (`header-filter`) — a funnel button in each filterable header opens a popover
  with the column's distinct values (with counts, `(Blanks)` for empty values, a search box and
  **Select all**). Dates are grouped by year → month → day. **OK** applies, **Cancel**/`Esc`/a
  click outside close without applying, **Clear filter** removes every condition of the column.
  The values come from the rows that pass the *other* filters. The funnel turns active while the
  column has a condition.

Filters combine with `and`; sorting, grouping and group counts work on the result. A polite live
region announces the row count after a user filter ("Rows: 12").

### Filter expressions

`filterValue` uses the same shape as DevExtreme:

```ts
grid.filterValue = [
  ['age', '>=', 30],
  'and',
  [['city', 'anyof', ['Lima', 'Rio']], 'or', ['name', 'startswith', 'jo']],
];
grid.filterValue = ['!', ['status', '=', 'archived']];
grid.filterValue = null; // no filter
```

- A condition is `[field, operation, value]`, where `field` is the column `path` or, for a
  [computed column](#filtering-computed-columns) (a `valueGetter` and no `path`), its `name`. A
  `path` match wins over a `name` (the reverse of string column references elsewhere), and a field
  that matches no column is read from the items as a dot path; with two columns on the same path,
  the first wins. `[field, value]` means `=`.
- Groups join expressions with `'and'` / `'or'` (`and` binds tighter; two expressions in a row
  mean `and`, as in DevExtreme); `['!', expression]` negates.

| Operation | Value | Notes |
| --------- | ----- | ----- |
| `=`, `<>` | value | Text: ignores case and accents, compares the displayed text. `null` means blank. |
| `<`, `<=`, `>`, `>=` | value | Numbers and dates by value; text in the grid language order. |
| `contains`, `notcontains`, `startswith`, `endswith` | text | Ignore case and accents; match the displayed text (also in number/date columns). |
| `between` | `[start, end]` | Inclusive; either end may be `null`. |
| `anyof`, `noneof` | list | `null` in the list stands for blank values. |
| `isblank`, `isnotblank` | — | Blank = `null`, `undefined`, `''`, `NaN` or an invalid date. |

Values are converted to the column `dataType`. In `date` columns comparisons use the calendar day;
in `datetime` columns they use the instant, except for a date-only value (`'2024-03-05'`), which
compares the day (that is what the filter row and the header filter write). An invalid expression is
ignored with a console warning.

The grid keeps a frozen copy of `filterValue` (never your array) and updates it when the user
filters, so reading it always gives the current filter. The filter row and the header filter edit
the top-level `and` conditions of their column and leave the rest of the expression alone. The
header filter shows `anyof`/`noneof` as its selection, and also a `=`/`<>` of one value on its
column (`['active', '=', true]` opens with "Inactive" unchecked; OK replaces it).

### Column options

| Option | Attribute | Default | Description |
| ------ | --------- | ------- | ----------- |
| `filterable` | `filterable` | `true` with a `path`, or with a `valueGetter` and a `name` (not with remote filtering) | `false` removes the column from the filter row, the header filter and the search. A column needs a `path`, or a `valueGetter` and a `name`, to be filtered. |
| `filterOperations` | `filter-operations` | by type | Operations of the filter row menu (attribute: space separated, `filter-operations="contains startswith ="`). Text: `contains notcontains startswith endswith = <>`; number/date: `= <> < > <= >= between`; boolean: `=`. Only the menu is restricted. |
| `defaultFilterOperation` | `default-filter-operation` | `contains` (text), `=` | Operation of the filter row editor; one outside `filterOperations` falls back to the first of the list. |

### Filtering computed columns

A column whose value comes only from its `valueGetter` (no `path`) is filtered by that value: the
filter row, the header filter (its list shows the distinct computed values) and the search use it,
and `displayValue`/`format` apply to text operations as in any column. Give it a `name`: conditions,
`filterValue` and the saved state refer to it by that `name`.

```ts
grid.columns = [
  { path: 'user', label: 'User' },
  { name: 'docA', label: 'Policy A', valueGetter: row => statusOf(row, 'A') },
];
grid.filterValue = ['docA', 'anyof', ['pending', 'expired']];
```

- Without a `name` the column cannot be addressed and is not filterable (`filterable: true` warns
  once); neither is a column with neither `path` nor `valueGetter` (it has no value to filter). A computed column whose `name` is also another column's `path` (or repeats the `name` of an
  earlier computed column) is not filterable either, so no filter control ever filters another
  column; `filterable: true` on it warns once.
- A computed column without `label` shows its `name` as the header text (with a console warning
  when it is filterable or sortable: the `name` is usually an id, not a label).
- With a remote `dataSource` (`remoteOperations` filtering), computed columns are not filterable by
  default: the server does not know the getter. With `filterable: true` they get a filter row editor
  (no header filter: its list would come only from the loaded rows), and their conditions reach
  `load()` as they are, by `name` (`filter`, `filterValue`, and the search in `filter`): translate
  them on the server.

### Filtering API

```ts
grid.filterValue = ['amount', 'between', [100, 500]];
grid.searchText = 'lima';      // attribute: search-text
grid.getCombinedFilter();      // filterValue `and` the search, e.g. for a server request
grid.clearFilter();            // removes filterValue and searchText
```

`getCombinedFilter()` turns the search into `[field, 'contains', text]` conditions (`field`: the
`path`, or the `name` of a computed column) joined by `'or'`
over the visible filterable columns (number and date columns included: `contains` matches their
displayed text).

### Filtering events

`u-grid-filter-change` bubbles, is `composed` and fires after the user filtered (filter row, header
filter, search panel) or `clearFilter()` changed something. Setting `filterValue` or `searchText`
does **not** fire it, so two-way bindings don't loop. `detail` is
`{ filterValue, previousFilterValue, searchText, previousSearchText, source: 'user' | 'api' }`.

```ts
grid.addEventListener('u-grid-filter-change', event => {
  saveState({ filter: event.detail.filterValue, search: event.detail.searchText });
});
```

**Large data** — up to 200,000 rows the filter runs at once (100,000 rows filter in well under
100 ms). Above that it runs in slices between frames, so typing stays fluid even with a million rows;
the previous result stays on screen until the new one is ready, and `await grid.updateComplete`
waits for it.

---

## Grouping

Assign `groupIndex` to one or more columns to group by them. The index defines the nesting order
(`0` is the outermost group). It is the *initial* grouping: after that grouping is grid state — the
user regroups by drag and drop, code uses `groupColumn()` / `ungroupColumn()` — and re-assigning the
same column objects keeps it. (Changing `groupIndex` on a rendered `<u-grid-column>` still regroups,
but is deprecated.)

```ts
grid.columns = [
  { path: 'country', label: 'Country', groupIndex: 0 }, // outer group
  { path: 'year',    label: 'Year',    groupIndex: 1 }, // nested group
  { path: 'population', label: 'Population' },
];
```

- **Interactive grouping** — drag a column header into the header bar to group by it, and drag the
  group chips to reorder or remove them. When no column is grouped, the header bar shows a hint
  (translatable) prompting the user to drag a column there:

  ![Ungrouped grid with the grouping hint](data:image/webp;base64,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)

- **Group order** — groups are sorted by value type: numbers and dates by value, text in natural
  order for the grid language (`item 2` before `item 10`); empty values come first. Click the group
  chip to reverse the order — see [Sorting](#sorting).
- **Expand / collapse** — click the chevron on a group row, press `→`/`←` (or `Enter`) with the
  group row focused, or use the group panel menu (below). The expanded state is kept per group (by its
  values) when `items` are replaced or sorted. `auto-expand-groups` renders groups expanded by
  default; it is the *initial* default — changing it later resets the expansion state:

  ```html
  <u-grid auto-expand-groups></u-grid>
  ```

- **Group row label** — rendered as `` `${columnLabel}${separator}${value} (${count})` ``. The
  separator is translatable (`groupLabelSeparator`), e.g. `": "` in English, `"：" ` in Japanese.
  The count (`show-group-count="false"` hides it) and the inline group summaries go inside
  `groupInfoText` (`"(3, Sum of Population: 1,234)"`, `::part(group-count)`).
- **Group by range** — `groupValueGetter(item)` returns the value to group by (a decade, the
  initial letter, a size bucket). Groups are identified, sorted and shown by that value; the
  column `dataType`, `comparator`, `format` and `displayValue` do not apply to it (numbers are
  shown without thousands separators, so a year stays `1990`):

  ```ts
  { path: 'year', label: 'Year', groupValueGetter: item => Math.floor(item.year / 10) * 10 }
  { path: 'name', label: 'Name', groupValueGetter: item => item.name[0].toUpperCase() }
  ```

- **Group panel menu** — right-click a group chip (or focus it and press `Shift+F10` / the context
  menu key; `Enter` too when the chip does not sort) for *Ungroup*, *Move left*/*Move right* (the
  grouping level), *Ungroup all*, *Expand all groups* and *Collapse all groups*. Arrow keys and `Home`/`End` move, `Esc` closes and returns
  the focus. `group-panel-menu="false"` disables it.
- **Who can group** — `groupable: false` (attribute `groupable="false"`) keeps the user from
  dropping a column on the group panel; `groupColumn()` still works. By default columns without a
  value (no `path`, `valueGetter` or `groupValueGetter` — e.g. action columns) are not groupable.

### Programmatic grouping / reordering

```ts
grid.groupColumn(column);              // group by this column (innermost level)
grid.groupColumn(column, 0);           // …or at a given level (moves it if already grouped)
grid.ungroupColumn(column);            // back to the end of its band (or of the regular columns)
grid.getGrouping();                    // grouped columns, outermost first
grid.moveColumn(column, targetIndex);  // reorder among its siblings (same band); ungroups a grouped one
```

All accept a `GridColumnDef` (or a `<u-grid-column>` element) already known to the grid.

### Expanding groups

A group is identified by its *group path*: its values from the outermost level, compared as when
grouping (`10` and `"10"` are the same group in a column with `dataType: 'number'`; with
`groupValueGetter`, the range value).

```ts
grid.expandGroup(['Brazil']);          // one group (not its parents)
grid.expandGroup(['Brazil', 'SP']);    // a nested group
grid.collapseGroup(['Brazil']);
grid.isGroupExpanded(['Brazil']);      // true / false
grid.expandAllGroups();                // every level…
grid.collapseAllGroups(1);             // …or one grouping level (0 = outermost)
```

`expandAllGroups`/`collapseAllGroups` also apply to groups that appear later (new `items`), until
the next `expandAllGroups`/`collapseAllGroups` call or a change of `auto-expand-groups` (which
fires no event). `expandGroup`/`collapseGroup` need the grouping set (at least as many grouped
columns as values in the path; otherwise they are ignored); for a group with no rows yet the state
is kept — and the event fires — for when it appears.

`u-grid-group-expansion-change` fires when a group's state changed, by the chevron, the menu or
these methods: `detail` is `{ groupPath, groupIndex, expanded, source }`; `groupPath` is `null`
for `expandAllGroups`/`collapseAllGroups` (`groupIndex` `null` = every level).

`u-grid-group-change` fires after the grouping changed — by drag and drop, `Ctrl+G`, the group panel
menu, the column header menu or these methods:
`detail` is `{ grouping: GridColumnDef[]; previous: GridColumnDef[]; source: 'user' | 'api' }`.
Initial grouping (and changing `groupIndex` on a column) fires nothing.

---

## Summaries

Set `summary` (property only) with `total` items (a footer fixed at the bottom of the grid, under
their columns) and/or `group` items (per group):

```ts
grid.summary = {
  total: [
    { column: 'country', type: 'count' },
    { column: 'population', type: 'sum' },
    { column: 'updatedAt', type: 'max', label: 'Last update' },
  ],
  group: [
    { column: 'population', type: 'sum' },                       // in the group row text
    { column: 'population', type: 'max', display: 'column' },    // in the group row, under the column
    { column: 'population', type: 'avg', display: 'footer' },    // in a footer row after the group
  ],
};
```

| Option | Description |
| ------ | ----------- |
| `column` | The column: its `path` (first column with it) or the column object / `<u-grid-column>`. Values are read like the cells (`valueGetter` or `path`), and the summary is shown under it. |
| `type` | `'sum'`, `'min'`, `'max'`, `'avg'`, `'count'` or `(values, items) => unknown`. `sum`/`avg` ignore empty and non-numeric values (the average divides by the values, not the rows); `min`/`max` compare in the column type (dates, text in the grid language); `count` counts rows. Without values: `sum` is `0`, the others empty. |
| `label` | Replaces the aggregate name: `"Total: 1,234"`. A custom function without `label` shows the value alone (and `"{column}: {value}"` in the group row text). |
| `format` | `Intl` options or `(value) => string`. Default: the column `format` when it is `Intl` options (a formatter function is not inherited); `count` uses the integer format. `min`/`max` look like the cells; `sum`/`avg` use thousands separators and up to 2 decimals. |
| `name` | Identifies the item in `getSummaryValues()`. |
| `display` | Group items only: `'inline'` (default, in the group row text), `'column'` (in the group row under its column; the label spans the columns before it) or `'footer'` (a footer row after the group items, while expanded). |

- Totals and group summaries are recomputed when `items`, the grouping or `summary` change, over
  the rows the grid shows. Group summaries are computed in the same pass that builds the groups.
- A summary whose column is hidden or grouped gets no cell: `inline`/`column` group items fall
  back to the group row text; `footer` items and totals are not shown.
- Text: `summaryText` (`"Sum: 1,234"`) in cells; `summaryColumnText` (`"Sum of Population:
  1,234"`) in the group row text and as the accessible label of every summary cell. Names come from
  `summarySum`, `summaryMin`, … — all translated in the 14 languages.
- `getSummaryValues()` returns the totals and `getSummaryValues(groupPath)` the summaries of a
  group, as `{ item, value, text }[]` (empty if the group does not exist).
- Styling: `::part(summary-row)` (totals footer and group footers), `::part(total-row)`,
  `::part(group-footer-row)`, `::part(summary-cell)`, `--u-grid-summary-background-color` and
  `--u-grid-summary-cell-font-weight`.
- Accessibility: the totals footer is a `rowgroup` of its own (`<tfoot>`) with a `row`, counted
  in `aria-rowcount`; every summary cell is a `gridcell` with the full label.

## Tree data

Show hierarchical data (folders, org charts, charts of accounts, bills of materials) in the same
`<u-grid>`: set `tree-mode` and each row becomes a node with an indent and an expand button in the
*tree column*. Filtering, the search, sorting, summaries, selection, editing, export, state and
virtualization keep working; a million nodes expand, filter and scroll without freezing.

```html
<!-- Flat list: each item has its key and its parent's key -->
<u-grid tree-mode="flat" key-expr="id" parent-key-expr="parentId"></u-grid>

<!-- Nested: items are the roots, children in `children` (or `children-expr`) -->
<u-grid tree-mode="nested" key-expr="id" auto-expand-nodes></u-grid>
```

| Property | Attribute | Type | Default | Description |
| -------- | --------- | ---- | ------- | ----------- |
| `treeMode` | `tree-mode` | `'none' \| 'nested' \| 'flat'` | `'none'` | `nested`: children by `childrenExpr`; `flat`: by `keyExpr` + `parentKeyExpr` (both needed; otherwise a list, with a warning). |
| `childrenExpr` | `children-expr` | `string \| (item) => item[] \| null` | `'children'` | Children of an item (`nested`). |
| `parentKeyExpr` | `parent-key-expr` | `string \| (item) => GridRowKey \| null` | `null` | Key of the parent (`flat`). |
| `rootParentKey` | `root-parent-key` | `GridRowKey \| null` | `null` | Parent key of the root nodes, compared by text (`"0"` matches `0`). `null`, `undefined` and a key with no item are roots too. |
| `hasChildrenExpr` | `has-children-expr` | `string \| (item) => boolean \| null` | `null` | With `dataSource`: the node has children to load. |
| `treeColumn` | `tree-column` | `GridColumnRef \| null` | `null` | Column with the indent and the button (`name` or `path`; any leaf column, also inside a band); default the first visible data column. |
| `treeFilterMode` | `tree-filter-mode` | `'with-ancestors' \| 'full-branch' \| 'match-only'` | `'with-ancestors'` | What filtering shows: the matching nodes and their ancestors; also all their descendants; or only the matching nodes (each under its nearest shown ancestor). |
| `autoExpandNodes` | `auto-expand-nodes` | `boolean` | `false` | Nodes start expanded (initial default, like `auto-expand-groups`). |
| `recursiveSelection` | `recursive-selection` | `boolean` | `false` | Checking a node checks its descendants; a parent is checked when all its children are and mixed when some are. Needs `selection-mode="multiple"` and `show-checkboxes`. |

- **Expanding**: the button, the keyboard (below), the row menu ("Expand"/"Collapse") and
  `expandNode(rowKey)` (a `Promise<boolean>` that never rejects: `true` once the children are
  ready), `collapseNode`, `isNodeExpanded`, `expandAllNodes`, `collapseAllNodes`. The state is kept
  by key when `items` change and saved in `GridState.nodeExpansion`. `isNodeExpanded` tells what is
  shown (`false` for a leaf, a node whose children are filtered out or a remote node not loaded).
  `u-grid-node-expansion-change` (`{ rowKey, expanded, source }`, `rowKey: null` for the "all"
  methods, only when something changed) fires when asked — before remote children arrive — and
  with `expanded: false, source: 'api'` when their load fails or is canceled in `u-grid-loading`
  (also for a node expanded by a restored state, with no event before).
- **Filtering and search** test every node; when the filter changes, the ancestors of the matching
  nodes expand (clearing the filter does not collapse them). Totals and "select all" use the nodes
  shown by the filter.
- **Sorting** sorts the children of each node (a parent always stays above its children).
- **Summaries**: `summary.total` as usual; `summary.node` (`GridNodeSummaryItem`, the shape of group items) summarizes
  the visible descendants of each node with children — `inline` after the tree cell text,
  `column` instead of the node value in that column (not editable; exported), `footer` in a row
  after the children. `getNodeSummaryValues(rowKey)` returns them. `summary.group` is ignored in a
  tree; `summary.node` is off with a `dataSource`. Parts compose: `::part(summary-row)` (totals and
  every footer), `::part(footer-row)` (group and node footers), `::part(node-footer-row)`;
  `::part(summary-cell)` (group and node `column` summaries), `::part(node-summary)` (inline).
- **Recursive selection**: gestures (checkbox, `Space`, click) and `selectRows`/`deselectRows`
  propagate; setting `selectedKeys` or `setState` applies the keys as given. `Space` on a mixed node
  checks its whole branch. `selectedKeys` lists every checked node (a mixed parent is not in it).
  Children that arrive from a `dataSource` under a checked parent are checked, firing
  `u-grid-selection-change` with `source: 'api'`.
- **Editing**: `addRow(data, { parentKey })` and the row menu "Add child row" add a child as the
  first row under the node (which expands, with its ancestors); with `tree-mode="flat"` and a
  `parentKeyExpr` path the new item gets the parent key. `u-grid-row-adding` and the `add` change
  carry `parentKey`. Saving with `items` rebuilds a copy (nested: only the path that changed).
  Deleting a node marks only it — cascading is up to you.
- **Export** writes the expanded nodes in screen order, with `level` = depth (also with
  `includeGroups: false`; Excel writes it as the row outline; CSV has no indent). `selectedOnly`
  writes every selected node, also inside collapsed branches. A `column` node summary replaces the
  value (an array when a column has several).
- **Not combined** with grouping (ignored, restored when `tree-mode` is back to `none`),
  master-detail (`detailRenderer`) or `rowRenderer`. Local paging pages the visible rows.
- **Responsive columns** (`auto-hide-columns`) work in a tree: the adaptive row of a node comes
  right below it and above its children (at the children's `aria-level` when the node is expanded,
  else at the node's); in a tree the details toggle cell carries the name and state (its button is
  hidden from assistive technology, like the tree button).

**Data source.** With `tree-mode="flat"` and `dataSource`, the first load asks the roots
(`options.tree = { parentKeys: [rootParentKey] }`) and expanding a node whose `hasChildrenExpr` is
true asks its children (`{ parentKeys: [key] }`; expansions of the same tick go in one call). Return
the items with their parent key. While loading, the node shows a spinner and a skeleton child row
(`aria-busy`); "Loading child rows" is announced after a second, then "Child rows loaded: {count}"
or the error. With `remoteOperations.filtering`, a filter asks `{ parentKeys: null }`: return the
matching nodes and all their ancestors at once. `expandAllNodes()`/`auto-expand-nodes` only reach
loaded nodes (no cascade of loads). Remote paging and grouping do not apply to a tree.

**Keyboard and screen readers.** The table is a `treegrid`: every node row has `aria-level`,
`aria-setsize`/`aria-posinset` (among the shown siblings) and, with children, `aria-expanded` —
also on the tree cell, so the change is read with the focus there. In the tree cell (`←`/`→`
swap in right-to-left):

| Key | Action |
| --- | ------ |
| `→` | Collapsed node: expand (the focus stays). Expanded node or leaf: next cell. |
| `←` | Expanded node: collapse. Collapsed node or leaf: the parent's tree cell. Root: previous cell. |
| `*` | In any cell of a node row: expand the sibling nodes ("Expanded rows: {count}"). On a desktop-layout screen reader the numpad `*` is a right click: use `Shift+8`. |
| `Enter` | Toggle the node when the tree cell is not editable and has no interactive content (otherwise `Enter`/`F2` as usual). |

Cells to the left of a non-first tree column are reached with `Home` or `↑`/`↓`. The button is
hidden from assistive technology (the state is on the row and cell); with voice control, click the
cell and say "right arrow". Keep `row-height` ≥ 24 for the 24 × 24 px button target (WCAG 2.5.8).

Styling: `--u-grid-tree-indent` (per level, default `24px`), `--u-grid-tree-toggle-color`,
`::part(tree-cell)`, `::part(tree-toggle-button)` and `::part(expanded)` on expanded nodes.

---

## Selection & keyboard

### Row selection

```html
<u-grid selection-mode="multiple" show-checkboxes></u-grid>
```

- **`selection-mode`** — `none` (default), `single` or `multiple`.
- **Mouse** — click selects the row, `Ctrl`/`⌘`+click toggles it, `Shift`+click selects the range
  from the last toggled row (`Ctrl`+`Shift` adds the range).
- **`show-checkboxes`** (`multiple` only) — adds a checkbox column fixed at the start, with "select
  all" in its header (checked, unchecked or mixed). With checkboxes, a click on a row only moves the
  focus; the checkbox (or `Space`) selects.
- **By key** — the selection is a set of row keys: the [`keyExpr`](#row-keys-keyexpr) value, or,
  without it, the item object itself (then replacing `items` with new objects loses the
  selection). It survives sorting, grouping and filtering. Keys that are not in `items` are kept
  (and retained) until deselected or `clearSelection()` is called.
- **Select all** selects every row that passes the filter, including rows inside collapsed groups.

```ts
grid.selectRows([item1, item2]);                 // replace the selection
grid.selectRows([item3], { append: true });      // add to it
grid.deselectRows([item1]);
grid.selectAll();                                // multiple only
grid.deselectAll();                              // the filtered rows only
grid.clearSelection();                           // every key
grid.isRowSelected(item2);                       // true
grid.getSelectedItems();                         // selected items present in `items`
grid.selectedKeys;                               // frozen array, same instance until it changes
grid.selectedKeys = [item2];                     // set without firing an event
```

`u-grid-selection-change` fires after every change made by the user or by a method — not when
`selectedKeys` is set: `detail` is
`{ selectedKeys, previous, added, removed, source: 'user' | 'api' }`. Switching
`selection-mode` from `multiple` to `single` keeps only the last key (and fires with `source: 'api'`).

### Cell ranges

```html
<u-grid cell-selection-mode="multiple" show-cell-range-summary></u-grid>
```

- **`cell-selection-mode`** — `none` (default), `single` (one rectangular range at a time — not one
  cell) or `multiple` (several ranges).
- **Mouse / pen** — drag over data cells to select a rectangle (the grid scrolls when the pointer
  reaches an edge, also through virtualized rows and columns); `Shift`+click extends the active range
  from its anchor; `Ctrl`/`⌘`+click and `Ctrl`/`⌘`+drag add a range (`multiple`). A plain click or
  an arrow key clears the ranges. Touch scrolls (no drag selection).
- **Keyboard** — `Shift`+arrows, `Ctrl`+`Shift`+arrows (to the edge), `Shift`+`Home`/`End`,
  `Ctrl`+`Shift`+`Home`/`End`, `Shift`+`PageUp`/`PageDown` extend the active range; `Ctrl`+`A`
  selects every data cell; `Shift`+`F8` (Mac: `Fn`+`Shift`+`F8`) turns "add to selection" on and
  off: arrows move without clearing and the next `Shift`+arrow starts another range (`Esc`,
  `Shift`+`F8` again or leaving the grid turns it off; "Adding to selection" is shown below the
  grid). `Shift`+`↓` then `Shift`+`↑` leaves a single cell, the way to add a one-cell range.
- **Focus** — the active cell is always the corner that moves (the anchor stays), so screen
  readers read the new cell and its "selected" state; `Enter`/`F2` edit that cell. After `Ctrl`+`A`
  the active cell does not move, and the next `Shift`+arrow starts a new range from it.
- **What is selected** — data cells only: group, detail, footer and totals rows and the checkbox,
  detail toggle and row buttons columns are never part of a range (a range over a group row
  skips it). [Fixed rows](#fixed-pinned-rows) are never in a range; a range over a
  [full-width row](#full-width-rows-rowrenderer) skips it like a group row (not a corner, not
  copied, not pasted into). Fixed columns, the middle columns and bands form one flat order, as on screen. A
  range is a rectangle of indices: selecting a million rows × 300 columns costs nothing per cell,
  and only the rendered cells get `aria-selected="true"` and `::part(cell selected)`.
- **Cleared** when the rows or columns change: sorting, filtering, grouping, expanding/collapsing,
  paging, a new `dataSource`, adding/removing a row, moving/hiding/fixing a column, or new `items`
  with another number of rows (the same number — e.g. the `items` of `u-grid-save` — keeps them).
  Scrolling keeps them.
- **With row selection on too** (`selection-mode`), clicks, drags, `Shift`/`Ctrl` and `Ctrl`+`A` on
  data cells are for cells and never select rows; rows are selected with the checkbox column (its
  clicks, `Shift`+`↑`/`↓` and `Ctrl`+`A` work as before) and with `Space`/`Shift`+`Space` on any
  cell. Use `show-checkboxes` in that case (the grid warns once in the console without it).
- **Copy** — `Ctrl`/`⌘`+`C` copies the ranges (else the selected rows, else the cell); see
  [Clipboard](#clipboard-ctrlc). **Paste** — `Ctrl`/`⌘`+`V` with `clipboard-mode="copy-paste"`.
- **Summary** — `show-cell-range-summary` shows a bar below the grid with the count of non-empty
  cells and, when there are numbers, their sum and average (by value, not text), formatted in the
  grid's language. It updates 500 ms after the selection stops changing and is a polite status
  region.

```ts
grid.selectCellRange({ startRowIndex: 0, endRowIndex: 9, startColumn: 'name', endColumn: 'amount' });
grid.selectCellRange({ startRowIndex: 20, endRowIndex: 20, startColumn: 'amount', endColumn: 'amount' }, { append: true });
grid.getCellRanges();                 // [{ startRowIndex, endRowIndex, startColumn, endColumn }, …] (frozen)
grid.clearCellRanges();
await grid.getCellRangeSummary();     // { count, numericCount, sum, avg, complete }
grid.getRowIndex(rowKey);             // index of a data row in the displayed body (-1 if not shown)
grid.getRowKey(rowIndex);             // key of the data row at an index (undefined for group rows…)
```

Row indices are positions in the displayed body (the current page with `paging`), counting group,
detail and footer rows; the header, the filter row and pinned rows do not count. `start*` is the
anchor and `end*` the corner that moves (it may come first). `getCellRangeSummary` reads the ranges at
the call and computes in slices (millions of cells do not freeze the page); it rejects only through
`signal` (with its `reason`, an `AbortError` by default); with a remote data
source, rows not loaded yet are left out and `complete` is `false`.

`u-grid-cell-range-change` (`{ ranges, previous, source }`) fires after every change: a gesture (a
drag fires once, on release), a method, or the grid clearing the ranges because rows or columns
changed — then `source` is the cause: `user` for a gesture (sorting by clicking a header), `api` for
methods and for setters (`items`, `columns`, `dataSource`, `cell-selection-mode`…).

### Keyboard navigation

The table is a single `Tab` stop (roving `tabindex`, as in the WAI-ARIA APG "Data Grid" pattern):
`Tab` enters the grid on its active cell and leaves it on the next key press. The group panel and the
column chooser button are separate stops in the bar above.

| Key | Action |
| --- | ------ |
| `←` `→` `↑` `↓` | Neighbor cell (`←`/`→` mirrored in RTL). The header row is the first row. |
| `Home` / `End` | First / last cell of the row. |
| `Ctrl`+`Home` / `Ctrl`+`End` | First cell of the first row / last cell of the last row. |
| `PageUp` / `PageDown` | One page up / down (the grid scrolls and keeps the focus). With `paging`, the previous / next page (on the first / last page, the first / last row). |
| `Enter` / `F2` | Into the interactive content of the cell (e.g. a button from `renderer`); `F2` on a header goes to its buttons ("⋮" menu, filter) and resize handle. With editing on, opens the editor of an editable cell — see [Editing](#keyboard-and-screen-readers). |
| `Tab` / `Shift`+`Tab` inside a cell | Cycle through the interactive content of that cell. |
| `Esc` | Back from the content to the cell. |
| `Space` | Selects (toggles) the row; on the "select all" header, toggles all. |
| `Shift`+`↑`/`↓`, `Shift`+`Space` | Extend the selection (`multiple`). With `cell-selection-mode`, `Shift`+arrows on data cells extend the cell range instead (on the checkbox column they still extend the rows). |
| `Ctrl`+`Shift`+arrows, `Shift`+`Home`/`End`, `Ctrl`+`Shift`+`Home`/`End`, `Shift`+`PageUp`/`PageDown` | Extend the cell range to the edge, the row's first/last column, the first/last cell, one page (`cell-selection-mode`). See [Cell ranges](#cell-ranges). |
| `Ctrl`+`A` | Select all (`multiple`). With `cell-selection-mode`, every data cell (on the checkbox column: every row). |
| `Shift`+`F8` | "Add to selection" on/off (`cell-selection-mode="multiple"`): arrows move without clearing, the next `Shift`+arrow starts another range; `Esc` turns it off. |
| `Ctrl`+`C` / `⌘`+`C` | Copy the cell ranges, else the selected rows, else the focused data cell (announced). See [Clipboard](#clipboard-ctrlc). |
| `Ctrl`+`V` / `⌘`+`V` | Paste into editable cells (`clipboard-mode="copy-paste"`). |
| `→` / `←` on a group row | Expand / collapse (`←` on a collapsed group goes to its parent group); `Enter` toggles. |
| `Enter` / `Space` on a header | Sort (`Shift` adds the column), as with the mouse. |
| `Alt`+`←`/`→` on a header | Resize the column. |
| `Alt`+`Shift`+`←`/`→` on a header | Move the column (same as dragging it; mirrored in RTL). |
| `Ctrl`+`G` on a header | Group by the column (same as dragging it to the group panel). |
| `Ctrl`+`G` on a group row | Ungroup that row's column (works without the group panel). |
| `Shift`+`F10` / menu key on a header | Open the column header menu (sort, pin ▸, auto-size, widen/narrow, move left/right, group, choose/reset columns). |
| `Enter` / `Space` / `↓` on the header "⋮" button | Open the column header menu on its first item (`↑`: on its last item). `F2` on the header reaches the button. |
| `→` / `Enter` / `Space` on "Pin column" | Open the submenu on its first item (`←` in RTL); `←` / `Esc` close it and go back to "Pin column" (`→` in RTL); `Tab` closes every menu. |
| `Shift`+`F10` / menu key on a cell | Open the row menu (built-in items with `row-menu`; the cell range items with `cell-selection-mode`; or yours). |
| `←`/`→`, `Home`/`End` in the toolbar | Move between the toolbar buttons and the group chips (one `Tab` stop). |
| `Alt`+`Shift`+`←`/`→` on a group chip | Change the grouping level. |
| `Ctrl`+`G` or `Delete` on a group chip | Ungroup the column (the focus goes to its header). |
| `Shift`+`F10` / menu key on a group chip | Open the group panel menu (also moves the chip left/right). |
| `F2` / `Alt`+`↓` on a header | `F2` cycles through the header's own controls (`headerRenderer` content, header filter button, "⋮" menu button, resize handle), then back to the header / `Alt`+`↓` opens the header filter (`Esc` closes it and returns to the button, `Esc` again to the cell). |
| `Alt`+`Shift`+`↑`/`↓` on a column chooser checkbox | Move the column up / down in the chooser (and in the grid); the focus stays on the checkbox. |
| `↓` on a filter row operation button | Open the operation menu on its first item (`↑`: last item). |
| In the header filter list | One `Tab` stop: `↑`/`↓`/`Home`/`End` move, `→`/`←` expand/collapse dates or go to the child/parent (mirrored in RTL), `Space` checks, `Enter` applies (also in its search field), a letter goes to the search field. |

Interactive content returned by `renderer` (links, buttons, inputs, custom elements with a shadow
root) gets `tabindex="-1"` so the grid stays a single `Tab` stop; `Enter`/`F2` reach it. Content added
to a cell later (asynchronously) is not adjusted.

The grid calls `preventDefault()` on the keys it handles, so `Ctrl`+`A`/`Ctrl`+`G` do not reach the
browser while the focus is in a cell. The active cell survives virtualization (its row stays in the
DOM, hidden, while scrolled away), sorting, grouping and column moves.

```ts
grid.focus();                          // focus the active cell
grid.focusCell(item, column);          // scroll to a cell and focus it (false if the row or column is not shown)
grid.focusedRowKey;                    // key of the active data row (null in a header, group or fixed row)
grid.focusedRowKey = item;             // move the active cell without focusing (no event)
grid.focusedRowKey = null;             // back to the first header (ignored without column headers)
```

`u-grid-focus-change` fires when the active cell changes by keyboard, click or `focusCell()` — not
when `focusedRowKey` is set, nor when the active cell moves because its row or column left the grid
(read `focusedRowKey` then): `detail` is
`{ rowKey, column, cellType, previousRowKey, previousColumn, rowFixed, previousRowFixed, source }`, where `cellType` is
`'header' | 'data' | 'selection' | 'group' | 'summary' | 'detail-toggle' | 'detail' | 'command' | 'full-width'` and `column` is
`null` in the checkbox and detail toggle columns, in detail rows, in group rows and in full-width cells
(in a detail row, `rowKey` is the key of its master row); `rowFixed` is `'top'`/`'bottom'` in a
[fixed row](#fixed-pinned-rows) and `null` otherwise.

Group footers and the totals footer ([Summaries](#summaries)) are rows of the navigation too (the
totals footer is the last row, `cellType: 'summary'`). A group row is a single stop: summaries shown
under their columns in it are part of its accessible name. In the group panel, `Shift+F10` (or the
menu key) opens the group panel menu on a chip.

The filter row ([Filtering](#filtering)) is a header row whose editors are regular `Tab` stops
between the column headers and the body (arrow keys stay in the editor; `↓` from a header goes
straight to the body). The header filter button is not a `Tab` stop: `F2` or `Alt+↓` on the header
reach it. "Select all" selects the rows that pass the filter and the search.

### Accessibility

- **Name the grid**: `aria-label` or `aria-labelledby` set on `<u-grid>` names the table
  (`role="grid"`/`"treegrid"`) inside the shadow root. `aria-labelledby` points to ids in the same
  root as the grid (the page, or the template of the outer grid for a nested grid). The grid hands
  those elements to the table (`ariaLabelledByElements`, so the browser computes the name) and also
  copies their text as a fallback for server rendering and older browsers — an approximation that
  uses each element's `aria-label`, `alt` and visible text and skips `aria-hidden` content. It
  follows text changes and elements added, removed or replaced later. An `aria-labelledby` that
  points to the grid itself or to an element containing it uses only that element's `aria-label`
  (with a console warning). Element references set on `<u-grid>` (`ariaLabelledByElements`) and
  `aria-describedby` are not forwarded; use the `aria-labelledby` attribute. Give every grid a name, especially nested and side-by-side grids:

  ```html
  <h2 id="orders-title">Orders</h2>
  <u-grid aria-labelledby="orders-title"></u-grid>
  ```

- `role="grid"` (`role="treegrid"` while grouped or with `tree-mode`), with `aria-rowcount`/`aria-colcount` for the whole
  data set (not just the rendered rows), the real `aria-rowindex`/`aria-colindex` of every cell,
  `aria-multiselectable` in `multiple` mode or with cell ranges, `aria-selected` on data rows (row
  selection) and `aria-selected="true"` on the rendered data cells of a cell range, `aria-expanded` on group
  rows and, while grouped, `aria-level` on every row (data rows and group footers one level below
  their group). `aria-busy` is set while a large data set is filtered in slices.
- Checkboxes are `role="checkbox"` with `aria-checked` (`mixed` in "select all" and on a partly
  checked tree node with `recursive-selection`).
- A visible focus ring (`:focus-visible`, `--u-grid-focus-ring-color`/`-width`) on the keyboard
  focus only.
- Sorting, filtering, grouping, column moves and selections are announced through an `aria-live`
  region (translatable). Interface texts carry the `lang` of the translation in use, so screen
  readers switch voice when the grid language differs from the page.
- When a render removes the focused element (a row filtered out, an ungrouped chip, a hidden
  column), focus moves to the relocated active cell instead of the page.
- Windows high contrast (`forced-colors: active`): selection, search highlights, grid lines,
  pinned-column edges and active states use system colors. Transitions are off with
  `prefers-reduced-motion: reduce`.
- Every drag gesture has a keyboard alternative (WCAG 2.1.1) and a single-pointer one (WCAG 2.5.7):
  the column header menu (the "⋮" button, right-click, a long press on touch screens, `Shift+F10`
  or the menu key) groups, moves, pins and resizes columns; the column chooser moves columns with
  `Alt+Shift+↑/↓`; the group panel menu moves chips. With
  `column-header-menu="false"` the host must provide its own alternative; `headerMenu: false` on a
  column keeps the items that replace a drag the column still allows.
- Headers expose `aria-keyshortcuts` and a description with what is not visible to a screen
  reader: the sort priority (only the first sorted column has `aria-sort`, as ARIA asks), pinned and
  filtered. A filtered column's funnel shows a dot, not only a color.
- Selected rows show a bar at the start (`--u-grid-selected-row-indicator-*`), not only a tint.
- Cell ranges show an outline around each range besides the tint (`--u-grid-cell-range-border-*`,
  `Highlight` in forced colors); the active cell inside a range keeps its focus ring, separated from
  the outline by a light band. The size of the range is announced 500 ms after the selection stops
  changing ("Selected cells: 6. Rows: 3, columns: 2"), only the last one; nothing when it is cleared.
  Dragging has a keyboard alternative (`Shift`+arrows, `Shift`+`F8`) and `Shift`+click.
- The browser tests run `axe-core` with zero violations and automated keyboard scripts. The audit is
  in `.specs/17-accessibility.md`.

> Behavior changes in this version: right-click on a header opens the grid menu when it has
> actions for the column (cancel the `contextmenu` event in the capture phase to keep your own — also on the group panel);
> the grid sets its own text color (`--u-grid-color`) — on dark pages set it together with
> `--u-grid-background-color`; the resize hit area is invisible (8px over the header's end
> padding, only the cursor changes) and dragging shows the column separator at the new edge —
> header text lines up with the cells again; `--u-grid-resize-handle-color` now colors that drag
> separator (default `--u-grid-drop-indicator-color`; if you turn off `column-header-menu`, offer
> your own pointer alternative to the narrow resize handle — the menu's auto-size and
> wider/narrower items are the WCAG 2.5.8 equivalent); `dragToGroup`/`autoSize` texts mention the keyboard (update your overrides);
> `--u-grid-toolbar-height` is now a minimum height (the bar wraps);
> `searchPlaceholder` and `filterOperationLabel` no longer name controls — the
> names come from `searchPanelLabel` and `filterOperationButtonLabel` (`fixStartLabel`/`fixEndLabel`
> are now deprecated and ignored, see [Deprecated names](#deprecated-names)); languages added with `setGridTranslation` get the new keys in
> English until translated.


## Data sources, keys & paging

### Row keys (`keyExpr`)

```html
<u-grid key-expr="id"></u-grid>
```

```ts
grid.keyExpr = 'id';                                 // a path (dots allowed: 'customer.id')
grid.keyExpr = (order: Order) => `${order.year}-${order.number}`; // or a function
```

With a key, `selectedKeys`, `focusedRowKey`, `focusCell(rowKey)`, `isRowSelected(key)` and the
`rowKey` of events use its value, and replacing `items` with **new objects** keeps the selection,
the focus and the group expansion. Without it the key is the item object. Keys must be unique and
not empty (the grid logs an error once otherwise). Changing `keyExpr` converts the selection to the
new keys (`u-grid-selection-change` with `source: 'api'`).

### Data source

Instead of `items`, give the grid a `dataSource` — an object with a `load(options, signal)` method
that returns a promise of `{ data, totalCount?, summary?, groupCount? }`. Use one or the other
(both = console error; the data source wins).

```ts
grid.keyExpr = 'id';
grid.remoteOperations = true;      // the server filters, sorts, groups, summarizes and pages
grid.dataSource = {
  async load(options, signal) {
    const response = await fetch('/api/orders/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(options), // plain data: skip, take, sort, filter, group, groupPath…
      signal,                        // aborted when the request is no longer needed
    });

    return response.json();          // { data, totalCount, summary }
  },
};
```

- **`remoteOperations`** (attribute `remote-operations`) — `false` (default): one `load` call returns
  every row and the grid does everything else in the browser. `true`: everything on the server.
  An object picks operations: `{ filtering, sorting, paging, grouping, summary }`. Remote `paging` or
  `grouping` also turn on remote `filtering`, `sorting` and `summary` (and `paging` turns on
  `grouping`), with a console warning — the grid cannot group or summarize rows it does not have.
- **What the grid asks** (`GridLoadOptions`, frozen): `skip`/`take` (absent = all rows), `sort`
  (`{ path, order }[]`, grouped columns first), `filter` (`filterValue` `and` the search — the same
  as `getCombinedFilter()`), `filterValue`, `searchText`, `group` (`{ path, order, expanded }[]`),
  `groupPath`, `requireTotalCount`, `requireGroupCount`, `totalSummary` and `groupSummary`
  (`{ path, type, name? }[]`).
- **Groups load lazily** — with remote grouping the first call returns the groups of the first
  level (`data: [{ key, count, summary }]`, `items: null`). Expanding a group asks for the next level,
  or for its rows, with `groupPath` = the group values from the outermost level; the server returns
  groups of level `groupPath.length` while it is shorter than `group`, and rows otherwise. Match
  `groupPath` with **exact** equality (unlike the `=` of the filter, which ignores case and accents).
- **Blocks and skeleton rows** — with remote paging the grid asks `pageSize` rows at a time for the
  rows in view, shows skeleton rows (`::part(skeleton-row)`, `aria-busy`) until they arrive and keeps
  the last 200 blocks in a cache. Sorting, filtering or grouping again aborts the requests in flight
  (`signal`) and the answers of an older query are dropped, even if the source ignores the signal.
  The rows shown stay (with the load panel) until the new answer arrives.
- **Remote operations use `path`** — columns with `valueGetter`, `comparator` or `groupValueGetter`
  are not sent (console warning); custom summary functions are computed only for local data. The
  search becomes `contains` conditions on the raw `path` values — or use `searchText` for your own
  text search.
- **Selection with remote rows** — `selectAll()` and `getSelectedItems()` only see the loaded rows,
  the "select all" checkbox is hidden, and `focusCell` of a row not loaded returns `false`.
- **Load panel and errors** — while a query loads, a panel ("Loading…", `::part(load-panel)`) covers
  the rows and the table gets `aria-busy="true"`. A rejected `load` shows an error bar
  (`::part(error-row)`, `role="alert"`) with a "Retry" button.
- **Loading local items** — without a `dataSource`, set `loading` while you fetch the array
  (`grid.loading = true; grid.items = await fetchAll(); grid.loading = false`). With rows on screen
  the load panel covers them (no `aria-busy`: the rows stay readable); with none yet, a "Loading…"
  row and placeholder rows (`::part(skeleton-row)`, only visual) replace the empty state, and the
  table gets `aria-busy` and an unknown row count. "Loading…" is announced after 300 ms and, when it
  ends, the number of rows. Placeholder rows are never data. It fires no `u-grid-loading` /
  `u-grid-load` events.
- **Events** — `u-grid-loading` before each call (cancelable: `preventDefault()` skips it and keeps
  the rows shown), `u-grid-load` with the result, `u-grid-load-error` with the error. Aborted calls
  fire nothing.

> **Security** — the grid never builds URLs, SQL or any query: it hands you `GridLoadOptions` as data
> and you make the call. `filter`, `filterValue`, `searchText`, `sort`, `group` and the paths in them
> come from the user (filter row, header filter, search, clicks), so **validate them on the server**:
> accept only an allow-list of paths and operations, cap `take`, and use parameterized queries —
> never concatenate them into SQL or a URL.

A minimal reference of the contract over an array (filtering, sorting, groups, summaries, paging) is
[`LocalDataSource`](https://github.com/erichideyuki/universal-data-grid/blob/main/src/data/local-source.ts)
in the repository (not exported; copy it as a starting point for a server).

### Refreshing and incremental changes

```ts
await grid.refresh();                     // reload (keeps the rows on screen until the answer)

grid.applyChanges({                       // by key, without reloading everything
  update: [{ id: 7, status: 'Paid' }],    // replaced in place (unless reshapeOnChanges)
  remove: [12],
  add: [newOrder],                        // appended at the end (unless reshapeOnChanges)
});
```

`applyChanges` works with `dataSource` (with `items`, set a new array: rows keep their state by
key). `update` and `remove` need `keyExpr`. Selection, focus and group expansion are kept. With
remote paging or grouping, `update` patches the loaded blocks and `add`/`remove` reload the rows in
view. `getTotalCount()` returns the number of data rows (`-1` while unknown).

**Live data that moves (`reshapeOnChanges`, attribute `reshape-on-changes`).** By default updates
stay where they are, so rows don't jump under the reader. Turn it on for tickers and dashboards:
every `applyChanges` then re-applies filtering, sorting, grouping and summaries — an updated row
moves to its sorted place, a row that stops matching the filter leaves (it stays selected by key,
as with any filter) and added rows go to their sorted place. Several calls in one frame reshape
once.

```ts
grid.reshapeOnChanges = true;
setInterval(() => grid.applyChanges({ update: latestPrices() }), 1000);
```

While keyboard focus is in the grid body or an editor is open, values keep updating in place but
rows don't move (arrow keys never land on a row that slid in); the rows move once focus leaves the
body or the edit ends, and focus stays on its row. With remote paging or grouping each reshape
reloads the rows in view from the server, one reload at a time (calls during a reload are merged
into one more). Saving edits never reshapes: the edited row keeps its position.

### Paging and infinite scrolling

```html
<u-grid paging page-size="20" page-size-options="10, 20, 50"></u-grid>
```

- **`paging`** shows the pager below the table and only the rows of the current page (group rows
  count, as in the reference). The pager is a `<nav>` with the page size selector, "Page 2 of 50
  (1,000 items)" (`aria-live`), and first/previous/page numbers/next/last buttons
  (`aria-current="page"` on the current one). `PageUp`/`PageDown` in the grid change the page.
  A new filter goes back to the first page (`u-grid-page-change` after `u-grid-filter-change`); a
  page past the end is clamped (silently when you set `pageIndex`).
- **`pageSize`** (default `20`) is also the block size asked to a remote source.
- **`pageIndex`** is the current page (0-based); `u-grid-page-change` fires for the pager, the
  keyboard and automatic corrections (not for the setters).
- **`scroll-mode="infinite"`** (remote paging only; otherwise ignored with a warning) loads the next block when the end is reached,
  without asking `totalCount` (`aria-rowcount="-1"` until the last block). With `paging` the pager
  wins.

### Scrolling with the page or a parent

By default the grid has its own scrollbar. To make it part of a longer page (one scrollbar for the
whole page, content above and below the grid), point it at the container that scrolls:

```html
<!-- The page scrolls -->
<u-grid scroll-container="window"></u-grid>

<!-- A panel of the app scrolls (an ancestor of the grid) -->
<main id="report" style="height: 100vh; overflow: auto">
  <h1>Sales</h1>
  <u-grid scroll-container="report"></u-grid>
  <footer>…</footer>
</main>
```

```js
grid.scrollContainerElement = window;              // or an ancestor element
grid.scrollContainerElement = null;                // back to the grid's own scrollbar
```

- **`scroll-container`** takes the id of an **ancestor** of the grid (the first ancestor with that
  id, crossing shadow roots — unlike IDREF attributes such as `for`), or `window` for the page
  (`window` wins over an element with `id="window"`). `<html>` (or the
  `document.scrollingElement`) also means the page; `<body>` only when it is the scrolling
  element. **`scrollContainerElement`** sets it by reference and wins over the attribute.
- The grid grows to its content — **don't give it a height** in this mode — and the container
  scrolls **vertically**. Rows are still virtualized: only what is visible in the container is
  rendered, with millions of rows and with content after the grid.
- **Sideways, the grid scrolls inside itself** (`scroll-container-axis="block"`, the default): it
  keeps the width you give it, so the page never scrolls sideways and the rest of your layout stays
  put. Headers, body and totals scroll together, fixed columns and group labels stay at the grid's
  edges, and a horizontal scrollbar of the grid sticks to the bottom of the container (below the
  totals) whenever the grid is in view; touch, trackpad, Shift+wheel (also over the headers),
  Ctrl+F and keyboard navigation scroll it too. The scrollbar takes its colors from the inherited
  `scrollbar-color` (`u-grid { scrollbar-color: … }`). In a flex or grid layout the grid already
  shrinks to its track (`min-width: 0`).
- **Columns without `width` are 150px** in this mode (`max(minWidth, 150)`, within `maxWidth`), or
  the width measured once by `column-auto-width` (it never changes while you scroll). The headers,
  the body and the totals are separate tables sharing the column widths, so a width can't come from
  the content of each one. The leftover width still goes to the last non-fixed column.
- **`scroll-container-axis="both"`** keeps the 0.4.x behavior: the container scrolls in both
  directions, the grid grows to the width of its columns and columns are virtualized by the visible
  part of the container (the bullets on `scroll-padding-inline`, phones and wrappers below are about
  this mode).

```html
<u-grid scroll-container="window" scroll-container-axis="both"></u-grid>
```

- The toolbar, the column headers (with bands), fixed rows and the totals stick to the container;
  fixed columns and group labels stick to the grid's edges (with `both`, to the container's). The
  toolbar, the pager, detail rows and full-width rows span the visible part of the grid.
- Something of yours stuck to the container (an app bar)? Give the container a
  **`scroll-padding-top`** (and `scroll-padding-bottom` for a bottom bar): the grid sticks its
  headers below it, and keyboard focus never stops under it (WCAG 2.4.11).
- With `both`, the same sideways: **`scroll-padding-inline-start`/`-end`** (a fixed side menu over the page)
  keep fixed columns, group labels and the toolbar clear of it (start/end follow the direction; with
  `window`, set it on `<html>`). Without it, the grid sticks those parts at its own edge when it sits
  inset in the container (the padding of your layout), so nothing slides at the ends of a sideways
  scroll; that inset is only used when the grid starts in the first half of the visible area. Once
  you scroll sideways, the strip between the visible edge and the stuck parts is painted with the
  grid background, so scrolled content never shows beside a fixed column.
- Keyboard navigation, `focusCell` and `editCell` scroll the container (with `block`, the grid
  sideways and the container vertically). Keyboard and mouse scroll
  instantly; API calls follow the container's `scroll-behavior` (`smooth` animates, focus moves at
  once), except with `prefers-reduced-motion: reduce`.
- The attributes alone (`scroll-container`, `scroll-container-axis`) are enough for server rendering: the server already renders the grid without
  its own scrollbar, so hydration doesn't jump.
- Resolved when the grid connects and when either property changes (changing the ancestor's id
  later doesn't re-resolve). Not found, not an ancestor or empty: a console warning and the grid's
  own scrollbar. A warning also when an element between the grid and the container clips or
  scrolls (`overflow` other than `visible`/`clip`): sticky headers would stick to it instead; and
  when something gives the grid a height in this mode (it would clip the rows).
- Accessibility: the container is yours. If it scrolls, make it reachable by keyboard and name it
  (`tabindex="0" role="region" aria-label="…"`): while the grid loads its rows it is inert, and a
  scrollable region with nothing focusable fails WCAG 2.1.1. Screen readers still see one grid
  (`role="grid"` on the element that holds headers, body and totals); the grid's own scrollbar is
  hidden from them and never takes Tab focus (the keyboard scrolls by moving between cells). When
  the stuck parts (toolbar, headers, totals and scrollbar) would cover more than half of the
  container's height (zoom, a short panel), they scroll with the content instead (WCAG 1.4.10).
- CSS of yours that targeted the `<table>`, `<thead>` or `<tbody>` inside the shadow root is not
  supported (with `block` they are split in three tables); the row and cell `::part`s are the same.
- **Phones and `window` with `both`:** the container scrolls sideways too, so with `scroll-container="window"` a
  table wider than the screen makes the page wider. Mobile browsers then widen their layout
  viewport, and what sticks to the bottom (totals, `fixedBottomItems`) sticks below the screen. On
  narrow screens turn on `autoHideColumns` (the columns that don't fit move to the row details) or
  use an element as the container.
- **With `both`, a wrapper that grows with the table** (for example `display: inline-block; min-width: 100%`
  around the grid, to keep the container's padding at the end of the horizontal scroll) makes the
  grid as wide as its table, so `autoHideColumns` never runs out of room and hides nothing. Use one
  or the other: keep the wrapper where all columns should show (wide screens) and drop it
  (`display: block`) where `autoHideColumns` should act.

---

## Column features

```html
<u-grid column-resizing resize-mode="next-column" column-chooser column-auto-width></u-grid>
```

The user's choices (widths, visibility, fixed side, order) are kept in the grid's own state: the
column objects you pass are never modified. Re-assigning the same column objects keeps the user's
choices; changing an option on a column definition (e.g. a new `width` or `visible`) wins over what
the user picked for that option.

### Resizing

With `column-resizing`, every header gets an 8 px handle on its end edge (`resizable: false` opts a
column out).

- **Drag** the handle to resize. `minWidth` (default 40 px) and `maxWidth` are respected.
- **Modes** (`resize-mode`): `widget` (default) changes only that column, so the total width grows or
  shrinks; `next-column` gives/takes the same amount from the next column, keeping the total width
  (the last column has no handle in this mode).
- **Double-click** the handle to auto-size the column to its content (header + rendered rows).
- **Keyboard** — `Alt+←/→` on a header cell, or `←/→` on the focused handle, resize by 16 px
  (mirrored in RTL); `Enter` on the handle auto-sizes.
- The handle is a `role="separator"` with `aria-valuenow` set to the column width. It is not a `Tab`
  stop (the grid has one): `F2` on the header focuses it, `Esc` goes back.
- Using the handle (drag, click, double-click, keys) never sorts the column; neither does dragging a
  header to reorder it.

When every visible column has a width (set by you or by the user), the last non-fixed column absorbs
any leftover width so the table still fills the grid (its own width is the minimum; a column fixed
at an edge, such as an actions column, keeps its width; when only fixed columns are shown, the last
one without a width of yours takes it) — columns measured by
`column-auto-width` count as having a width; otherwise, with at least one auto-width column, that
column takes the leftover. With column virtualization the table is exactly
as wide as the sum. `getColumnWidth()` and the resize handle report the set width, not the
stretched one.

```ts
grid.setColumnWidth(column, 180); // clamped to minWidth/maxWidth
grid.autoSizeColumn(column);      // fit header + rendered rows
grid.autoSizeAllColumns();        // the same for every visible column
grid.resetColumns();              // order, width, visibility and pinning back to the definitions
grid.addEventListener('u-grid-column-resize', e => console.log(e.detail.column, e.detail.width));
```

The column header menu offers the same as the user's alternative: **Auto-size column**, **Auto-size
all columns** and **Increase / Decrease width** (the keyboard and single-pointer alternative to
dragging the handle, WCAG 2.5.7), and **Reset columns**.

### Auto width

With `column-auto-width`, columns without a `width` are sized to their content (header + rendered
rows), measured again when `items` change. Extra space is still distributed while the table is
narrower than the grid.

### Fixed columns

`fixed: 'start'` / `'end'` keeps a column visible while scrolling horizontally (`position: sticky`
on header, cells and group rows). Fixed columns are shown at the start/end regardless of their
position in `columns`, a line marks the edge of each fixed block and a shadow appears while content
scrolls under it. Reordering by drag and drop stays inside the column's block (start-fixed, regular,
end-fixed). Give fixed columns a `width` so the scrollable area keeps a predictable size.

The user pins columns from the column header menu: **Pin column ▸** opens a submenu with *Pin to
start*, *Pin to end* and *Unpin* (radio items, the current side checked). It does not need the
column chooser; `column-fixing="false"` (`columnFixing = false`) removes it (columns with `fixed`
stay pinned). A hidden column can be pinned only after it is shown again (as in AG Grid).

```ts
grid.columns = [
  { path: 'name', label: 'Name', width: 200, fixed: 'start' },
  { path: 'city', label: 'City', width: 160 },
  // …
  { path: 'total', label: 'Total', width: 120, fixed: 'end' },
];
```

### Column chooser

`column-chooser` adds a button at the end of the header bar (and **Choose columns** to the column
header menu) that opens a small non-modal dialog listing the columns (`showInChooser: false` leaves a
column out), modeled on AG Grid's:

- a **search** field (focused on open) filters the list, ignoring case and accents; the number of
  columns found is announced after a short pause;
- **Show all columns**, a checkbox that is mixed while some listed columns are hidden: checked shows
  every listed column, unchecked hides them (the last visible column stays);
- one labelled checkbox per column to show/hide it (bands are tri-state, with their columns nested);
- a drag handle per column to **reorder** it by dragging, and `Alt+Shift+↑/↓` on a checkbox for the
  same with the keyboard (announced, also when the move is refused — e.g. past a pinned column; the
  focus stays on the checkbox). Both fire
  `u-grid-column-reorder` and stay inside the column's band and fixed block.

Pinning is not in the chooser any more: use **Pin column ▸** in the column header menu.
`openColumnChooser()` and `closeColumnChooser()` open and close it from code (also without the
button). While it is open, dragging a column header onto it hides that column. `Esc`, `Tab` out of
it or a click outside closes it. The last visible column cannot be hidden.

### Column events

| Event | Detail | Fired when |
| ----- | ------ | ---------- |
| `u-grid-column-resize` | `{ column, width, previousWidth, nextColumn?, nextColumnWidth? }` | The user finishes a resize (pointer release, keyboard step, auto-size, column header menu). `nextColumn*` only in `next-column` mode. |
| `u-grid-column-visibility-change` | `{ column, visible }` | The user shows/hides a column (or a band) in the chooser. One event per column whose own visibility changed: a band first, then each column it shows. |
| `u-grid-column-fixed-change` | `{ column, fixed, previousFixed }` | The user pins/unpins a column (or a top-level band) from the column header menu. |
| `u-grid-column-reorder` | `{ column, band, index, previousIndex }` | The user moves a column (or a band) by drag and drop (header or column chooser), `Alt+Shift+←/→` on the header, `Alt+Shift+↑/↓` in the column chooser or the column header menu. Positions are among the column's siblings — the columns of the same `band`, or the top level when `band` is `null` — that are not grouped, hidden ones included. `fromIndex`/`toIndex` are deprecated aliases. |

All events bubble and are `composed`. Unlike sorting and grouping, these column events fire **only
for user gestures**: changes made through the API (`setColumnWidth`, `moveColumn`, a new `width` or
`visible` on the definition) do not fire them. "Reset columns" (column header menu) and
`resetColumns()` fire none of them either, only `u-grid-state-change` (`sources: ['user']` from the
menu).

### Bands (multi-level headers)

A column with nested `columns` is a **band**: a header over its columns, with one header row per
level. Bands nest to any depth; a column without a band above it spans the header rows down to the
last one.

```ts
grid.columns = [
  { path: 'country', label: 'Country' },
  { label: 'Population', columns: [
    { path: 'population', label: 'Total' },
    { path: 'urban', label: 'Urban', format: { style: 'percent' } },
  ] },
  { label: 'GDP', fixed: 'end', columns: [
    { path: 'gdp', label: 'Total' },
    { label: 'By sector', columns: [{ path: 'agro', label: 'Agriculture' }, { path: 'industry', label: 'Industry' }] },
  ] },
];
```

```html
<u-grid>
  <u-grid-column path="country">Country</u-grid-column>
  <u-grid-column>Population
    <u-grid-column path="population">Total</u-grid-column>
    <u-grid-column path="urban">Urban</u-grid-column>
  </u-grid-column>
</u-grid>
```

- In a band only `label`, `headerRenderer`, `alignment` (of the label; default `start`), `fixed`,
  `visible`, `showInChooser` and `headerMenu` (of the band header only) apply; the other fields are
  ignored. With `<u-grid-column>`, the
  band's `label` is its own text (without the nested columns) and `columns` is a read-only list of
  the nested elements (`null` without them).
- **Reordering**: a column moves only among the columns of its band (drag and drop, `Alt+Shift+←/→`
  or the header menu); dragging a band, or `Alt+Shift+←/→` on it, moves the whole block.
  `moveColumn(column, index)` takes the index among the column's siblings.
- **Fixing** a band fixes all its columns; `fixed` on a nested column is ignored.
- **Hiding**: a band is shown while it is visible and has a visible column. In the column chooser a
  band is a checkbox with its columns in a nested list: mixed (some columns hidden) → all visible →
  band hidden → back as it was before hiding (all visible, or mixed if the band was hidden while
  mixed); checking a column of a hidden band shows the band and keeps the others' state.
- Only leaf columns sort, group, filter, resize and export (no band row in CSV; Excel writes the band rows above the column labels, each band label merged across its columns).
  `sortColumn`, `groupColumn` and `setColumnWidth` with a band do nothing, `focusCell` returns
  `false` and `autoSizeColumn` sizes each visible column of the band. A grouped column leaves its
  band in the header and returns to the end of it when ungrouped.
- **Keyboard**: `↑`/`↓` move between header levels (`↑` from a column goes to its band, `↓` from a
  band to the column under the remembered position), `←`/`→` move along the level skipping the whole
  band, `Home`/`End` go to the first/last cell of the level and `Ctrl+Home` to the top-left header.
  On a band, `Shift+F10`, the menu key, right-click or a long press open a menu with "Move left/right"; `Enter`, `Space`
  and `Ctrl+G` do nothing.
- **Accessibility**: bands are `role="columnheader"` cells with a native `colspan`, header rows have
  `aria-rowindex` 1…N (the filter row follows), and `aria-colindex` is always the real column index.
  `u-grid-focus-change` on a band header has `cellType: 'header'` and the band as `column`.
- Style bands with `::part(band-header-cell)` (they also match `::part(header-cell)`);
  `--u-grid-header-cell-height` applies to each header row.

### Column virtualization

`column-rendering-mode` (`columnRenderingMode`) controls how columns are rendered:

| Value | Behavior |
| ----- | -------- |
| `auto` (default) | `virtual` when more than 50 leaf columns are defined (visible, hidden or grouped), otherwise `standard`. |
| `virtual` | Only the columns in view (plus some overscan), the fixed columns and the focused cell's column are in the DOM; the others become spacer cells with their width. |
| `standard` | Every visible column is rendered. |

Under `virtual`, a column without `width` takes its auto-size width (`column-auto-width`) or
`max(minWidth, 150)` px, and the table is exactly as wide as the sum. Keyboard navigation reaches
every column: moving to a column outside the DOM brings it in, focuses it and scrolls it into view
(never under the fixed columns). `aria-colcount` and `aria-colindex` count every column; spacers
are `role="presentation"`. Exports, summaries and Ctrl+C use all columns. As with rows, the
browser's find-in-page only sees the rendered columns. Before measuring (server rendering, first
render) the grid renders the columns that fit in 1920 px.

### Responsive columns (auto-hide)

With `auto-hide-columns` (`autoHideColumns`), columns that don't fit in the **grid's own width**
(not the window's: a side panel or a narrow card counts too; so the grid must not grow with its
table) leave the table, and their values move
to the row details — an expandable row below each row, the same one as
[master-detail](#master-detail):

```html
<u-grid auto-hide-columns>
  <u-grid-column path="invoice" width="120">Invoice</u-grid-column>
  <u-grid-column path="city" width="140" hiding-priority="0">City</u-grid-column>
  <u-grid-column path="state" width="120" hiding-priority="1">State</u-grid-column>
  <u-grid-column path="amount" width="120">Amount</u-grid-column>
</u-grid>
```

- **Which columns leave:** when any column has a `hidingPriority`, only those hide, the lowest
  first (ties: the later one in column order goes first) — any column counts, grouped or hidden
  ones included; without any, columns hide from the last one.
  Fixed columns, grouped columns, checkboxes, the toggle and the row buttons never hide, and at
  least one column always stays. The grid needs a width per column: the chosen width (user,
  `width`, auto-size) or `max(minWidth, 150 × font-size/16)` px within `maxWidth` (follows text-only zoom).
  If what is left still doesn't fit, the last non-fixed column with a width shrinks to the available
  space (never below its `minWidth`); when only fixed columns are left, the widest one shrinks — e.g.
  a fixed name column sized by `column-auto-width`.
  A hidden column comes back only when it fits with a small margin (no flicker when the scrollbar
  appears).
- **Row details:** while a column is hidden, the toggle column appears at the start (sticky). An
  expanded row shows "Label: value" for each hidden column, in column order, with the cell's
  formatting, `renderer` (`ctx.adaptive` is `true` there), search highlight, sort/filter marks and
  edit state — then the `detailRenderer` content, if any. `expandRow`/`collapseRow`/`isRowExpanded`
  and `u-grid-row-expansion-change` work with `autoHideColumns` even without `detailRenderer`; the
  expansion is kept (and in `getState()`) while every column fits, and rows open again when
  columns leave. Fixed rows expand too.
- **Layout only:** a hidden column stays visible for everything else — the column chooser (checked,
  with "In row details" below it), `getState()`, exports, row copies, the search and the filters
  (its filter keeps applying; its filter-row cell and funnel leave with it). Totals and group
  footer summaries of a hidden column leave the footer with its cells (the footer keeps one line;
  `getSummaryValues()` still returns them); aligned group summaries join the group row text.
- **Keyboard:** the toggle cell and the details row work as in master-detail (`Enter`/`Space`
  toggle, `↓` enters the details row, `↑` leaves). `Enter`/`F2` on it reach the values: every value
  is a stop for `Tab`/`Shift+Tab` (they cycle) and `Esc` returns to the cell. On a value,
  `Enter`/`F2` (or a double click) edit it in place, `Shift+F10`/the menu key (or a right click)
  open the cell menu of that column and `Ctrl+C` copies it.
- **Editing:** in `cell`/`batch` mode the editor opens in place of the value; `Enter`/`Tab` commit
  (focus back on the value / the next value) and `Esc` cancels. In `row` mode, editing a row opens
  its details with editors for the hidden columns (`Tab`: row editors → detail editors →
  Save/Cancel) and closes them when the edit ends; both fire `u-grid-row-expansion-change`. A
  hidden column with a change or an error while the details are closed marks the toggle cell
  (described by the first error); saving with an error there opens the details on its editor.
  `focusCell`/`editCell` on a hidden column open the details (`source: 'api'`) and go to the value.
- **Focus:** when the column of the active cell leaves, the focus goes to the toggle cell of the
  same row (header: the previous column; footers: the last column); when it comes back while a
  value of it is focused, to its cell; when the toggle column goes away, to the first data cell.
  Outside the grid only the Tab stop moves. The set does not change while an editor, a header
  filter or a menu is open (zooming doesn't throw away what you are typing).
- **Screen readers:** `aria-colcount`/`aria-colindex` count the columns in the table only; a value
  is named "label value" (`aria-labelledby`) and the details row is labelled by its row. When the
  set changes and the focus is in the grid, one polite announcement after the resizing settles
  (1 s): "Columns in row details: City, State" (or the count above three), or "All columns in the
  table"; the toggle column header keeps the same text as its description. When fixed columns and
  the toggle would take more than half of the width, fixed columns stop sticking.
- `getAdaptiveColumns()` returns the hidden columns; `u-grid-adaptive-columns-change`
  (`{ columns, previous }`, after the render, no `source`) fires when the set changes, also from
  setters (layout state).
- **SSR:** the server doesn't know the width: every column is rendered and the client hides them
  after hydration.
- Style the details with the `adaptive-fields` (`<dl>`), `adaptive-field`, `adaptive-label`
  (`<dt>`) and `adaptive-value` (`<dd>`, also `modified`/`invalid`) parts.

---

## Export & clipboard

The grid exports **what the user sees**: the visible columns in their current order, the filter,
the sorting, the groups (collapsed groups are exported whole) and the summaries. The state is read
when the method is called; rows are produced in time slices, so exporting a million rows does not
freeze the page.

```js
await grid.downloadCsv({ fileName: 'orders.csv' });          // build and download
const blob = await grid.exportCsv({ selectedOnly: true });    // or get the Blob
```

`exportCsv(options)` returns a `Blob` (`text/csv;charset=utf-8`), RFC 4180: fields with the
separator, quotes or line breaks are quoted, lines end with CRLF. A group row puts its label
(`"Country: Brazil (3)"`) in the first field and its column summaries under their columns; the
nesting level is not written as empty columns.

| Option | Default | Description |
| ------ | ------- | ----------- |
| `selectedOnly` | `false` | Only the selected rows, in the current order and filter (not the selection order of `getSelectedItems()`). Group counts and summaries are computed over them. |
| `includeGroups` | `true` | Group rows. `false` exports a flat list in the current order with the grouped columns first. |
| `includeSummaries` | `true` | Group footers, totals and the summaries of group rows. |
| `includeFixedRows` | `true` | Fixed rows (`fixedTopItems` before the body, `fixedBottomItems` before the totals; `fixed` on each data row). `selectedOnly` leaves them out. |
| `separator` | `'auto'` | Field separator. `auto`: `;` when the grid language uses a decimal comma (pt, de, fr…: what Excel expects there), `,` otherwise. |
| `bom` | `true` | UTF-8 byte order mark, so Excel opens the file as UTF-8. |
| `includeHeaders` | `true` | First line with the column labels. |
| `escapeFormulas` | `true` | Prefix `'` to text starting with `=`, `+`, `-`, `@`, tab or CR ([CSV injection](https://owasp.org/www-community/attacks/CSV_Injection)). Numbers and dates formatted by the grid (`-5`, `-$5.00`) are not prefixed. |
| `rawValues` | `false` | Cell values instead of the displayed text: numbers with `.`, dates in ISO 8601, `true`/`false`, empty values as empty fields. Group labels and summaries stay text. |
| `signal` | — | An `AbortSignal`; aborting rejects the promise with an `AbortError`. |
| `fileName` | `'export.csv'` | `downloadCsv()` only. |

Leave a column out with `exportable: false` (`exportable="false"` on `<u-grid-column>`); columns that
only have a `renderer` are left out by default.

With a [`dataSource`](#data-source): a single-load source exports every row like `items`. When the
server pages or groups (`remoteOperations`), the grid only has the rows it loaded, so only those are
exported — in screen order, without group rows (grouped columns become columns), with the server
totals; `selectedOnly` keeps the loaded selected rows (by `keyExpr`). For a full export, ask the
server for the file with the same `GridLoadOptions`.

### Export data (Excel, PDF, anything)

`getExportData(options)` (same options as above, without the CSV ones) resolves to the rows ready
for any library:

```ts
const { columns, rows } = await grid.getExportData();
// columns: { column, label, dataType, alignment, width }[]
for (const row of rows) {
  switch (row.rowType) {
    case 'data':         row.level; row.item; row.values; row.texts; break;   // values/texts per column
    case 'group':        row.level; row.groupPath; row.label; row.text; row.itemCount; row.texts; break;
    case 'group-footer': // falls through
    case 'total':        row.summaries; row.texts; break;                    // GridSummaryValue[] per column
  }
}
```

`values[i]`, `texts[i]` and `summaries[i]` belong to `columns[i]`; several summaries in one column
are joined in `texts[i]` with the list separator of the language, as on screen.

### Excel (`export-xlsx`)

An optional entry point writes an `.xlsx` of what the user sees, with no dependency of yours: the file
is written by a WebAssembly engine ([Universal Office](https://github.com/erichideyuki/universal-office)'s
`uo-xlsx` writer) in a Web Worker, so 10,000 rows × 40 styled columns do not freeze the page. The
`.wasm` (~95 KB gzip) and the worker are only downloaded on the first export; the grid bundle does not
change.

```js
import { downloadXlsx, exportXlsx } from '@universal-material/data-grid/export-xlsx';

await downloadXlsx(grid, { fileName: 'orders.xlsx' });
const blob = await exportXlsx(grid, { selectedOnly: true, sheetName: 'Orders 2026' });
```

What goes in the sheet: the visible columns in their current order and widths, the filter, the
sorting, the groups, the summaries and the [bands](#bands-multi-level-headers), like
[`getExportData`](#export-data-excel-pdf-anything). Cells keep the column alignment, as on screen (a
`start` date is not pushed right by Excel's General). Numbers, dates and booleans are typed cells with a
number format close to the column `format` (dates by their wall-clock time, no time zone); columns
with `displayValue`, a `format` function, `booleanDisplay` or their own `trueText`/`falseText` are
written as their displayed text, and so is a value that is not of the column type (`'n/a'` in a date
column). Text is always a text cell (never a formula), so it needs no `'` prefix.

The sheet is built for spreadsheet users and screen readers alike: the header rows (bands and column
labels) are frozen and repeat on every printed page; a `ColumnTitle` name on the first column label
lets screen readers (JAWS) read the column titles; columns fixed at the start (`fixed: 'start'`) are
frozen too and read as row titles (`RowTitle`; with the header, a single `Title` on the corner cell, the
JAWS convention for both; repeating them on printed pages waits for the writer; unfreeze them in Excel
with View › Freeze Panes when they take too much room);
a band label is a merged range across its columns, aligned by the band `alignment` (default
`start`, as on screen), in its own header row only — the column labels, group rows and data are never
merged, so sorting and filtering the data keep working and the column titles stay in one row (the
accessibility checker of Office lists merged cells as a warning); a group label is text
(`"Country: Brazil (3)"`) at the start of the row, as on screen (set `alignment: 'center'` in
`customizeCell` to center it across the row), with the row outline of Excel (the collapse button
on the group row); fixed rows are exported, not frozen. The document title and language
(`dc:language`) come from the grid, and a right-to-left grid writes a right-to-left sheet. Cell
templates (`renderer`) are not drawn — the sheet holds the values; restyle cells with `customizeCell`.

| Option | Default | Description |
| ------ | ------- | ----------- |
| `sheetName` | accessible name of the grid, else "Data" (translated) | Tab name, always cleaned: `[ ] : * ? / \` removed, cut to 31 characters, never `History`. |
| `title` | accessible name of the grid, else "Data" (translated) | Document title (metadata). |
| `language` | language of the grid | Language of the file (BCP 47): `dc:language` and the number and date formats. |
| `dateFormat` | `'language'` | Date and date-time columns: `'language'` writes the order of `language` (`dd/mm/yyyy` in `pt-BR`); `'reader'` writes the Excel built-in formats `14` (date) and `22` (date and time), which Excel shows in the regional settings of whoever opens the file, chosen by the column. |
| `includeHeaders` | `true` | The header rows (bands and column labels). |
| `includeBands` | `true` | Band rows above the column labels (the label in the first column of the band, aligned by the band `alignment`). |
| `freezeHeader` | `true` | Freezes every header row (the `fixed: 'start'` columns are always frozen). |
| `direction` | direction of the grid | `'rtl'` writes a right-to-left sheet; `start`/`end` alignments follow it. |
| `customizeCell` | — | `(cell) => void`, see below. |
| `onProgress` | — | `({ rowCount, totalCount, pageCount }) => void` (`pageCount` is 0), about every 250 ms and once at the end. |
| `worker` | `true` | `false` writes on the main thread in time slices; a function returns a new `Worker` of `worker.js` (CDN, strict CSP: see below) and is called once per export. |
| `assetsUrl` | next to the module | The folder `grid-xlsx.wasm` and `worker.js` are served from (relative to the page). |
| `selectedOnly`, `includeGroups`, `includeSummaries`, `includeFixedRows`, `signal` | | As in [`getExportData`](#export-data-excel-pdf-anything). An aborted `signal` rejects with its reason. |
| `fileName` | `'export.xlsx'` | `downloadXlsx()` only. |

`customizeCell(cell)` runs synchronously for every header, band, data, group, group footer and totals
cell, after the adapter chose its value, number format and style. Read `rowType` (`'header'` includes
the band rows), `row`, `column` (the `GridExportColumn`, as in the PDF; in a band cell, the first column
of the band; `null` in the label of a group row), `band` (the band of a band cell, else `null`),
`columnIndex`, `columnSpan`, `headerRow` and `value` (the source value). `column` is the export column
(`{ column, label, dataType, alignment, width }`), not your definition: test your column through
`cell.column?.column` — `cell.column?.column.name === 'actions'` or `cell.column?.column.path ===
'status'` (`cell.column.name` is always `undefined`). Change `cellValue` (a string
is always text; or a number, boolean, `Date` or `null`), `text` (sets `cellValue` to the text and
`numFmt` to `null`), `numFmt` (an Excel format code written as is, or the id of a built-in date/time
format — `14` short date, `22` date and time, 15–21, 45–47 — shown in the reader's regional settings;
other ids are ignored with a warning; a `Date` with no format, or an ignored one, gets `14` or `22`), `style` and `link` (a `GridExportLink` `{ url,
description? }`: `http:`, `https:` or `mailto:`; without a color of yours, or when yours fails the
contrast check, the cell gets the link color — `#0563c1`, or `#9dc3e6` on a dark background; no underline
yet — and `description` is ignored for now: the writer has no link tooltip yet). The last write wins.

**Color is never the only signal.** When a background tells a state, write the state in the cell too:

```js
// a heat map: the background reinforces the text, it does not replace it
const tone = pct => pct < 50 ? '#f8696b' : pct < 80 ? '#ffeb84' : '#63be7b';

await downloadXlsx(grid, {
  fileName: 'compliance.xlsx',
  customizeCell: cell => {
    // your definition is cell.column.column (cell.column is the export column)
    if (cell.rowType === 'data' && cell.column?.column.path === 'progress' && typeof cell.value === 'number') {
      const pct = cell.value;
      cell.text = `${pct}% ${pct < 50 ? 'overdue' : pct < 80 ? 'in progress' : 'done'}`;
      cell.style = { ...cell.style, backgroundColor: tone(pct) };     // contrast checked
    }
  },
});
```

`cell.style`: `bold`, `italic`, `color`, `backgroundColor`, `alignment` (the same `GridExportCellStyle`
as the PDF), plus `wrap` and `border` (`true`, one `{ color?, style?: 'thin' | 'medium' }` for every
side, or `GridXlsxBorderSides` `{ top?, bottom?, start?, end? }`). A text color below 4.5:1 contrast
with its background is dropped (with a console warning); on a dark background where the automatic black
text does not reach 4.5:1 the text turns white; unsupported values are ignored with a warning. A band or
group label spans its columns without merging: `customizeCell` sees it once (`columnSpan`), the
covered cells take its final style, and only `alignment: 'center'` centers across them.

For the toolbar Export button, `createXlsxExporter(options?)` returns the exporter to assign to
`grid.xlsxExporter` (see [Export button](#export-button)); while it runs, the Excel entry becomes
"Cancel export" and the button describes the progress.

**ExcelJS forms (deprecated).** `exportXlsx(grid, ExcelJS, options)`, `downloadXlsx(grid, ExcelJS,
options)` and `createXlsxExporter(ExcelJS, options)` still work, with a console warning once: they
write the file through the [ExcelJS](https://github.com/exceljs/exceljs) module you pass, with only
their old options (`sheetName`, default `'Sheet1'`; `includeHeaders`; `customize(worksheet,
workbook)`) — no bands, frozen header nor `customizeCell`. Drop the ExcelJS argument to switch; they
will be removed in the next major version.

#### Without a bundler: `/vendor` or a CDN

Bundlers (Vite, webpack, esbuild) copy the `.wasm` and `worker.js` from `new URL('./…',
import.meta.url)`. Without one, load the self-contained modules next to `grid.min.js`: they find their
assets in the `export-xlsx/` and `export-pdf/` folders beside them and use the grid already on the page
(no second copy).

| Module | Assets beside it |
| ------ | ---------------- |
| `dist/export-xlsx.min.js` | `dist/export-xlsx/worker.js`, `dist/export-xlsx/grid-xlsx.wasm` |
| `dist/export-pdf.min.js` | `dist/export-pdf/worker.js`, `dist/export-pdf/grid-pdf.wasm` |

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@universal-material/data-grid@0.3/dist/grid.min.js';
  import { createXlsxExporter } from 'https://cdn.jsdelivr.net/npm/@universal-material/data-grid@0.3/dist/export-xlsx.min.js';

  const assets = 'https://cdn.jsdelivr.net/npm/@universal-material/data-grid@0.3/dist/export-xlsx/';
  // a Worker from another origin is blocked: start it from a same-origin Blob URL (made once)
  const workerUrl = URL.createObjectURL(new Blob([`import '${assets}worker.js';`], { type: 'text/javascript' }));
  document.querySelector('u-grid').xlsxExporter = createXlsxExporter({
    worker: () => new Worker(workerUrl, { type: 'module' }),
  });
</script>
```

Use the same version for `grid.min.js` and the export modules. Served from your own origin
(`/vendor`), no factory is needed. The PDF takes the same factory (it calls it twice per export).

**Content Security Policy.** The exports need `worker-src 'self'` (or `blob:` with the factory above),
`script-src 'wasm-unsafe-eval'` (to compile the `.wasm`) and `connect-src` for the `.wasm` (and, for
the PDF, the fonts). Serve `.wasm` files as `application/wasm`; otherwise the engine compiles only
after the whole file has downloaded.

### PDF (`export-pdf`)

An optional entry point writes an **accessible, tagged PDF** (PDF/UA-1 target: table structure with
header cells, reading order, language, title, embedded fonts) of what the user sees, in any script
(Arabic and Hebrew right to left, Devanagari, Thai, CJK…). A WebAssembly engine lays out, shapes and
writes the file in Web Workers (one lays out the pages while another compresses and writes), so the
page stays responsive; the `.wasm` (~470 KB gzip) and the worker are only downloaded on the first
export. The grid bundle does not change.

```js
import { downloadPdf, exportPdf } from '@universal-material/data-grid/export-pdf';

const fonts = [
  { source: '/fonts/NotoSans-Regular.ttf' },
  { source: '/fonts/NotoSans-Bold.ttf', weight: 'bold' },
  { source: '/fonts/NotoSansArabic-Regular.ttf' },  // fallback per character, in this order
];

await downloadPdf(grid, { fonts, fileName: 'orders.pdf', title: 'Orders 2026' });
const blob = await exportPdf(grid, { fonts, layout: 'sections', paperSize: 'letter' });
```

**Fonts are yours.** Browsers do not let pages read installed font files, and an accessible PDF must
embed its fonts, so pass TrueType/OpenType files (or collections) covering the characters of your data;
only the glyphs used are embedded. A character no font covers rejects with
`GridPdfMissingGlyphError` (`codePoints`), instead of a PDF that would lose it.

What goes in the PDF: the visible columns in their current order, the filter, the sorting, the groups
and the summaries, like [`getExportData`](#export-data-excel-pdf-anything). Cell templates
(`renderer`, `rowRenderer`, `detailRenderer`) are not drawn — the PDF holds the cell texts; restyle
cells or add images and links with `customizeCell`. The header repeats on every page; text wraps in
its cell (never cut with "…"); a row taller than a page continues on the next one. Columns that do not
fit the paper follow the [auto-hide rule](#responsive-columns-auto-hide) (`hidingPriority`): they move
to a "Label: value" line under each row; when none can move, the columns shrink and the text wraps.

| Option | Default | Description |
| ------ | ------- | ----------- |
| `fonts` | — | Required. `{ source, weight?, style? }[]`: `source` is an `ArrayBuffer`, a `Uint8Array` (copied, never transferred) or a URL. |
| `layout` | `'table'` | `'table'`: one table, groups as rows. `'sections'`: a heading and a table per first-level group (navigable headings, bookmarks). `'list'`: a flat list, grouped columns first. |
| `title` | accessible name of the grid, else "Data" | Document title (shown by PDF readers) and heading of page 1. |
| `language` | language of the grid | Document language (`/Lang`). |
| `direction` | direction of the grid | `'rtl'` mirrors the table. |
| `paperSize` | `'auto'` | `'a4' \| 'letter' \| 'legal' \| 'a3'`; `'auto'`: Letter in the US, Canada, Mexico…, A4 elsewhere. |
| `orientation` | `'auto'` | `'auto'`: landscape when the columns do not fit in portrait. |
| `autoHideColumns` | the grid's | Hidden columns move to a "Label: value" line instead of shrinking. |
| `striped` | the grid's | Alternate row backgrounds. |
| `theme` | — | `{ fontSize (pt, min 6), color, headerBackgroundColor, groupBackgroundColor, stripedBackgroundColor, summaryBackgroundColor, lineColor }`. A text color below 4.5:1 contrast with a background falls back to the default (with a warning). |
| `includePageNumbers` | `true` | "Page X of Y" in the footer. |
| `bookmarks` | `true` | Bookmarks for the first-level groups. |
| `customizeCell` | — | `(cell) => void`, see below. |
| `onProgress` | — | `({ rowCount, totalCount, pageCount }) => void`, about every 250 ms and once at the end. |
| `worker` | `true` | `false` generates on the main thread in time slices (Node, strict CSP); a function returns a new `Worker` of `worker.js` (CDN: a Blob URL) and is called twice per export. |
| `assetsUrl` | next to the module | Where `grid-pdf.wasm` and `worker.js` are served from. |
| `selectedOnly`, `includeSummaries`, `includeFixedRows`, `signal` | | As in [`getExportData`](#export-data-excel-pdf-anything). |
| `fileName` | `'export.pdf'` | `downloadPdf()` only. |

`customizeCell(cell)` runs for every header, data, group, group footer and totals cell, synchronously,
before the cell is laid out. Read `rowType`, `row`, `column`, `columnIndex`, `value`; change:

```js
customizeCell: cell => {
  if (cell.rowType === 'data' && cell.column?.column.path === 'status' && cell.value === 'late') {
    cell.style = { ...cell.style, bold: true, color: '#b00020' };          // contrast checked
  }
  if (cell.rowType === 'data' && cell.column?.column.path === 'flag') {
    cell.image = { data: flags[cell.value], format: 'png', width: 16, height: 11, alt: cell.text };
  }
  if (cell.column?.column.path === 'site') {
    cell.link = { url: cell.text, description: 'Customer website' };      // http(s): and mailto: only
  }
  if (cell.column?.column.path === 'name_fa') {
    cell.lang = 'fa';                                                      // the grid never guesses languages
  }
}
```

`cell.style`: `bold`, `italic`, `color`, `backgroundColor`, `alignment`. An image needs `alt` (`''` marks
it decorative). Unsupported values are ignored with a console warning.

Options are checked when called (`TypeError`); loading errors reject with the original error; an
aborted `signal` rejects with its reason. In Node (or a server), pass ready data —
`exportPdf({ columns, rows }, { fonts, worker: false })` with a `GridExportData` — and fonts as file
URLs or buffers.

For the toolbar Export button, `createPdfExporter({ fonts, ... })` returns the exporter to assign to
`grid.pdfExporter` (see [Export button](#export-button)).

### Clipboard (Ctrl+C)

With [cell ranges](#cell-ranges) selected and the focus on a data cell, **Ctrl+C** copies the ranges,
stacked vertically in the order they were made (as text and HTML, with the same formula protection
below); `detail.ranges` lists them, `items` are their distinct rows and `columns` the union of their
columns, both in the displayed order. Up to 200,000 cells (the copy event is synchronous): above that,
or with rows of a remote source not loaded yet, nothing is copied and the reason is announced — use
[`getExportData`](#export-data-excel-pdf-anything) for more. On the checkbox column, Ctrl+C copies the
selected rows. Without ranges:

With the focus on a cell, **Ctrl+C** (⌘C, or Copy in the browser menu) copies the selected rows in
the current order — or, without a selection (or when no selected row passes the filter), the
focused data cell — as tab separated text (`text/plain`) and an HTML table (`text/html`, escaped;
above 10,000 rows only the text), with the visible exportable columns, formatted values, no header
and formula injection blocked. The HTML table carries `dir="rtl"` when the grid is right-to-left and
the grid's effective `language` as `lang`. Text a spreadsheet would run as a formula keeps the `'`
prefix in both formats; in the HTML its cell is also marked as text (`mso-number-format:"\@"`),
because LibreOffice ignores that mark when pasting and would run the formula. Screen readers announce the copy (again when repeated). Without a
selection, Ctrl+C on a header, group row, summary or checkbox cell copies nothing. Text the user
selected with the mouse inside the grid, and copies from the filter row, the search box or an
editable control inside a cell, are left to the browser.

`clipboard-mode="none"` turns it off. The cancelable `u-grid-copying` event fires before the grid
writes; `detail` is `{ items, columns, ranges, text, html, clipboardData, source }` (`source` is `'api'`
from [`copySelection()`](#copy-by-api)). After `preventDefault()` the
grid writes nothing and announces nothing — write your own content in `clipboardData`
(synchronously) and announce the copy in your own live region:

```js
grid.addEventListener('u-grid-copying', event => {
  event.preventDefault();
  event.detail.clipboardData.setData('text/plain', event.detail.items.map(item => item.id).join('\n'));
});
```

The exact markup of `detail.html` may gain attributes in minor versions — don't compare it as a
fixed string.

### Paste (Ctrl+V)

With `clipboard-mode="copy-paste"`, editing on (`allow-editing`) and the focus on a data cell,
**Ctrl+V** pastes tab separated text (what spreadsheets and the grid's own copy write) into the
editable cells: from the top left of the active [cell range](#cell-ranges), or of the active cell.
A single value fills the whole range; a range that is an exact multiple of the pasted block repeats
it; otherwise the block is pasted from the corner and cut at the grid's edges (no rows are added).
Read-only cells, rows marked for removal and rows not loaded are skipped (announced). Values are
converted by the column's type in the grid's language (formatted numbers, currencies, `%`, dates)
and the `'` the copy puts before formulas is removed. They go through [editing](#editing): validated
by the rules, pending in `batch` mode, saved at once (one `u-grid-saving`) in `cell` and `row`
modes — invalid ones stay pending and marked. Up to 200,000 cells. Paste in an open editor is the
editor's.

The cancelable `u-grid-pasting` event fires before anything changes; `detail` is
`{ text, values, range, clipboardData }` (`clipboardData`: the native one on Ctrl+V; for the menu's
"Paste", a `DataTransfer` of the grid with only `text/plain`). `values` (one array of strings per row) belongs to the
grid: change the strings to transform what is pasted. `range` is the area that will be written; it
is not recomputed, so edited `values` are tiled into it. After
`preventDefault()` the grid changes nothing and the native paste goes on:

```js
grid.addEventListener('u-grid-pasting', event => {
  for (const row of event.detail.values) {
    row.forEach((text, i) => row[i] = text.trim());
  }
});
```

---

## Toolbar & context menus

### Toolbar

The bar above the table holds the built-in items whose feature is on — `groupPanel`
(`show-group-panel`), `addRowButton` (`allow-adding`), `saveButton` and `discardButton`
(`edit-mode="batch"`), `exportButton` (`export-formats`), `columnChooserButton` (`column-chooser`)
and `searchPanel` (`show-search-panel`) — in that order (`GRID_DEFAULT_TOOLBAR_ITEMS`). Set
`toolbarItems` (property only) to choose the items, their order and side, and to add your own:

```js
import { GRID_DEFAULT_TOOLBAR_ITEMS } from '@universal-material/data-grid';

grid.toolbarItems = [
  // Configure a built-in with an object (when a name is listed twice, the first one wins).
  ...GRID_DEFAULT_TOOLBAR_ITEMS.map(name => name === 'searchPanel' ? { name, location: 'start' } : name),
  { text: 'Refresh', icon: refreshIcon, showText: 'in-menu', action: ({ grid }) => grid.refresh() },
  { text: 'Print', action: () => print(), locateInMenu: 'always' },
  { renderer: ({ signal }) => html`<my-view-select></my-view-select>` }, // your own content
];
```

| Item option | Default | Description |
| ----------- | ------- | ----------- |
| `name` | — | A built-in item. It shows only when its feature is on (a console warning tells you when it doesn't). |
| `location` | `'end'` (`groupPanel`: `'start'`) | Side of the bar. |
| `locateInMenu` | `'auto'` for built-in buttons, `'never'` for yours | `auto`: moves to the "More actions" menu when it does not fit (the last ones first); `always`: always there. The group panel, the search panel and `renderer` items never move. |
| `showText` | `'always'` (`columnChooserButton`, `exportButton`: `'in-menu'`) | `'in-menu'`: only the icon on the bar (the text becomes its accessible name and tooltip). |
| `disabled` | `false` | Shown and focusable, but does nothing (`aria-disabled`; the whole button at 38% opacity). Not for `renderer` items. |
| `text` | — | Your button's label (required; also the menu text). On a built-in, replaces the translated label. |
| `icon` | — | Your button's icon (decorative: `aria-hidden`). |
| `action` | — | `({ toolbarItem, grid }) => void`, from the bar or the "More actions" menu. |
| `renderer` | — | `({ toolbarItem, grid, signal }) => GridRenderResult`: your own content (its own Tab stops, at the start or the end of the bar). |

`toolbarItems = null` (default) is the automatic bar; `[]` hides it (the editing status text still
shows). Replace the array instead of mutating it.

**Keyboard.** The bar is one `Tab` stop (`role="toolbar"`): `←`/`→` move between its buttons and
group chips (mirrored in RTL), `Home`/`End` go to the first/last one. The search field and
`renderer` content are separate `Tab` stops (they use the arrow keys themselves). Menu buttons
("More actions", Export) open with `Enter`, `Space` or `↓` (`↑` opens on the last item).

### Export button

```html
<u-grid export-formats="csv xlsx pdf"></u-grid>
```

```js
import { createXlsxExporter } from '@universal-material/data-grid/export-xlsx';
import { createPdfExporter } from '@universal-material/data-grid/export-pdf';

grid.xlsxExporter = createXlsxExporter({ fileName: 'orders.xlsx' });          // without it, no Excel entry
grid.pdfExporter = createPdfExporter({ fonts, fileName: 'orders.pdf' });     // without it, no PDF entry
grid.csvExportOptions = { fileName: 'orders.csv' };
```

The Export button lists "Export to CSV", "Export to Excel", "Export to PDF" and — with
`selection-mode` on — "Export selected rows to …" (disabled while nothing is selected); with a single
entry it is a plain button. The cancelable `u-grid-exporting` (`{ format, selectedOnly }`) fires first —
cancel it to export your own way — then `u-grid-export` or `u-grid-export-error`
(`{ format, selectedOnly, error }`). While an export runs, the menu gets a first **Cancel export** entry
(a single-format button becomes Cancel export) and the format entries are disabled; the button
description reads the progress when the exporter reports it
("Exporting… 40%", read on focus, not announced). Screen readers hear "Exporting…" after a second and
the result ("Exported to PDF", "Export canceled"); `cancelExport()` cancels by API, and removing the
grid aborts the export (the exporter gets an `AbortSignal`; a rejection with an `AbortError` is a
cancel, not an error). Other formats: add your own toolbar item that uses
[`getExportData()`](#export-data-excel-pdf-anything). The export methods do not fire these events.

### Context menus

Right-click, a long press (touch), `Shift+F10` or the context menu key opens the context menu of a
column header, the group panel (a chip or its empty area), a data row or a
group row. Column headers also have an always visible "⋮" button that opens their menu
(`show-column-header-menu-button="false"` hides it). Built-in items:

| Target | Built-in items (only those that apply) | Turned off by |
| ------ | -------------------------------------- | ------------- |
| `header` | Sort ascending / descending / Clear sorting (when sorted); **Pin column ▸** (`fixColumn`: Pin to start / end / Unpin, `column-fixing`); Auto-size column, Auto-size all columns (`autoSizeAllColumns`), Increase / Decrease width (`column-resizing`); Move left / right; Group by this column; Choose columns (`openColumnChooser`, with `column-chooser`), Reset columns (`resetColumns`) — in AG Grid's order | `column-header-menu="false"`; on one column `headerMenu: false` (keeps the drag alternatives, see below) |
| `group-panel` | Ungroup, Move left / right, Ungroup all, Expand / Collapse all groups | `group-panel-menu="false"` |
| `row` (cell ranges) | Copy selected cells, Paste, Extend selection to this cell, Add cell to selection (see below) | shown with `cell-selection-mode` (Paste: also needs `clipboard-mode="copy-paste"`), even without `row-menu`; without cell ranges, Paste only with `row-menu`. To keep the browser menu, remove them in `u-grid-context-menu-opening` |
| `row` | Copy (the cell), Copy selected rows, Export selected rows, Edit, Delete / Restore, Show / Hide details; tree data: Expand / Collapse (`expandNode`/`collapseNode`), Add child row (`addChildRow`, with `allow-adding`) | **off by default**: `row-menu` turns them on |
| `group-row` | Expand / Collapse group, Expand / Collapse all groups, Ungroup | `row-menu` (off by default) |

### Header menu of one column

`headerMenu: false` on a column (`header-menu="false"` on `<u-grid-column>`) removes its header
menu, for example on an actions column whose header shows only its title:

```js
grid.columns = [
  ...columns,
  { name: 'actions', label: 'Actions', fixed: 'end', sortable: false, groupable: false, resizable: false, headerMenu: false },
];
```

- No "⋮" and no built-in items from any opener (button, right-click, long press, Shift+F10, context
  menu key); the header no longer announces Shift+F10 or F2.
- The items that are the single-pointer alternative to a drag the column still allows stay (WCAG
  2.5.7): Auto-size column and Increase / Decrease width while it is resizable, Move left / right while
  it has a movable neighbor, Group by this column while it is groupable and there is a group panel to
  drag it to — with the "⋮" while there are
  any. Turn those drags off (`resizable`, `groupable`, a fixed or single column) to remove the menu
  entirely.
- `u-grid-context-menu-opening` still fires, so the host may add its own items (the menu opens by
  right-click, long press, Shift+F10 and the context menu key, without a "⋮"); without items the
  browser menu is kept.
- The other headers keep the grid-wide items (auto-size all, choose columns, reset columns).
- `true` and `null` (default) follow the grid's `column-header-menu`, which always wins. The group
  panel chip menu of the column is not affected.
- The header still needs a name for screen readers: a `label` (visible), or a `headerRenderer` with
  the text in a visually hidden element.
- With only host items, `aria-keyshortcuts` does not list `Shift+F10` (the grid cannot know about
  them before the event): mention the key in the column's help if that menu matters.


On a [full-width row](#full-width-rows-rowrenderer) the `row` menu has `cellType: 'full-width'` and
`column: null`: Copy copies the row (like `Ctrl+C`), there is no Edit, and Delete / Restore and
Show / Hide details stay — with `row-menu`, the way to restore a full-width row removed in `batch`
mode. [Fixed rows](#fixed-pinned-rows) have no context menu and fire no
`u-grid-context-menu-opening` (the browser's menu stays). `openContextMenu({ rowKey })` finds body
rows only.

Before any context menu opens, the cancelable `u-grid-context-menu-opening` fires — also with no
built-in item, so you can add menus anywhere (except fixed rows). Change `detail.menuItems` in place (synchronously):

```js
grid.addEventListener('u-grid-context-menu-opening', event => {
  const { target, item, column, menuItems } = event.detail;

  if (target === 'row') {
    menuItems.push({ id: 'open', text: 'Open order', separatorBefore: true, action: ({ item }) => openOrder(item) });
  }

  // Remove or reorder built-ins by `name`; put one back with `{ name: 'copyCell' }`.
  const sort = menuItems.findIndex(menuItem => menuItem.name === 'clearColumnSorting');
  if (sort >= 0) menuItems.splice(sort, 1);
});
```

`detail` is `{ target, cellType, column, item, rowKey, groupPath, grid, menuItems }`; the built-in
items come as `{ name, disabled, separatorBefore }` (their default state). The header's
`fixColumn` ("Pin column") is a submenu: it comes with `items` holding `fixColumnStart`,
`fixColumnEnd` and `unfixColumn`; reorder or remove them there, or move one to the top level, where
it is a plain item; your own items (with `action`) may go in it too. Only `fixColumn` has `items`
(other built-ins inside it, and `items` on other items, are ignored with a warning).
A menu item is `{ name?, id?, text?, disabled?, separatorBefore?, action?, items? }`: with `action` (and `text`) it is
yours — the action gets the same context plus `menuItem`, after the menu closed and the focus went
back to where it was opened (still within the user's gesture); with `name` it is a built-in
(`GridContextMenuItemName`, `text` optional). A built-in of another target, or one that does not
apply now, never acts. Canceled or empty, no menu opens and the browser menu stays. The browser
menu also stays with text selected in the grid, on editable fields and with Ctrl+right-click.

`openContextMenu({ rowKey, column? } | { column } | { groupPath }, anchor?)` opens the same menu
from your own control (e.g. a "⋯" button in a cell `renderer`), returning `false` when nothing
opened; `closeContextMenu()` closes it.

**Keyboard.** `↑`/`↓` (wrapping), `Home`/`End`, a letter goes to the next item starting with it,
`Enter`/`Space` run the item, `Esc` and `Tab` close it and give the focus back. On "Pin column",
`→`/`Enter`/`Space` open the submenu on its first item and `←`/`Esc` close it back to "Pin column"
(the arrows swap in RTL); `Tab` closes both. In the header menu, the focus follows the column after
"Move left/right", goes to the column chooser after "Choose columns" and back to the header after
the other items; pinning, "Auto-size all columns" and "Reset columns" are announced. When a "Copy" item
cannot write to the clipboard (permission denied), screen readers hear "Could not copy to the clipboard." On a cell,
`Shift+F10`/the menu key opens the row menu only when the focus is on the cell itself (inside an
editor or a control of the cell, the browser menu stays). After "Edit" the focus is in the editor;
after "Delete" in the confirmation dialog; after the other items, back where the menu was opened.

**Cell ranges in the menu.** On a data cell, with [cell ranges](#cell-ranges) on, the menu offers
`copySelectedCells` (with ranges), `paste` (with `clipboard-mode="copy-paste"` on an editable cell;
it reads the clipboard with the Clipboard API — the browser may ask for permission; if it cannot, the
grid announces it and the keyboard paste still works; it pastes into the active range when the cell
is in it, like `Ctrl+V`), `extendSelectionToCell` (the active range — or the
cell that was active before the menu opened — grows to this cell; same as `Shift`+click) and, in
`multiple`, `addCellToSelection` (same as `Ctrl`+click). They are the single-pointer alternative
to dragging (WCAG 2.5.7): right-click (on a Mac also Ctrl+click), or a long press on touch screens;
"Extend" starts from the cell that was active before the right-click. The focus goes to the new
corner after "Extend"/"Add", and back to the cell after "Copy"/"Paste".

### Copy by API

`copySelection()` copies like `Ctrl+C` (the cell ranges — wherever the active cell is —, else the
selected rows, else the active cell; `false` when the ranges exceed the cell limit, announced) through the asynchronous Clipboard API and resolves `true` when written. Call it within the
user's gesture (browsers require it). It fires `u-grid-copying` with `source: 'api'` and a
`DataTransfer` of the grid: cancel it and `setData` your own content, as with `Ctrl+C`.

---

## Templates & master-detail

Renderers customize the content of data cells, headers, group rows, the empty state and the detail
row. Every renderer may return:

- a Lit **`TemplateResult`** (`html\`…\``) — **recommended**: rendered directly inside the grid's
  shadow DOM, fast, and also rendered on the server (SSR). Event listeners (`@click=${…}`) work
  (use `ctx.grid` to reach the grid). Style it through the `part` names your template declares
  (`u-grid::part(app-badge)`), inherited properties and CSS custom properties. Unprefixed part
  names (`row`, `cell`, `expanded`…) belong to the grid — prefix yours (`app-…`);
- a **string** — always rendered as text, never parsed as HTML;
- an **`HTMLElement`** — placed in the grid's light DOM and projected into the cell by a slot:
  page styles apply, but it only renders in the browser (see the light DOM note below);
- `null`, `undefined` or Lit's `nothing` — empty content.

Return the same kind of result on the server and on the client (don't branch on
`typeof document`). A renderer that throws leaves its content empty and logs one `console.error`.

> **Security:** the grid does not sanitize what a renderer returns. Lit templates and strings bind
> row data as text — never use `unsafeHTML` with row data, nor assign it to `innerHTML`.

<a id="custom-cell-rendering"></a>

### Cell renderer

`renderer(item, ctx)` receives the row item and a context
(`GridCellRenderContext`: `item`, `value`, `text` — what the native cell would show —, `column`,
`rowKey`, `adaptive` — `true` in the row details of a column hidden by `autoHideColumns` —, `grid`
and `signal`).

```ts
import { html } from 'lit';

grid.columns = [
  { path: 'country', label: 'Country' },
  {
    path: 'population',
    label: 'Population',
    dataType: 'number',
    renderer: (item, { text }) => html`<span part="app-population">${text}</span>`,
  },
];
```

```css
u-grid::part(app-population) { font-variant-numeric: tabular-nums; }
```

A renderer is a pure function of the item and the column: it runs again when the item, the column
object or the language change and when the row comes back into the virtual window (so it may run
several times for the same item), never when selecting, focusing or sorting, nor when an item is
mutated in place (assign a new `items` array). The row index is deliberately not in the context: it
changes while scrolling and sorting.

**`ctx.signal`** is an `AbortSignal` aborted when the grid discards that content — the row leaves
the virtual window, the detail is collapsed, the column or renderer changes, or the grid is
disconnected. Use it to unmount framework roots you created:

```ts
renderer: (item, ctx) => {
  const host = document.createElement('div');
  const root = createRoot(host);                 // React, Vue's createApp, Angular's createComponent…
  root.render(<Badge item={item} />);
  ctx.signal.addEventListener('abort', () => root.unmount());
  return host;
},
```

> **Light DOM (`HTMLElement` results only):** to be slotted, each element lives in a
> `<div slot="…">` that the grid appends as a **child of `<u-grid>`** (next to your
> `<u-grid-column>` elements). Don't remove or reorder those nodes, and filter them out if you walk
> `grid.children`. Frameworks that render the grid's children (React, Vue, Angular templates with
> `<u-grid-column>`) leave unknown nodes alone, but don't let them re-create the whole children list
> on every render — prefer the `columns` property when columns are data-driven. Templates and
> strings add nothing to the light DOM.

With the declarative API, set the property on the element:

```ts
const col = document.querySelector('u-grid-column')!;
col.renderer = (item) => html`<b>${item.name}</b>`;
```

### Header, group row and empty state

- `headerRenderer(ctx)` (column) replaces the header label (`ctx`: `column`, `grid`, `signal`).
  The sort arrow, the header filter button and the resize handle stay; clicks and keys on
  interactive content of the template (buttons, links, inputs) do not sort. Set `label` too (with
  `<u-grid-column>`, keep the text content): the column chooser, group chips, the row details,
  announcements, filter labels and export use it, and one name per column keeps them consistent
  (WCAG 3.2.4). Without it the grid logs one `console.warn` per column and uses `path`, then
  `name`, as is. The header's accessible name comes from the rendered content, and so do the names
  of its "⋮" menu button, filter button and resize handle ("Options for {rendered text}"); an
  icon-only template needs its own text alternative (`aria-label` or visually hidden text).
  For a header that looks empty (an actions column), set `label: 'Actions'` and a `headerRenderer`
  that returns the label as visually hidden text; a column with neither `label` nor `path` (only
  `name` and `renderer`) keeps an empty header.
- `groupRenderer(ctx)` (column) replaces the label and count of the group rows of that column
  (`ctx`: `column`, `value`, `text` — the formatted value —, `groupPath`, `groupIndex`, `itemCount`,
  `expanded`, `firstItem` — the group's first row in the current order, `undefined` in remote
  groups without loaded rows —, `summaries` — the inline ones —, `defaultText` — the label the grid
  would show —, `grid`, `signal`). The expand button and the summaries aligned under columns stay.
- `noDataRenderer(ctx)` (grid) builds the empty state (`ctx.filtered` is `true` when a filter or
  the search hides every item).

```ts
grid.noDataRenderer = ({ filtered }) => filtered
  ? html`No rows match. <button @click=${() => grid.clearFilter()}>Clear filter</button>`
  : html`No orders yet.`;
```

### Master-detail

Set `detailRenderer(item, ctx)` (`ctx`: `item`, `rowKey`, `grid`, `signal`) to add a toggle column
at the start (after the group indents, before the selection checkboxes). An expanded row is followed
by a **full-width detail row** whose height is measured (and measured again when its content
grows), so details of any height scroll smoothly; with no detail open, scrolling costs the same as
without master-detail. A detail can hold anything — including another `<u-grid>`:

```ts
grid.detailRenderer = (order: Order) => html`
  <u-grid style="height: 240px" .columns=${lineColumns} .items=${order.lines}></u-grid>`;

grid.expandRow(orders[0]);           // by row key (without keyExpr, the item itself)
grid.collapseRow(orders[0]);
grid.isRowExpanded(orders[0]);       // false
```

- `auto-expand-rows` starts every row expanded (changing it resets the expansion state, without an
  event). Expansion is grid state, kept across sorting, filtering and new `items` (by key). A key
  that is not in the rows keeps its state — and is retained — until it is collapsed.
- `u-grid-row-expansion-change` (`{ rowKey, expanded, source }`) fires for the toggle button, the
  keyboard and `expandRow`/`collapseRow` (and, with `autoHideColumns`, a row edit and
  `focusCell`/`editCell` on a hidden column), not for `auto-expand-rows`.
- Without `detailRenderer` (and without [`autoHideColumns`](#responsive-columns-auto-hide)),
  `expandRow`/`collapseRow` do nothing and `isRowExpanded` is `false`. Returning `null` from it
  renders an empty detail row.
- **Keyboard:** `Enter`/`Space` on the toggle cell expands or collapses (`Space` does not select
  there; clicking the button keeps the focus on the cell); the detail row is one cell — `↑`/`↓` move into and out of it, `Enter`/`F2` move the focus
  into its content (the first focusable element, or a nested grid) and `Esc` returns to the cell.
  A nested grid keeps its own keyboard navigation: keys it handles never move the outer grid.
- **Accessibility:** the toggle is a `<button aria-expanded>` named "Row details" (`rowDetails` in
  `GridI18n`), and its cell carries the same `aria-expanded`; the detail row is labelled by its
  master row (`aria-labelledby`) and keeps the master's `aria-level` in a grouped grid. The detail
  content is kept within the visible width while scrolling horizontally. Interactive content of
  any renderer leaves the Tab order (one Tab stop per grid): `Enter`/`F2` on a cell, `F2` on a
  header or group row reach it, `Esc` comes back — except the empty state, which is not part of the
  navigation and stays reachable with `Tab`. Content added later (after an async fetch) is not
  taken out of the Tab order: render it with the data already loaded or set `tabindex="-1"`.
- **Nested grids:** a grid returned in a template lives in the outer grid's shadow DOM, so page CSS
  reaches it only through inheritance and `--u-grid-*` custom properties (return an `HTMLElement`
  to style it with page selectors). Their `u-grid-*` events bubble (`composed`) through the outer grid. Listen on
  the inner grid, or check `event.composedPath()[0] === grid`.
- Name each nested grid with `aria-label`, or `aria-labelledby` pointing to a heading in the same
  template (see [Accessibility](#accessibility)).
- Style with the `detail-toggle-cell`, `detail-toggle-button`, `detail-row`, `detail-cell` and
  `expanded` parts.

### Fixed (pinned) rows

`fixedTopItems` and `fixedBottomItems` (property only) are rows of **your own data** fixed below
the column headers and above the totals footer — targets, last year, averages, a custom total
(AG Grid calls them *pinned rows*). They use the grid columns, formatting, cell `renderer` and
`rowRenderer`, scroll horizontally with the columns (fixed columns stay fixed) and never scroll
vertically:

```ts
grid.fixedTopItems = [{ name: 'Target', amount: 50_000 }];
grid.fixedBottomItems = [{ name: 'Average', amount: average }];
```

- They stay out of sorting, filtering, the search (no highlight), grouping and paging (shown on
  every page), `getTotalCount()` and the summaries. They are not selectable nor editable (their
  checkbox and buttons cells are empty); they expand like body rows (detail and
  [hidden columns](#responsive-columns-auto-hide)), inside their row group, by row key — a key also
  in the body expands in both places. To fix an item of `items`, put the same object in
  `fixedTopItems` — it shows in both places.
- **Keyboard:** they are part of the row sequence — headers, top fixed rows, body, bottom fixed
  rows, totals. `PageUp`/`PageDown` move by the body page and never jump over a block (last body
  row → first bottom fixed row → totals). Moving among fixed rows doesn't scroll the body; a body
  cell is never left under them. `Enter`/`F2` reach a cell renderer's content.
- **Focus API:** `u-grid-focus-change` carries `rowFixed` (`'top' | 'bottom' | null`) and
  `previousRowFixed`; `focusedRowKey` is `null` on a fixed row; `focusCell(key, column, { rowFixed:
  'top' })` focuses one.
- **Export:** `getExportData()`/CSV include them (`fixed` on each data row; top rows before the
  body, bottom rows before the totals); `includeFixedRows: false` or `selectedOnly: true` leave them
  out. `Ctrl+C` on a fixed cell copies it.
- **Accessibility:** each side is a `rowgroup` named "Pinned rows at top"/"…at bottom"
  (`fixedTopRowsLabel`/`fixedBottomRowsLabel`); `aria-rowindex` follows the visual order. Few
  screen readers announce row group names, so let the row content say what it is ("Target",
  "Average"). Keep them few: when the headers, fixed rows and totals take more than half of the
  grid height (high zoom), the fixed rows stop sticking and scroll with the content.
- Style with the `fixed-row`, `fixed-top-row`, `fixed-bottom-row`, `fixed-top-row-group` and
  `fixed-bottom-row-group` parts and `--u-grid-fixed-row-background-color` /
  `--u-grid-fixed-row-shadow-color`.

### Full-width rows (`rowRenderer`)

`rowRenderer(item, ctx)` (`ctx`: `item`, `rowKey`, `fixed`, `grid`, `signal`) replaces the data
cells of a row with **one cell spanning the grid** — a card, a banner, a notice. Return `false` to
keep that row's columns:

```ts
grid.rowRenderer = (item: Order) => item.type === 'notice'
  && html`<div class="notice">${item.text}</div>`;   // false → normal row
// ✗ item.type === 'notice' ? html`…` : nothing   → EMPTY full-width rows for every other item
```

- `null`, `undefined`, `''` and `nothing` are an *empty* full-width row; only `false` keeps the
  columns. A renderer that throws keeps the columns (one `console.error`).
- It runs for every **rendered** data or fixed row (never for rows outside the virtual window, nor
  for group, summary, detail, skeleton or newly added rows): decide `false` first, cheaply,
  deterministically and without touching `document` (server and client must decide the same).
  The result — `false` included — is cached per row: it runs again when the item object, the
  function or the language change and when the row comes back to the window. Assign a new item or a
  new function to re-decide. `ctx.signal` aborts when the content is discarded, and right away when
  the renderer returns `false`.
- The group indents, the detail toggle and the selection checkbox stay as real cells before the
  full-width cell (select and expand as usual); the content is kept within the visible width while
  scrolling horizontally. The row height is the content height (at least `row-height`), measured
  like a detail row; the scrollbar uses `row-height` until a row is rendered.
- It is still a data row: selection (`Space`, click, `Shift`), `aria-selected`, striping,
  master-detail, `removeRow`, export (the column values — the template is only visual). It is not
  editable (`editCell`/`editRow` return `false`).
- **Keyboard:** the full-width cell is one cell (`cellType: 'full-width'`, `column: null` in
  `u-grid-focus-change`); `←`/`→` move between it and the leading cells, `↑`/`↓` keep the column of
  the rows around it, `Enter`/`F2` move into its content, `Tab` cycles there, `Esc` comes back.
  `Ctrl+C` on it copies the row.
- Style with the `full-width-row` and `full-width-cell` parts.

---

## State persistence

The grid keeps the user's choices — column order, width, visibility and fixing, grouping, sorting,
the filter and the search text, expanded groups, the page and page size, and (with `keyExpr`) the
selection and the expanded detail rows — and can save and restore them.

### Saving automatically

```html
<u-grid state-storage="local" state-storage-key="orders-grid" key-expr="id"></u-grid>
```

`state-storage="local"` (or `"session"`) reads the state from `localStorage` (`sessionStorage`)
when the grid connects, **before the first render of data** (no flash of the default layout), and
writes it `state-change-delay` ms (default `500`) after each change — and right away on disconnect
or `pagehide` when a save is pending. Or pass your own storage (server, IndexedDB…) as a property:

```ts
grid.stateStorage = {
  load: () => fetch('/api/grid-state').then(r => (r.ok ? r.json() : null)),
  save: state => fetch('/api/grid-state', { method: 'PUT', body: JSON.stringify(state) }),
};
```

While an asynchronous `load()` runs, the grid shows the load panel and no rows, and is `aria-busy`
(nothing to click or focus yet). A rejected or throwing `load()`, unreadable JSON or an invalid
state is ignored with a console warning and the grid starts from its initial state. Calling
`setState()` before the grid connects skips the read. Changing `stateStorage` or
`stateStorageKey` reads again.

| Property           | Attribute            | Type | Default | Description |
| ------------------ | -------------------- | ---- | ------- | ----------- |
| `stateStorage`     | `state-storage`      | `'local' \| 'session' \| GridStateStorage \| null` | `null` | Where the state is saved (an object only as a property). |
| `stateStorageKey`  | `state-storage-key`  | `string` | `''` | Key in `localStorage`/`sessionStorage` (required for them). |
| `stateChangeDelay` | `state-change-delay` | `number` | `500` | Delay (ms) of `u-grid-state-change` and of the save after the last change. |

### `getState()` / `setState()` / `resetState()`

```ts
const state = grid.getState();          // { version: 1, columns: [...], filterValue, ... }
localStorage.setItem('view', JSON.stringify(state));

grid.setState(JSON.parse(localStorage.getItem('view')!));
grid.setState({ version: 1, searchText: 'brazil' }, { partial: true }); // only the search changes
grid.resetState();                      // back to the column definitions and initial properties
```

- `getState()` returns a new, JSON-serializable object. It never holds row data: rows appear only
  by key, and only with `keyExpr` and string/number keys (without `keyExpr` the key is the item
  itself, so the selection and the detail rows are left out).
- Columns are identified by `name` (`GridColumnDef.name` / `<u-grid-column name>`), or by `path`
  without one. A column without either is left out of the state (console warning); give two
  columns with the same `path` different names. `filterValue` refers to columns by `path` (or by
  `name` for a computed column without `path`), like the property.
- With [bands](#bands-multi-level-headers), the order of the columns inside each band and of the
  bands themselves comes from the column order. A band with a `name` also keeps its own visibility
  and, at the top level, its fixed side (a band without `name` is left out silently); each column
  keeps its own visibility, so a column of a hidden band comes back as it was.
- `setState()` validates the state first; an invalid one is ignored with a warning. A state of an
  older version is migrated, an unknown version ignored. Unknown column names are ignored; columns
  missing from `columns` go back to their definition, at the end, in definition order. Only page
  sizes offered by `pageSizeOptions` (or the initial `pageSize`) are restored.
- Without `partial`, every top-level key missing from the state goes back to its **initial**
  value: the column definitions and the `filterValue`, `searchText`, `pageIndex`, `pageSize` and
  `selectedKeys` the host set before the grid connected. With `partial: true` only the keys
  present change (`columns`, when present, is the whole layout).
- Like the setters, `setState` fires none of the per-feature events (`u-grid-sort-change`…), only
  `u-grid-state-change`. It never moves the focus nor announces anything to screen readers: when a
  user gesture triggers it (a "Restore layout" button, saved views), announce the result yourself.
- Setting a property afterwards (`pageSize`, `filterValue`…) wins over the restored state: in
  frameworks, don't re-assign them on every render.

Grouped dates travel as ISO text and are matched back on `date`/`datetime` columns; group values
that are other objects are left out of `groupExpansion`.

### `u-grid-state-change`

Fires `state-change-delay` ms after the last change of any part of the state — user gesture,
method, property or `setState` — once per burst and only if the state really changed (a burst that
ends in the same state fires nothing). `detail.sources` lists where the changes came from
(`'user'`, `'api'`); a restore from `stateStorage` fires it with `['storage']` (the state is ready)
and is not saved back.

```ts
grid.addEventListener('u-grid-state-change', e => saveView(e.detail.state));
```

With server-side rendering and `stateStorage`, the server (which has no storage) renders the
"loading state" panel instead of the default layout; the client hydrates it and restores the
state in the next render.
## Editing

Cells are edited in place, rows are added and deleted, and values are validated — but the grid
**never mutates your items or your array**. It keeps the pending changes by row key and hands them
to you in `u-grid-saving`; once saved, it applies them to a copy of `items` (or to the data source
with `applyChanges`).

```html
<u-grid key-expr="id" allow-editing allow-adding allow-removing edit-mode="batch"></u-grid>
```

```ts
grid.columns = [
  { path: 'id', label: 'Id', editable: false },
  { path: 'name', label: 'Name', validationRules: [{ type: 'required' }, { type: 'stringLength', max: 40 }] },
  { path: 'email', label: 'E-mail', validationRules: [{ type: 'email' }] },
  { path: 'price', label: 'Price', dataType: 'number', validationRules: [{ type: 'range', min: 0 }] },
  { path: 'shipped', label: 'Shipped', dataType: 'date' },
  { path: 'active', label: 'Active', dataType: 'boolean' },
];

grid.addEventListener('u-grid-saving', event => {
  // Save on the server; the grid waits. Reject to keep the changes pending.
  event.detail.waitUntil(api.save(event.detail.changes));
});

grid.addEventListener('u-grid-save', event => {
  // With `items`: the new array the grid now shows (your array is untouched). Keep it in your state.
  state.items = event.detail.items;
});
```

### Modes

| `edit-mode` | How it works |
| ----------- | ------------ |
| `cell` (default) | One cell at a time. `Enter`, `Tab` or clicking elsewhere commits the value and **saves at once** (`u-grid-saving`). |
| `row` | A row opens whole (Edit button, `Enter`/`F2`, `editRow()`), with **Save** and **Cancel** buttons in the row. |
| `batch` | Changes stay pending — edited cells are marked (tint + corner mark), new rows are tinted, deleted rows are struck through with a **Restore** button — until **Save changes** (toolbar) or `saveChanges()`; **Discard changes** drops them. |

`allow-editing` turns on editing (columns with `path` or `valueSetter` are editable unless
`editable: false`); `allow-adding` shows the **Add row** button (the new row appears at the top of
the visible rows, its first editable cell open); `allow-removing` adds a **Delete** button to each
row, in a last "Actions" column. `allowEditing` and `allowRemoving` also take a function
`(item) => boolean` (property only) to decide per row. Deleting asks for confirmation in an
accessible dialog (`confirm-remove="false"` skips it; `batch` mode never asks, the removal is
pending). `edit-trigger="dblclick"` opens editors with a double-click instead of a click.

With `dataSource`, editing needs `keyExpr` (a console error turns it off otherwise). Pending
changes are kept by key: they survive scrolling (an open editor stays in the DOM while scrolled
away), sorting, filtering and new `items` with the same keys; changes of keys no longer present are
dropped with `u-grid-edit-cancel` (`source: 'api'`). Pending changes are data, not layout: they are never part of
`getState()`; `setState()`/`resetState()` with an editor open close it and keep what was typed as a
pending change.

### Editors

| Data type | Built-in editor |
| --------- | --------------- |
| `string` | `<input type="text">` |
| `number` | `<input inputmode="decimal">` with the decimal separator of the grid's `language` (`1234,5` in `pt`); text that is not a number is a validation error. |
| `date` / `datetime` | `<input type="date">` / `<input type="datetime-local">`; the value keeps the type of the original (`Date`, ISO string or timestamp). |
| `boolean` | A 24×24 checkbox: `Enter`/`F2` focuses it, `Space` toggles, a click toggles and commits. |

Your own editor: `editorRenderer(item, ctx)` returns a template, text or element (like the cell
`renderer`). `item` is the original row; `ctx` has `value` (pending), `data` (the pending change of
the row), `setValue(value)`, `commit()`, `cancel()`, `column`, `rowKey`, `label` (use it as
`aria-label`), `adaptive` (`true` in the row details of a column hidden by `autoHideColumns`), `invalid`, `errorMessage`, `describedBy`, `signal` and `grid`. The grid handles
`Enter`, `Tab` and `Esc` unless your editor calls `preventDefault()` on the `keydown` (a combobox
that uses `Enter`). `describedBy` is the id of the error text, for editors rendered as templates
(the grid's shadow root); for an `HTMLElement` editor the grid sets `aria-label`, `aria-invalid` and
`aria-describedby` itself when they are missing (adding to an `aria-describedby` you set). The
renderer runs when the editor opens and again when the validity changes — keep the value with
`setValue`.

```ts
{
  path: 'status',
  label: 'Status',
  editorRenderer: (item, ctx) => html`
    <select aria-label=${ctx.label} aria-describedby=${ctx.describedBy || nothing}
      @change=${(e: Event) => ctx.setValue((e.target as HTMLSelectElement).value)}>
      ${['Open', 'Closed'].map(s => html`<option ?selected=${s === ctx.value}>${s}</option>`)}
    </select>`,
}
```

`valueSetter(data, value, item)` writes an edited value into the pending change (default: sets
`path`; dots create nested objects) — use it to edit computed columns or several fields at once.

### Validation

`validationRules` run when a value is committed and, for new rows, on every column before saving.
One message per cell (the first rule that fails); empty values only fail `required`.

| Rule | Options |
| ---- | ------- |
| `{ type: 'required' }` | `trim` (default `true`: spaces only count as empty) |
| `{ type: 'range' }` | `min`, `max` (numbers or dates, inclusive) |
| `{ type: 'stringLength' }` | `min`, `max` |
| `{ type: 'pattern' }` | `pattern`: a `RegExp`, or a string matched against the whole value like the HTML `pattern` attribute |
| `{ type: 'email' }` | the rule of `<input type="email">` |
| `{ type: 'custom' }` | `validate(ctx, signal)` returns `true`, `false`, an error text or a promise of it (server check) |

Every rule takes `message` (default: the grid's translation). `ctx` is
`{ value, item, data, column, rowKey }`. An asynchronous rule shows "Validating…"; `Enter`/`Tab`
wait for its answer, and typing again aborts it (`signal`) — a late answer to an old value is
ignored. An invalid cell gets an error border, `aria-invalid` and a visible message below it
(above it on the last row) linked by `aria-describedby`; while its editor is open (`cell`/`row`),
`Enter` and `Tab` stay and `Esc` cancels. In `batch` mode invalid values stay pending, marked.

Before saving, `u-grid-row-validating` fires for each added or edited row with the broken rules in
`errors`; `detail.setError(message, column?)` (or `preventDefault()`) marks the row invalid —
cross-field checks. Saving is then blocked: the toolbar shows "Rows with errors: n" and the focus
goes to the first invalid cell.

### Saving

`u-grid-saving` carries `changes: GridEditChange[]`:

```ts
interface GridEditChange<TItem = any> {
  type: 'add' | 'update' | 'remove';
  rowKey: unknown;        // a new row has an opaque provisional key
  data?: Partial<TItem>;  // add: the new item; update: only the edited fields
  item?: TItem;           // the original item (update, remove)
}
```

`detail.waitUntil(promise)` makes the grid wait (only during the dispatch; several calls wait for
all; the first promise that resolves with an object wins). Rejected: `u-grid-save-error` fires, the changes stay pending and the toolbar shows "Could not
save the changes." with the error text. Resolved with `GridDataChanges` (`{ add, update, remove }`,
e.g. new rows with the ids the server created): the grid applies those instead of the ones it
computed. `preventDefault()` cancels the save (changes stay pending). After saving, `u-grid-save`
fires with `items` (the new array, `null` with `dataSource`); edited rows keep their position (no
re-sorting or re-filtering, like `applyChanges`) and new rows go to the end. Focus and selection on
a new row move to its real key.

### Editing API

```ts
grid.editCell(rowKey, column);     // open a cell editor (row mode: the row) — false if not possible
grid.editRow(rowKey);              // row mode only
grid.addRow({ status: 'Open' });   // returns the provisional key (null when not added)
await grid.removeRow(rowKey);      // cell/row: saved at once; batch: marked. Never asks.
grid.restoreRow(rowKey);           // batch: undo a removal
await grid.saveChanges();          // commit the editor, validate and save everything pending
grid.discardChanges();             // close the editor and drop every pending change
grid.hasChanges();                 // pending changes (or a changed open editor)
grid.getChanges();                 // GridEditChange[] (copies)
```

| Event | `detail` | Description |
| ----- | -------- | ----------- |
| `u-grid-edit-starting` | `{ rowKey, item, column, source }` | Before an editor (or a row) opens. Cancelable. |
| `u-grid-row-adding` | `{ data, source }` | Before a row is added: fill `detail.data` with initial values. Cancelable. |
| `u-grid-row-removing` | `{ rowKey, item, source }` | Before a row is deleted or marked (before the confirmation). Cancelable: `preventDefault()` + `removeRow(key)` for your own dialog. |
| `u-grid-row-validating` | `{ rowKey, item, change, errors, setError(), source }` | Before saving each added or edited row. Cancelable. |
| `u-grid-saving` | `{ changes, waitUntil(), source }` | Before saving. Cancelable. |
| `u-grid-save` | `{ changes, items, source }` | Saved and applied. |
| `u-grid-save-error` | `{ changes, error, source }` | `waitUntil` rejected. |
| `u-grid-edit-cancel` | `{ changes, source }` | Pending changes were discarded (`Esc`, Cancel, Discard changes, `discardChanges()`, rows gone from new `items`). |

### Keyboard and screen readers

| Key | Action |
| --- | ------ |
| `Enter` / `F2` on an editable cell | Open its editor (row mode: the whole row), focus in the editor. A click (`edit-trigger`) too. |
| `Enter` in an editor | Commit and go to the cell below (last row: stay). `Shift`+`Enter`: above. Row mode: save the row. |
| `Tab` / `Shift`+`Tab` in an editor | Commit and open the next / previous editable cell (skips read-only cells, group and detail rows, deleted rows; continues on the next row). At the ends, commit and stay on the cell. Row mode: cycle through the row's editors and its Save / Cancel buttons. |
| `Esc` in an editor | Cancel and return the focus to the cell (a new row in `cell`/`row` mode is removed and the focus goes back to **Add row**). |
| `Enter` / `F2` on the Actions cell | Into its buttons (`Tab` cycles, `Esc` back). |

Read-only data cells get `aria-readonly="true"` while editing is on. Edited cells, new rows and rows
marked for removal are described to screen readers ("Changed, not saved", "New row, not saved",
"Marked for removal"). Saving, discarding, deleting, restoring and errors are announced; "Saving…"
appears (and is announced) when saving takes more than a second. The delete dialog is a modal
`alertdialog` with the focus on **Cancel**; `Esc` returns the focus to the Delete button.

---

## Internationalization (i18n)

The grid renders a small set of built-in strings (empty state, grouping hint, group label
separator). Column labels are always provided by you and are never translated.

### The `language` property

```html
<u-grid language="pt"></u-grid>
```
```ts
grid.language = 'ja';
```

When **not** set explicitly, the language is resolved in this order:

1. **Explicit** value on the component (`language` attribute/property)
2. **Lit context** default (see [`setGridLanguage`](#set-a-default-language-setgridlanguage))
3. **Document** — `<html lang>` or a `content-language` meta tag
4. **Browser** — `navigator.language`
5. Falls back to `en`

Region codes fall back to their base language (`pt-BR` → `pt`).

### Built-in languages

`en`, `es`, `pt`, `fr`, `de`, `it`, `nl`, `ru`, `pl`, `tr`, `ja`, `ko`, `zh`, `ar`.

### Set a default language (`setGridLanguage`)

Provides a default `language` to every grid in the subtree through Lit context (on `document.body`
by default). Call it once at startup:

```ts
import { setGridLanguage } from '@universal-material/data-grid';

setGridLanguage('pt');            // default for all grids
setGridLanguage('pt', myRootEl);  // scope the default to a subtree
```

An explicit `language` on a specific grid still wins over this default.

### Override or add translations (`setGridTranslation`)

Override any subset of strings for a language — or register a brand-new language / region:

```ts
import { setGridTranslation } from '@universal-material/data-grid';

// Override one string for an existing language
setGridTranslation('pt', { noData: 'Nenhum registro encontrado' });

// Add a region-specific or custom language
setGridTranslation('pt-BR', {
  noData: 'Nenhum registro',
  dragToGroup: 'Arraste uma coluna aqui para agrupar',
  groupLabelSeparator: ': ',
});
```

Missing keys keep their previous value, so a partial object is enough.

> Note: `setGridTranslation` updates the shared dictionary; already-rendered grids pick up the new
> strings on their next render. Call it before grids mount to affect the first paint.

### The `GridI18n` shape

```ts
interface GridI18n {
  noData: string;              // empty-state message
  dragToGroup: string;         // hint shown when nothing is grouped
  groupLabelSeparator: string; // between a group's column label and its value
  trueText: string;            // `true` in boolean columns
  falseText: string;           // `false` in boolean columns
  sortAscending: string;       // "ascending" — used in announcements and the group chip label
  sortDescending: string;      // "descending"
  sortClearedAnnouncement: string; // announcement after removing a column: "Sorting removed from {column}"
  sortedAnnouncement: string;  // announcement after sorting: "Sorted by {column}, {order}"
  columnChooser: string;       // column chooser button and title
  hideColumn: string;          // checkbox hint / drop-to-hide hint in the chooser
  showColumn: string;          // checkbox hint for a hidden column
  fixStart: string;            // "Pin column" submenu: "Pin to start"
  fixEnd: string;              // "Pin column" submenu: "Pin to end"
  unfix: string;               // "Pin column" submenu: "Unpin"
  autoSize: string;            // resize handle hint: "Double-click or press Enter to auto-size"
  summarySum: string;          // "Sum"
  summaryMin: string;          // "Min"
  summaryMax: string;          // "Max"
  summaryAvg: string;          // "Avg"
  summaryCount: string;        // "Count"
  summaryText: string;         // summary cell: "{type}: {value}"
  summaryColumnText: string;   // group row text / accessible label: "{type} of {column}: {value}"
  groupInfoText: string;       // count and inline summaries in the group row: "({info})"
  ungroupColumn: string;       // group panel menu: "Ungroup"
  ungroupAll: string;          // "Ungroup all"
  expandAllGroups: string;     // "Expand all groups"
  collapseAllGroups: string;   // "Collapse all groups"
  groupPanelMenuLabel: string; // accessible name of the group panel menu
  filterEquals: string;        // one key per operation: filterEquals, filterNotEquals, filterLessThan,
  // filterLessThanOrEqual, filterGreaterThan, filterGreaterThanOrEqual, filterContains,
  // filterNotContains, filterStartsWith, filterEndsWith, filterBetween, filterAnyOf,
  // filterNoneOf, filterIsBlank, filterIsNotBlank
  filterReset: string;         // last item of the operation menu
  filterEditorLabel: string;   // filter row editor name: "Filter {column}"
  filterOperationLabel: string; // operation menu name (the button uses filterOperationButtonLabel)
  headerFilterLabel: string;   // header filter button / popover name: "Filter options for {column}"
  filterBetweenStart: string;  // "From" (first `between` editor)
  filterBetweenEnd: string;    // "To"
  filterAll: string;           // "(All)" in the boolean filter row value menu
  filterBlanks: string;        // "(Blanks)" in the header filter
  filterClear: string;         // "Clear filter" in the header filter
  searchPlaceholder: string;   // "Search…" placeholder (names: searchPanelLabel, headerFilterSearchLabel)
  selectAll: string;           // "Select all"
  ok: string;
  cancel: string;
  filteredAnnouncement: string; // after a user filter: "Rows: {count}"
  selectRow: string;           // row checkbox label: "Select row"
  rowDetails: string;          // row details toggle button and column: "Row details"
  adaptiveColumnsAnnouncement: string;   // autoHideColumns: "Columns in row details: {columns}"
  noAdaptiveColumnsAnnouncement: string; // autoHideColumns: "All columns in the table"
  adaptiveColumnDescription: string;     // column chooser, hidden for lack of space: "In row details"
  adaptiveLabelSeparator: string;        // between label and value in the row details: ": "
  fixedTopRowsLabel: string;   // row group of fixedTopItems: "Pinned rows at top"
  fixedBottomRowsLabel: string; // row group of fixedBottomItems: "Pinned rows at bottom"
  selectAllRows: string;       // "select all" checkbox label: "Select all rows"
  rowsSelectedAnnouncement: string; // after a bulk selection: "Selected rows: {count}"
  rowsCopiedAnnouncement: string;   // after Ctrl+C: "Copied rows: {count}"
  cellCopiedAnnouncement: string;   // after Ctrl+C on a cell: "Cell copied"
  cellRangeSelectedAnnouncement: string;  // "Selected cells: {cells}. Rows: {rows}, columns: {columns}"
  cellRangesSelectedAnnouncement: string; // "Selected ranges: {count}. Cells: {cells}"
  addToSelectionOnAnnouncement: string;   // Shift+F8 on: "Adding to selection. Shift+F8 or Esc stops."
  addToSelectionOffAnnouncement: string;  // "Stopped adding to selection"
  addingToSelection: string;        // visible text while Shift+F8 is on: "Adding to selection"
  cellsCopiedAnnouncement: string;  // "Copied cells: {count}"
  cellsPastedAnnouncement: string;  // "Pasted cells: {count}"
  cellsSkippedAnnouncement: string; // after pasting with skipped cells: "Pasted cells: {count}. Skipped: {skipped}"
  copyLimitExceededAnnouncement: string;  // "Too many cells to copy: {count}. Limit: {max}"
  pasteLimitExceededAnnouncement: string; // "Too many cells to paste: {count}. Limit: {max}"
  rowsNotLoadedAnnouncement: string; // copy refused: rows of a remote source not loaded yet
  cellRangeSummaryLabel: string;    // name of the summary bar: "Selection summary"
  extendSelectionToCell: string;    // cell context menu: "Extend selection to this cell"
  addCellToSelection: string;       // cell context menu: "Add cell to selection"
  columnMovedAnnouncement: string;  // "{column} moved to position {position} of {count}"
  groupedAnnouncement: string;      // "Grouped by {column}"
  ungroupedAnnouncement: string;    // "Ungrouped {column}"
  columnHeaderMenuLabel: string;    // column header menu: "Options for {column}"
  groupColumn: string;              // "Group by this column"
  moveLeft: string;                 // "Move left" (physical side, also in RTL)
  moveRight: string;                // "Move right"
  autoSizeColumn: string;           // "Auto-size column"
  increaseColumnWidth: string;      // "Increase width"
  decreaseColumnWidth: string;      // "Decrease width"
  columnFiltered: string;           // header description: "Filtered"
  columnFixedStart: string;         // header description: "Pinned to start"
  columnFixedEnd: string;           // header description: "Pinned to end"
  columnSortPriority: string;       // header description: "Sorted {order}, priority {priority}"
  sortedWithPriorityAnnouncement: string; // "Sorted by {column}, {order}, priority {priority}"
  groupLevelChangedAnnouncement: string;  // "{column} moved to grouping level {level} of {count}"
  groupingClearedAnnouncement: string;    // "All columns ungrouped"
  groupsExpandedAnnouncement: string;     // "All groups expanded"
  groupsCollapsedAnnouncement: string;    // "All groups collapsed"
  columnResizedAnnouncement: string;      // "{column} width: {width} px"
  resizeHandleLabel: string;        // resize handle name: "Resize {column}"
  groupPanelLabel: string;          // group panel name: "Grouping"
  filterOperationButtonLabel: string; // "Filter operation for {column}: {operation}"
  searchPanelLabel: string;         // search panel name: "Search in the grid"
  headerFilterSearchLabel: string;  // header filter search name: "Search values"
  headerFilterTruncated: string;    // "Showing {shown} of {count}"
  headerFilterSearchAnnouncement: string;   // after searching the header filter: "Values: {count}"
  selectAllResults: string;         // header filter "select all" while searching: "Select all results ({count})"
  loading: string;             // load panel: "Loading…"
  loadError: string;           // error bar: "Could not load the data."
  retry: string;               // error bar button: "Retry"
  pageInfo: string;            // pager: "Page {page} of {pageCount} ({count} items)"
  pageInfoUnknownCount: string; // pager, total unknown: "Page {page}"
  pageSizeLabel: string;       // page size selector: "Rows per page"
  paginationLabel: string;     // pager name: "Pagination"
  firstPage: string;           // pager buttons: "First page", "Previous page", "Next page", "Last page"
  previousPage: string;
  nextPage: string;
  lastPage: string;
  // Editing: editRow, saveRow, removeRow, restoreRow, addRow, saveChanges, discardChanges,
  // commandColumn, confirmRemoveTitle, confirmRemoveMessage, addedRowDescription,
  // removedRowDescription, modifiedCellDescription, changesSavedAnnouncement,
  // changesDiscardedAnnouncement ({count}), rowRemovedAnnouncement, rowMarkedForRemovalAnnouncement,
  // rowRestoredAnnouncement, rowAddedAnnouncement, saveError, invalidRowsMessage ({count}),
  // saving, validating, validationEscapeHint, validationRequired, validationRange ({min}, {max}),
  // validationRangeMin, validationRangeMax, validationStringLength ({min}, {max}),
  // validationStringLengthMin, validationStringLengthMax, validationPattern, validationEmail,
  // validationNumber, validationDate, validationInvalid
  // Toolbar and menus: toolbarLabel, toolbarMoreButtonLabel, exportButtonLabel, exportCsv,
  // exportXlsx, exportSelectedCsv, exportSelectedXlsx, exportPdf, exportSelectedPdf, exportCancel,
  // exportingAnnouncement, exportProgress ({percent}), exportCompleteAnnouncement ({format}),
  // exportCanceledAnnouncement, exportErrorAnnouncement, copyCell, copySelectedRows,
  // copySelectedCells, paste, pasteFailedAnnouncement (cell ranges),
  // rowMenuLabel, groupRowMenuLabel ({value}), sortColumnAscending, sortColumnDescending,
  // clearColumnSorting, expandGroup, collapseGroup, expandRow, collapseRow, copyFailedAnnouncement
  // Tree data: expandNode, collapseNode, addChildRow, childRowsLoadingAnnouncement,
  // childRowsLoadedAnnouncement ({count}), childRowsLoadErrorAnnouncement, nodesExpandedAnnouncement ({count})
  // exports: exportDefaultTitle (PDF title, xlsx sheet name); PDF: pdfPageNumber ({page}, {pageCount}), pdfTotalRow
  fixColumn: string;           // header menu submenu: "Pin column"
  autoSizeAllColumns: string;  // header menu: "Auto-size all columns"
  openColumnChooser: string;   // header menu: "Choose columns"
  resetColumns: string;        // header menu: "Reset columns"
  columnChooserSearchLabel: string;        // chooser search name/placeholder: "Search columns"
  columnChooserSearchAnnouncement: string; // after searching the chooser: "Columns: {count}"
  selectAllColumns: string;    // chooser: "Show all columns"
  reorderColumnLabel: string;  // chooser checkbox description: "Alt+Shift+Up or Down arrow moves the column"
  columnFixedStartAnnouncement: string; // "{column} pinned to start"
  columnFixedEndAnnouncement: string;   // "{column} pinned to end"
  columnUnfixedAnnouncement: string;    // "{column} unpinned"
  allColumnsAutoSizedAnnouncement: string; // "All columns auto-sized"
  columnMoveRefusedAnnouncement: string;   // chooser, Alt+Shift+↑/↓ refused: "{column} can't move past {target}"
  columnsResetAnnouncement: string;        // after "Reset columns" in the header menu: "Columns reset"
}
```

`{column}`, `{order}`, `{count}`, `{position}`, `{priority}`, `{level}`, `{width}`, `{operation}`,
`{cells}`, `{rows}`, `{columns}`, `{max}`, `{skipped}`, `{shown}`, `{target}`, `{percent}`, `{format}`, `{page}` and
`{pageCount}` are placeholders filled by the grid (`{order}` with `sortAscending` /
`sortDescending`). The keys `clearSorting`, `pinStart`, `pinEnd`, `unpin`, `groupPanelMenu` and `pdfDefaultTitle` were renamed;
`setGridTranslation` still accepts them (with a console warning).

### SSR note

During server-side rendering there is no `document`/`navigator`, so the server resolves the
language from the Node process locale (or `en`). If you rely on `<html lang>` for the initial
paint, set the grid's `language` explicitly to avoid a mismatch on hydration.

---

## Appearance & behavior

| Property           | Attribute             | Type      | Default | Description |
| ------------------ | --------------------- | --------- | ------- | ----------- |
| `items`            | *(property only)*     | `any[]`   | `[]`    | Row data (never mutated). |
| `columns`          | *(property only)*     | `GridColumnDef[]` | `[]` | Column definitions (alternative to `<u-grid-column>`). |
| `language`         | `language`            | `string`  | *auto*  | i18n language. See [i18n](#internationalization-i18n). |
| `summary`          | *(property only)*     | `GridSummary \| null` | `null` | Totals and group summaries. See [Summaries](#summaries). |
| `autoExpandGroups` | `auto-expand-groups`  | `boolean` | `false` | Render groups expanded by default (initial default; changing it resets the expansion state). |
| `showGroupCount`   | `show-group-count`    | `boolean` | `true`  | Show the row count in group rows. |
| `groupPanelMenu`   | `group-panel-menu`    | `boolean` | `true`  | Built-in items of the group panel menu (ungroup, move, expand/collapse all). See [Context menus](#context-menus). |
| `columnHeaderMenu` | `column-header-menu`  | `boolean` | `true`  | Built-in items of the column header menu ("⋮" button, right-click, long press, Shift+F10): sort, pin ▸, auto-size (this / all), widen/narrow, move, group, choose/reset columns. The single-pointer alternative to dragging (WCAG 2.5.7). |
| `showColumnHeaderMenuButton` | `show-column-header-menu-button` | `boolean` | `true` | Always visible "⋮" button in the leaf headers with menu items (it takes width in the header; band menus open by right-click, long press, Shift+F10 or the context menu key). `"false"` hides it; the menu still opens by right-click, long press, Shift+F10 and the context menu key. |
| `columnFixing`     | `column-fixing`       | `boolean` | `true`  | "Pin column ▸" in the column header menu (pin to start/end, unpin). `"false"` removes it; `fixed` columns stay pinned. |
| `rowMenu`          | `row-menu`            | `boolean` | `false` | Built-in items of the row menu (copy, export selected, edit, delete, details; group rows: expand/collapse, ungroup). With `cell-selection-mode`, the cell menu also opens with the range items. |
| `toolbarItems`     | *(property only)*     | `readonly (GridToolbarItemName \| GridToolbarItem)[] \| null` | `null` | Items of the toolbar (`null`: `GRID_DEFAULT_TOOLBAR_ITEMS`; `[]`: no bar). See [Toolbar](#toolbar). |
| `exportFormats`    | `export-formats`      | `readonly GridExportFormat[]` | `[]` | Export UI formats (`'csv'`, `'xlsx'`, `'pdf'`; attribute `"csv xlsx pdf"`). See [Export button](#export-button). |
| `xlsxExporter`     | *(property only)*     | `GridExporter \| null` | `null` | Excel exporter of the export UI (`createXlsxExporter()`). |
| `pdfExporter`      | *(property only)*     | `GridExporter \| null` | `null` | PDF exporter of the export UI (`createPdfExporter({ fonts })`). See [PDF](#pdf-export-pdf). |
| `csvExportOptions` | *(property only)*     | `Omit<GridCsvDownloadOptions, 'selectedOnly' \| 'signal'> \| null` | `null` | Options of the CSV exported from the UI. |
| `sortMode`         | `sort-mode`           | `'none' \| 'single' \| 'multiple'` | `'single'` | How the user sorts by clicking headers. See [Sorting](#sorting). |
| `stateStorage`     | `state-storage`       | `'local' \| 'session' \| GridStateStorage \| null` | `null` | Save and restore the user state. See [State persistence](#state-persistence). |
| `stateStorageKey`  | `state-storage-key`   | `string`  | `''`    | Key in `localStorage`/`sessionStorage`. |
| `stateChangeDelay` | `state-change-delay`  | `number`  | `500`   | Delay (ms) of `u-grid-state-change` and of the save. |
| `rowHeight`        | `row-height`          | `number`  | `48`    | Row height in pixels (the cell padding fits inside it). Content taller than that — e.g. a 40px button with the default 13px block padding — makes the row grow; the virtualizer measures it. |
| `striped`          | `striped`             | `boolean` | `false` | Zebra striping on alternating rows. |
| `showGroupPanel`   | `show-group-panel`    | `boolean` | `true`  | Show the group panel in the toolbar (where columns are dropped to group). |
| `showColumnHeaders`| `show-column-headers` | `boolean` | `true`  | Show the column header row. |
| `showRowLines`     | `show-row-lines`      | `boolean` | `true`  | Horizontal row separators. |
| `showColumnLines`  | `show-column-lines`   | `boolean` | `false` | Vertical column separators. With bands, the header always has them; this option sets the body. |
| `columnResizing`   | `column-resizing`     | `boolean` | `false` | Let the user resize columns. See [Column features](#column-features). |
| `resizeMode`       | `resize-mode`         | `'widget' \| 'next-column'` | `'widget'` | How a resize affects the other columns. |
| `columnChooser`    | `column-chooser`      | `boolean` | `false` | Show the column chooser button (and "Choose columns" in the column header menu): search, show all, show/hide, reorder. See [Column chooser](#column-chooser). |
| `columnAutoWidth`  | `column-auto-width`   | `boolean` | `false` | Size columns without `width` to their content (the header label in one line, with its buttons). |
| `headerWrap`       | `header-wrap`         | `boolean` | `false` | Wrap the column header labels over several lines instead of an ellipsis (a column's `headerWrap` wins). Breaks only between words (hyphenation follows the `lang`); a word longer than the column ends in an ellipsis; `--u-grid-header-cell-max-lines` limits the lines; a cut default label shows the full text as a hover tooltip. The header row grows; if the bar and the headers take more than half of the visible height, the headers stop sticking. |
| `columnRenderingMode` | `column-rendering-mode` | `'auto' \| 'virtual' \| 'standard'` | `'auto'` | Column virtualization (`auto`: virtual with more than 50 leaf columns). See [Column virtualization](#column-virtualization). |
| `showFilterRow`    | `show-filter-row`     | `boolean` | `false` | Show the filter row. See [Filtering](#filtering). |
| `showSearchPanel`  | `show-search-panel`   | `boolean` | `false` | Show the search box in the bar above the table. |
| `headerFilter`     | `header-filter`       | `boolean` | `false` | Show the header filter button in filterable headers. |
| `filterValue`      | *(property only)*     | `GridFilterExpression \| null` | `null` | Column filter expression (read it for the current filter). |
| `searchText`       | `search-text`         | `string`  | `''`    | Search panel text. |
| `selectionMode`    | `selection-mode`      | `'none' \| 'single' \| 'multiple'` | `'none'` | Row selection. See [Selection & keyboard](#selection--keyboard). |
| `showCheckboxes`   | `show-checkboxes`     | `boolean` | `false` | Checkbox column with "select all" (`multiple` only). |
| `selectedKeys`     | *(property only)*     | `readonly unknown[]` | `[]` | Selected row keys (`keyExpr` values, or the items without it). Setting it fires no event. |
| `focusedRowKey`    | *(property only)*     | `unknown` | `null` | Key of the data row of the active cell (`null` in a header, group or fixed row; the setter only finds body rows). Setting it fires no event. |
| `keyExpr`          | `key-expr`            | `string \| (item) => GridRowKey \| null` | `null` | Row key. See [Row keys](#row-keys-keyexpr). |
| `dataSource`       | *(property only)*     | `GridDataSource \| null` | `null` | Data source (alternative to `items`). See [Data source](#data-source). |
| `remoteOperations` | `remote-operations`   | `boolean \| GridRemoteOperations` | `false` | What the server does (the attribute is all or nothing). |
| `reshapeOnChanges` | `reshape-on-changes` | `boolean` | `false` | `applyChanges` re-applies filter, sort, groups and summaries. See [Refreshing and incremental changes](#refreshing-and-incremental-changes). |
| `paging`           | `paging`              | `boolean` | `false` | Pages and the pager. See [Paging](#paging-and-infinite-scrolling). |
| `pageSize`         | `page-size`           | `number`  | `20`    | Rows per page; block size of a remote source. |
| `pageIndex`        | `page-index`          | `number`  | `0`     | Current page (0-based, clamped). Setting it fires no event. |
| `pageSizeOptions`  | `page-size-options`   | `readonly number[]` | `[10, 20, 50, 100]` | Page sizes of the pager (attribute: `"10, 20, 50"`; empty hides the selector). |
| `scrollMode`       | `scroll-mode`         | `'virtual' \| 'infinite'` | `'virtual'` | Infinite scrolling for a remote source. |
| `scrollContainer`  | `scroll-container`    | `string \| null` | `null` | Scroll with an outer container: the id of an ancestor, or `window`. See [Scrolling with the page or a parent](#scrolling-with-the-page-or-a-parent). |
| `scrollContainerElement` | *(property only)* | `HTMLElement \| Window \| null` | `null` | The outer scroll container by reference (wins over `scrollContainer`). |
| `scrollContainerAxis` | `scroll-container-axis` | `'block' \| 'both'` | `'block'` | With `scrollContainer`: `block` = the container scrolls vertically and the grid scrolls its columns sideways inside itself (columns without `width`: 150px); `both` = the container scrolls in both directions (0.4.x). Unknown values: `block` and a console warning. |
| `clipboardMode`    | `clipboard-mode`      | `'copy' \| 'copy-paste' \| 'none'` | `'copy'` | Ctrl+C copies the cell ranges, the selected rows or the focused cell; `copy-paste` also pastes with Ctrl+V (and the cell menu "Paste" with cell ranges or `row-menu`). See [Export & clipboard](#export--clipboard). |
| `cellSelectionMode` | `cell-selection-mode` | `'none' \| 'single' \| 'multiple'` | `'none'` | Cell ranges. Also opens the cell context menu with the range items, even without `row-menu`. See [Cell ranges](#cell-ranges). |
| `showCellRangeSummary` | `show-cell-range-summary` | `boolean` | `false` | Bar with the count, sum and average of the selected cells. |
| `noDataRenderer`   | *(property only)*     | `GridNoDataRenderer \| null` | `null` | Empty state content. See [Templates](#header-group-row-and-empty-state). |
| `loading`          | `loading`             | `boolean` | `false` | Show the grid as loading while you fetch `items`: with rows, the load panel covers them; with none, a "Loading…" row and placeholder rows replace the empty state. See **Loading local items** under [Data sources, keys & paging](#data-sources-keys--paging). |
| `detailRenderer`   | *(property only)*     | `GridDetailRenderer \| null` | `null` | Detail row content; adds the toggle column. See [Master-detail](#master-detail). |
| `autoExpandRows`   | `auto-expand-rows`    | `boolean` | `false` | Detail rows start expanded (initial default; changing it resets the expansion state). |
| `autoHideColumns`  | `auto-hide-columns`   | `boolean` | `false` | Hide columns by `hidingPriority` when the grid is too narrow; their values move to the row details. See [Responsive columns](#responsive-columns-auto-hide). |
| `treeMode`         | `tree-mode`           | `'none' \| 'nested' \| 'flat'` | `'none'` | Tree data; with `childrenExpr`, `parentKeyExpr`, `rootParentKey`, `hasChildrenExpr`, `treeColumn`, `treeFilterMode`, `autoExpandNodes`, `recursiveSelection`. See [Tree data](#tree-data). |
| `fixedTopItems`    | *(property only)*     | `readonly any[]` | `[]` | Rows fixed below the headers. See [Fixed rows](#fixed-pinned-rows). |
| `fixedBottomItems` | *(property only)*     | `readonly any[]` | `[]` | Rows fixed above the totals footer. |
| `rowRenderer`      | *(property only)*     | `GridRowRenderer \| null` | `null` | Full-width row content (`false` keeps the columns). See [Full-width rows](#full-width-rows-rowrenderer). |
| `editMode`         | `edit-mode`           | `'cell' \| 'row' \| 'batch'` | `'cell'` | How rows are edited. See [Editing](#editing). |
| `allowEditing`     | `allow-editing`       | `boolean \| (item) => boolean` | `false` | Let the user edit cells (the function: property only). |
| `allowAdding`      | `allow-adding`        | `boolean` | `false` | "Add row" button and `addRow()`. |
| `allowRemoving`    | `allow-removing`      | `boolean \| (item) => boolean` | `false` | Delete button per row and `removeRow()` (the function: property only). |
| `editTrigger`      | `edit-trigger`        | `'click' \| 'dblclick'` | `'click'` | Pointer gesture that opens a cell editor (`Enter`/`F2` always do). |
| `confirmRemove`    | `confirm-remove`      | `boolean` | `true`  | Ask before deleting with the Delete button (not in `batch` mode nor with `removeRow()`). |

```html
<u-grid striped show-column-lines show-group-panel="false" row-height="40" language="fr"></u-grid>
```

> Boolean attributes: absent = the default, present = `true`, `"false"` = `false`. So the options
> that default to `true` turn off with `show-group-panel="false"`, `show-row-lines="false"`, etc.

Deprecated names still work, with a console warning once per grid — see
[Deprecated names](#deprecated-names).

---

## Theming

The grid is themed with CSS custom properties (set them on `u-grid` or an ancestor). It also reads
`@universal-material` design tokens (`--u-color-*`, typography tokens, …) as fallbacks, so it
blends into that design system automatically when present.

On a dark page without those tokens, set `--u-grid-background-color` and `--u-grid-color` together:
the grid has its own text color (it no longer inherits the page's), and its grid lines and hover
tint derive from it.

### Common custom properties

| Property | Default | Description |
| -------- | ------- | ----------- |
| `--u-grid-background-color` | surface token | Grid background. |
| `--u-grid-color` | on-surface token | Text color of the grid (not inherited from the page). |
| `--u-grid-striped-background-color` | surface token | Background of even rows when `striped`. |
| `--u-grid-header-background-color` | grid background | Header / sticky background. |
| `--u-grid-row-hover-opacity` | state-layer token / `8%` | Tint of the data row and of the column/band header under the pointer (`0%` disables both). |
| `--u-grid-toolbar-height` | `56px` | Minimum height of the bar above the table (group panel, search, chooser button); it grows when its content wraps. |
| `--u-grid-toolbar-padding` | `8px 16px` | Bar padding (or `--u-grid-toolbar-block-padding` / `--u-grid-toolbar-inline-padding`). |
| `--u-grid-toolbar-gap` | `8px` | Space between the bar items and between its lines (a `gap` value: `8px` or `8px 12px`). A change at runtime applies at the next toolbar layout (resize or item change). |
| `--u-grid-header-cell-height` | `46px` | Minimum column header height (rows with `header-wrap` grow). |
| `--u-grid-header-cell-padding` | `13px 16px` | Header cell padding. |
| `--u-grid-header-cell-font-size` / `--u-grid-header-cell-font-weight` | `0.8125rem` / inherited | Header text. |
| `--u-grid-header-cell-max-lines` | `none` | With `header-wrap` (grid or column), maximum lines of the default header label: an ellipsis on the last line and the full text as a hover tooltip; the full label stays the header's accessible name. `headerRenderer` output is never clipped. A positive integer or `none`; invalid values mean no limit. Prefer 2 or more lines: from the keyboard the full label is read by widening the column (Alt+→) or auto-sizing it, so keep the header menu or resizing on. |
| `--u-grid-cell-padding` | `13px 16px` | Data cell padding (shorthand; wins over the longhands). `--u-grid-cell-block-padding` (`13px`) / `--u-grid-cell-inline-padding` (`16px`) set one axis of both data and header cells (unless `--u-grid-cell-padding` / `--u-grid-header-cell-padding` is set). |
| `--u-grid-cell-font-size` / `--u-grid-cell-font-weight` | `0.875rem` / inherited | Data cell text. |
| `--u-grid-line-opacity` | `20%` | Opacity of row/column lines (derived from the text color). |
| `--u-grid-line-width` | `1px` | Base line thickness. |
| `--u-grid-row-line-width` | line width | Row separator thickness. |
| `--u-grid-column-line-width` | line width | Column separator thickness. |
| `--u-grid-group-toggle-color` / `--u-grid-group-toggle-shape` | on-surface-variant token / `50%` | Group expand/collapse chevron (the color also applies to the chooser button). |
| `--u-grid-tree-indent` | `24px` | Indent of each tree level. |
| `--u-grid-tree-toggle-color` | `--u-grid-group-toggle-color` | Tree expand button. |
| `--u-grid-group-row-emphasis` | `80%` | Emphasis of group row text. |
| `--u-grid-group-chip-height` | `32px` | Group chip height. |
| `--u-grid-group-chip-padding` | `16px` | Group chip inline padding. |
| `--u-grid-group-chip-shape` | `8px` | Group chip corner radius. |
| `--u-grid-group-chip-outline-color` / `--u-grid-group-chip-outline-width` | outline token / `1px` | Group chip border. |
| `--u-grid-group-chip-font-size`, `-font-weight`, `-line-height`, `-letter-spacing` | label-large tokens | Group chip text. |
| `--u-grid-focus-ring-color` / `--u-grid-focus-ring-width` | primary token / `2px` | Keyboard focus ring. |
| `--u-grid-selected-row-background-color` | primary token at 12% | Background of selected rows. |
| `--u-grid-selected-row-indicator-color` | primary token | Bar at the start of selected rows (selection is not shown by color alone). |
| `--u-grid-selected-row-indicator-width` | `3px` | Thickness of that bar; `0` hides it. |
| `--u-grid-sorted-header-color` | text color | Text color of sorted column headers. |
| `--u-grid-sort-indicator-size` | `1.125em` | Size of the sort arrow. |
| `--u-grid-drop-indicator-color` | primary token | Drag-and-drop drop indicator color. |
| `--u-grid-drop-indicator-width` | `3px` | Drop indicator thickness. |
| `--u-grid-resize-handle-width` | `8px` | Width of the invisible column resize hit area at the end of each header cell (over the cell padding; the cursor changes on hover; also how far the header buttons reach into the end padding). Keyboard and the header menu (auto-size, wider/narrower) are the equivalent controls (WCAG 2.5.8). |
| `--u-grid-column-header-menu-button-size` | `24px` | Size of the header "⋮" menu button and of the header filter button (WCAG 2.5.8). They sit side by side with no gap, so below `24px` add spacing. |
| `--u-grid-resize-handle-color` | `--u-grid-drop-indicator-color` | Color of the separator shown at the column edge while dragging to resize. |
| `--u-grid-fixed-shadow-color` | shadow token | Shadow at the edge of fixed columns while scrolling. |
| `--u-grid-column-chooser-background-color` | surface-container token | Column chooser background. |
| `--u-grid-column-chooser-shape` | `12px` | Column chooser corner radius. |
| `--u-grid-summary-background-color` | header background | Background of the totals footer and group footers (opaque: the footer covers the rows). |
| `--u-grid-summary-cell-font-weight` | `500` | Font weight of summary cells. |
| `--u-grid-fixed-row-background-color` | header background | Background of the fixed rows (opaque: the body scrolls under them). |
| `--u-grid-fixed-row-shadow-color` | line color | Line between the fixed rows and the body. |
| `--u-grid-filter-row-height` | header cell height (`46px`) | Height of the filter row. |
| `--u-grid-search-highlight-background-color` / `--u-grid-search-highlight-color` | primary token at 24% / inherited | Search matches in cells. |
| `--u-grid-header-filter-button-active-color` | primary token | Funnel of a filtered column. |
| `--u-grid-header-filter-background-color` | surface-container token | Header filter popover background. |
| `--u-grid-header-filter-shape` | `12px` | Header filter popover corner radius. |
| `--u-grid-menu-background-color` | surface-container token | Background of the menus (context, "More actions", Export). |
| `--u-grid-menu-shape` | `4px` | Corner radius of the menus. |
| `--u-grid-load-panel-background-color` | surface-container-high token | Background of the load panel. |
| `--u-grid-skeleton-row-color` | text color at 12% | Placeholders of rows still loading. |
| `--u-grid-pager-height` | `56px` | Minimum height of the pager (it wraps on narrow grids; the rows take the rest). |
| `--u-grid-modified-cell-background-color` | primary token at 10% | Background of edited, unsaved cells (`batch`). |
| `--u-grid-modified-cell-indicator-color` | primary token | Corner mark of edited, unsaved cells (not shown by color alone). |
| `--u-grid-invalid-cell-color` | error token | Border and message accent of cells with a validation error. |
| `--u-grid-added-row-background-color` | primary token at 6% | Background of new, unsaved rows. |
| `--u-grid-removed-row-opacity` | `0.7` | Opacity of rows marked for removal (their text is also struck through). |
| `--u-grid-selected-cell-background-color` | primary token at 14% | Background of cells in a cell range. |
| `--u-grid-cell-range-border-color` / `--u-grid-cell-range-border-width` | primary token / `2px` | Outline around each cell range (keep 3:1 contrast with the background; `Highlight` in forced colors). |

```css
u-grid {
  height: 600px;
  --u-grid-toolbar-height: 48px;
  --u-grid-drop-indicator-color: #6750a4;
  --u-grid-cell-font-size: 0.8125rem;
}
```

The older names (`--u-table-*`, `--u-td-*`, `--u-th-*`, `--u-group-*`,
`--u-grid-header-height`, …) still work as fallbacks — see [Deprecated names](#deprecated-names).

### CSS `::part`s

| Part | Description |
| ---- | ----------- |
| `row` | Every body row (`<tr>`; not the header nor the totals footer). |
| `group-row` | Group header rows. |
| `odd` / `even` | Data rows, by parity (the first data row is `odd`; useful with striping). |
| `selected` | Selected data rows (with `row`) and data cells in a cell range (with `cell`): use `row selected` / `cell selected`. |
| `cell` | Data cells (`<td>`). |
| `selection-cell` | Cells and header of the checkbox column. |
| `selection-checkbox` | The selection checkboxes (rows and "select all"). |
| `no-data` | The cell rendered in the empty state, or the "Loading…" cell while `loading` has no rows. |
| `header-cell` | Column header cells (`<th>`), bands included. |
| `band-header-cell` | Band header cells (multi-level headers). |
| `sort-indicator` | The sort arrow (and priority number) in headers and group chips. |
| `group-chip` | Group chips in the grouping bar. |
| `column-chooser` | The column chooser popover. |
| `summary-row` | Rows with summaries: the totals footer and group footers. |
| `total-row` | The totals footer row. |
| `group-footer-row` | Group footer rows (summaries with `display: 'footer'`; with `summary-row` and `footer-row`). |
| `node-footer-row` | Tree node footer rows (`summary.node` with `display: 'footer'`; with `summary-row` and `footer-row`). |
| `footer-row` | Group and tree node footer rows together (the totals footer is `total-row`; `summary-row` covers all three). |
| `node-summary` | `summary.node` values with `display: 'inline'` after the tree cell text. A `column` value makes its cell a `summary-cell` too (like group rows). |
| `summary-cell` | Cells with summaries (footers and `display: 'column'` in group rows). |
| `group-count` | Count and inline summaries in a group row. |
| `toolbar` | The bar above the table. |
| `toolbar-button` | Toolbar buttons, built-in and yours (built-ins also have `add-row-button`, `save-button`, `discard-button`, `export-button` or `column-chooser-button`). |
| `toolbar-more-button` | The "More actions" button. |
| `menu` | Every menu (context menus and toolbar menus), with one of `column-header-menu`, `group-panel-menu`, `row-menu`, `toolbar-menu`. |
| `menu-item` / `menu-separator` | Menu items / separators. |
| `group-panel-menu` | The group panel context menu. |
| `column-header-menu` | The column header context menu (and its "Pin column" submenu). |
| `column-header-menu-button` | The "⋮" button that opens the column header menu. |
| `row-menu` | The context menu of data and group rows. |
| `toolbar-menu` | The "More actions" and Export menus. |
| `filter-row` | The filter row (`<tr>`). |
| `filter-cell` | Filter row cells. |
| `filter-editor` | Filter row editors: the inputs, and the value menu button of boolean columns. |
| `filter-operation-button` | The operation button of a filter row cell. |
| `search-input` | The search panel input. |
| `header-filter-button` | The funnel button in a header. |
| `header-filter` | The header filter popover. |
| `search-highlight` | Search matches (`<mark>`) in native cells. |
| `detail-toggle-cell` | Cells and header of the row details toggle column (master-detail and `autoHideColumns`). |
| `detail-toggle-button` | The expand/collapse button of a master row. |
| `detail-row` | Detail rows (with `row`). |
| `detail-cell` | The full-width cell of a detail row. |
| `adaptive-fields` | The list (`<dl>`) of the values of the columns hidden by `autoHideColumns`, in the detail cell. |
| `adaptive-field` | A label + value pair. |
| `adaptive-label` | The label (`<dt>`): band path, column label, sort and filter marks. |
| `adaptive-value` | The value (`<dd>`; also `modified`/`invalid`). |
| `fixed-row` | Fixed rows (with `row`, `odd`/`even`, and `fixed-top-row` or `fixed-bottom-row`; never `selected`). |
| `fixed-top-row` | Rows fixed at the top (with `fixed-row`). |
| `fixed-bottom-row` | Rows fixed at the bottom (with `fixed-row`). |
| `fixed-top-row-group` / `fixed-bottom-row-group` | The row group (`<tbody>`) of each side's fixed rows. |
| `full-width-row` | Rows rendered by `rowRenderer` (with `row`, `odd`/`even`, `selected`, `expanded`). |
| `full-width-cell` | The cell that holds the `rowRenderer` content. |
| `expanded` | Master rows whose detail is expanded, and expanded tree nodes (with `row`). |
| `tree-cell` | The cell of the tree column (with `cell`). |
| `tree-toggle-button` | The expand/collapse button of a tree node. |
| `pager` | The pager (`<nav>`) below the table. |
| `pager-button` | Pager buttons (first, previous, page numbers, next, last). |
| `page-size-select` | The page size `<select>`. |
| `page-info` | The "Page x of y (n items)" text. |
| `load-panel` | The load panel shown while a data source loads or `loading` is set (with rows). |
| `skeleton-row` | Rows of a remote source not loaded yet (with `row`), or placeholder rows while `loading` has no rows. |
| `error-row` | The bar shown when the data source failed. |
| `retry-button` | Its "Retry" button. |
| `modified` / `invalid` | Edited, unsaved data cells / cells with a validation error (with `cell` or `adaptive-value`). |
| `added` / `removed` | New, unsaved rows / rows marked for removal (with `row`). |
| `cell-editor` | The built-in cell editors (`<input>`). |
| `validation-message` | The validation error shown below an invalid cell or row details value. |
| `command-cell` / `command-button` | Cells and header of the row buttons column / the row buttons (edit, save, cancel, delete, restore). |
| `add-row-button`, `save-button`, `discard-button` | The toolbar buttons of editing. |
| `remove-dialog` | The delete confirmation dialog. |
| `cell-range-summary` | The bar below the grid with the cell range summary and the "Adding to selection" text. |

```css
u-grid::part(group-row) { font-weight: 600; }
u-grid::part(even) { background: #fafafa; }
u-grid::part(cell) { font-variant-numeric: tabular-nums; }
```

---

## Server-side rendering

The grid is SSR-friendly and works with `@lit-labs/ssr` + client hydration. Render the element on
the server and hydrate on the client with the Lit hydration support:

```ts
// client entry
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@universal-material/data-grid';
```

See [the i18n SSR note](#ssr-note) about language resolution during SSR. With `state-storage`,
the server renders the "loading state" panel and the client restores the saved state after
hydrating (see [State persistence](#state-persistence)).

---

## Using with frameworks

`<u-grid>` is a standard custom element. Set `items`, `columns` and `language` as **properties**
(they carry arrays/objects), toggle behavior with **attributes**, and listen to the `u-grid-*`
**events** (all `CustomEvent`s that bubble and are `composed`).

> **Import the package before the first render.** If a framework renders `<u-grid>` before the
> element is defined, it can't tell properties from attributes and may set `columns`/`items` as
> attributes (stringified). Import `@universal-material/data-grid` in your entry point.

**Angular** — add `CUSTOM_ELEMENTS_SCHEMA` and bind with property and event syntax:

```html
<u-grid [columns]="columns" [items]="items" [language]="lang" auto-expand-groups
        (u-grid-sort-change)="onSort($event)"></u-grid>
```

**React** (19+, which sets properties on custom elements and supports custom events):

```tsx
<u-grid columns={columns} items={items} sort-mode="multiple"
        onu-grid-sort-change={(e: CustomEvent<GridSortEventDetail>) => setSorting(e.detail.sorting)} />
```

For React < 19, assign `ref.current.columns` / `ref.current.items` and call
`ref.current.addEventListener('u-grid-sort-change', …)` in an effect.

**Vue**:

```html
<u-grid :columns.prop="columns" :items.prop="items" :language="lang"
        @u-grid-sort-change="onSort"></u-grid>
```

(Register `u-grid` as a custom element with your bundler/compiler options as needed.)

With [state persistence](#state-persistence), a property set after the grid connected wins over
the restored state: bind `pageSize`, `filterValue`, `searchText` or `selectedKeys` once (or keep
them in sync from `u-grid-state-change`) instead of re-assigning them on every render.

Renderers that return an `HTMLElement` add nodes to the grid's light DOM — see the
[light DOM note](#cell-renderer) before letting a framework manage the grid's children.

TypeScript users get typed events through `HTMLElementEventMap`
(`grid.addEventListener('u-grid-sort-change', e => e.detail.sorting)`), and
`document.querySelector('u-grid')` returns a `DataGrid`. The manifest at
`@universal-material/data-grid/custom-elements.json` describes every attribute, property, event,
CSS property and part for IDEs and tooling.

---

## API reference

### Elements

| Tag | Description |
| --- | ----------- |
| `<u-grid>` | The grid. Class: `DataGrid`. Properties and attributes in [Appearance & behavior](#appearance--behavior). |
| `<u-grid-column>` | Declarative column. Class: `DataGridColumn`. Attributes: `path`, `name`, `width`, `min-width`, `max-width`, `hiding-priority`, `group-index`, `type`, `alignment`, `boolean-display`, `true-text`, `false-text`, `wrap`, `header-wrap`, `empty-text`, `sortable`, `groupable`, `sort-order`, `sort-index`, `fixed`, `visible`, `resizable`, `show-in-chooser`, `header-menu`, `filterable`, `filter-operations`, `default-filter-operation`, `exportable`, `editable`; properties only: `format`, `valueGetter`, `displayValue`, `renderer`, `headerRenderer`, `groupRenderer`, `comparator`, `groupValueGetter`, `editorRenderer`, `validationRules`, `valueSetter`; label = text content. |

### `<u-grid>` methods

| Method | Description |
| ------ | ----------- |
| `sortColumn(column, order, { append })` | Sort by `column` (`'asc'`/`'desc'`; `null` removes it). `append: true` adds it to the current sort. |
| `clearSorting()` | Remove all sorting. |
| `getSorting()` | Current sort as `{ column, order }[]`, in priority order. |
| `groupColumn(column, targetIndex?)` | Group by `column` at level `targetIndex` (default: innermost); moves an already grouped column. |
| `ungroupColumn(column)` | Remove `column` from the grouping (it goes back to the end of its band, or of the regular columns at the top level). |
| `getGrouping()` | Grouped columns, outermost first. |
| `expandAllGroups(groupIndex?)` / `collapseAllGroups(groupIndex?)` | Expand / collapse every group of a level (every level without it), also groups that appear later. |
| `expandGroup(groupPath)` / `collapseGroup(groupPath)` | Expand / collapse one group (`['Brazil', 'SP']`). |
| `isGroupExpanded(groupPath)` | Whether a group is (or would be) expanded. |
| `getSummaryValues(groupPath?)` | Computed totals, or the summaries of a group: `{ item, value, text }[]`. |
| `getNodeSummaryValues(rowKey)` | The `summary.node` values of a tree node (empty for a leaf or a node not shown). |
| `expandNode(rowKey)` | `Promise<boolean>`: expand a tree node (loading its children from a `dataSource`); never rejects. See [Tree data](#tree-data). |
| `collapseNode(rowKey)` / `isNodeExpanded(rowKey)` | Collapse a tree node / whether it is shown expanded. |
| `expandAllNodes()` / `collapseAllNodes()` | Expand / collapse every tree node (remote: only the loaded ones). |
| `moveColumn(column, targetIndex)` | Reorder a column or a band to `targetIndex` among its siblings (same band or top level; kept inside its band and its fixed/regular block); ungroups a grouped column. |
| `setColumnWidth(column, px)` | Set a column width, clamped to `minWidth`/`maxWidth` (a band does nothing). |
| `autoSizeColumn(column)` | Fit a column to its content (header + rendered rows); for a band, each of its visible columns. |
| `autoSizeAllColumns()` | Fit every visible column to its content (`autoSizeColumn` on each). No events. |
| `resetColumns()` | Order, width, visibility and pinning back to the column definitions (a partial `setState` of the columns); sorting, filtering and grouping are kept. Fires only `u-grid-state-change`. |
| `openColumnChooser()` / `closeColumnChooser()` | Open / close the column chooser. |
| `clearFilter()` | Remove `filterValue` and `searchText` (fires `u-grid-filter-change`, `source: 'api'`). |
| `getCombinedFilter()` | `filterValue` `and` the search as one expression (copy), or `null`. |
| `selectRows(keys, { append })` | Select the rows of `keys` (replacing the selection unless `append`). |
| `deselectRows(keys)` | Deselect the rows of `keys`. |
| `selectAll()` / `deselectAll()` | Select / deselect every row that passes the filter (`multiple` only). |
| `clearSelection()` | Deselect every key. |
| `isRowSelected(key)` | Whether the row of `key` is selected. |
| `getSelectedItems()` | Selected items that are loaded (all of `items`; the loaded blocks of a remote source), in selection order. |
| `expandRow(rowKey)` / `collapseRow(rowKey)` | Expand / collapse the detail row of a row (master-detail, hidden columns; nothing without `detailRenderer` and `autoHideColumns`). |
| `isRowExpanded(rowKey)` | Whether the detail of a row is (or would be) expanded. |
| `getAdaptiveColumns()` | Columns hidden now for lack of space (`autoHideColumns`), in column order (a copy). |
| `refresh()` | Reload the data source (or recompute local data); resolves when done. |
| `applyChanges({ add, update, remove })` | Change loaded rows of `dataSource` by key without reloading everything. |
| `getTotalCount()` | Number of data rows (after the filter; the server total with remote paging; `-1` while unknown). |
| `focusCell(rowKey, column?, options?)` | Scroll to a cell and focus it (`column`: definition, `name` or `path`); `false` if the row or column is not shown (groups and tree nodes are not expanded, unless `{ expandAncestors: true }`: it expands the collapsed groups or nodes that contain the row, from the outer level in, with `source: 'api'` expansion events; nothing expands with a remote `dataSource`, for a filtered-out row or an invalid column); a column hidden by `autoHideColumns` opens the row details and focuses its value. `{ rowFixed: 'top' \| 'bottom' }` looks among the fixed rows. |
| `selectCellRange(range, { append })` | Select a range of data cells (`append`: add it, `multiple` only); `false` (nothing changes) when the mode is `none`, a column is not a visible data column, a row is not a data row of the displayed body, or the range is a single cell without `append` and another range. See [Cell ranges](#cell-ranges). |
| `getCellRanges()` / `clearCellRanges()` | The cell ranges (copies, frozen) / clear them. |
| `getCellRangeSummary({ signal })` | `Promise<GridCellRangeSummary>`: count, sum and average of the selected cells. |
| `getRowIndex(rowKey)` / `getRowKey(rowIndex)` | Index of a data row in the displayed body / key of the data row at an index. |
| `focus(options?)` | Focus the active cell. |
| `getExportData(options?)` | `Promise<GridExportData>`: the columns and rows the user sees. See [Export & clipboard](#export--clipboard). |
| `exportCsv(options?)` | `Promise<Blob>`: CSV of what the user sees. |
| `downloadCsv(options?)` | Build the CSV and download it (`fileName`, default `export.csv`). |
| `cancelExport()` | Cancel the export started from the export UI, if any ("Export canceled"; no `u-grid-export-error`). |
| `copySelection()` | `Promise<boolean>`: copy like Ctrl+C through the Clipboard API (call it within a user gesture). See [Copy by API](#copy-by-api). |
| `openContextMenu(target, anchor?)` / `closeContextMenu()` | Open the context menu of a row (`{ rowKey, column? }`), a header (`{ column }`) or a group row (`{ groupPath }`) / close it. See [Context menus](#context-menus). |
| `getState()` | The user state (`GridState`, JSON serializable, no row data). See [State persistence](#state-persistence). |
| `setState(state, { partial })` | Validate and apply a state; without `partial`, missing keys go back to the initial value. |
| `resetState()` | Put the state back to the initial one (column definitions and the properties set before connecting). |
| `editCell(rowKey, column)` / `editRow(rowKey)` | Open a cell editor (row mode: the row; `column`: definition, `name` or `path`; a column hidden by `autoHideColumns`: in the row details) / a row (`row` mode only). See [Editing](#editing). |
| `addRow(data?, { parentKey }?)` | Add a row at the top of the visible rows (tree: `parentKey` makes it the first child of that node); returns its provisional key (`null` when not added). |
| `removeRow(rowKey)` / `restoreRow(rowKey)` | Delete a row (saved at once; `batch`: marked) / restore a marked row. |
| `saveChanges()` / `discardChanges()` | Save every pending change (`Promise<boolean>`) / drop them. |
| `hasChanges()` / `getChanges()` | Whether there are pending changes / the pending changes (copies). |

### `<u-grid>` events

All bubble and are `composed`.

| Event | `detail` | Fired by API? | Description |
| ----- | -------- | ------------- | ----------- |
| `u-grid-sorting` | `GridSortEventDetail` | yes | Before the sort changes. Cancelable. |
| `u-grid-sort-change` | `GridSortEventDetail` | yes | After the sort changed. |
| `u-grid-group-change` | `GridGroupEventDetail` | yes | After the grouping changed. |
| `u-grid-group-expansion-change` | `GridGroupExpansionChangeEventDetail` | yes | After groups were expanded or collapsed (chevron, menu or API); only when the state changed. |
| `u-grid-filter-change` | `GridFilterEventDetail` | `clearFilter()` only | After the user filtered. Setting `filterValue`/`searchText` does not fire it. |
| `u-grid-column-resize` | `GridColumnResizeEventDetail` | no | The user finished resizing a column. See [Column events](#column-events). |
| `u-grid-column-visibility-change` | `GridColumnVisibilityChangeEventDetail` | no | The user showed/hid a column (or a band) in the chooser. |
| `u-grid-column-fixed-change` | `GridColumnFixedChangeEventDetail` | no | The user fixed/unfixed a column (or a top-level band) from the column header menu ("Pin column"). |
| `u-grid-column-reorder` | `GridColumnReorderEventDetail` | no | The user moved a column or a band (drag and drop on the header or in the column chooser, `Alt+Shift+←/→` on the header, `Alt+Shift+↑/↓` in the column chooser or the column header menu). |
| `u-grid-selection-change` | `GridSelectionChangeEventDetail` | yes (not the `selectedKeys` setter; also remote tree children checked under a checked parent) | The selection changed. |
| `u-grid-row-expansion-change` | `GridRowExpansionChangeEventDetail` | yes (not `auto-expand-rows`) | A detail row was expanded or collapsed (also by a row edit or `focusCell`/`editCell` on a hidden column). |
| `u-grid-node-expansion-change` | `GridNodeExpansionChangeEventDetail` | yes (not `auto-expand-nodes` nor a new filter) | A tree node was expanded or collapsed (fired when asked; again with `expanded: false` when its children fail to load). |
| `u-grid-adaptive-columns-change` | `GridAdaptiveColumnsChangeEventDetail` (`{ columns, previous }`) | layout (width, columns, `autoHideColumns`) | The columns hidden for lack of space changed (after the render). |
| `u-grid-focus-change` | `GridFocusChangeEventDetail` | yes (`focusCell`, `selectCellRange`, the active column hidden or back with `autoHideColumns`; not the `focusedRowKey` setter) | The active cell changed. |
| `u-grid-loading` | `GridLoadingEventDetail` (`{ options }`) | — (every load: scroll, sort, filter, `refresh()`…) | Before each `dataSource.load` call. Cancelable (the call is skipped). |
| `u-grid-load` | `GridLoadEventDetail` (`{ options, result }`) | — (every load) | A `load` call resolved (aborted calls fire nothing). |
| `u-grid-load-error` | `GridLoadErrorEventDetail` (`{ options, error }`) | — (every load) | A `load` call rejected; the error bar is shown. |
| `u-grid-page-change` | `GridPageChangeEventDetail` | corrections only (not the setters) | The page or page size changed (pager, `PageUp`/`PageDown`, new filter, clamp). |
| `u-grid-copying` | `GridCopyEventDetail` | `copySelection()` | Before Ctrl+C, the menu "Copy" items or `copySelection()` write to the clipboard. Cancelable. |
| `u-grid-pasting` | `GridPasteEventDetail` | no | Before Ctrl+V (or the cell menu "Paste") pastes into editable cells. Cancelable. |
| `u-grid-cell-range-change` | `GridCellRangeChangeEventDetail` | yes (also when the grid clears the ranges) | The cell ranges changed (a drag fires once, on release). |
| `u-grid-context-menu-opening` | `GridContextMenuOpeningEventDetail` | `openContextMenu()` | Before a context menu opens; change `menuItems` in place. Cancelable. |
| `u-grid-exporting` | `GridExportingEventDetail` (`{ format, selectedOnly }`) | no (UI only) | Before an export from the toolbar or the row menu. Cancelable. |
| `u-grid-export` | `GridExportEventDetail` | no (UI only) | That export finished. |
| `u-grid-export-error` | `GridExportErrorEventDetail` (`+ error`) | no (UI only) | That export failed (not fired when it is canceled). |
| `u-grid-state-change` | `GridStateChangeEventDetail` (`{ state, sources }`) | yes (also setters and `setState`) | `state-change-delay` ms after the last change of the state, once per burst, only if it really changed; after a restore from `stateStorage` with `sources: ['storage']`. |
| `u-grid-edit-starting` | `GridEditStartingEventDetail` | yes | Before an editor (or a row) opens. Cancelable. |
| `u-grid-row-adding` | `GridRowAddingEventDetail` | yes | Before a row is added (initial values in `data`). Cancelable. |
| `u-grid-row-removing` | `GridRowRemovingEventDetail` | yes | Before a row is deleted or marked for removal. Cancelable. |
| `u-grid-row-validating` | `GridRowValidatingEventDetail` | yes | Before saving each added or edited row. Cancelable. |
| `u-grid-saving` | `GridSavingEventDetail` | yes | Before saving; `waitUntil(promise)`. Cancelable. |
| `u-grid-save` | `GridSaveEventDetail` | yes | The changes were saved and applied. |
| `u-grid-save-error` | `GridSaveErrorEventDetail` | yes | The `waitUntil` promise rejected (changes stay pending). |
| `u-grid-edit-cancel` | `GridEditCancelEventDetail` | yes | Pending changes were discarded. |

The state-change events that also fire for API calls carry `source: 'user' | 'api'` in `detail`

### Exports

```ts
import {
  DataGrid,            // the <u-grid> class
  DataGridColumn,      // the <u-grid-column> class
  setGridLanguage,     // (language, host?) => void — default language via Lit context
  setGridTranslation,  // (language, GridI18nInput) => void — override/add strings
  gridLanguageContext, // Lit context key (advanced: custom providers)
  type GridColumnDef,       // GridColumnDef<TItem = any>
  type GridColumnDataType,  // 'string' | 'number' | 'date' | 'datetime' | 'boolean'
  type GridColumnAlignment, // 'start' | 'center' | 'end'
  type GridColumnBooleanDisplay, // 'text' | 'icon'
  type GridColumnFormat,    // Intl options or (value, item) => string
  type GridColumnFormatter, // (value, item) => string
  type GridColumnComparator, // (a, b, itemA, itemB) => number
  type GridColumnFixed,     // 'start' | 'end' | null
  type GridColumnRenderingMode, // 'auto' | 'virtual' | 'standard'
  type GridSort,            // { column, order }
  type GridSortOrder,       // 'asc' | 'desc'
  type GridSortMode,        // 'none' | 'single' | 'multiple'
  type GridResizeMode,      // 'widget' | 'next-column'
  type GridChangeSource,    // 'user' | 'api'
  type GridSelectionMode,   // 'none' | 'single' | 'multiple'
  type GridSelectionChangeEventDetail, // { selectedKeys, previous, added, removed, source }
  type GridCellType,        // 'header' | 'data' | 'selection' | 'group' | 'summary' | 'detail-toggle' | 'detail' | 'command' | 'full-width'
  type GridFocusChangeEventDetail, // { rowKey, column, cellType, previousRowKey, previousColumn, rowFixed, previousRowFixed, source }
  type GridSortEventDetail, // { sorting, previous, source }
  type GridGroupEventDetail, // { grouping, previous, source }
  type GridGroupExpansionChangeEventDetail, // { groupPath, groupIndex, expanded, source }
  type GridGroupPath,       // readonly unknown[] — group values from the outermost level
  type GridColumnRef,       // string (name, else path) | GridColumnDef
  type GridSummary,         // { total?: GridSummaryItem[]; group?: GridGroupSummaryItem[] }
  type GridSummaryItem,     // { column, type, label?, format?, name? }
  type GridGroupSummaryItem, // GridSummaryItem + display?: 'inline' | 'column' | 'footer'
  type GridSummaryType,     // 'sum' | 'min' | 'max' | 'avg' | 'count'
  type GridSummaryAggregator, // (values, items) => unknown
  type GridSummaryFormat,   // Intl options or (value) => string
  type GridSummaryValue,    // { item, value, text }
  type GridFilterOperation, // '=' | '<>' | '<' | ... | 'isblank' | 'isnotblank'
  type GridFilterCondition, // [field, operation, value?]
  type GridFilterExpression, // condition | ['!', expr] | (expr | 'and' | 'or')[]
  type GridFilterEventDetail, // { filterValue, previousFilterValue, searchText, previousSearchText, source }
  type GridColumnResizeEventDetail,
  type GridColumnVisibilityChangeEventDetail,
  type GridColumnFixedChangeEventDetail,
  type GridColumnReorderEventDetail,
  type GridRenderResult,    // TemplateResult | HTMLElement | string | nothing | null | undefined
  type GridCellRenderer,    // (item, GridCellRenderContext) => GridRenderResult
  type GridHeaderRenderer,  // (GridHeaderRenderContext) => GridRenderResult
  type GridGroupRenderer,   // (GridGroupRenderContext) => GridRenderResult
  type GridDetailRenderer,  // (item, GridDetailRenderContext) => GridRenderResult
  type GridNoDataRenderer,  // (GridNoDataRenderContext) => GridRenderResult
  type GridRenderContextBase, // { grid, signal } — shared by every context
  type GridCellRenderContext, // { item, value, text, column, rowKey, adaptive, grid, signal }
  type GridHeaderRenderContext, // { column, grid, signal }
  type GridGroupRenderContext, // { column, value, text, groupPath, groupIndex, itemCount, expanded, firstItem, summaries, defaultText, grid, signal }
  type GridDetailRenderContext, // { item, rowKey, grid, signal }
  type GridRowRenderer,     // (item, GridRowRenderContext) => GridRowRenderResult
  type GridRowRenderResult, // GridRenderResult | false (false = keep the row's columns)
  type GridRowRenderContext, // { item, rowKey, fixed, grid, signal }
  type GridRowFixed,        // 'top' | 'bottom' | null
  type GridNoDataRenderContext, // { filtered, grid, signal }
  type GridRowExpansionChangeEventDetail, // { rowKey, expanded, source }
  type GridAdaptiveColumnsChangeEventDetail, // { columns, previous }
  type GridTreeMode,        // 'none' | 'nested' | 'flat'
  type GridTreeFilterMode,  // 'with-ancestors' | 'full-branch' | 'match-only'
  type GridChildrenExpr,    // string | ((item) => item[] | null | undefined)
  type GridParentKeyExpr,   // string | ((item) => GridRowKey | null | undefined)
  type GridHasChildrenExpr, // string | ((item) => boolean)
  type GridNodeSummaryItem, // = GridGroupSummaryItem (summary.node)
  type GridNodeExpansionChangeEventDetail, // { rowKey, expanded, source }
  type GridAddRowOptions,   // { parentKey? }
  type GridFocusCellOptions, // { rowFixed?, expandAncestors? }
  type GridLoadTree,        // { parentKeys: (GridRowKey | null)[] | null } — GridLoadOptions.tree
  type GridRowKey,          // string | number
  type GridKeyExpr,         // string | ((item) => GridRowKey)
  type GridDataSource,      // { load(options, signal): Promise<GridLoadResult> }
  type GridLoadOptions,     // { skip?, take?, sort, filter, filterValue, searchText, group, groupPath, … }
  type GridLoadSort,        // { path, order }
  type GridLoadGroup,       // { path, order, expanded }
  type GridLoadSummary,     // { path, type, name? }
  type GridLoadResult,      // { data, totalCount?, groupCount?, summary? }
  type GridLoadGroupResult, // { key, count, items, summary? }
  type GridRemoteOperations, // { filtering?, sorting?, paging?, grouping?, summary? }
  type GridDataChanges,     // { add?, update?, remove? }
  type GridScrollMode,      // 'virtual' | 'infinite'
  type GridScrollContainerAxis, // 'block' | 'both'
  type GridLoadingEventDetail, // { options }
  type GridLoadEventDetail,  // { options, result }
  type GridLoadErrorEventDetail, // { options, error }
  type GridPageChangeEventDetail, // { pageIndex, previousPageIndex, pageSize, previousPageSize, source }
  type GridI18n,
  type GridI18nInput,       // Partial<GridI18n> that still accepts the deprecated keys
  type GridExportOptions,   // { selectedOnly?, includeGroups?, includeSummaries?, includeFixedRows?, signal? }
  type GridCsvOptions,      // + { separator?, bom?, includeHeaders?, escapeFormulas?, rawValues? }
  type GridCsvDownloadOptions, // + { fileName? }
  type GridExportData,      // { columns: GridExportColumn[]; rows: GridExportRow[] }
  type GridExportColumn,    // { column, label, dataType?, alignment, width? }
  type GridExportRow,       // GridExportDataRow | GridExportGroupRow | GridExportSummaryRow (by rowType)
  type GridExportDataRow,
  type GridExportGroupRow,
  type GridExportSummaryRow,
  type GridClipboardMode,   // 'copy' | 'copy-paste' | 'none'
  type GridCopyEventDetail, // { items, columns, ranges, text, html, clipboardData, source }
  type GridPasteEventDetail, // { text, values, range, clipboardData }
  type GridCellSelectionMode, // 'none' | 'single' | 'multiple'
  type GridCellRange,       // { startRowIndex, endRowIndex, startColumn, endColumn } (frozen)
  type GridCellRangeInit,   // the same with columns as GridColumnRef
  type GridCellRangeSummary, // { count, numericCount, sum, avg, complete }
  type GridCellRangeChangeEventDetail, // { ranges, previous, source }
  GRID_DEFAULT_TOOLBAR_ITEMS, // the automatic toolbar, in order
  type GridToolbarItemName, // 'groupPanel' | 'searchPanel' | 'columnChooserButton' | 'exportButton' | 'addRowButton' | 'saveButton' | 'discardButton'
  type GridToolbarItem,     // GridBuiltInToolbarItem | GridHostToolbarItem
  type GridBuiltInToolbarItem, // { name, location?, locateInMenu?, showText?, disabled?, text? }
  type GridHostToolbarItem, // GridToolbarButtonItem | GridToolbarContentItem
  type GridToolbarButtonItem, // { id?, text, icon?, action, location?, locateInMenu?, showText?, disabled? }
  type GridToolbarContentItem, // { id?, renderer, location? }
  type GridToolbarItemOptions, // { location?, locateInMenu?, showText?, disabled? }
  type GridToolbarItemActionContext, // { toolbarItem, grid }
  type GridToolbarItemRenderContext, // { toolbarItem, grid, signal }
  type GridToolbarItemRenderer, // (context) => GridRenderResult
  type GridExportFormat,    // 'csv' | 'xlsx' | 'pdf'
  type GridExporter,        // (grid, { selectedOnly, signal, onProgress? }) => Promise<void>
  type GridExportProgress,  // { rowCount, totalCount, pageCount }
  type GridExportCellStyle, // { bold?, italic?, color?, backgroundColor?, alignment? } (customizeCell of the PDF and xlsx)
  type GridExportLink,      // { url, description? } (cell.link of the PDF and xlsx)
  type GridExportingEventDetail, // { format, selectedOnly }
  type GridExportEventDetail,    // { format, selectedOnly }
  type GridExportErrorEventDetail, // { format, selectedOnly, error }
  type GridContextMenuTarget, // 'header' | 'group-panel' | 'row' | 'group-row'
  type GridContextMenuItem, // { name?, id?, text?, disabled?, separatorBefore?, action? }
  type GridContextMenuItemName, // the built-in items
  type GridContextMenuContext, // { target, cellType, column, item, rowKey, groupPath, grid }
  type GridContextMenuItemActionContext, // + { menuItem }
  type GridContextMenuOpeningEventDetail, // + { menuItems }
  type GridState,           // { version: 1, columns?, filterValue?, searchText?, groupExpansion?, selectedKeys?, rowExpansion?, nodeExpansion?, pageIndex?, pageSize? }
  type GridColumnState,     // { name, width?, visible?, fixed?, groupIndex?, sortOrder?, sortIndex? }
  type GridGroupExpansionState, // { all, levels, expanded: GridStateGroupPath[], collapsed: GridStateGroupPath[] }
  type GridRowExpansionState, // { expanded: GridRowKey[], collapsed: GridRowKey[] }
  type GridNodeExpansionState, // { all: boolean | null, expanded: GridRowKey[], collapsed: GridRowKey[] }
  type GridStateGroupPath,  // readonly (string | number | boolean | null)[]
  type GridStateStorage,    // { load(): GridState | null | Promise<…>; save(state): void | Promise<void> }
  type GridStateChangeSource, // 'user' | 'api' | 'storage'
  type GridStateChangeEventDetail, // { state, sources }
  type GridEditMode,        // 'cell' | 'row' | 'batch'
  type GridEditTrigger,     // 'click' | 'dblclick'
  type GridEditChange,      // { type: 'add' | 'update' | 'remove', rowKey, data?, item? }
  type GridValidationError, // { column, rule, message }
  type GridValidationRule,  // GridRequiredRule | GridRangeRule | GridStringLengthRule | GridPatternRule | GridEmailRule | GridCustomRule
  type GridValidationContext, // { value, item, data, column, rowKey }
  type GridEditorRenderer,  // (item, GridEditorRenderContext) => GridRenderResult
  type GridEditorRenderContext, // { item, value, data, column, rowKey, label, adaptive, invalid, errorMessage, describedBy, setValue, commit, cancel, grid, signal }
  type GridValueSetter,     // (data, value, item) => void
  type GridEditStartingEventDetail, // { rowKey, item, column, source }
  type GridRowAddingEventDetail,    // { data, source }
  type GridRowRemovingEventDetail,  // { rowKey, item, source }
  type GridRowValidatingEventDetail, // { rowKey, item, change, errors, setError, source }
  type GridSavingEventDetail,       // { changes, waitUntil, source }
  type GridSaveEventDetail,         // { changes, items, source }
  type GridSaveErrorEventDetail,    // { changes, error, source }
  type GridEditCancelEventDetail,   // { changes, source }
} from '@universal-material/data-grid';

import {
  exportXlsx,              // (grid, GridXlsxOptions?) => Promise<Blob>; deprecated: (grid, ExcelJS, GridXlsxExcelJSOptions?)
  downloadXlsx,            // (grid, GridXlsxDownloadOptions?) => Promise<void>; deprecated: (grid, ExcelJS, options?)
  createXlsxExporter,      // (GridXlsxExporterOptions?) => GridExporter — for grid.xlsxExporter; deprecated: (ExcelJS, options?)
  type GridXlsxOptions,    // GridExportOptions + { sheetName?, title?, language?, includeHeaders?, includeBands?, freezeHeader?, direction?, customizeCell?, onProgress?, worker?, assetsUrl? }
  type GridXlsxDownloadOptions, // + { fileName? }
  type GridXlsxExporterOptions, // GridXlsxDownloadOptions without selectedOnly and signal
  type GridXlsxCell,       // customizeCell argument: readonly rowType, row, column, band, columnIndex, columnSpan, headerRow, value; cellValue, text, numFmt, style, link
  type GridXlsxCellStyle,  // GridExportCellStyle + { wrap?, border? }
  type GridXlsxBorder,     // { color?, style?: 'thin' | 'medium' }
  type GridXlsxBorderSides, // { top?, bottom?, start?, end? }: boolean | GridXlsxBorder each
  type GridExportCellStyle, // { bold?, italic?, color?, backgroundColor?, alignment? } (shared with the PDF)
  type GridExportLink,     // { url, description? } (cell.link; shared with the PDF, description ignored in xlsx for now)
  type GridXlsxExcelJSOptions, // deprecated: options of the ExcelJS forms ({ sheetName?, includeHeaders?, customize? })
  type ExcelJSModule,      // the minimal ExcelJS shape the adapter needs ({ Workbook })
  type ExcelJSWorkbook,    // the part of an ExcelJS workbook it uses
  type ExcelJSWorksheet,   // the part of an ExcelJS worksheet it uses
  type ExcelJSRow,         // the part of an ExcelJS row it writes
  type ExcelJSCell,        // the part of an ExcelJS cell it writes
  type WorkbookOf,         // WorkbookOf<typeof ExcelJS>: the real workbook type (for `customize`)
  type WorksheetOf,        // WorksheetOf<typeof ExcelJS>: the real worksheet type
} from '@universal-material/data-grid/export-xlsx';

import {
  exportPdf,               // (grid | GridExportData, GridPdfOptions) => Promise<Blob>
  downloadPdf,             // (grid | GridExportData, GridPdfDownloadOptions) => Promise<void>
  createPdfExporter,       // (GridPdfExporterOptions) => GridExporter — for grid.pdfExporter
  GridPdfMissingGlyphError, // Error with codePoints: no font covers them
  type GridPdfOptions,     // GridExportOptions (no includeGroups) + { fonts, layout?, title?, language?, direction?, paperSize?, orientation?, autoHideColumns?, striped?, theme?, includePageNumbers?, bookmarks?, customizeCell?, onProgress?, worker?, assetsUrl? }
  type GridPdfDownloadOptions, // + { fileName? }
  type GridPdfExporterOptions, // GridPdfDownloadOptions without selectedOnly and signal
  type GridPdfFont,        // { source: ArrayBuffer | Uint8Array | string | URL; weight?; style? }
  type GridPdfLayout,      // 'table' | 'sections' | 'list'
  type GridPdfPaperSize,   // 'auto' | 'a4' | 'letter' | 'legal' | 'a3'
  type GridPdfOrientation, // 'auto' | 'portrait' | 'landscape'
  type GridPdfTheme,
  type GridPdfCell,        // customizeCell argument
  type GridPdfCellStyle,   // = GridExportCellStyle { bold?, italic?, color?, backgroundColor?, alignment? }
  type GridExportCellStyle,
  type GridPdfImage,       // { data, format: 'png' | 'jpeg', width, height, alt } (pt)
  type GridPdfLink,        // = GridExportLink { url, description? }
  type GridExportLink,
  type GridPdfProgress,    // = GridExportProgress
} from '@universal-material/data-grid/export-pdf';
```

### Next release (unreleased)

New: `headerMenu: false` on a column (`header-menu="false"`) removes its header menu — see "Header
menu of one column". The items that are the single-pointer alternative to a drag the column still
allows stay.

Fixed on Chrome and Edge 114 to 119: the header labels, the group rows and the muted texts were
invisible (`currentColor` inside `color-mix()` in a text color is transparent before Chromium 120),
and the icons were black squares (unprefixed `mask` is Chromium 120+). The README now lists the
minimum browser versions, tested on real browsers.

### 0.6.0

Excel export: `dateFormat: 'reader'` writes date columns with the built-in formats `14` (date) and
`22` (date and time), which Excel shows in the regional settings of whoever opens the file (the
default `'language'` keeps the order of the file language); `GridXlsxCell.numFmt` also takes the id of
a built-in date/time format (`cell.numFmt = 22`), so its type is now `string | number | null`.

### 0.5.1

`column-auto-width` no longer measures while the grid has no layout box (the grid or an ancestor
with `display: none`): columns without `width` kept the minimum width (40px) when the rows changed
while the grid was hidden; the measure now waits and runs when the grid is shown again. Widths the
user resized are kept.

### 0.5.0

**Breaking:** with `scroll-container`, the container now scrolls only vertically and the grid
scrolls its columns sideways inside itself (new `scrollContainerAxis` / `scroll-container-axis`,
default `block`): the grid keeps the width it is given instead of growing to the width of its
columns, so the page (or panel) no longer scrolls sideways; headers, body and totals scroll
together, with a horizontal scrollbar of the grid stuck to the bottom of the container. In this mode
a column without `width` is 150px (or its `column-auto-width` measure) instead of sized by its
content, and the headers, pinned rows, body and totals are separate tables in the shadow root, each
in its own `rowgroup` (`role="grid"` moves from the `<table>` to the element that holds them; CSS
that targeted the shadow `<table>`, `<thead>` or `<tbody>` is not supported, the `::part`s are
unchanged). To keep the 0.4.x behavior,
set `scroll-container-axis="both"`. Also: in RTL the grid's live region no longer pokes 1px past
the grid's edge (the page could scroll sideways by 1px); dragging a column that cannot be grouped
(`groupable: false`) over the group panel no longer shows the drop indicator; the toolbar keeps its
bottom line also without `show-column-lines`.

### Deprecated names

They still work and warn once per grid (or once per page for translation keys) in the console.
They will be removed in the next major version.

| Deprecated | Use instead |
| ---------- | ----------- |
| attributes `rowheight`, `showrowlines`, `showcolumnlines` | `row-height`, `show-row-lines`, `show-column-lines` |
| `sorting` / attribute `sorting`, type `GridSortingMode` | `sortMode` / `sort-mode`, `GridSortMode` |
| `stripped`, `showHeader` | `striped`, `showGroupPanel` |
| `exportXlsx(grid, ExcelJS, …)`, `downloadXlsx(grid, ExcelJS, …)`, `createXlsxExporter(ExcelJS, …)` (warn once per page), the type parameters of `GridXlsxOptions` and its `customize` | the same functions without ExcelJS, `customizeCell` |
| `sortBy()` | `sortColumn()` |
| `showColumnChooser()` | `openColumnChooser()` |
| `<u-grid-column data-type>` | `type` attribute |
| changing `groupIndex` of a rendered `<u-grid-column>` | `groupColumn()` / `ungroupColumn()` |
| `detail.fromIndex` / `detail.toIndex` of `u-grid-column-reorder` | `previousIndex` / `index` |
| type `UmDataGridColumn` | `DataGridColumn` |
| i18n keys `clearSorting`, `pinStart`, `pinEnd`, `unpin`, `groupPanelMenu` | `sortClearedAnnouncement`, `fixStart`, `fixEnd`, `unfix`, `groupPanelMenuLabel` |
| i18n key `pdfDefaultTitle` | `exportDefaultTitle` (the PDF and the xlsx share it) |
| i18n keys `fixStartLabel`, `fixEndLabel` — an exception: ignored (with the warning), since the chooser has no pin buttons | — (pin from the column header menu) |
| `--u-grid-header-height` (bar) | `--u-grid-toolbar-height` (the header cells use `--u-grid-header-cell-height`) |
| `--u-table-header-padding`, `-block-padding`, `-inline-padding` | `--u-grid-toolbar-padding`, `-block-padding`, `-inline-padding` |
| `--u-table-cell-padding`, `--u-grid-data-cell-padding` | `--u-grid-cell-padding` |
| `--u-table-cell-block-padding`, `--u-table-cell-inline-padding` | `--u-grid-cell-block-padding`, `--u-grid-cell-inline-padding` |
| `--u-td-font-size`, `--u-td-font-weight` | `--u-grid-cell-font-size`, `--u-grid-cell-font-weight` |
| `--u-th-font-size`, `--u-th-font-weight` | `--u-grid-header-cell-font-size`, `--u-grid-header-cell-font-weight` |
| `--u-table-hover-opacity` | `--u-grid-row-hover-opacity` |
| `--u-group-height`, `-outline-color`, `-outline-width`, `-shape`, `-padding` | `--u-grid-group-chip-height`, `-outline-color`, `-outline-width`, `-shape`, `-padding` |
| `--u-group-label-font-size`, `-font-weight`, `-line-height`, `-letter-spacing` | `--u-grid-group-chip-font-size`, `-font-weight`, `-line-height`, `-letter-spacing` |
| `--u-grid-stripped-background-color` | `--u-grid-striped-background-color` |
| `--u-grid-drop-indicator-bg` | `--u-grid-drop-indicator-color` |
| `--u-grid-borders-width`, `--u-grid-border-opacity` | `--u-grid-line-width`, `--u-grid-line-opacity` |
| `--u-grid-row-lines-height`, `--u-grid-column-lines-width` | `--u-grid-row-line-width`, `--u-grid-column-line-width` |
| `--u-grid-toggle-color`, `--u-grid-toggle-shape` | `--u-grid-group-toggle-color`, `--u-grid-group-toggle-shape` |
| `--u-grid-grouping-cell-emphasis` | `--u-grid-group-row-emphasis` |

When migrating CSS, remove the old names. The new cell padding longhands
(`--u-grid-cell-block-padding`, `--u-grid-cell-inline-padding`) win over the old cell shorthands
(`--u-table-cell-padding`, `--u-grid-data-cell-padding` — the Universal Material theme sets
`--u-table-cell-padding` on `:root`); the other axis then comes from its own longhand or the
default, not from the old shorthand. The old toolbar shorthand `--u-table-header-padding` still
wins over the new toolbar longhands.

Also changed (not deprecations): `::part(cell)` now matches every data cell (the empty-state cell
is only `::part(no-data)`); data rows and column headers get a hover tint
(`--u-grid-row-hover-opacity: 0%` turns it off); `items` is no longer read from an `items`
attribute; band labels default to `start` (set `alignment: 'center'` for the old look); the boolean
filter row editor is a menu button (`::part(filter-editor)` is a `<button>`, its menu uses
`menuitemradio`) instead of a native `<select>`; with every column width set, the last column
absorbs the leftover width.

In 0.4.2: with `scroll-container`, fixed columns, group labels, band labels, detail
and full-width rows and the toolbar stick at the container's `scroll-padding-inline-start/-end` and
at the grid's own edge when it sits inset in the container — they no longer slide by that inset at the
ends of a sideways scroll, nor hide under a fixed side menu, and scrolled content no longer shows in
the strip between the container's visible edge and them; `column-auto-width` reserves the sort
arrow (and, with `sort-mode="multiple"`, its priority number), so sorting no longer narrows and wraps
the label; leaf header labels and their buttons sit at the bottom of the header row also without
bands, so with `header-wrap` the buttons of every column line up with the last line of the labels;
the arrow of a menu item that opens a submenu is visible again; in the Excel export, the group label
sits at the start of the row, as on screen and like the band labels, instead of centered across it,
and each band label is merged across its columns (like the reference grids) instead of written in its
first column; with bands, every header cell has its vertical separator also without
`show-column-lines` (it now sets only the body), so the columns under a band are told apart.

In 0.4.1: in the Excel export, a total or group footer of your own aggregator that
shows only its value (no `label`, no `format` function) is a number or date cell with the column's
number format (it was text); a sheet name over 31 characters is cut at the last whole word with "…"
(it was cut mid-word).

In 0.4.0: Excel export without ExcelJS — `exportXlsx(grid, options)`,
`downloadXlsx` and `createXlsxExporter(options)` write the file in a WebAssembly engine in a Web
Worker, with `customizeCell` (per-cell values, formats, styles, links), progress and "Cancel export"
in the toolbar; the ExcelJS forms are deprecated. Visible changes of the new forms: band rows are
exported above the column labels (`includeBands`, default `true`: the data starts lower) and the
header rows are frozen (`freezeHeader`, default `true`); the default sheet name is the grid's
accessible name (else "Data", translated) instead of `Sheet1`; group labels are centered across the
row instead of merged, and the outline button sits on the group row; `fixed: 'start'` columns are frozen
(and named `RowTitle`, or `Title` with the header, for screen readers); typed cells keep the column
alignment, as on screen; link cells without a color of yours get the Excel link color. New self-contained
`export-xlsx.min.js` and `export-pdf.min.js` for pages without a bundler; the export workers are now
one file each. `GridPdfCellStyle` and `GridPdfLink` are now aliases of the shared `GridExportCellStyle` and
`GridExportLink`; the i18n key `pdfDefaultTitle` is renamed `exportDefaultTitle` (the old name still
works in `setGridTranslation`, with a warning).

In 0.3.8: the header filter shows a `=`/`<>` of one value on its own column
(an initial `filterValue`) as its selection — it listed only the matching values and couldn't widen
the filter.

In 0.3.7: with `autoHideColumns`, resizing a column while the grid has room no
longer hides it (dragging fixed the stretched width of the column taking the leftover, so the first
pixel overflowed); the hidden set also holds still during the drag and is recomputed on release.

In 0.3.6: when only fixed columns are shown (the others hidden by
`autoHideColumns`), the leftover width goes to the last one without a width of yours, not to an
actions column with `width` (it took the leftover).

In 0.3.5: with `column-auto-width`, a fixed column with a `width` (an actions
column) keeps it too; the leftover goes to the last non-fixed column (the browser spread it over
every column, the fixed one included).

In 0.3.4: with `autoHideColumns` and `scroll-container`, a grid inset in its
container (a padded wrapper) fits its own width again (the table took the container's visible width,
so too few or no columns were hidden); the leftover width of a grid whose columns all have a width
goes to the last non-fixed column (a fixed actions column kept growing); the `overflow-x` warning
also fires when the grid grows with its table (an `inline-block` wrapper) and the table passes the
container's visible edge.

In 0.3.3: with `header-wrap` and no `--u-grid-header-cell-max-lines`, a word longer than the column
ends in an ellipsis on its line again (it was cut mid-letter); with `autoHideColumns` and
`scroll-container`, the `overflow-x` warning waits until the columns are hidden (it fired before,
for a table that then fit); with `autoHideColumns`, when only fixed columns are left and the table
still doesn't fit, the widest fixed one shrinks (never below its `minWidth`) — e.g. a fixed name
column sized by `column-auto-width`; host content in the toolbar (`renderer` items) can shrink, so
its own `flex-wrap` works in a narrow grid. Published from CI with npm provenance.

In 0.3.2: `focusCell(rowKey, column, { expandAncestors: true })` expands the collapsed
groups or tree nodes that contain the row before focusing it (default `false`, as before); absolutely positioned parts inside the table (the screen reader text of
group rows) no longer escape the grid's scroll area — they made the grid and the page wider on
phones; the pager shows only its arrow buttons when the page number buttons don't fit (the page number
is in its text).

In 0.3.1: `header-wrap` breaks only between words (it used to split words at
any letter); a word longer than the column ends in an ellipsis, `--u-grid-header-cell-max-lines`
limits the lines, and a cut default header label shows its full text as a hover tooltip; with
`column-auto-width`, web fonts that load after the first measure trigger a new measure (a label
was cut by 1px); header buttons of end-aligned columns no longer reach into the start padding (the
"⋮" sat close to the previous column's); with `scroll-container`, a console warning tells when the
container (or `html`/`body` for `window`) has `overflow-x: hidden/clip` while the table is wider
than the grid.

In 0.3.0: computed columns (a `valueGetter` and a `name`, no `path`) are
filterable by default — they get a filter row editor and a header filter button, and the search
also matches their displayed text (set `filterable: false` to keep the old behavior); a computed
column without `label` shows its `name` as the header text instead of an empty header.

Also in 0.3.0: the bar has `8px` between its items (`--u-grid-toolbar-gap`; host content
no longer touches the group panel), and the search panel and host content lost their own `8px`
start margin; the column chooser icon is `24px`; the header "⋮" and filter buttons sit side by side
and reach into the end padding up to the resize handle (about `10px` more for the label); the group
panel hint is shorter in every language; `GridColumnBooleanDisplay` gained `'check'` (an exhaustive
`switch` over it needs the new case); `u-grid` is now `position: relative` (the containing block of its own
visually hidden parts — with `scroll-container` they made the page as tall as the grid; your own
`position` on `u-grid` still wins).

In 0.2.0: a column without `label` shows its `path` as the header text and uses `path`, then
`name`, as its name elsewhere (it was empty); summaries and `treeColumn` find columns inside bands;
totals of a column hidden by `autoHideColumns` are no longer shown in the last visible column; the
cell padding longhands win over the old shorthands (the other axis comes from its own longhand or
the default, so if you customized an old shorthand, set both longhands).

**Header menu and column chooser (behavior changes, modeled on AG Grid):**

- **Header layout.** Every header with menu items shows an always visible "⋮" button
  (`show-column-header-menu-button="false"` hides it). It takes about 28px of the header width, so
  narrow columns truncate their label sooner. The header content now spans the cell: start/center
  aligned columns read `[label][sort] … [filter][⋮]`, end aligned (numbers) `[⋮][filter] … [sort][label]`
  (mirrored in RTL). The header filter button is always fully opaque (it was dimmed at rest).
- **Pinning moved into a submenu.** `fixColumnStart`, `fixColumnEnd` and `unfixColumn` are now in
  the `items` of the new `fixColumn` item of `u-grid-context-menu-opening`, not at the top of
  `menuItems`: code that looks for them there won't find them. Pinning no longer needs
  `column-chooser` (turn it off with `column-fixing="false"`), and the chooser has no pin buttons.
- **Header menu items.** New items in AG Grid's order (`autoSizeAllColumns`, `openColumnChooser`,
  `resetColumns`); "Clear sorting" is listed only when the column is sorted; "Reset columns" is always
  there, so a right-click on a header opens the grid menu even when no other action applies (use
  `column-header-menu="false"` or cancel `u-grid-context-menu-opening` to keep the browser menu).
- **Column chooser.** Focus starts in the new search field; the first checkbox is "Show all columns".

---

## License

[MIT](https://github.com/erichideyuki/universal-data-grid/blob/main/LICENSE) © Eric Kono
