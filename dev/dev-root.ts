import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import type { GridColumnDef, GridDetailRenderer, GridSummary } from '../src/grid-column-def';

import { LocalDataSource } from '../src/data/local-source';
import { DataGrid, GRID_DEFAULT_TOOLBAR_ITEMS, type GridDataSource } from '../src/grid';

/** "Servidor" do demo (frente 08): os dados do demo com 400 ms de latência; `?fail` falha 1 em 3. */
const slowSource = (items: readonly unknown[]): GridDataSource => {
  const local = new LocalDataSource(items);
  let calls = 0;

  return {
    load: (options, signal) => new Promise((resolve, reject) => {
      const fail = location.search.includes('fail') && ++calls % 3 === 0;
      const timer = setTimeout(() => (fail ? reject(new Error('Demo failure')) : resolve(local.query(options))), 400);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
      }, { once: true });
    }),
  };
};

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

/** Demo largo: 2 colunas fixas no início, 1 no fim e métricas sintéticas (em bandas de 10 com `?bands`). */
const wideColumns = (count: number, bands: boolean): GridColumnDef[] => {
  const metrics = Array.from({ length: count - 4 }, (_, i): GridColumnDef => ({
    path: `m${i + 1}`,
    label: `Metric ${i + 1}`,
    width: 120,
    minWidth: 60,
  }));
  const banded = bands
    ? Array.from({ length: Math.ceil(metrics.length / 10) }, (_, band): GridColumnDef => ({
      label: `Metrics ${band * 10 + 1}–${Math.min((band + 1) * 10, metrics.length)}`,
      columns: metrics.slice(band * 10, (band + 1) * 10),
    }))
    : metrics;
  const place: GridColumnDef[] = [
    { path: 'country', label: 'Country', width: 180 },
    { path: 'code', label: 'Code', width: 90 },
  ];

  return [
    ...bands ? [{ label: 'Place', fixed: 'start' as const, columns: place }] : place.map(column => ({ ...column, fixed: 'start' as const })),
    { path: 'year', label: 'Year', width: 100 },
    ...banded,
    { path: 'population', label: 'Population', width: 150, fixed: 'end' },
  ];
};

const withMetrics = (rows: any[], count: number): any[] =>
  rows.map(row => {
    const extra: Record<string, number> = {};

    for (let i = 1; i <= count - 4; i++) {
      extra[`m${i}`] = (row.population * (i + 7) + row.year * i) % 100_000;
    }

    return { ...row, ...extra };
  });

/** Master-detail do demo (frente 10): um template simples ou um grid aninhado. */
const detailColumns: GridColumnDef[] = [
  { path: 'year', label: 'Year', width: 120 },
  { path: 'population', label: 'Population', dataType: 'number', format: { maximumFractionDigits: 0 } },
];

const detailRenderers: Record<string, GridDetailRenderer | null> = {
  none: null,
  template: (item: any) => html`
    <div style="display: grid; gap: 4px; padding-block: 8px">
      <strong>${item.country} (${item.code})</strong>
      <span>${item.year}: ${Number(item.population).toLocaleString()}</span>
    </div>`,
  grid: (item: any) => html`
    <u-grid
      style="display: block; height: 220px"
      show-group-panel="false"
      .columns=${detailColumns}
      .items=${Array.from({ length: 8 }, (_, i) => ({ year: item.year - i, population: Math.round(item.population * (1 - i / 50)) }))}></u-grid>`,
};

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

  /** Métricas em bandas (frente 13). */
  @property({ type: Boolean })
  bands = false;

  #columns?: GridColumnDef[];
  #items?: any[];
  #keyed?: any[];

  @query('u-grid')
  grid!: DataGrid;

  /** Troca a fonte dos dados do demo (frente 08). */
  #setData(mode: string): void {
    const grid = this.grid;
    const remote = mode.startsWith('remote') || mode === 'infinite';

    // Os dados do demo não têm chave única: `id` = posição.
    this.#keyed ??= (this.#items ?? []).map((row, id) => ({ id, ...row }));
    grid.keyExpr = 'id';
    grid.paging = mode === 'paging' || mode === 'remote-paging';
    grid.scrollMode = mode === 'infinite' ? 'infinite' : 'virtual';
    grid.remoteOperations = remote;
    grid.items = [];
    grid.dataSource = mode === 'items' || mode === 'paging' ? null : slowSource(this.#keyed);

    if (!grid.dataSource) {
      grid.items = this.#keyed;
    }
  }

  override render() {
    if (typeof this.initialData === 'string') {
      this.initialData = JSON.parse(this.initialData);
    } else {
      this.initialData ??= [];
    }

    if (!this.#columns) {
      const wide = this.columnsCount > 4;
      this.#columns = wide ? wideColumns(this.columnsCount, this.bands) : baseColumns;
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
          Selection:
          <select @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            this.grid.selectionMode = value.startsWith('multiple') ? 'multiple' : value as DataGrid['selectionMode'];
            this.grid.showCheckboxes = value === 'multiple-checkboxes';
          }}>
            <option value="none">none</option>
            <option value="single">single</option>
            <option value="multiple">multiple</option>
            <option value="multiple-checkboxes">multiple + checkboxes</option>
          </select>
        </label>
        <label>
          Detail:
          <select @change=${(e: Event) => this.grid.detailRenderer = detailRenderers[(e.target as HTMLSelectElement).value]}>
            <option value="none">none</option>
            <option value="template">template</option>
            <option value="grid">nested grid</option>
          </select>
        </label>
        <label>
          Data:
          <select @change=${(e: Event) => this.#setData((e.target as HTMLSelectElement).value)}>
            <option value="items">items</option>
            <option value="paging">items + paging</option>
            <option value="source">dataSource (single load)</option>
            <option value="remote">dataSource, remote (virtual)</option>
            <option value="remote-paging">dataSource, remote + paging</option>
            <option value="infinite">dataSource, remote (infinite)</option>
          </select>
        </label>
        <label>
          Editing:
          <select @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            const on = value !== 'none';
            this.grid.editMode = on ? value as DataGrid['editMode'] : 'cell';
            this.grid.allowEditing = on;
            this.grid.allowAdding = on;
            this.grid.allowRemoving = on;
          }}>
            <option value="none">none</option>
            <option value="cell">cell</option>
            <option value="row">row</option>
            <option value="batch">batch</option>
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
          show-filter-row
          show-search-panel
          header-filter
          row-menu
          selection-mode="multiple"
          .exportFormats=${['csv'] as const}
          .toolbarItems=${[...GRID_DEFAULT_TOOLBAR_ITEMS, { text: 'Refresh', action: ({ grid }: { grid: DataGrid }) => void grid.refresh() }]}
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
