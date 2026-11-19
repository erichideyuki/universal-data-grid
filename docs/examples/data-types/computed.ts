import '@universal-material/data-grid';
import type { GridColumnDef } from '@universal-material/data-grid';

import { checkbox, controls, createGrid } from '../shared/controls.js';
import { makeOrders, type Order } from '../shared/data.js';

export const meta = {
  title: 'Computed columns and custom text',
  description: '`valueGetter` computes the cell value from the row: it is also what the grid sorts, groups and exports. A `format` function or `displayValue` turns the value into text — `displayValue` also labels the group rows. Group by **Size** to see a computed column used as a group key.',
};

const SIZES = ['Small', 'Medium', 'Large'] as const;

export default (host: HTMLElement) => {
  const grid = createGrid(host, 420);
  const usd = new Intl.NumberFormat('en', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  // Computed bucket: 0, 1 or 2, so it sorts in size order; displayValue gives the text.
  const sizeColumn: GridColumnDef<Order> = {
    label: 'Size',
    width: 110,
    valueGetter: order => (order.total < 1_000 ? 0 : order.total < 4_000 ? 1 : 2),
    displayValue: value => SIZES[value as number]!,
    alignment: 'start',
  };

  const columns: GridColumnDef<Order>[] = [
    { path: 'customer', label: 'Customer', width: 170 },
    { path: 'product', label: 'Product', width: 140 },
    { path: 'quantity', label: 'Qty', width: 80 },
    { path: 'total', label: 'Total', width: 120, format: { style: 'currency', currency: 'USD' } },
    // Computed number: sorts numerically, formatted with Intl options.
    { label: 'Tax (8%)', width: 110, valueGetter: order => order.total * 0.08, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
    sizeColumn,
    // A format function receives the value and the row.
    { path: 'unitPrice', label: 'Price × qty', width: 170, format: (value, order) => `${order.quantity} × ${usd.format(value as number)}` },
    { path: 'orderDate', label: 'Quarter', width: 110, dataType: 'date', format: value => {
      const date = value as Date;
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
    } },
  ];

  grid.keyExpr = 'id';
  grid.autoExpandGroups = true;
  grid.columns = columns;
  grid.items = makeOrders(400);

  controls(host,
    checkbox('Group by size', false, grouped => (grouped ? grid.groupColumn(sizeColumn) : grid.ungroupColumn(sizeColumn))));
};
