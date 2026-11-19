import '@universal-material/data-grid';
import { createXlsxExporter, downloadXlsx, type ExcelJSRow, type ExcelJSWorkbook, type ExcelJSWorksheet } from '@universal-material/data-grid/export-xlsx';

import { button, controls, createGrid, eventLog } from '../shared/controls.js';
import { makeOrders } from '../shared/data.js';

export const meta = {
  title: 'Excel and the Export button',
  description: '`export-formats="csv xlsx"` adds an **Export** button to the toolbar (with "Export selected rows" entries when rows can be selected). Excel goes through the optional `export-xlsx` entry point, which takes the ExcelJS module you pass it: the grid does not depend on ExcelJS. This demo loads it **lazily from a CDN** (`exceljs@4.4.0` on jsDelivr) the first time you export to Excel; in your app, `import ExcelJS from \'exceljs\'`. `customize` styles the sheet, and `u-grid-exporting` / `u-grid-export` / `u-grid-export-error` report the toolbar exports.',
};

// With `import ExcelJS from 'exceljs'` you get ExcelJS's own types; for the CDN bundle we
// describe the part we use.
type Worksheet = ExcelJSWorksheet & { getRow(index: number): ExcelJSRow };
type ExcelJSModule = { Workbook: new () => ExcelJSWorkbook & { addWorksheet(name?: string): Worksheet } };

const EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
let excelJS: Promise<ExcelJSModule> | undefined;

// Loads the ExcelJS browser bundle once (it sets `window.ExcelJS`).
const loadExcelJS = () => (excelJS ??= new Promise<ExcelJSModule>((resolve, reject) => {
  const script = document.createElement('script');
  script.src = EXCELJS_URL;
  script.crossOrigin = 'anonymous';
  script.onload = () => resolve((window as unknown as { ExcelJS: ExcelJSModule }).ExcelJS);
  script.onerror = () => {
    excelJS = undefined;
    script.remove();
    reject(new Error('Could not load ExcelJS.'));
  };
  document.head.append(script);
}));

export default (host: HTMLElement) => {
  const grid = createGrid(host, 380);

  grid.keyExpr = 'id';
  grid.selectionMode = 'multiple';
  grid.showCheckboxes = true;
  grid.exportFormats = ['csv', 'xlsx'];
  grid.csvExportOptions = { fileName: 'orders.csv' };
  grid.columns = [
    { path: 'category', label: 'Category', width: 150, groupIndex: 0 },
    { path: 'id', label: 'Order', width: 90, dataType: 'number' },
    { path: 'customer', label: 'Customer', width: 190 },
    { path: 'orderDate', label: 'Date', width: 140, dataType: 'date' },
    { path: 'priority', label: 'Priority', width: 110, dataType: 'boolean' },
    { path: 'total', label: 'Total', width: 140, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  ];
  grid.summary = { group: [{ column: 'total', type: 'sum' }], total: [{ column: 'total', type: 'sum' }] };
  grid.items = makeOrders(300);

  // The toolbar's Excel entry: an exporter that loads ExcelJS on first use.
  grid.xlsxExporter = async (target, options) => {
    const exporter = createXlsxExporter(await loadExcelJS(), { fileName: 'orders.xlsx', sheetName: 'Orders' });
    await exporter(target, options);
  };

  const log = eventLog(host);

  grid.addEventListener('u-grid-exporting', event => log.write(`u-grid-exporting  ${event.detail.format}${event.detail.selectedOnly ? ' (selected rows)' : ''}`));
  grid.addEventListener('u-grid-export', event => log.write(`u-grid-export  ${event.detail.format} done`));
  grid.addEventListener('u-grid-export-error', event => log.write(`u-grid-export-error  ${String(event.detail.error)}`));

  controls(host,
    button('Download styled .xlsx', async () => {
      await downloadXlsx(grid, await loadExcelJS(), {
        fileName: 'orders-styled.xlsx',
        sheetName: 'Orders',
        customize: worksheet => {
          // `worksheet` is ExcelJS's own Worksheet: style the header row
          worksheet.getRow(1).font = { bold: true, color: { argb: 'FF1565C0' } };
        },
      });
      log.write('downloadXlsx() done');
    }));
};
