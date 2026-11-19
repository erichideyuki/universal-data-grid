import '@universal-material/data-grid';

import { checkbox, controls, createGrid, el } from '../shared/controls.js';
import { makeOrders } from '../shared/data.js';

export const meta = {
  title: 'Styling ::part',
  description: 'The grid renders in a shadow root, so page CSS reaches its insides through `::part()`: `header-cell`, `group-row`, `group-chip`, `even`/`odd`, `row selected`, `total-row`, `pager-button`… (full list in the README). Each checkbox turns on one rule, scoped by a class on the grid; the active CSS is shown below.',
};

const RULES = {
  'Header cells': `::part(header-cell) {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.75rem;
}`,
  'Group rows': `::part(group-row) {
  background: light-dark(#eaddff, #4f378b);
  font-weight: 600;
}`,
  'Group chips': `::part(group-chip) {
  border-radius: 16px;
  background: light-dark(#e8def8, #4a4458);
}`,
  'Even rows': `::part(even) {
  background: light-dark(#f7f2fa, #25232a);
}`,
  'Selected rows': `::part(row selected) {
  background: light-dark(#ffd8e4, #633b48);
}`,
  'Totals footer': `::part(total-row) {
  font-weight: 700;
  color: light-dark(#6750a4, #d0bcff);
}`,
  'Pager buttons': `::part(pager-button) {
  border-radius: 50%;
}`,
};

type RuleName = keyof typeof RULES;

export default (host: HTMLElement) => {
  const grid = createGrid(host, 440);
  const style = el('style'); // page CSS for this grid only: every rule starts with #parts-demo
  const code = el('pre', { className: 'demo-log', ariaLabel: 'Active CSS', tabIndex: 0 });
  const active = new Set<RuleName>(['Header cells', 'Group rows', 'Selected rows']);

  grid.id = 'parts-demo';
  grid.keyExpr = 'id';
  grid.selectionMode = 'multiple';
  grid.paging = true;
  grid.pageSize = 10;
  grid.columns = [
    { path: 'country', label: 'Country', width: 160, groupIndex: 0 },
    { path: 'customer', label: 'Customer', width: 200 },
    { path: 'status', label: 'Status', width: 130 },
    { path: 'total', label: 'Total', width: 150, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  ];
  grid.summary = { total: [{ column: 'total', type: 'sum' }] };
  grid.autoExpandGroups = true;
  grid.items = makeOrders(120);
  grid.selectedKeys = [1, 2, 3, 4, 5, 6];

  const update = () => {
    const css = [...active].map(name => `#parts-demo${RULES[name]}`).join('\n\n');
    style.textContent = css;
    code.textContent = css || '/* No rule active. */';
  };

  controls(host, ...(Object.keys(RULES) as RuleName[]).map(name => checkbox(name, active.has(name), on => {
    if (on) {
      active.add(name);
    } else {
      active.delete(name);
    }

    update();
  })));

  host.append(style, code);
  update();
};
