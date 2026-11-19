import { html } from 'lit';

import '@universal-material/data-grid';
import type { GridRowRenderer } from '@universal-material/data-grid';

import { checkbox, controls, createGrid, select } from '../shared/controls.js';
import { makeOrders, type Order } from '../shared/data.js';

export const meta = {
  title: 'Fixed rows and full-width rows',
  description: '`fixedTopItems` and `fixedBottomItems` are rows of your own data pinned under the headers and above the bottom edge — a target, an average — outside sorting, filtering and paging. `rowRenderer(item, ctx)` replaces a row\'s cells with one cell spanning the grid; return `false` to keep the columns. Decide `false` first and cheaply: it runs for every rendered row.',
};

type Row = Order & { notice?: string };

const notice = (id: number, text: string) => ({ id, notice: text }) as Row;

const noticeTemplate = (row: Row) => html`<div style="padding: 12px 0; font-weight: 500">${row.notice}</div>`;

// Full-width notice rows mixed with the data; every other row keeps its columns.
const noticeRows: GridRowRenderer<Row> = row => row.notice !== undefined && noticeTemplate(row);

// Every body row as a card (fixed rows keep their columns).
const cardRows: GridRowRenderer<Row> = (row, { fixed }) => {
  if (fixed) {
    return false;
  }

  return row.notice !== undefined ? noticeTemplate(row) : html`
    <div style="display: flex; gap: 24px; align-items: baseline; padding: 12px 0">
      <strong style="min-width: 160px">${row.customer}</strong>
      <span>${row.quantity} × ${row.product}</span>
      <span>${row.country}</span>
      <span style="margin-inline-start: auto">${row.status}</span>
    </div>`;
};

export default (host: HTMLElement) => {
  const orders: Row[] = makeOrders(300);
  const target = { id: 'target', customer: 'Target per order', total: 2_500 };
  const average = { id: 'average', customer: 'Average', total: orders.reduce((sum, order) => sum + order.total, 0) / orders.length };
  const grid = createGrid(host, 460);

  grid.keyExpr = 'id';
  grid.columns = [
    { path: 'customer', label: 'Customer', width: 200 },
    { path: 'product', label: 'Product', width: 160 },
    { path: 'quantity', label: 'Qty', width: 90, dataType: 'number' },
    { path: 'total', label: 'Total', width: 150, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  ];
  grid.items = [
    notice(-1, 'Orders from the new web shop start here.'),
    ...orders.slice(0, 40),
    notice(-2, 'Orders below were imported from the legacy system.'),
    ...orders.slice(40),
  ];
  grid.fixedTopItems = [target];
  grid.fixedBottomItems = [average];
  grid.rowRenderer = noticeRows;

  controls(host,
    select('Full-width rows', [['notices', 'Notices only'], ['cards', 'Cards for every row'], ['off', 'Off']], 'notices',
      value => (grid.rowRenderer = value === 'notices' ? noticeRows : value === 'cards' ? cardRows : null)),
    checkbox('Fixed top row', true, value => (grid.fixedTopItems = value ? [target] : [])),
    checkbox('Fixed bottom row', true, value => (grid.fixedBottomItems = value ? [average] : [])));
};
