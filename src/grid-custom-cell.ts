import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { DataGrid } from './grid';
import type { GridColumnDef } from './grid-column-def.ts';

@customElement('u-grid-custom-cell')
export class UmDataGridCustomCell extends LitElement {
  @property({ attribute: false }) grid: DataGrid | null = null;
  @property({ attribute: false }) column: GridColumnDef | null = null;
  @property({ attribute: false }) item!: any;
  @property({ attribute: false }) slotName: string | null = null;

  #cellContainer: HTMLElement | null = null;

  override connectedCallback() {
    super.connectedCallback();

    const cellContainer = document.createElement('div');
    const cell = this.column!.renderer!(this.item);
    cellContainer.appendChild(cell);
    cellContainer.slot = this.slotName!;
    this.grid!.appendChild(cellContainer);
    this.#cellContainer = cellContainer;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();

    this.#cellContainer?.remove();
    this.#cellContainer = null;
    this.column = null;
    this.grid = null;
    this.item = null;
    this.slotName = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'u-grid-custom-cell': UmDataGridCustomCell;
  }
}
