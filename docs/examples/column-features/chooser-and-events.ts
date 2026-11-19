import '@universal-material/data-grid';
import type { GridColumnDef } from '@universal-material/data-grid';

import { button, controls, createGrid, eventLog } from '../shared/controls.js';
import { makeOrders, type Order } from '../shared/data.js';

export const meta = {
  title: 'Column chooser, reordering and events',
  description: '`column-chooser` adds a button that lists the columns: show or hide them and fix them to either edge (`showInChooser: false` leaves Order out; Status starts with `visible: false`). Drag headers to reorder them, or press `Alt+Shift+←/→` on a header. Column events fire **only for user gestures** — the API buttons change the grid silently.',
};

export default (host: HTMLElement) => {
  const grid = createGrid(host, 360);

  const total: GridColumnDef<Order> = { path: 'total', label: 'Total', width: 130, format: { style: 'currency', currency: 'USD' } };
  const columns: GridColumnDef<Order>[] = [
    { path: 'id', label: 'Order', width: 90, showInChooser: false },
    { path: 'customer', label: 'Customer', width: 180 },
    { path: 'country', label: 'Country', width: 150 },
    { path: 'product', label: 'Product', width: 140 },
    { path: 'status', label: 'Status', width: 130, visible: false },
    { path: 'quantity', label: 'Qty', width: 90 },
    total,
  ];

  grid.keyExpr = 'id';
  grid.columnChooser = true;
  grid.columnResizing = true;
  grid.columns = columns;
  grid.items = makeOrders(200);

  const log = eventLog(host);

  grid.addEventListener('u-grid-column-visibility-change', ({ detail }) =>
    log.write(`u-grid-column-visibility-change  ${detail.column.label}: ${detail.visible ? 'shown' : 'hidden'}`));
  grid.addEventListener('u-grid-column-fixed-change', ({ detail }) =>
    log.write(`u-grid-column-fixed-change  ${detail.column.label}: ${detail.previousFixed ?? 'none'} → ${detail.fixed ?? 'none'}`));
  grid.addEventListener('u-grid-column-reorder', ({ detail }) =>
    log.write(`u-grid-column-reorder  ${detail.column.label}: ${detail.previousIndex} → ${detail.index}`));
  grid.addEventListener('u-grid-column-resize', ({ detail }) =>
    log.write(`u-grid-column-resize  ${detail.column.label}: ${detail.width}px`));

  controls(host,
    button('Open chooser', () => grid.openColumnChooser()),
    button('Move Total first', () => grid.moveColumn(total, 0)),
    button('Reset', () => grid.resetState()));
};
