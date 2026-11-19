import '@universal-material/data-grid';
import type { GridColumnDef } from '@universal-material/data-grid';

import { el, select } from '../shared/controls.js';
import { makeStocks, type Stock } from '../shared/data.js';

export const meta = {
  title: 'Formatting follows the language',
  description: 'Each grid has its own `language`, and region codes work: `en-IN` groups digits in lakhs, `de-CH` uses apostrophes, `ar-EG` uses Arabic-Indic digits. The texts fall back to the base language (`de-CH` → `de`); a language without a built-in translation (`hi-IN`) shows English texts with Hindi formatting. Dates, numbers, `Intl` `format` options and summaries all use it.',
};

const LOCALES = ['en-US', 'en-GB', 'en-IN', 'de-DE', 'de-CH', 'fr-FR', 'pt-BR', 'ja-JP', 'zh-CN', 'hi-IN', 'ar-EG'] as const;

const columns: GridColumnDef<Stock>[] = [
  { path: 'symbol', label: 'Symbol', width: 110 },
  { path: 'price', label: 'Price', width: 140, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  { path: 'changePercent', label: 'Change', width: 120, dataType: 'number', format: { style: 'percent', minimumFractionDigits: 2 } },
  { path: 'volume', label: 'Volume', width: 150, dataType: 'number' },
  { path: 'updatedAt', label: 'Updated', width: 220, dataType: 'date', format: { dateStyle: 'medium', timeStyle: 'short' } },
];

export default (host: HTMLElement) => {
  const stocks = makeStocks(8).map((stock, i) => ({
    ...stock,
    changePercent: (i % 2 ? -1 : 1) * (i + 1) * 0.0123,
    volume: stock.volume * 37,
    updatedAt: new Date(Date.UTC(2025, 11, 31, 14, 30)),
  }));

  for (const locale of ['en-US', 'de-CH', 'en-IN'] as const) {
    const grid = document.createElement('u-grid');

    grid.style.height = '230px';
    grid.style.marginBottom = '16px';
    grid.language = locale; // per grid: two grids on the same page can differ
    grid.keyExpr = 'symbol';
    grid.showGroupPanel = false;
    grid.columns = columns;
    grid.summary = { total: [{ column: 'volume', type: 'sum' }] };
    grid.items = stocks;

    host.append(
      el('div', { className: 'demo-controls' }, select('Language', LOCALES, locale, value => {
        grid.language = value;
        grid.dir = value.startsWith('ar') ? 'rtl' : 'ltr';
      })),
      grid);
  }
};
