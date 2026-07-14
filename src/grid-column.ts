import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { GridColumnDef } from './grid-column-def.ts';
import { DataGrid } from './grid.ts';

@customElement('u-grid-column')
export class UmDataGridColumn extends LitElement implements GridColumnDef {

  _width: number | null = null;
  _groupIndex: number | null = null;

  @property({ type: Number })
  get width(): number | null {
    return this._width;
  }

  set width(value: number | null) {

    if (this._width === value) {
      return;
    }

    this._width = value;
    this.#grid?.requestUpdate();
  }

  @property({ type: Number, attribute: 'group-index' })
  get groupIndex(): number | null {
    return this._groupIndex;
  }

  set groupIndex(value: number | null) {
    this._groupIndex = value;
    this.#grid?._resetGroupColumns();
    this.#grid?.requestUpdate();
  }

  @property() path = '';
  @property() renderer: ((item: any) => HTMLElement) | null = null;

  get label(): string {
    return this.textContent;
  }

  get #grid(): DataGrid | null {

    const grid = this.parentElement as DataGrid;
    return grid?._nativeColumnMap
      ? grid
      : null;
  }

  _index: number | null = null;
}

declare global {
  interface HTMLElementTagNameMap {
    'u-grid-column': UmDataGridColumn;
  }
}
