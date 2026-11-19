import '@universal-material/data-grid';
import type { GridColumnDef, GridResizeMode } from '@universal-material/data-grid';

import { button, controls, createGrid, eventLog, select } from '../shared/controls.js';
import { makeOrders, type Order } from '../shared/data.js';

export const meta = {
  title: 'Resizing',
  description: 'With `column-resizing` each header gets a handle: drag it, **double-click** it to fit the content, or press `Alt+←/→` on a header. `minWidth`/`maxWidth` are respected (Customer: 120–320 px) and `resizable: false` opts a column out (Order). `resize-mode="next-column"` keeps the total width.',
};

export default (host: HTMLElement) => {
  const grid = createGrid(host, 360);

  const customer: GridColumnDef<Order> = { path: 'customer', label: 'Customer', width: 180, minWidth: 120, maxWidth: 320 };
  const product: GridColumnDef<Order> = { path: 'product', label: 'Product', width: 140 };
  const columns: GridColumnDef<Order>[] = [
    { path: 'id', label: 'Order', width: 90, resizable: false },
    customer,
    { path: 'country', label: 'Country', width: 150 },
    product,
    { path: 'quantity', label: 'Qty', width: 90 },
    { path: 'total', label: 'Total', width: 130, format: { style: 'currency', currency: 'USD' } },
  ];

  grid.keyExpr = 'id';
  grid.columnResizing = true;
  grid.columns = columns;
  grid.items = makeOrders(200);

  const log = eventLog(host);

  grid.addEventListener('u-grid-column-resize', event => {
    const { column, width: newWidth, previousWidth, nextColumn, nextColumnWidth } = event.detail;
    const next = nextColumn ? ` · ${nextColumn.label} → ${nextColumnWidth}px` : '';
    log.write(`u-grid-column-resize  ${column.label}: ${previousWidth}px → ${newWidth}px${next}`);
  });

  controls(host,
    select<GridResizeMode>('Mode', ['widget', 'next-column'], 'widget', value => (grid.resizeMode = value)),
    // API calls change the width without firing the event (it is only for user gestures).
    button('Product to 260px', () => grid.setColumnWidth(product, 260)),
    button('Auto-size Customer', () => grid.autoSizeColumn(customer)),
    // Back to the widths in the column definitions (and the initial sort, order…).
    button('Reset', () => grid.resetState()));
};
