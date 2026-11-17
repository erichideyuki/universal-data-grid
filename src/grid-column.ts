import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { GridColumnDef } from './grid-column-def.js';

interface ColumnHost extends HTMLElement {
  _columnChanged(column: GridColumnDef, change: 'width' | 'groupIndex'): void;
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

  get label(): string {
    return (this.textContent ?? '').trim();
  }

  #notify(change: 'width' | 'groupIndex'): void {
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
