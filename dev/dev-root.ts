import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import type { GridColumnDef } from '../src/grid-column-def';

import { DataGrid } from '../src/grid';

const languages = ['en', 'pt', 'es', 'fr', 'de', 'it', 'nl', 'ru', 'pl', 'tr', 'ja', 'ko', 'zh', 'ar'];

const columns: GridColumnDef[] = [
  {
    path: 'country',
    label: 'Country',
    groupIndex: 0,
    width: 240
  },
  {
    path: 'code',
    label: 'Code',
    width: 120
  },
  {
    path: 'year',
    label: 'Year',
    width: 120
  },
  {
    path: 'population',
    label: 'Population',
    width: 220,
  },
];

@customElement('dev-root')
export class DevRoot extends LitElement {

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100vh;
      overflow: hidden;
    }
    
    .toolbar {
      height: 64px;
      position: sticky;
      top: 0;
      display: flex;
      padding: 16px;
      align-items: center;
      box-sizing: border-box;
      background: #002a34;
      z-index: 2000;
    }
    
    .container {
      padding: 16px;
      max-width: 100%;
      width: 1600px;
      min-height: 0;
      flex: 1; 
      margin-inline: auto;
    }
  `;

  @property()
  initialData: any[] = [];

  @query('u-grid')
  grid!: DataGrid;

  override render() {
    if (typeof this.initialData === 'string') {
      this.initialData = JSON.parse(this.initialData);
    } else {
      this.initialData ??= [];
    }

    // Sets language imperatively so switching it does NOT re-render (and thus
    // re-commit .items/.columns to) the grid. Keeps the demo faithful: a
    // language change is a pure grid re-render, not a data rebuild.
    return html`
      <div class="toolbar">
        <label>
          Language:
          <select @change=${(e: Event) => this.grid.language = (e.target as HTMLSelectElement).value}>
            <option value="">(auto)</option>
            ${languages.map(lang => html`<option value=${lang}>${lang}</option>`)}
          </select>
        </label>
      </div>

      <div class="container">
        <u-grid
          slot="before-content"
          auto-expand-groups
          .columns=${columns}
          .items=${this.initialData}>
        </u-grid>
      </div>
      `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dev-root': DevRoot
  }
}
