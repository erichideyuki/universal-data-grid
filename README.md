# @universal-material/data-grid

A high-performance data grid **Web Component** built with [Lit](https://lit.dev). It renders
thousands of rows smoothly through row virtualization, supports drag-and-drop grouping and
column reordering, custom cell renderers, server-side rendering and built-in internationalization.

Because it ships as a standard custom element (`<u-grid>`), it works in any framework — Angular,
React, Vue, Svelte — or with no framework at all.

![Data grid overview](data:image/webp;base64,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)

---

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Use in the browser (no build step)](#use-in-the-browser-no-build-step)
- [Defining columns](#defining-columns)
- [Data types & formatting](#data-types--formatting)
- [Sorting](#sorting)
- [Grouping](#grouping)
- [Column features](#column-features) (resizing, fixed columns, column chooser, auto width)
- [Custom cell rendering](#custom-cell-rendering)
- [Internationalization (i18n)](#internationalization-i18n)
- [Appearance & behavior](#appearance--behavior)
- [Theming (CSS custom properties & parts)](#theming)
- [Server-side rendering](#server-side-rendering)
- [Using with frameworks](#using-with-frameworks)
- [API reference](#api-reference)
- [License](#license)

---

## Features

- **Row virtualization** — only visible rows are rendered (powered by `@tanstack/lit-virtual`), so
  the grid stays responsive with very large datasets.
- **Sorting** — click a header to sort, Shift+click to sort by several columns, stable and fast
  (100,000 rows in under 200 ms), with keyboard and screen reader support.
- **Grouping** — group by one or more columns, with expand/collapse, multi-level nesting and an
  optional auto-expand mode. Group interactively by dragging a column header into the header bar.
- **Data types & formatting** — number, date, date-time and boolean columns formatted with `Intl`
  in the grid's language, with per-column `format`, `alignment`, computed values and empty text.
- **Column reordering** — drag column headers to reorder them, or drag them in/out of the grouping
  area.
- **Column features** — resize by dragging (or with the keyboard), auto-size on double-click, fix
  columns to the start/end while scrolling horizontally, and show/hide columns in a column chooser.
- **Custom cell renderers** — return any `HTMLElement` per column to fully control a cell.
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
`@lit/context`, `@tanstack/lit-virtual` and `interactjs` are regular dependencies, so your bundler
deduplicates them with the rest of your app. Importing the package registers the custom elements as
a side effect.

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
| jsDelivr | `https://cdn.jsdelivr.net/npm/@universal-material/data-grid@1/dist/grid.min.js` |
| unpkg | `https://unpkg.com/@universal-material/data-grid@1/dist/grid.min.js` |

Pin a version (`@1`, `@1.0.0`) in production so a new major can't change the page under you.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />

    <!-- Alias the package specifier to the self-contained bundle -->
    <script type="importmap">
      {
        "imports": {
          "@universal-material/data-grid": "https://cdn.jsdelivr.net/npm/@universal-material/data-grid@1/dist/grid.min.js"
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
  `<script type="module" src="https://cdn.jsdelivr.net/npm/@universal-material/data-grid@1/dist/grid.min.js"></script>`.
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
  /** Dot-path into each item, e.g. `"user.address.city"`. */
  path?: string;
  /** Header text. With <u-grid-column>, this is the element's text content. */
  label?: string;
  /** Fixed column width in pixels. Omit for auto width. */
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
  /** 'text' (default: trueText/falseText) or 'icon' (read-only check / cross). */
  booleanDisplay?: GridColumnBooleanDisplay | null;
  /** Wrap long text over several lines instead of truncating with an ellipsis. */
  wrap?: boolean;
  /** Text shown for `null`/`undefined` values. Default: empty. */
  emptyText?: string | null;
  /** Custom cell renderer — see "Custom cell rendering". `null` renders an empty cell. */
  renderer?: ((item: TItem) => HTMLElement | null) | null;
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
  /** Keep the column at the start or end while scrolling horizontally (mirrored in RTL). */
  fixed?: 'start' | 'end' | null;
  /** Initial visibility. Default `true`. */
  visible?: boolean | null;
  /** `false` hides the column from the column chooser. Default `true`. */
  showInChooser?: boolean | null;
}
```

`TItem` (default `any`) types the row item in the callbacks: `GridColumnDef<Order>[]`.

`<u-grid-column>` (class `DataGridColumn`) has the same options with the same property names. The
primitive ones are kebab-case attributes (`min-width`, `group-index`, `empty-text`, …); `dataType`
is the `type` attribute (`data-*` attributes belong to the page author). Boolean options turn off
with `"false"`: `visible="false"`, `resizable="false"`, `sortable="false"`, `show-in-chooser="false"`,
`wrap="false"`.

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

`alignment` is logical: `end` is the right edge in LTR and the left edge in RTL. The header follows
the column alignment. Cells that do not wrap are truncated with an ellipsis and show the full text
as a tooltip (`title`) when hovered.

Declaratively, primitive options are kebab-case attributes; functions and `format` are properties:

```html
<u-grid-column path="createdAt" type="datetime" empty-text="—" min-width="160">Created</u-grid-column>
<u-grid-column path="notes" alignment="center" wrap>Notes</u-grid-column>
<u-grid-column path="active" boolean-display="icon">Active</u-grid-column>
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
- **Expand / collapse** — click the chevron on a group row (it is a button, so `Tab` + `Enter`/`Space`
  work too). The expanded state survives replacing `items`. Use the `auto-expand-groups` attribute
  to render groups expanded by default:

  ```html
  <u-grid auto-expand-groups></u-grid>
  ```

- **Group row label** — rendered as `` `${columnLabel}${separator}${value}` ``. The separator is
  translatable (`groupLabelSeparator`), e.g. `": "` in English, `"：" ` in Japanese.

### Programmatic grouping / reordering

```ts
grid.groupColumn(column);              // group by this column (innermost level)
grid.groupColumn(column, 0);           // …or at a given level (moves it if already grouped)
grid.ungroupColumn(column);            // back to the end of the regular columns
grid.getGrouping();                    // grouped columns, outermost first
grid.moveColumn(column, targetIndex);  // reorder a regular column (ungroups a grouped one)
```

All accept a `GridColumnDef` (or a `<u-grid-column>` element) already known to the grid.

`u-grid-group-change` fires after the grouping changed, by drag and drop or by these methods:
`detail` is `{ grouping: GridColumnDef[]; previous: GridColumnDef[]; source: 'user' | 'api' }`.
Initial grouping (and changing `groupIndex` on a column) fires nothing.

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
- The handle is a focusable `role="separator"` with `aria-valuenow` set to the column width.
- Using the handle (drag, click, double-click, keys) never sorts the column; neither does dragging a
  header to reorder it.

When every visible column has a width (set by you or by the user), the table is exactly as wide as
their sum and does not stretch; with at least one auto-width column, the table fills the grid.

```ts
grid.setColumnWidth(column, 180); // clamped to minWidth/maxWidth
grid.autoSizeColumn(column);      // fit header + rendered rows
grid.addEventListener('u-grid-column-resize', e => console.log(e.detail.column, e.detail.width));
```

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

```ts
grid.columns = [
  { path: 'name', label: 'Name', width: 200, fixed: 'start' },
  { path: 'city', label: 'City', width: 160 },
  // …
  { path: 'total', label: 'Total', width: 120, fixed: 'end' },
];
```

### Column chooser

`column-chooser` adds a button at the end of the header bar that opens a small popover listing the
columns (`showInChooser: false` leaves a column out). Each row has a labelled checkbox to show/hide
the column and two toggle buttons to fix it to the start or the end. `openColumnChooser()` and
`closeColumnChooser()` open and close it from code (also without the button). While it is open, dragging a column header onto it hides that column. `Esc` or a click
outside closes it. The last visible column cannot be hidden.

### Column events

| Event | Detail | Fired when |
| ----- | ------ | ---------- |
| `u-grid-column-resize` | `{ column, width, previousWidth, nextColumn?, nextColumnWidth? }` | The user finishes a resize (pointer release, keyboard step, auto-size). `nextColumn*` only in `next-column` mode. |
| `u-grid-column-visibility-change` | `{ column, visible }` | The user shows/hides a column in the chooser. |
| `u-grid-column-fixed-change` | `{ column, fixed, previousFixed }` | The user fixes/unfixes a column in the chooser. |
| `u-grid-column-reorder` | `{ column, index, previousIndex }` | The user moves a column by drag and drop (positions among regular columns, hidden ones included). `fromIndex`/`toIndex` are deprecated aliases. |

All events bubble and are `composed`. Unlike sorting and grouping, these column events fire **only
for user gestures**: changes made through the API (`setColumnWidth`, `moveColumn`, a new `width` or
`visible` on the definition) do not fire them.

---

## Custom cell rendering

Provide a `renderer` that receives the row item and returns any `HTMLElement` (or `null` for an empty
cell). The grid slots the returned element into the cell, so your element keeps its own styles and
event listeners. The renderer runs again whenever the cell shows a different row or column.

> **Light DOM:** to be slotted, each rendered cell lives in a `<div slot="cell:…">` that the grid
> appends as a **child of `<u-grid>`** (next to your `<u-grid-column>` elements). Don't remove or
> reorder those nodes, and filter them out if you walk `grid.children`. Frameworks that render the
> grid's children (React, Vue, Angular templates with `<u-grid-column>`) leave unknown nodes alone,
> but don't let them re-create the whole children list on every render — prefer the `columns`
> property when columns are data-driven.

> **Security:** the grid does not sanitize what the renderer returns. Build the element with
> `textContent` (as below) — never assign row data to `innerHTML`.

```ts
grid.columns = [
  { path: 'country', label: 'Country' },
  {
    path: 'population',
    label: 'Population',
    renderer: (item) => {
      const el = document.createElement('span');
      el.textContent = item.population.toLocaleString();
      el.style.fontVariantNumeric = 'tabular-nums';
      return el;
    },
  },
];
```

With the declarative API, set the property on the element:

```ts
const col = document.querySelector('u-grid-column')!;
col.renderer = (item) => { /* ... */ return el; };
```

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
  fixStart: string;            // "fix to the start" toggle in the chooser
  fixEnd: string;              // "fix to the end" toggle in the chooser
  unfix: string;               // hint of a pressed fix toggle
  autoSize: string;            // resize handle hint (double-click to auto-size)
}
```

`{column}` and `{order}` are placeholders filled by the grid (`{order}` with `sortAscending` /
`sortDescending`). The keys `clearSorting`, `pinStart`, `pinEnd` and `unpin` were renamed;
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
| `autoExpandGroups` | `auto-expand-groups`  | `boolean` | `false` | Render groups expanded by default. |
| `sortMode`         | `sort-mode`           | `'none' \| 'single' \| 'multiple'` | `'single'` | How the user sorts by clicking headers. See [Sorting](#sorting). |
| `rowHeight`        | `row-height`          | `number`  | `48`    | Row height in pixels. |
| `striped`          | `striped`             | `boolean` | `false` | Zebra striping on alternating rows. |
| `showGroupPanel`   | `show-group-panel`    | `boolean` | `true`  | Show the grouping toolbar (where columns are dropped to group). |
| `showColumnHeaders`| `show-column-headers` | `boolean` | `true`  | Show the column header row. |
| `showRowLines`     | `show-row-lines`      | `boolean` | `true`  | Horizontal row separators. |
| `showColumnLines`  | `show-column-lines`   | `boolean` | `false` | Vertical column separators. |
| `columnResizing`   | `column-resizing`     | `boolean` | `false` | Let the user resize columns. See [Column features](#column-features). |
| `resizeMode`       | `resize-mode`         | `'widget' \| 'next-column'` | `'widget'` | How a resize affects the other columns. |
| `columnChooser`    | `column-chooser`      | `boolean` | `false` | Show the column chooser button. |
| `columnAutoWidth`  | `column-auto-width`   | `boolean` | `false` | Size columns without `width` to their content. |

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

### Common custom properties

| Property | Default | Description |
| -------- | ------- | ----------- |
| `--u-grid-background-color` | surface token | Grid background. |
| `--u-grid-striped-background-color` | surface token | Background of even rows when `striped`. |
| `--u-grid-header-background-color` | grid background | Header / sticky background. |
| `--u-grid-row-hover-opacity` | state-layer token / `8%` | Tint of the data row under the pointer (`0%` disables it). |
| `--u-grid-toolbar-height` | `56px` | Height of the bar above the table (group panel, chooser button). |
| `--u-grid-toolbar-padding` | `8px 16px` | Bar padding (or `--u-grid-toolbar-block-padding` / `--u-grid-toolbar-inline-padding`). |
| `--u-grid-header-cell-height` | `46px` | Column header height. |
| `--u-grid-header-cell-padding` | `13px 16px` | Header cell padding. |
| `--u-grid-header-cell-font-size` / `--u-grid-header-cell-font-weight` | `0.8125rem` / inherited | Header text. |
| `--u-grid-cell-padding` | `13px 16px` | Data cell padding. `--u-grid-cell-block-padding` / `--u-grid-cell-inline-padding` set both data and header cells. |
| `--u-grid-cell-font-size` / `--u-grid-cell-font-weight` | `0.875rem` / inherited | Data cell text. |
| `--u-grid-line-opacity` | `20%` | Opacity of row/column lines (derived from the text color). |
| `--u-grid-line-width` | `1px` | Base line thickness. |
| `--u-grid-row-line-width` | line width | Row separator thickness. |
| `--u-grid-column-line-width` | line width | Column separator thickness. |
| `--u-grid-group-toggle-color` / `--u-grid-group-toggle-shape` | on-surface-variant token / `50%` | Group expand/collapse chevron (the color also applies to the chooser button). |
| `--u-grid-group-row-emphasis` | `80%` | Emphasis of group row text. |
| `--u-grid-group-chip-height` | `32px` | Group chip height. |
| `--u-grid-group-chip-padding` | `16px` | Group chip inline padding. |
| `--u-grid-group-chip-shape` | `8px` | Group chip corner radius. |
| `--u-grid-group-chip-outline-color` / `--u-grid-group-chip-outline-width` | outline token / `1px` | Group chip border. |
| `--u-grid-group-chip-font-size`, `-font-weight`, `-line-height`, `-letter-spacing` | label-large tokens | Group chip text. |
| `--u-grid-focus-ring-color` / `--u-grid-focus-ring-width` | primary token / `2px` | Keyboard focus ring. |
| `--u-grid-sorted-header-color` | text color | Text color of sorted column headers. |
| `--u-grid-sort-indicator-size` | `1.125em` | Size of the sort arrow. |
| `--u-grid-drop-indicator-color` | primary token | Drag-and-drop drop indicator color. |
| `--u-grid-drop-indicator-width` | `3px` | Drop indicator thickness. |
| `--u-grid-resize-handle-width` | `8px` | Width of the column resize handle. |
| `--u-grid-fixed-shadow-color` | shadow token | Shadow at the edge of fixed columns while scrolling. |
| `--u-grid-column-chooser-background-color` | surface-container token | Column chooser background. |
| `--u-grid-column-chooser-shape` | `12px` | Column chooser corner radius. |

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
| `row` | Every rendered row (`<tr>`). |
| `group-row` | Group header rows. |
| `odd` / `even` | Data rows, by parity (the first data row is `odd`; useful with striping). |
| `cell` | Data cells (`<td>`). |
| `no-data` | The cell rendered in the empty state. |
| `header-cell` | Column header cells (`<th>`). |
| `sort-indicator` | The sort arrow (and priority number) in headers and group chips. |
| `group-chip` | Group chips in the grouping bar. |
| `column-chooser` | The column chooser popover. |

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

See [the i18n SSR note](#ssr-note) about language resolution during SSR.

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

Columns with a `renderer` add nodes to the grid's light DOM — see the
[light DOM note](#custom-cell-rendering) before letting a framework manage the grid's children.

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
| `<u-grid-column>` | Declarative column. Class: `DataGridColumn`. Attributes: `path`, `width`, `min-width`, `max-width`, `group-index`, `type`, `alignment`, `boolean-display`, `wrap`, `empty-text`, `sortable`, `sort-order`, `sort-index`, `fixed`, `visible`, `resizable`, `show-in-chooser`; properties only: `format`, `valueGetter`, `displayValue`, `renderer`, `comparator`; label = text content. |

### `<u-grid>` methods

| Method | Description |
| ------ | ----------- |
| `sortColumn(column, order, { append })` | Sort by `column` (`'asc'`/`'desc'`; `null` removes it). `append: true` adds it to the current sort. |
| `clearSorting()` | Remove all sorting. |
| `getSorting()` | Current sort as `{ column, order }[]`, in priority order. |
| `groupColumn(column, targetIndex?)` | Group by `column` at level `targetIndex` (default: innermost); moves an already grouped column. |
| `ungroupColumn(column)` | Remove `column` from the grouping (it goes to the end of the regular columns). |
| `getGrouping()` | Grouped columns, outermost first. |
| `moveColumn(column, targetIndex)` | Reorder a regular column to `targetIndex` (kept inside its fixed/regular block); ungroups a grouped column. |
| `setColumnWidth(column, px)` | Set a column width, clamped to `minWidth`/`maxWidth`. |
| `autoSizeColumn(column)` | Fit a column to its content (header + rendered rows). |
| `openColumnChooser()` / `closeColumnChooser()` | Open / close the column chooser. |

### `<u-grid>` events

All bubble and are `composed`.

| Event | `detail` | Fired by API? | Description |
| ----- | -------- | ------------- | ----------- |
| `u-grid-sorting` | `GridSortEventDetail` | yes | Before the sort changes. Cancelable. |
| `u-grid-sort-change` | `GridSortEventDetail` | yes | After the sort changed. |
| `u-grid-group-change` | `GridGroupEventDetail` | yes | After the grouping changed. |
| `u-grid-column-resize` | `GridColumnResizeEventDetail` | no | The user finished resizing a column. See [Column events](#column-events). |
| `u-grid-column-visibility-change` | `GridColumnVisibilityChangeEventDetail` | no | The user showed/hid a column in the chooser. |
| `u-grid-column-fixed-change` | `GridColumnFixedChangeEventDetail` | no | The user fixed/unfixed a column in the chooser. |
| `u-grid-column-reorder` | `GridColumnReorderEventDetail` | no | The user moved a column by drag and drop. |

The events that also fire for API calls carry `source: 'user' | 'api'` in `detail`.

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
  type GridSort,            // { column, order }
  type GridSortOrder,       // 'asc' | 'desc'
  type GridSortMode,        // 'none' | 'single' | 'multiple'
  type GridResizeMode,      // 'widget' | 'next-column'
  type GridChangeSource,    // 'user' | 'api'
  type GridSortEventDetail, // { sorting, previous, source }
  type GridGroupEventDetail, // { grouping, previous, source }
  type GridColumnResizeEventDetail,
  type GridColumnVisibilityChangeEventDetail,
  type GridColumnFixedChangeEventDetail,
  type GridColumnReorderEventDetail,
  type GridI18n,
  type GridI18nInput,       // Partial<GridI18n> that still accepts the deprecated keys
} from '@universal-material/data-grid';
```

### Deprecated names

They still work and warn once per grid (or once per page for translation keys) in the console.
They will be removed in the next major version.

| Deprecated | Use instead |
| ---------- | ----------- |
| attributes `rowheight`, `showrowlines`, `showcolumnlines` | `row-height`, `show-row-lines`, `show-column-lines` |
| `sorting` / attribute `sorting`, type `GridSortingMode` | `sortMode` / `sort-mode`, `GridSortMode` |
| `stripped`, `showHeader` | `striped`, `showGroupPanel` |
| `sortBy()` | `sortColumn()` |
| `showColumnChooser()` | `openColumnChooser()` |
| `<u-grid-column data-type>` | `type` attribute |
| changing `groupIndex` of a rendered `<u-grid-column>` | `groupColumn()` / `ungroupColumn()` |
| `detail.fromIndex` / `detail.toIndex` of `u-grid-column-reorder` | `previousIndex` / `index` |
| type `UmDataGridColumn` | `DataGridColumn` |
| i18n keys `clearSorting`, `pinStart`, `pinEnd`, `unpin` | `sortClearedAnnouncement`, `fixStart`, `fixEnd`, `unfix` |
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

When migrating CSS, remove the old names: an old **shorthand** (`--u-table-cell-padding`,
`--u-table-header-padding`, `--u-grid-data-cell-padding`) still wins over the new block/inline
longhands.

Also changed (not deprecations): `::part(cell)` now matches every data cell (the empty-state cell
is only `::part(no-data)`); data rows get a hover tint (`--u-grid-row-hover-opacity: 0%` turns it
off); `items` is no longer read from an `items` attribute.

---

## License

[MIT](LICENSE) © Eric Kono
