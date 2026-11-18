/**
 * Frente 21: colunas ocultas por falta de espaço (`autoHideColumns`,
 * `hidingPriority`) e linha adaptativa (a linha de detalhe com os valores
 * das ocultas).
 */
import { html } from 'lit';

import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import type { GridAdaptiveColumnsChangeEventDetail, GridColumnDef, GridRowExpansionChangeEventDetail } from './grid.js';
import type { DataGrid } from './grid.js';
import { bodyRows, cleanup, createGrid, headerLabels, settle } from './test/fixture.js';

afterEach(cleanup);

interface Sale {
  id: number;
  invoice: string;
  city: string;
  state: string;
  employee: string;
  date: Date;
  amount: number;
}

const sales = (count: number): Sale[] =>
  Array.from({ length: count }, (_, id) => ({
    id,
    invoice: `INV-${id}`,
    city: `City ${id}`,
    state: `State ${id % 5}`,
    employee: `Employee ${id % 7}`,
    date: new Date(2024, id % 12, 1 + (id % 27)),
    amount: 100 + id,
  }));

const columns = (): GridColumnDef<Sale>[] => [
  { path: 'invoice', label: 'Invoice', width: 120 },
  { path: 'city', label: 'City', width: 120 },
  { path: 'state', label: 'State', width: 120 },
  { path: 'employee', label: 'Employee', width: 120 },
  { path: 'date', label: 'Order date', width: 120, dataType: 'date' },
  { path: 'amount', label: 'Amount', width: 120, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;

/** Grid com `autoHideColumns` e largura própria (px). */
const createResponsive = async (width: number, configure?: (grid: DataGrid) => void, items = sales(20), cols = columns()): Promise<DataGrid> => {
  const grid = await createGrid({
    columns: cols,
    items,
    setBeforeConnect: true,
    configure: g => {
      g.style.width = `${width}px`;
      g.autoHideColumns = true;
      configure?.(g);
    },
  });

  await settle(grid);
  return grid;
};

const resize = async (grid: DataGrid, width: number): Promise<void> => {
  grid.style.width = `${width}px`;
  // ResizeObserver entrega no próximo quadro.
  await settle(grid);
  await settle(grid);
};

const key = async (grid: DataGrid, name: string, init: KeyboardEventInit = {}): Promise<void> => {
  const target = root(grid).activeElement as HTMLElement;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const detailRows = (grid: DataGrid): HTMLTableRowElement[] =>
  [...root(grid).querySelectorAll<HTMLTableRowElement>('tbody tr.detail-row:not(.pinned)')];

const masterRows = (grid: DataGrid): HTMLTableRowElement[] =>
  bodyRows(grid).filter(tr => !tr.classList.contains('detail-row') && !tr.classList.contains('group-row'));

const fieldTexts = (row: Element): string[] =>
  [...row.querySelectorAll('.adaptive-field')].map(field => [
    field.querySelector('.adaptive-label-text')?.textContent ?? '',
    field.querySelector('.adaptive-text')?.textContent?.trim() ?? '',
  ].join('='));

describe('colunas ocultas por falta de espaço', () => {
  it('sem hidingPriority saem da última para a primeira; a coluna de expansão aparece', async () => {
    const grid = await createResponsive(1000);

    expect(headerLabels(grid)).toEqual(['Invoice', 'City', 'State', 'Employee', 'Order date', 'Amount']);
    expect(root(grid).querySelector('th.detail-toggle-cell')).toBeNull();
    expect(grid.getAdaptiveColumns()).toEqual([]);

    await resize(grid, 500);
    expect(headerLabels(grid)).toEqual(['Invoice', 'City', 'State']);
    expect(grid.getAdaptiveColumns().map(column => column.label)).toEqual(['Employee', 'Order date', 'Amount']);
    expect(root(grid).querySelector('th.detail-toggle-cell')).not.toBeNull();

    await resize(grid, 1000);
    expect(headerLabels(grid)).toEqual(['Invoice', 'City', 'State', 'Employee', 'Order date', 'Amount']);
    expect(root(grid).querySelector('th.detail-toggle-cell')).toBeNull();
  });

  it('com hidingPriority só elas saem, da menor para a maior', async () => {
    const cols = columns();
    cols[1].hidingPriority = 0;
    cols[2].hidingPriority = 1;
    cols[4].hidingPriority = 2;
    const grid = await createResponsive(560, undefined, sales(5), cols);

    expect(headerLabels(grid)).toEqual(['Invoice', 'Employee', 'Order date', 'Amount']);

    await resize(grid, 300);
    expect(headerLabels(grid)).toEqual(['Invoice', 'Employee', 'Amount']);
  });

  it('expandir mostra rótulo: valor formatado; evento e aria-expanded', async () => {
    const grid = await createResponsive(500);
    const events: GridRowExpansionChangeEventDetail[] = [];
    grid.addEventListener('u-grid-row-expansion-change', event => events.push(event.detail));

    const button = masterRows(grid)[0].querySelector<HTMLButtonElement>('button.detail-toggle')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    await settle(grid);

    expect(events).toEqual([{ rowKey: grid.items[0], expanded: true, source: 'user' }]);
    const detail = detailRows(grid)[0];
    expect(fieldTexts(detail)).toEqual(['Employee=Employee 0', 'Order date=1/1/2024', 'Amount=$100.00']);
    expect(detail.getAttribute('aria-labelledby')).toBe(masterRows(grid)[0].id);
  });

  it('aria-colcount conta só as colunas exibidas', async () => {
    const grid = await createResponsive(500);
    const table = root(grid).querySelector('[role=grid]')!;

    // expansão + 3 exibidas
    expect(table.getAttribute('aria-colcount')).toBe('4');
  });

  it('evento u-grid-adaptive-columns-change depois do render', async () => {
    const grid = await createResponsive(1000);
    const events: GridAdaptiveColumnsChangeEventDetail[] = [];
    grid.addEventListener('u-grid-adaptive-columns-change', event => events.push(event.detail));

    await resize(grid, 500);
    expect(events.map(detail => [detail.columns.map(c => c.label), detail.previous.map(c => c.label)])).toEqual([
      [['Employee', 'Order date', 'Amount'], []],
    ]);
    expect(Object.isFrozen(events[0].columns)).toBe(true);
  });

  it('getState não muda com a largura', async () => {
    const grid = await createResponsive(1000);
    const before = JSON.stringify(grid.getState());
    await resize(grid, 400);
    expect(grid.getAdaptiveColumns().length).toBeGreaterThan(0);
    expect(JSON.stringify(grid.getState())).toBe(before);
  });

  it('axe sem violações (fechado e aberto)', async () => {
    const grid = await createResponsive(500);
    grid.expandRow(grid.items[0]);
    await settle(grid);

    const result = await axe.run(grid as unknown as Element);
    expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.html).join(' | ')}`)).toEqual([]);
  });

  it('renderer recebe ctx.adaptive', async () => {
    const seen: boolean[] = [];
    const cols = columns();
    cols[5].renderer = (item: Sale, ctx) => {
      seen.push(ctx.adaptive);
      return html`<b class="amount">${item.amount}</b>`;
    };
    const grid = await createResponsive(500, undefined, sales(3), cols);
    grid.expandRow(grid.items[0]);
    await settle(grid);

    expect(seen).toContain(true);
    expect(detailRows(grid)[0].querySelector('.amount')?.textContent).toBe('100');
    void key;
  });
});
