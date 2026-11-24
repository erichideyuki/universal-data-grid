import { html, LitElement, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { booleanAttribute, filterOperationAttribute, filterOperationsAttribute, type LegacyAttributes, optionalBooleanAttribute, optionalNumberAttribute } from './attribute-converters.js';
import type {
  GridCellRenderer,
  GridColumnAlignment,
  GridColumnBooleanDisplay,
  GridColumnComparator,
  GridColumnDataType,
  GridColumnDef,
  GridColumnFixed,
  GridColumnFormat,
  GridEditorRenderer,
  GridFilterOperation,
  GridGroupRenderer,
  GridHeaderRenderer,
  GridSortOrder,
  GridValidationRule,
  GridValueSetter,
} from './grid-column-def.js';

/**
 * `value`: muda o valor das células; `display`: só a exibição/layout.
 * @internal
 */
export type GridColumnChange = 'width' | 'groupIndex' | 'value' | 'display' | 'columns';

const optionalBoolean = optionalBooleanAttribute;

/** Atributos renomeados na revisão de API (spec 15): antigo → novo. */
const LEGACY_ATTRIBUTES: LegacyAttributes = {
  'data-type': 'type',
};

/** @internal */
interface ColumnHost extends HTMLElement {
  _columnChanged(column: GridColumnDef, change: GridColumnChange): void;
}

const isColumnHost = (element: Element | null): element is ColumnHost =>
  !!element && typeof (element as Partial<ColumnHost>)._columnChanged === 'function';

const isColumnElement = (node: Node): node is DataGridColumn =>
  node instanceof Element && node.localName === 'u-grid-column';

const sameElements = (a: readonly Element[], b: readonly Element[]): boolean =>
  a.length === b.length && a.every((element, index) => element === b[index]);

const fixedSide = {
  fromAttribute: (value: string | null): GridColumnFixed =>
    value === 'start' || value === 'end' ? value : null,
};

/**
 * Declarative column of a `<u-grid>`: one direct child `<u-grid-column>` per
 * column. The text content is the header label. Every option mirrors a
 * `GridColumnDef` field with the same property name. A `<u-grid-column>`
 * with nested `<u-grid-column>` elements is a band (multi-level header).
 *
 * @slot - Header label text and, in a band, the nested `<u-grid-column>` elements.
 */
@customElement('u-grid-column')
export class DataGridColumn extends LitElement implements GridColumnDef {

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, ...Object.keys(LEGACY_ATTRIBUTES)];
  }

  readonly #warnedDeprecations = new Set<string>();
  #nested: readonly DataGridColumn[] = Object.freeze([]);

  #width: number | null = null;
  #groupIndex: number | null = null;

  /**
   * Width in px. Changing it after the column is rendered overrides the width
   * chosen by the user. Under virtual column rendering (`columnRenderingMode`),
   * or with `scrollContainer` and `scrollContainerAxis` `block` (the default),
   * a column without `width` takes its `columnAutoWidth` measure or
   * `max(minWidth, 150)` px within `maxWidth`.
   */
  @property({ type: Number })
  get width(): number | null {
    return this.#width;
  }

  set width(value: number | null) {

    if (this.#width === value) {
      return;
    }

    this.#width = value;
    this.#notify('width');
  }

  /**
   * INITIAL grouping level. Afterwards grouping is grid state: use
   * `grid.groupColumn()` / `grid.ungroupColumn()`. Changing it after the
   * column is rendered still regroups, but is deprecated.
   */
  @property({ type: Number, attribute: 'group-index' })
  get groupIndex(): number | null {
    return this.#groupIndex;
  }

  set groupIndex(value: number | null) {

    if (this.#groupIndex === value) {
      return;
    }

    this.#groupIndex = value;
    this.#notify('groupIndex');
  }

  /** Dot path of the cell value in the row item (`"address.city"`). */
  @property() path = '';

  /**
   * Stable id of the column in the grid state (`getState`, `stateStorage`)
   * and in string column references (`summary` items look it up before
   * `path`) and, for a column without `path`, in filter conditions
   * (`filterValue`). Default: `path`. A column without `name` and `path` is
   * left out of the state.
   */
  @property() name = '';

  /**
   * Builds the cell content (property only): a Lit `TemplateResult`
   * (recommended), a string (text) or an `HTMLElement` (placed in the grid's
   * light DOM). `null`, `undefined` and Lit's `nothing` render an empty cell.
   */
  @property({ attribute: false }) renderer: GridCellRenderer | null = null;

  /**
   * Builds the header label (property only); sort arrow, filter button and resize handle stay. Keep
   * the text content: it still names the column outside the header (menus, chooser, announcements, export).
   */
  @property({ attribute: false }) headerRenderer: GridHeaderRenderer | null = null;

  /** Builds the label of the group rows of this column (property only); the expand button and aligned summaries stay. */
  @property({ attribute: false }) groupRenderer: GridGroupRenderer | null = null;

  /**
   * Data type of the column (`string`, `number`, `date`, `datetime`,
   * `boolean`); attribute `type`. Without it, inferred from the first
   * non-null value. The `data-type` attribute is deprecated (`data-*`
   * belongs to the page author).
   */
  @property({ attribute: 'type' }) dataType: GridColumnDataType | null = null;

  /** `Intl` options or a formatter function (property only). */
  @property({ attribute: false }) format: GridColumnFormat | null = null;

  /** Logical alignment (`start`, `center`, `end`); follows RTL. Default by data type. In a band, of the header label (default `start`). */
  @property() alignment: GridColumnAlignment | null = null;

  /** Computes the cell value used to group, sort and filter (property only). Default: read `path`. */
  @property({ attribute: false }) valueGetter: ((item: any) => unknown) | null = null;

  /** Displayed text (cell and group row); wins over `format` (property only). */
  @property({ attribute: false }) displayValue: ((value: unknown, item: any) => string) | null = null;

  /**
   * `text` (default), `icon` (read-only check/cross icon) or `check` (check
   * icon for `true`, nothing visible for `false`) for boolean columns.
   */
  @property({ attribute: 'boolean-display' }) booleanDisplay: GridColumnBooleanDisplay | null = null;

  /**
   * Text of `true` in this boolean column (cell, icon name, group row, filters,
   * copy/paste, summaries, export). Empty or unset: the language's `trueText`;
   * a fixed text, it does not follow `language`.
   */
  @property({ attribute: 'true-text' }) trueText: string | null = null;

  /** Text of `false` in this boolean column, like `trueText`. Empty or unset: the language's `falseText`. */
  @property({ attribute: 'false-text' }) falseText: string | null = null;

  /** Wraps the text in several lines instead of an ellipsis (`wrap="false"` turns it off). */
  @property({ type: Boolean, converter: booleanAttribute(false) }) wrap = false;

  /**
   * Wraps the header label in several lines (`header-wrap`); `header-wrap="false"`
   * turns off the grid's `header-wrap` for this column. Unset: the grid's.
   */
  @property({ converter: optionalBoolean, attribute: 'header-wrap' }) headerWrap: boolean | null = null;

  /** Minimum width in px (also when resizing and auto-sizing). */
  @property({ type: Number, attribute: 'min-width' }) minWidth: number | null = null;

  /** Text for empty values (`null`/`undefined`). */
  @property({ attribute: 'empty-text' }) emptyText: string | null = null;

  /** Maximum width in px when resizing and auto-sizing. */
  @property({ type: Number, attribute: 'max-width' }) maxWidth: number | null = null;

  /**
   * Order in which the column leaves the table when the grid is too narrow
   * (`auto-hide-columns`; its values move to the row details): the lowest
   * goes first, ties from the end. When any column has a `hiding-priority`
   * (grouped or hidden ones included), only those columns hide; otherwise
   * columns hide from the last one. Fixed columns never hide. Empty or not a
   * number = none. Ignored on bands.
   */
  @property({ converter: optionalNumberAttribute, attribute: 'hiding-priority' }) hidingPriority: number | null = null;

  /** `resizable="false"` prevents resizing this column even with `column-resizing`. */
  @property({ converter: optionalBoolean }) resizable: boolean | null = null;

  /**
   * Fixes the column at the `start` or `end` of the scrollable area (logical:
   * mirrors in RTL). A fixed band fixes its columns; ignored on nested columns.
   */
  @property({ converter: fixedSide }) fixed: GridColumnFixed = null;

  /** INITIAL visibility (`visible="false"` hides). Afterwards the user changes it in the chooser. */
  @property({ converter: optionalBoolean }) visible: boolean | null = null;

  /** `show-in-chooser="false"` removes the column from the chooser (the user cannot hide it). */
  @property({ converter: optionalBoolean, attribute: 'show-in-chooser' }) showInChooser: boolean | null = null;

  /**
   * `header-menu="false"` removes this column's header menu ("⋮" and the
   * built-in items); the single-pointer alternatives to the drags this column
   * still allows stay (WCAG 2.5.7), with the "⋮" while there are any;
   * `u-grid-context-menu-opening` still fires. Unset or `true`: the grid's
   * `column-header-menu`, which wins. On a band, the band header only. The
   * group panel chip menu is not affected.
   */
  @property({ converter: optionalBoolean, attribute: 'header-menu' }) headerMenu: boolean | null = null;

  /** Allows sorting by this column. Default: `true` when it has a `path`, `valueGetter` or `comparator`. */
  @property({ converter: optionalBoolean }) sortable: boolean | null = null;

  /** Initial sort direction. Afterwards the sorting is grid state. */
  @property({ attribute: 'sort-order' }) sortOrder: GridSortOrder | null = null;

  /** Priority of the initial sort among columns (lower first). */
  @property({ type: Number, attribute: 'sort-index' }) sortIndex: number | null = null;

  /** Custom ascending comparator: `(valueA, valueB, itemA, itemB) => number`. */
  @property({ attribute: false }) comparator: GridColumnComparator | null = null;

  /**
   * Value used to GROUP by this column (a range or bucket: decade, initial
   * letter), property only. Groups are identified, sorted and shown by the
   * returned value; `dataType`, `comparator`, `format` and `displayValue` do
   * not apply to it.
   */
  @property({ attribute: false }) groupValueGetter: ((item: any) => unknown) | null = null;

  /**
   * Allows the user to group by this column (`groupable="false"` prevents
   * it). Default: `true` when it has a `path`, `valueGetter` or
   * `groupValueGetter`. Only limits the user: `groupColumn()` still works.
   */
  @property({ converter: optionalBoolean }) groupable: boolean | null = null;

  /**
   * Allows filtering by this column (filter row, header filter and, by
   * default, the search panel). Default (`null`): `true` with a `path`, or
   * with a `valueGetter` and a `name` (not with remote filtering).
   * `filterable="false"` disables it.
   */
  @property({ converter: optionalBoolean }) filterable: boolean | null = null;

  /**
   * Includes this column in exports (`exportCsv`, `getExportData`, the
   * xlsx adapter) and in Ctrl+C. Default (`null`): `true` when it has a
   * `path`, `valueGetter` or `displayValue` (a `renderer`-only column has no
   * text). `exportable="false"` leaves it out.
   */
  @property({ converter: optionalBoolean }) exportable: boolean | null = null;

  /**
   * Operations of the filter row operation menu. Attribute: space separated
   * list (`filter-operations="contains startswith ="`); unknown tokens are
   * ignored with a warning. Default by data type.
   */
  @property({ converter: filterOperationsAttribute, attribute: 'filter-operations' }) filterOperations: readonly GridFilterOperation[] | null = null;

  /**
   * Operation of the filter row editor. Default: `contains` for text, `=`
   * otherwise; one outside `filterOperations` falls back to the first of the
   * list. Unknown attribute values are ignored with a warning.
   */
  @property({ converter: filterOperationAttribute, attribute: 'default-filter-operation' }) defaultFilterOperation: GridFilterOperation | null = null;

  /**
   * Allows editing the cells of this column (with `allow-editing` on the
   * grid). Default (`null`): `true` when it has a `path` or a
   * `valueSetter`. `editable="false"` makes it read-only.
   */
  @property({ converter: optionalBoolean }) editable: boolean | null = null;

  /** Builds the cell editor instead of the built-in one (property only). See `GridEditorRenderer`. */
  @property({ attribute: false }) editorRenderer: GridEditorRenderer | null = null;

  /** Rules checked when a value is committed and before saving (property only). See `GridValidationRule`. */
  @property({ attribute: false }) validationRules: readonly GridValidationRule[] | null = null;

  /** Writes an edited value into the pending change of the row (property only). Default: sets `path`. */
  @property({ attribute: false }) valueSetter: GridValueSetter | null = null;

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    const renamed = LEGACY_ATTRIBUTES[name];

    if (renamed) {
      this.#deprecated(`${name} attribute`, `${renamed} attribute`);
      // Conversor e propriedade são os do atributo novo.
      super.attributeChangedCallback(renamed, old, value);
      return;
    }

    super.attributeChangedCallback(name, old, value);
  }

  override willUpdate(changed: PropertyValues<this>): void {
    // Os valores iniciais o grid já lê ao montar as colunas.
    if (!this.hasUpdated) {
      return;
    }

    if (changed.has('path') || changed.has('valueGetter') || changed.has('dataType') || changed.has('comparator') || changed.has('groupValueGetter')) {
      this.#notify('value');
    } else if (changed.size) {
      this.#notify('display');
    }
  }

  /**
   * Nested `<u-grid-column>` elements (read-only): when there is at least
   * one, this column is a band. `null` without nested columns. The array is
   * frozen and stays the same while the nested columns don't change.
   */
  get columns(): readonly DataGridColumn[] | null {
    const nested = Array.from(this.children).filter(isColumnElement);

    if (!sameElements(nested, this.#nested)) {
      this.#nested = Object.freeze(nested);
    }

    return this.#nested.length ? this.#nested : null;
  }

  /**
   * Header label: the trimmed text content of the element, without the text of nested columns. Also
   * the column's name outside the header. Empty: the header shows `path`; elsewhere `path`, then `name`, as is.
   */
  get label(): string {
    if (!this.columns) {
      return (this.textContent ?? '').trim();
    }

    let text = '';

    for (const node of this.childNodes) {
      if (!isColumnElement(node)) {
        text += node.textContent ?? '';
      }
    }

    return text.trim();
  }

  // Só para saber quando as colunas aninhadas mudam (o grid não mostra este conteúdo).
  protected override render() {
    return html`<slot @slotchange=${this.#onSlotChange}></slot>`;
  }

  // O grid compara a árvore e ignora quando nada mudou.
  readonly #onSlotChange = (): void => this.#notify('columns');

  #deprecated(name: string, replacement: string): void {
    if (this.#warnedDeprecations.has(name)) {
      return;
    }

    this.#warnedDeprecations.add(name);
    console.warn(`<u-grid-column>: "${name}" is deprecated, use "${replacement}" instead.`);
  }

  #notify(change: GridColumnChange): void {
    // Coluna aninhada: sobe pelas bandas até o grid.
    let host = this.parentElement;

    while (host && !isColumnHost(host) && isColumnElement(host)) {
      host = host.parentElement;
    }

    if (isColumnHost(host)) {
      host._columnChanged(this, change);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'u-grid-column': DataGridColumn;
  }
}
