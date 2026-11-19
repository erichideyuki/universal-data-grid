import { html } from 'lit';

import '@universal-material/data-grid';
import type { GridColumnDef } from '@universal-material/data-grid';

import { checkbox, controls, createGrid, eventLog } from '../shared/controls.js';
import { makeOrders, type Order } from '../shared/data.js';

export const meta = {
  title: 'Context menus',
  description: 'Right-click (or long-press, `Shift`+`F10`, the menu key) a header, a group chip or a row. Headers have built-in items (sort, group, pin, move, auto-size); rows get theirs with `row-menu` (copy, edit, delete). Before any menu opens, `u-grid-context-menu-opening` lets you change `detail.menuItems` in place — here it adds **Open order** and **Mark as priority** to rows, **Choose columns…** to headers, and removes **Clear sorting**. The "⋯" button in each row calls `openContextMenu()`.',
};

export default (host: HTMLElement) => {
  const grid = createGrid(host, 400);
  let orders = makeOrders(300);

  const actions: GridColumnDef<Order> = {
    label: 'Actions',
    width: 90,
    exportable: false,
    sortable: false,
    renderer: (_item, ctx) => html`
      <button type="button" aria-label="Order actions" aria-haspopup="menu"
        @click=${(event: Event) => grid.openContextMenu({ rowKey: ctx.rowKey }, event.currentTarget as HTMLElement)}>⋯</button>`,
  };

  grid.keyExpr = 'id';
  grid.rowMenu = true;
  grid.allowEditing = true;
  grid.allowRemoving = true;
  grid.editMode = 'batch';
  grid.columnChooser = true;
  grid.columns = [
    { path: 'id', label: 'Order', width: 90, dataType: 'number', editable: false },
    { path: 'customer', label: 'Customer', width: 190 },
    { path: 'country', label: 'Country', width: 150 },
    { path: 'status', label: 'Status', width: 120 },
    { path: 'priority', label: 'Priority', width: 110, dataType: 'boolean' },
    { path: 'total', label: 'Total', width: 130, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
    actions,
  ];
  grid.items = orders;

  const log = eventLog(host);

  grid.addEventListener('u-grid-context-menu-opening', event => {
    const { target, menuItems } = event.detail;
    log.write(`u-grid-context-menu-opening  target=${target}  built-ins: ${menuItems.map(item => item.name).join(', ') || '(none)'}`);

    if (target === 'row') {
      menuItems.push(
        { id: 'open', text: 'Open order', separatorBefore: true, action: ({ item }) => log.write(`Open order #${(item as Order).id}`) },
        {
          id: 'priority',
          text: 'Mark as priority',
          disabled: (event.detail.item as Order).priority,
          action: ({ item }) => {
            // Never mutate the items: replace the row with a copy.
            orders = orders.map(order => (order === item ? { ...order, priority: true } : order));
            grid.items = orders;
          },
        },
      );
    }

    if (target === 'header') {
      const sort = menuItems.findIndex(item => item.name === 'clearColumnSorting');

      if (sort >= 0) {
        menuItems.splice(sort, 1);
      }

      menuItems.push({ id: 'columns', text: 'Choose columns…', separatorBefore: true, action: () => grid.openColumnChooser() });
    }
  });

  controls(host,
    checkbox('Row menu (row-menu)', true, value => (grid.rowMenu = value)),
    checkbox('Header menu', true, value => (grid.columnHeaderMenu = value)));
};
