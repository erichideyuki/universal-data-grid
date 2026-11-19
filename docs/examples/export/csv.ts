import '@universal-material/data-grid';
import type { GridCsvOptions } from '@universal-material/data-grid';

import { button, checkbox, controls, createGrid, select } from '../shared/controls.js';
import { makeOrders } from '../shared/data.js';

export const meta = {
  title: 'CSV',
  description: '`downloadCsv(options)` builds the file from the current view and downloads it (`exportCsv` returns the `Blob` instead). Group the grid, filter it or select rows, then download: `selectedOnly`, `includeGroups`, `includeSummaries`, `rawValues` and `separator` (`auto` uses `;` for languages with a decimal comma, as Excel expects) are some of the options. Text starting with `=`, `+`, `-` or `@` is escaped against CSV injection.',
};

export default (host: HTMLElement) => {
  const grid = createGrid(host, 380);

  grid.keyExpr = 'id';
  grid.selectionMode = 'multiple';
  grid.showCheckboxes = true;
  grid.showSearchPanel = true;
  grid.columns = [
    { path: 'country', label: 'Country', width: 160, groupIndex: 0 },
    { path: 'id', label: 'Order', width: 90, dataType: 'number' },
    { path: 'customer', label: 'Customer', width: 190 },
    { path: 'orderDate', label: 'Date', width: 140, dataType: 'date' },
    { path: 'quantity', label: 'Qty', width: 100, dataType: 'number' },
    { path: 'total', label: 'Total', width: 140, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  ];
  grid.summary = {
    group: [{ column: 'total', type: 'sum', display: 'footer' }],
    total: [{ column: 'id', type: 'count' }, { column: 'total', type: 'sum' }],
  };
  grid.items = makeOrders(300);

  const options: GridCsvOptions = { separator: 'auto', includeGroups: true, includeSummaries: true, rawValues: false };

  controls(host,
    select<string>('Separator', [['auto', 'auto'], [',', 'comma'], [';', 'semicolon'], ['\t', 'tab']], 'auto', value => (options.separator = value)),
    checkbox('Groups', true, value => (options.includeGroups = value)),
    checkbox('Summaries', true, value => (options.includeSummaries = value)),
    checkbox('Raw values', false, value => (options.rawValues = value)),
    button('Download CSV', () => grid.downloadCsv({ ...options, fileName: 'orders.csv' })),
    button('Download selected rows', () => grid.downloadCsv({ ...options, selectedOnly: true, fileName: 'selected-orders.csv' })));
};
