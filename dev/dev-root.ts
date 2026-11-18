import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import type { GridColumnDef, GridSummary } from '../src/grid-column-def';

import { DataGrid } from '../src/grid';

const languages = ['en', 'pt', 'es', 'fr', 'de', 'it', 'nl', 'ru', 'pl', 'tr', 'ja', 'ko', 'zh', 'ar'];

const baseColumns: GridColumnDef[] = [
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
    dataType: 'number',
    format: { maximumFractionDigits: 0 },
  },
  {
    path: 'updatedAt',
    label: 'Updated',
    width: 220,
    dataType: 'datetime',
    emptyText: '—',
  },
  {
    path: 'official',
    label: 'Official',
    minWidth: 120,
    dataType: 'boolean',
  },
];

/** Totais no rodapé e resumos por grupo (frente 07). */
const demoSummary: GridSummary = {
  total: [
    { column: 'code', type: 'count' },
    { column: 'population', type: 'sum' },
    { column: 'year', type: 'max' },
  ],
  group: [
    { column: 'population', type: 'max', display: 'column' },
    { column: 'year', type: 'min' },
    { column: 'population', type: 'sum', display: 'footer' },
  ],
};

/** Demo largo: 2 colunas fixas no início, 1 no fim e métricas sintéticas. */
const wideColumns = (count: number): GridColumnDef[] => [
  { path: 'country', label: 'Country', width: 180, fixed: 'start' },
  { path: 'code', label: 'Code', width: 90, fixed: 'start' },
  { path: 'year', label: 'Year', width: 100 },
  ...Array.from({ length: count - 4 }, (_, i): GridColumnDef => ({
    path: `m${i + 1}`,
    label: `Metric ${i + 1}`,
    width: 120,
    minWidth: 60,
  })),
  { path: 'population', label: 'Population', width: 150, fixed: 'end' },
];

const withMetrics = (rows: any[], count: number): any[] =>
  rows.map(row => {
    const extra: Record<string, number> = {};

    for (let i = 1; i <= count - 4; i++) {
      extra[`m${i}`] = (row.population * (i + 7) + row.year * i) % 100_000;
    }

    return { ...row, ...extra };
  });

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
      gap: 24px;
      align-items: center;
      box-sizing: border-box;
      background: #002a34;
      z-index: 2000;
    }
    
    .container {
      box-sizing: border-box;
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

  @property({ type: Number, attribute: 'columns-count' })
  columnsCount = 4;

  #columns?: GridColumnDef[];
  #items?: any[];

  @query('u-grid')
  grid!: DataGrid;

  override render() {
    if (typeof this.initialData === 'string') {
      this.initialData = JSON.parse(this.initialData);
    } else {
      this.initialData ??= [];
    }

    if (!this.#columns) {
      const wide = this.columnsCount > 4;
      this.#columns = wide ? wideColumns(this.columnsCount) : baseColumns;
      this.#items = wide ? withMetrics(this.initialData, this.columnsCount) : this.initialData;
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
        <label>
          Direction:
          <select @change=${(e: Event) => this.grid.dir = (e.target as HTMLSelectElement).value}>
            <option value="">(auto)</option>
            <option value="ltr">ltr</option>
            <option value="rtl">rtl</option>
          </select>
        </label>
        <label>
          Resize mode:
          <select @change=${(e: Event) => this.grid.resizeMode = (e.target as HTMLSelectElement).value as DataGrid['resizeMode']}>
            <option value="widget">widget</option>
            <option value="next-column">next-column</option>
          </select>
        </label>
      </div>

      <div class="container">
        <u-grid
          slot="before-content"
          auto-expand-groups
          sort-mode="multiple"
          column-resizing
          column-chooser
          .columns=${this.#columns}
          .summary=${demoSummary}
          .items=${this.#items}>
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
