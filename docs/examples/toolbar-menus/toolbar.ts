import { html } from 'lit';

import { GRID_DEFAULT_TOOLBAR_ITEMS } from '@universal-material/data-grid';
import type { GridToolbarItem, GridToolbarItemName } from '@universal-material/data-grid';

import { controls, createGrid, eventLog, select } from '../shared/controls.js';
import { makeOrders, STATUSES } from '../shared/data.js';

export const meta = {
  title: 'Toolbar items',
  description: '`toolbarItems` picks the items, their order and side (`location`). Built-ins are names (or objects to configure them); your buttons have `text`, an optional decorative `icon` and an `action`; `renderer` items put your own content in the bar (the status filter here). `locateInMenu: \'always\'` sends an item to the **More actions** menu, and `auto` items move there when the bar is too narrow — make the window narrower to see it. The bar is one `Tab` stop: `←`/`→` move between its buttons.',
};

const refreshIcon = html`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"/></svg>`;

export default (host: HTMLElement) => {
  const grid = createGrid(host, 400);
  let seed = 7;

  grid.keyExpr = 'id';
  grid.selectionMode = 'multiple';
  grid.allowEditing = true;
  grid.allowAdding = true;
  grid.columnChooser = true;
  grid.showSearchPanel = true;
  grid.exportFormats = ['csv'];
  grid.columns = [
    { path: 'id', label: 'Order', width: 90, dataType: 'number', editable: false },
    { path: 'customer', label: 'Customer', width: 200 },
    { path: 'country', label: 'Country', width: 160 },
    { path: 'status', label: 'Status', width: 130 },
    { path: 'total', label: 'Total', width: 140, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  ];
  grid.items = makeOrders(300, seed);

  const log = eventLog(host);

  const statusFilter: GridToolbarItem = {
    location: 'start',
    renderer: () => html`
      <label>Status
        <select @change=${(event: Event) => {
          const value = (event.target as HTMLSelectElement).value;
          grid.filterValue = value ? ['status', '=', value] : null;
        }}>
          <option value="">All</option>
          ${STATUSES.map(status => html`<option>${status}</option>`)}
        </select>
      </label>`,
  };

  const custom: GridToolbarItem[] = [
    statusFilter,
    {
      text: 'Reload',
      icon: refreshIcon,
      showText: 'in-menu',
      action: () => {
        grid.items = makeOrders(300, ++seed);
        log.write('Reload: new rows loaded');
      },
    },
    {
      text: 'Select first 10',
      locateInMenu: 'auto', // host buttons default to 'never'
      action: ({ grid }) => grid.selectRows(Array.from({ length: 10 }, (_, i) => grid.getRowKey(i)).filter(key => key !== undefined)),
    },
    { text: 'Print', action: () => print(), locateInMenu: 'always' },
    { text: 'About this view', action: () => log.write('About this view (from the More actions menu)'), locateInMenu: 'always' },
  ];

  const layouts: Record<string, readonly (GridToolbarItemName | GridToolbarItem)[] | null> = {
    'Default (null)': null,
    'Built-ins + custom': [...GRID_DEFAULT_TOOLBAR_ITEMS, ...custom],
    'Search at the start': [
      { name: 'searchPanel', location: 'start' },
      ...GRID_DEFAULT_TOOLBAR_ITEMS.filter(name => name !== 'searchPanel'),
      ...custom,
    ],
    'Custom only': custom,
    'Hidden ([])': [],
  };

  grid.toolbarItems = layouts['Built-ins + custom']!;

  controls(host,
    select('Toolbar', Object.keys(layouts), 'Built-ins + custom', value => {
      // Replace the array instead of mutating it.
      grid.toolbarItems = layouts[value] ?? null;
    }));
};
