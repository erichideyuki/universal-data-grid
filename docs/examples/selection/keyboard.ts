import '@universal-material/data-grid';

import { button, controls, createGrid, eventLog } from '../shared/controls.js';
import { makeOrders } from '../shared/data.js';

export const meta = {
  title: 'Keyboard navigation',
  description: 'Click a cell (or `Tab` into the grid) and use the keys: arrows move between cells (the header is the first row), `Home`/`End` go to the ends of the row, `Ctrl`+`Home`/`Ctrl`+`End` to the first/last cell, `PageUp`/`PageDown` scroll a page, `Space` selects the row and `Shift`+`↑`/`↓` extends the selection. On a header, `Enter` sorts, `Alt`+`←`/`→` resizes, `Alt`+`Shift`+`←`/`→` moves the column, `Ctrl`+`G` groups and `Shift`+`F10` opens its menu. `u-grid-focus-change` reports every move; `focusCell` scrolls to a cell and focuses it.',
};

export default (host: HTMLElement) => {
  const grid = createGrid(host, 380);

  grid.keyExpr = 'id';
  grid.selectionMode = 'multiple';
  grid.columnResizing = true;
  grid.columns = [
    { path: 'id', label: 'Order', width: 90, dataType: 'number' },
    { path: 'customer', label: 'Customer', width: 200 },
    { path: 'country', label: 'Country', width: 160 },
    { path: 'orderDate', label: 'Date', width: 140, dataType: 'date' },
    { path: 'total', label: 'Total', width: 140, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  ];
  grid.items = makeOrders(2_000);

  const log = eventLog(host);

  grid.addEventListener('u-grid-focus-change', event => {
    const { rowKey, column, cellType, source } = event.detail;
    log.write(`u-grid-focus-change  ${cellType}  row=${String(rowKey)}  column=${column?.label ?? '–'}  source=${source}`);
  });

  controls(host,
    button('Focus order 1500 · Total', () => grid.focusCell(1500, 'total')),
    button('Focus order 1 · Customer', () => grid.focusCell(1, 'customer')),
    button('Focus the grid', () => grid.focus()),
    button('Log focusedRowKey', () => log.write(`focusedRowKey = ${String(grid.focusedRowKey)}`)));
};
