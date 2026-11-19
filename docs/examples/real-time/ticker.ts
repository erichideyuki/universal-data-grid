import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import '@universal-material/data-grid';
import type { GridColumnDef } from '@universal-material/data-grid';

import { button, controls, createGrid, el, select, stat } from '../shared/controls.js';
import { makeStocks, random, type Stock } from '../shared/data.js';

export const meta = {
  title: 'Stock ticker with applyChanges',
  description: 'A `dataSource` serves the rows once; a timer (1 tick/s by default, adjustable) then pushes price changes with `applyChanges({ update })`. Updated rows are patched in place by `keyExpr` (no re-sorting or re-filtering while you read) and changed cells flash through a renderer plus `::part`. Select rows, sort or focus a cell — nothing is lost between ticks.',
};

interface Tick extends Stock {
  direction: 'up' | 'down';
  /** Bumped on every update; also the key that restarts the flash. */
  version: number;
  changedAt: number;
}

// Styles reach the cell content through ::part (the renderer adds the parts).
const STYLE = `
  .ticker::part(tick) { font-variant-numeric: tabular-nums; padding: 2px 6px; border-radius: 6px; }
  .ticker::part(up) { color: light-dark(#0a7a3d, #6fdc9a); }
  .ticker::part(down) { color: light-dark(#b3261e, #ffb4ab); }
  .ticker::part(flash-up) { animation: ticker-up 0.9s ease-out; }
  .ticker::part(flash-down) { animation: ticker-down 0.9s ease-out; }
  @keyframes ticker-up { from { background: rgb(46 160 67 / 0.35); } to { background: transparent; } }
  @keyframes ticker-down { from { background: rgb(218 54 51 / 0.35); } to { background: transparent; } }
  @media (prefers-reduced-motion: reduce) { .ticker::part(flash-up), .ticker::part(flash-down) { animation: none; } }
`;

const FLASH_MS = 900;

/** Price-like cell: colored by direction; recently changed cells get a new element (`keyed`) so the flash restarts. */
const tickRenderer = (item: Tick, { text }: { text: string }) => {
  const recent = Date.now() - item.changedAt < FLASH_MS;
  const parts = `tick ${item.direction}${recent ? ` flash-${item.direction}` : ''}`;
  return html`${keyed(item.version, html`<span part=${parts}>${text}</span>`)}`;
};

export default (host: HTMLElement) => {
  host.append(el('style', {}, STYLE));

  const grid = createGrid(host, 460);
  grid.classList.add('ticker');

  const columns: GridColumnDef<Tick>[] = [
    { path: 'symbol', label: 'Symbol', width: 110, fixed: 'start' },
    { path: 'company', label: 'Company', width: 220 },
    { path: 'sector', label: 'Sector', width: 140 },
    { path: 'price', label: 'Price', width: 130, dataType: 'number', format: { style: 'currency', currency: 'USD' }, renderer: tickRenderer },
    { path: 'change', label: 'Change', width: 120, dataType: 'number', format: { signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 }, renderer: tickRenderer },
    { path: 'changePercent', label: 'Change %', width: 120, dataType: 'number', format: { style: 'percent', signDisplay: 'exceptZero', minimumFractionDigits: 2 }, renderer: tickRenderer },
    { path: 'volume', label: 'Volume', width: 140, dataType: 'number' },
    { path: 'updatedAt', label: 'Updated', width: 130, dataType: 'datetime', format: { timeStyle: 'medium' } },
  ];

  // Current state, by key. The grid never mutates it: each update is a new object.
  const rows = new Map<string, Tick>(makeStocks(200).map(stock => [stock.symbol, { ...stock, direction: 'up', version: 0, changedAt: 0 }]));
  const keys = [...rows.keys()];
  const next = random(42);

  grid.keyExpr = 'symbol';
  grid.selectionMode = 'multiple';
  grid.showCheckboxes = true;
  grid.columns = columns;
  grid.summary = { total: [{ column: 'volume', type: 'sum' }, { column: 'changePercent', type: 'avg' }] };
  grid.dataSource = { load: async () => ({ data: [...rows.values()] }) };

  let perTick = 20;
  let ticksPerSecond = 1;
  let timer: ReturnType<typeof setInterval> | undefined;
  let sent = 0;
  let since = performance.now();
  const rate = stat();

  const tick = () => {
    const update: Tick[] = [];

    for (let n = 0; n < perTick; n++) {
      const old = rows.get(keys[Math.floor(next() * keys.length)]!)!;
      const price = Math.max(1, Math.round(old.price * (1 + (next() - 0.5) * 0.02) * 100) / 100);
      const row: Tick = {
        ...old,
        price,
        change: Math.round((price - old.open) * 100) / 100,
        changePercent: (price - old.open) / old.open,
        volume: old.volume + Math.floor(next() * 5_000),
        direction: price >= old.price ? 'up' : 'down',
        version: old.version + 1,
        changedAt: Date.now(),
        updatedAt: new Date(),
      };

      rows.set(row.symbol, row);
      update.push(row);
    }

    grid.applyChanges({ update });
    sent += update.length;

    const elapsed = performance.now() - since;

    // About once a second (a little slack: at 1 tick/s the interval jitters around 1000 ms).
    if (elapsed >= 950) {
      rate.textContent = `${Math.round(sent * 1000 / elapsed).toLocaleString()} updates/s`;
      sent = 0;
      since = performance.now();
    }
  };

  const start = () => {
    clearInterval(timer);
    sent = 0;
    since = performance.now();
    timer = setInterval(tick, 1000 / ticksPerSecond);
    toggle.textContent = 'Pause';
  };

  const stop = () => {
    clearInterval(timer);
    timer = undefined;
    toggle.textContent = 'Resume';
    rate.textContent = 'Paused';
  };

  const toggle = button('Pause', () => (timer ? stop() : start()), { className: 'primary' });

  controls(host,
    toggle,
    select('Ticks per second', ['0.5', '1', '2', '5', '10'], '1', value => {
      ticksPerSecond = Number(value);

      if (timer) {
        start(); // restarts the interval at the new rate
      }
    }),
    select('Updates per tick', ['1', '5', '20', '50', '100'], '20', value => (perTick = Number(value))),
    rate);

  start();

  return () => clearInterval(timer);
};
