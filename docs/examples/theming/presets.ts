import '@universal-material/data-grid';

import { controls, createGrid, el, select } from '../shared/controls.js';
import { makeOrders } from '../shared/data.js';

export const meta = {
  title: 'Preset themes',
  description: 'A theme is a handful of custom properties plus a few appearance properties (`rowHeight`, `striped`, `showColumnLines`). **Compact** for dense screens, **Spreadsheet** with column lines and tight cells, a **Brand** palette, and a **Dark surface** that works on a light page — the code below each choice is all it takes.',
};

interface Theme {
  css: Record<string, string>;
  rowHeight: number;
  striped: boolean;
  showColumnLines: boolean;
}

const THEMES: Record<string, Theme> = {
  Default: { css: {}, rowHeight: 48, striped: false, showColumnLines: false },
  Compact: {
    rowHeight: 32,
    striped: true,
    showColumnLines: false,
    css: {
      '--u-grid-cell-block-padding': '4px',
      '--u-grid-cell-font-size': '0.8125rem',
      '--u-grid-header-cell-height': '36px',
      '--u-grid-toolbar-height': '44px',
      '--u-grid-group-chip-height': '28px',
    },
  },
  Spreadsheet: {
    rowHeight: 28,
    striped: false,
    showColumnLines: true,
    css: {
      '--u-grid-cell-padding': '4px 8px',
      '--u-grid-header-cell-padding': '4px 8px',
      '--u-grid-header-cell-height': '30px',
      '--u-grid-cell-font-size': '0.8125rem',
      '--u-grid-line-opacity': '35%',
      '--u-grid-header-background-color': 'light-dark(#f1f3f4, #2d2f31)',
      '--u-grid-selected-row-indicator-width': '0',
      '--u-grid-focus-ring-color': '#1a73e8',
      '--u-grid-row-hover-opacity': '0%',
    },
  },
  Brand: {
    rowHeight: 44,
    striped: true,
    showColumnLines: false,
    css: {
      '--u-grid-background-color': '#f4fbfa',
      '--u-grid-color': '#0e2a29',
      '--u-grid-header-background-color': '#cce8e6',
      '--u-grid-header-cell-font-weight': '700',
      '--u-grid-striped-background-color': '#e6f4f2',
      '--u-grid-selected-row-background-color': '#b0dcd8',
      '--u-grid-selected-row-indicator-color': '#00696d',
      '--u-grid-focus-ring-color': '#00696d',
      '--u-grid-sorted-header-color': '#00696d',
      '--u-grid-drop-indicator-color': '#00696d',
      '--u-grid-group-chip-outline-color': '#00696d',
      '--u-grid-group-chip-shape': '16px',
    },
  },
  'Dark surface': {
    rowHeight: 48,
    striped: false,
    showColumnLines: false,
    css: {
      '--u-grid-background-color': '#1b1b21',
      '--u-grid-color': '#e4e1e9', // always together with the background
      '--u-grid-header-background-color': '#25252c',
      '--u-grid-summary-background-color': '#25252c',
      '--u-grid-selected-row-background-color': '#3a3768',
      '--u-grid-selected-row-indicator-color': '#c6bfff',
      '--u-grid-focus-ring-color': '#c6bfff',
      '--u-grid-group-toggle-color': '#c8c5d0',
      '--u-grid-group-chip-outline-color': '#928f9a',
    },
  },
};

export default (host: HTMLElement) => {
  const grid = createGrid(host, 420);

  grid.keyExpr = 'id';
  grid.selectionMode = 'multiple';
  grid.showCheckboxes = true;
  grid.columns = [
    { path: 'country', label: 'Country', width: 160, groupIndex: 0 },
    { path: 'customer', label: 'Customer', width: 200 },
    { path: 'product', label: 'Product', width: 150 },
    { path: 'quantity', label: 'Qty', width: 90, dataType: 'number' },
    { path: 'total', label: 'Total', width: 150, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  ];
  grid.summary = { total: [{ column: 'total', type: 'sum' }] };
  grid.autoExpandGroups = true;
  grid.items = makeOrders(200);

  const code = el('pre', { className: 'demo-log', ariaLabel: 'Theme code', tabIndex: 0 });

  const apply = (name: string) => {
    const theme = THEMES[name]!;

    grid.removeAttribute('style'); // drop the previous theme…
    grid.style.height = '420px'; // …but keep the height

    for (const [property, value] of Object.entries(theme.css)) {
      grid.style.setProperty(property, value);
    }

    grid.rowHeight = theme.rowHeight;
    grid.striped = theme.striped;
    grid.showColumnLines = theme.showColumnLines;

    const declarations = Object.entries(theme.css).map(([property, value]) => `  ${property}: ${value};`);
    const attributes = [`row-height="${theme.rowHeight}"`, theme.striped && 'striped', theme.showColumnLines && 'show-column-lines'].filter(Boolean);

    code.textContent = `u-grid {\n${declarations.join('\n') || '  /* the defaults */'}\n}\n\n<u-grid ${attributes.join(' ')}></u-grid>`;
  };

  controls(host, select('Theme', Object.keys(THEMES), 'Default', apply));
  host.append(code);
  apply('Default');
};
