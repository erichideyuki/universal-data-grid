import '@universal-material/data-grid';
import type { GridColumnDef, GridColumnFixed } from '@universal-material/data-grid';

import { controls, createGrid, eventLog, select } from '../shared/controls.js';
import { makeOrders, type Order } from '../shared/data.js';

export const meta = {
  title: 'Multi-level headers',
  description: 'Bands nest to any depth and only take `label`, `alignment`, `fixed`, `visible` and `showInChooser`. A column moves only inside its band; dragging a band moves the whole block. Fixing a band fixes its columns. In the column chooser a band is a checkbox over its columns. On the keyboard, `↑`/`↓` move between header levels.',
};

export default (host: HTMLElement) => {
  const grid = createGrid(host, 400);

  const columns = (orderFixed: GridColumnFixed): GridColumnDef<Order>[] => [
    { label: 'Order', fixed: orderFixed, columns: [
      { path: 'id', label: 'Number', width: 100 },
      { path: 'orderDate', label: 'Date', width: 120, dataType: 'date' },
    ] },
    { label: 'Customer', columns: [
      { path: 'customer', label: 'Name', width: 180 },
      { path: 'country', label: 'Country', width: 150 },
    ] },
    { label: 'Item', columns: [
      { path: 'category', label: 'Category', width: 130 },
      { path: 'product', label: 'Product', width: 140 },
      // A band inside a band: three header rows.
      { label: 'Pricing', columns: [
        { path: 'quantity', label: 'Qty', width: 80 },
        { path: 'unitPrice', label: 'Unit price', width: 120, format: { style: 'currency', currency: 'USD' } },
        { path: 'total', label: 'Total', width: 130, format: { style: 'currency', currency: 'USD' } },
      ] },
    ] },
    // No band above: spans every header row.
    { path: 'status', label: 'Status', width: 130 },
  ];

  grid.keyExpr = 'id';
  grid.columnChooser = true;
  grid.columnResizing = true;
  grid.showColumnLines = true;
  grid.columns = columns('start');
  grid.items = makeOrders(300);

  const log = eventLog(host);

  grid.addEventListener('u-grid-column-reorder', ({ detail }) =>
    log.write(`u-grid-column-reorder  ${detail.column.label} in ${detail.band?.label ?? 'top level'}: ${detail.previousIndex} → ${detail.index}`));
  grid.addEventListener('u-grid-column-visibility-change', ({ detail }) =>
    log.write(`u-grid-column-visibility-change  ${detail.column.label}: ${detail.visible ? 'shown' : 'hidden'}`));

  controls(host,
    // A new `fixed` on the definition wins over what the user picked in the chooser.
    select('Fix the Order band', [['start', 'Start'], ['none', 'Not fixed'], ['end', 'End']], 'start',
      value => (grid.columns = columns(value === 'none' ? null : value))));
};
