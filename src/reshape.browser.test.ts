/**
 * `reshapeOnChanges`: `applyChanges` reaplica filtro, ordenação, grupos e
 * resumos; congela com foco no corpo ou editor aberto (revisão de a11y);
 * salvar edição não reorganiza; a recarga remota não vira um pedido por
 * chamada; e o grid usado com o recurso é coletado (spec 14).
 */
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { GridDataSource, GridLoadOptions } from './data/data-source.js';
import { LocalDataSource } from './data/local-source.js';
import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { waitFor } from './test/fake-source.js';
import { cellText, cleanup, createGrid, dataRows, settle } from './test/fixture.js';
import { expectCollected, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

interface Stock {
  id: number;
  name: string;
  price: number;
}

const stocks = (): Stock[] => [
  { id: 1, name: 'A', price: 10 },
  { id: 2, name: 'B', price: 20 },
  { id: 3, name: 'C', price: 30 },
];

const columns = (): GridColumnDef<Stock>[] => [
  { path: 'name', label: 'Name' },
  { path: 'price', label: 'Price', dataType: 'number', sortOrder: 'desc' },
];

const names = (grid: DataGrid): string[] =>
  dataRows(grid).map(tr => cellText(tr.querySelector('td[part~=cell]')!));

const sourceGrid = async (configure?: (grid: DataGrid) => void, data = stocks()): Promise<DataGrid> => {
  const grid = await createGrid({
    columns: columns(),
    configure: element => {
      element.keyExpr = 'id';
      element.reshapeOnChanges = true;
      configure?.(element);
      element.dataSource = { load: () => Promise.resolve({ data }) };
    },
  });

  await waitFor(() => names(grid).length > 0);
  await settle(grid);
  return grid;
};

/** Tira o foco do grid (um botão fora dele). */
const blurGrid = async (grid: DataGrid): Promise<void> => {
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  await settle(grid);
  await settle(grid);
  outside.remove();
};

describe('reshapeOnChanges', () => {
  it('is off by default and maps to the reshape-on-changes attribute', async () => {
    const grid = await createGrid({ columns: columns() });
    expect(grid.reshapeOnChanges).toBe(false);

    grid.setAttribute('reshape-on-changes', '');
    expect(grid.reshapeOnChanges).toBe(true);
    grid.setAttribute('reshape-on-changes', 'false');
    expect(grid.reshapeOnChanges).toBe(false);
  });

  it('off: updates stay in place (current behaviour)', async () => {
    const grid = await sourceGrid(element => element.reshapeOnChanges = false);
    expect(names(grid)).toEqual(['C', 'B', 'A']);

    grid.applyChanges({ update: [{ id: 1, name: 'A', price: 99 }] });
    await settle(grid);
    expect(names(grid)).toEqual(['C', 'B', 'A']);
  });

  it('on: updated rows move, added rows take their sorted place, filtered-out rows leave, totals follow', async () => {
    const grid = await sourceGrid(element => {
      element.summary = { total: [{ column: 'price', type: 'sum' }] };
    });
    expect(names(grid)).toEqual(['C', 'B', 'A']);

    grid.applyChanges({ update: [{ id: 1, name: 'A', price: 99 }] });
    await settle(grid);
    expect(names(grid)).toEqual(['A', 'C', 'B']);

    grid.applyChanges({ add: [{ id: 4, name: 'D', price: 25 }] });
    await settle(grid);
    expect(names(grid)).toEqual(['A', 'C', 'D', 'B']);

    grid.filterValue = ['price', '>', 15];
    await settle(grid);
    grid.applyChanges({ update: [{ id: 3, name: 'C', price: 5 }] });
    await settle(grid);
    expect(names(grid)).toEqual(['A', 'D', 'B']);
    expect(grid.getTotalCount()).toBe(3);
    expect(grid.shadowRoot!.querySelector('tfoot tr.total-row')?.textContent).toContain('144');
  });

  it('several calls in one frame keep the last state', async () => {
    const grid = await sourceGrid();

    for (let price = 1; price <= 50; price++) {
      grid.applyChanges({ update: [{ id: 1, name: 'A', price }] });
    }

    await settle(grid);
    expect(names(grid)).toEqual(['A', 'C', 'B']);
  });

  it('keyboard focus in the body freezes the order; it applies when focus leaves, focus stays on the row', async () => {
    const grid = await sourceGrid(element => element.selectionMode = 'single');

    grid.selectRows([2]);
    expect(grid.focusCell(2)).toBe(true);
    await settle(grid);

    grid.applyChanges({ update: [{ id: 2, name: 'B', price: 1 }, { id: 1, name: 'A', price: 99 }] });
    await settle(grid);
    // Valores novos no lugar; a ordem não muda sob o foco.
    expect(names(grid)).toEqual(['C', 'B', 'A']);
    expect(dataRows(grid)[1].textContent).toContain('1');
    expect(grid.focusedRowKey).toBe(2);

    await blurGrid(grid);
    expect(names(grid)).toEqual(['A', 'C', 'B']);
    expect(grid.focusedRowKey).toBe(2);
    expect(grid.selectedKeys).toEqual([2]);
  });

  it('keyboard: arrows follow the frozen order, Tab out applies it, Tab back returns to the same row', async () => {
    const before = document.createElement('button');
    before.textContent = 'before';
    document.body.prepend(before);

    try {
      const grid = await sourceGrid();
      before.focus();
      await userEvent.tab();
      expect(grid.matches(':focus-within')).toBe(true);

      await userEvent.keyboard('{ArrowDown}');
      await settle(grid);
      expect(grid.focusedRowKey).toBe(3);

      // C (3) vai para o fim: congelado sob o foco, a seta desce para B (2), a vizinha que está na tela.
      grid.applyChanges({ update: [{ id: 3, name: 'C', price: 1 }] });
      await settle(grid);
      await userEvent.keyboard('{ArrowDown}');
      await settle(grid);
      expect(names(grid)).toEqual(['C', 'B', 'A']);
      expect(grid.focusedRowKey).toBe(2);

      // axe com o foco no corpo e o reshape pendente.
      const frozen = await axe.run(grid, { resultTypes: ['violations'] });
      expect(frozen.violations.map(violation => violation.id)).toEqual([]);

      await userEvent.tab({ shift: true });
      await settle(grid);
      await settle(grid);
      expect(document.activeElement).toBe(before);
      expect(names(grid)).toEqual(['B', 'A', 'C']);

      await userEvent.tab();
      await settle(grid);
      expect(grid.focusedRowKey).toBe(2);
    } finally {
      before.remove();
    }
  });

  it('an open context menu freezes the order', async () => {
    const grid = await sourceGrid(element => element.rowMenu = true);
    expect(grid.focusCell(2)).toBe(true);
    await settle(grid);

    const cell = grid.shadowRoot!.activeElement as HTMLElement;
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 10, clientY: 10 }));
    await settle(grid);
    expect(grid.shadowRoot!.querySelector('[part~=context-menu-panel], .context-menu-panel')).not.toBeNull();

    grid.applyChanges({ update: [{ id: 1, name: 'A', price: 99 }] });
    await settle(grid);
    expect(names(grid)).toEqual(['C', 'B', 'A']);
  });

  it('an open editor freezes the order; it applies when the edit ends', async () => {
    const grid = await sourceGrid(element => element.allowEditing = true);

    expect(grid.editCell(2, grid.columns[1])).toBe(true);
    await settle(grid);

    grid.applyChanges({ update: [{ id: 1, name: 'A', price: 99 }] });
    await settle(grid);
    expect(names(grid)).toEqual(['C', 'B', 'A']);

    // Fechar o editor devolve o foco à célula: ainda congelado até o foco sair do corpo.
    grid.discardChanges();
    await settle(grid);
    expect(names(grid)).toEqual(['C', 'B', 'A']);
    await blurGrid(grid);
    expect(names(grid)).toEqual(['A', 'C', 'B']);
  });

  it('saving an edit keeps the row in place', async () => {
    const grid = await sourceGrid(element => {
      element.allowEditing = true;
      element.editMode = 'batch';
    });

    expect(grid.editCell(1, grid.columns[1])).toBe(true);
    await settle(grid);
    const input = grid.shadowRoot!.activeElement as HTMLInputElement;
    input.value = '99';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
    await settle(grid);

    expect(await grid.saveChanges()).toBe(true);
    await blurGrid(grid);
    expect(names(grid)).toEqual(['C', 'B', 'A']);
  });

  it('remote: one reload at a time, at most one queued', async () => {
    const data = Array.from({ length: 300 }, (_, id) => ({ id, name: `N${id}`, price: id }));
    const local = new LocalDataSource(data);
    const calls: GridLoadOptions[] = [];
    const source: GridDataSource = {
      load: (options, signal) => new Promise((resolve, reject) => {
        calls.push(options);
        const timer = setTimeout(() => resolve(local.query(options)), 40);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason);
        }, { once: true });
      }),
    };

    const grid = await createGrid({
      columns: columns(),
      configure: element => {
        element.keyExpr = 'id';
        element.reshapeOnChanges = true;
        element.remoteOperations = true;
        element.pageSize = 50;
        element.dataSource = source;
      },
    });

    await waitFor(() => names(grid).length > 0);
    await settle(grid);
    const before = calls.length;

    for (let n = 0; n < 20; n++) {
      grid.applyChanges({ update: [{ id: n, name: `N${n}`, price: n }] });
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    await new Promise(resolve => setTimeout(resolve, 300));
    await settle(grid);
    // Uma em voo + uma na fila (cada recarga pede o bloco em vista).
    expect(calls.length - before).toBeLessThanOrEqual(4);
    expect(calls.length - before).toBeGreaterThanOrEqual(1);
  });

  it('passes axe after a reshape', async () => {
    const grid = await sourceGrid();
    grid.applyChanges({ update: [{ id: 1, name: 'A', price: 99 }] });
    await settle(grid);

    const result = await axe.run(grid, { resultTypes: ['violations'] });
    expect(result.violations.map(violation => violation.id)).toEqual([]);
  });

  it('a grid used with reshapes and removed (with a reshape pending) is collected', async () => {
    const scenario = async (): Promise<Tracked> => {
      const data = stocks();
      const grid = await sourceGrid(undefined, data);

      grid.applyChanges({ update: [{ id: 1, name: 'A', price: 99 }] });
      await settle(grid);
      grid.focusCell(2);
      await settle(grid);
      grid.applyChanges({ update: [{ id: 2, name: 'B', price: 1 }] });
      grid.remove();

      return track({ grid, item: data[0] });
    };

    await expectCollected(await scenario());
  });
});
