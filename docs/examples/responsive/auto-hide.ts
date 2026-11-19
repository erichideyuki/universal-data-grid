import '@universal-material/data-grid';
import type { GridColumnDef } from '@universal-material/data-grid';

import { controls, el, eventLog, stat } from '../shared/controls.js';
import { makeOrders, type Order } from '../shared/data.js';

export const meta = {
  title: 'Auto-hide by priority',
  description: 'Drag the slider to narrow the grid\'s container. Columns with the lowest `hidingPriority` leave first (Date, then Category, Country…); Customer has none, so it never hides, and neither does the fixed Order column. Expand a row (or press `Enter` on its toggle cell) to read the hidden values.',
};

export default (host: HTMLElement) => {
  // The grid reacts to its own width, not the window's: a narrow container is enough.
  const container = el('div');
  container.style.cssText = 'width: 1100px; max-width: 100%; box-sizing: border-box; padding: 4px; border: 1px dashed; border-radius: 8px';
  const grid = document.createElement('u-grid');
  grid.style.height = '400px';
  container.append(grid);
  host.append(container);

  const columns: GridColumnDef<Order>[] = [
    { path: 'id', label: 'Order', width: 90, fixed: 'start' },
    { path: 'customer', label: 'Customer', width: 180 },
    { path: 'country', label: 'Country', width: 150, hidingPriority: 2 },
    { path: 'category', label: 'Category', width: 130, hidingPriority: 1 },
    { path: 'product', label: 'Product', width: 140, hidingPriority: 3 },
    { path: 'orderDate', label: 'Date', width: 120, dataType: 'date', hidingPriority: 0 },
    { path: 'status', label: 'Status', width: 120, hidingPriority: 4 },
    { path: 'total', label: 'Total', width: 130, format: { style: 'currency', currency: 'USD' }, hidingPriority: 5 },
  ];

  grid.keyExpr = 'id';
  grid.autoHideColumns = true;
  grid.columnChooser = true;
  grid.columns = columns;
  grid.items = makeOrders(200);

  const hidden = stat('Hidden: none');
  const log = eventLog(host);

  grid.addEventListener('u-grid-adaptive-columns-change', ({ detail }) => {
    const labels = detail.columns.map(column => column.label).join(', ') || 'none';
    hidden.textContent = `Hidden: ${labels}`;
    log.write(`u-grid-adaptive-columns-change  ${detail.previous.length} → ${detail.columns.length} hidden (${labels})`);
  });

  const width = el('input', { type: 'range', min: '280', max: '1100', step: '10', value: '1100' });
  const widthText = stat('1100px');
  width.addEventListener('input', () => {
    container.style.width = `${width.value}px`;
    widthText.textContent = `${width.value}px`;
  });

  controls(host, el('label', {}, 'Container width', width), widthText, hidden);
};
