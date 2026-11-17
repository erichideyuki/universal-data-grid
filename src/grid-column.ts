import { LitElement, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type {
  GridColumnAlignment,
  GridColumnBooleanDisplay,
  GridColumnComparator,
  GridColumnDataType,
  GridColumnDef,
  GridColumnFormat,
  GridSortOrder,
} from './grid-column-def.js';

type ColumnChange = 'width' | 'groupIndex' | 'value' | 'display';

/** `sortable` sem atributo = automático; `sortable="false"` desliga. */
const optionalBoolean = {
  fromAttribute: (value: string | null): boolean | null => value === null ? null : value !== 'false',
  toAttribute: (value: boolean | null): string | null => value === null ? null : String(value),
};

interface ColumnHost extends HTMLElement {
  _columnChanged(column: GridColumnDef, change: ColumnChange): void;
}

const isColumnHost = (element: Element | null): element is ColumnHost =>
  !!element && typeof (element as Partial<ColumnHost>)._columnChanged === 'function';

@customElement('u-grid-column')
export class UmDataGridColumn extends LitElement implements GridColumnDef {

  #width: number | null = null;
  #groupIndex: number | null = null;

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

  @property() path = '';
  @property({ attribute: false }) renderer: ((item: any) => HTMLElement) | null = null;

  @property({ attribute: 'data-type' }) dataType: GridColumnDataType | null = null;
  @property({ attribute: false }) format: GridColumnFormat | null = null;
  @property() alignment: GridColumnAlignment | null = null;
  @property({ attribute: false }) valueGetter: ((item: any) => unknown) | null = null;
  @property({ attribute: false }) displayValue: ((value: unknown, item: any) => string) | null = null;
  @property({ attribute: 'boolean-display' }) booleanDisplay: GridColumnBooleanDisplay | null = null;
  @property({ type: Boolean }) wrap = false;
  @property({ type: Number, attribute: 'min-width' }) minWidth: number | null = null;
  @property({ attribute: 'empty-text' }) emptyText: string | null = null;

  /** Allows sorting by this column. Default: `true` when it has a `path`, `valueGetter` or `comparator`. */
  @property({ converter: optionalBoolean }) sortable: boolean | null = null;

  /** Initial sort direction. Afterwards the sorting is grid state. */
  @property({ attribute: 'sort-order' }) sortOrder: GridSortOrder | null = null;

  /** Priority of the initial sort among columns (lower first). */
  @property({ type: Number, attribute: 'sort-index' }) sortIndex: number | null = null;

  /** Custom ascending comparator: `(valueA, valueB, itemA, itemB) => number`. */
  @property({ attribute: false }) comparator: GridColumnComparator | null = null;

  override willUpdate(changed: PropertyValues<this>): void {
    // Os valores iniciais o grid já lê ao montar as colunas.
    if (!this.hasUpdated) {
      return;
    }

    if (changed.has('path') || changed.has('valueGetter') || changed.has('dataType') || changed.has('comparator')) {
      this.#notify('value');
    } else if (changed.size) {
      this.#notify('display');
    }
  }

  get label(): string {
    return (this.textContent ?? '').trim();
  }

  #notify(change: ColumnChange): void {
    const grid = this.parentElement;

    if (isColumnHost(grid)) {
      grid._columnChanged(this, change);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'u-grid-column': UmDataGridColumn;
  }
}
