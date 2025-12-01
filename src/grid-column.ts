import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('u-grid-column')
export class UmDataGridColumn extends LitElement {
  @property() path = '';
  @property({ type: Number, attribute: 'group-index' }) groupIndex: number | null = null;
  @property() renderer: ((item: any) => HTMLElement) | null = null;

  _index: number | null = null;
}

declare global {
  interface HTMLElementTagNameMap {
    'u-grid-column': UmDataGridColumn;
  }
}
