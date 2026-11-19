import '@universal-material/data-grid';

import { button, checkbox, controls, createGrid, eventLog, stat } from '../shared/controls.js';
import { makeOrders } from '../shared/data.js';
import { fakeServer } from '../shared/fake-server.js';

export const meta = {
  title: 'Paging',
  description: '`paging` shows a pager below the rows; `pageSize` and `pageSizeOptions` set the page sizes, and `PageUp`/`PageDown` change the page from the keyboard. `u-grid-page-change` fires for the pager, the keyboard and automatic corrections (a new filter goes back to page 1) — not for the `pageIndex` setter. With a remote source, each page is one request of `pageSize` rows.',
};

export default (host: HTMLElement) => {
  const rows = makeOrders(1_000);
  const page = stat();
  const grid = createGrid(host, 440);

  grid.keyExpr = 'id';
  grid.paging = true;
  grid.pageSize = 10;
  grid.pageSizeOptions = [10, 25, 50];
  grid.showSearchPanel = true;
  grid.columns = [
    { path: 'id', label: 'Order', width: 100, dataType: 'number' },
    { path: 'customer', label: 'Customer', width: 200 },
    { path: 'country', label: 'Country', width: 160 },
    { path: 'product', label: 'Product', width: 160 },
    { path: 'total', label: 'Total', width: 150, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  ];
  grid.items = rows;

  const log = eventLog(host);
  const showPage = () => (page.textContent = `pageIndex ${grid.pageIndex}, pageSize ${grid.pageSize}`);

  grid.addEventListener('u-grid-page-change', ({ detail }) => {
    log.write(`u-grid-page-change page ${detail.previousPageIndex} → ${detail.pageIndex}, size ${detail.previousPageSize} → ${detail.pageSize} (${detail.source})`);
    showPage();
  });

  controls(host,
    button('First page', () => { grid.pageIndex = 0; showPage(); }),
    button('Page 5', () => { grid.pageIndex = 4; showPage(); }),
    button('Last page', () => { grid.pageIndex = Math.ceil(grid.getTotalCount() / grid.pageSize) - 1; showPage(); }),
    checkbox('Remote (server pages)', false, remote => {
      if (remote) {
        grid.items = []; // use one or the other: items or dataSource
        grid.remoteOperations = true;
        grid.dataSource = fakeServer(rows, { latency: 400 });
      } else {
        grid.dataSource = null;
        grid.remoteOperations = false;
        grid.items = rows;
      }
    }),
    page);

  showPage();
};
