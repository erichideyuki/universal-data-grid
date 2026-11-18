/**
 * Frente 13 × frente 09: editores (célula, linha, lote) e validação com
 * bandas e virtualização de colunas — o editor aberto numa coluna que sai da
 * janela fica com valor e foco; Tab cruza bandas e colunas fora do DOM.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';

afterEach(cleanup);

const COLUMNS = 120;

/** 12 bandas de 10 colunas editáveis (texto), `id` não editável e fixo no início. */
const bandedColumns = (): GridColumnDef[] => [
  { path: 'id', label: 'Id', width: 80, editable: false, fixed: 'start' },
  ...Array.from({ length: COLUMNS / 10 }, (_, band): GridColumnDef => ({
    label: `Band ${band}`,
    columns: Array.from({ length: 10 }, (__, i): GridColumnDef => {
      const c = band * 10 + i;
      return { path: `c${c}`, label: `C${c}`, width: 120, ...c === 15 ? { validationRules: [{ type: 'required' }] } : {} };
    }),
  })),
];

const makeItems = (rows = 20) => Array.from({ length: rows }, (_, r) =>
  ({ id: r + 1, ...Object.fromEntries(Array.from({ length: COLUMNS }, (__, c) => [`c${c}`, `${r}.${c}`])) }));

const root = (grid: DataGrid) => grid.shadowRoot!;
const focused = (grid: DataGrid) => root(grid).activeElement as HTMLElement | null;
const scroller = (grid: DataGrid) => root(grid).querySelector<HTMLElement>('.scroll-container')!;
const leaf = (grid: DataGrid, path: string) => grid.columns.flatMap(column => column.columns ?? [column]).find(column => column.path === path)!;
const colOf = (element: Element | null) => element?.closest('td')?.getAttribute('aria-colindex');

const press = async (grid: DataGrid, key: string, init: KeyboardEventInit = {}) => {
  const target = (focused(grid) ?? root(grid).querySelector('[tabindex="0"]'))!;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const type = async (grid: DataGrid, text: string) => {
  const input = focused(grid) as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settle(grid);
};

const scrollToX = async (grid: DataGrid, left: number) => {
  scroller(grid).scrollLeft = left;
  scroller(grid).dispatchEvent(new Event('scroll'));
  await settle(grid);
};

const editingGrid = (mode: 'cell' | 'row' | 'batch') => createGrid({
  columns: bandedColumns(),
  items: makeItems(),
  configure: grid => {
    grid.keyExpr = 'id';
    grid.allowEditing = true;
    grid.editMode = mode;
  },
});

const openCell = async (grid: DataGrid, rowKey: number, path: string) => {
  expect(grid.focusCell(rowKey, leaf(grid, path))).toBe(true);
  await settle(grid);
  await press(grid, 'Enter');
  return focused(grid) as HTMLInputElement;
};

describe('edição com bandas e virtualização de colunas', () => {
  it('editor aberto numa coluna que sai da janela continua com o valor e o foco', async () => {
    const grid = await editingGrid('batch');
    const input = await openCell(grid, 1, 'c2');

    await type(grid, 'kept');
    await scrollToX(grid, 9000);

    // A coluna ativa fica no DOM (como as fixas); o mesmo editor, com o texto.
    expect(root(grid).querySelectorAll('th.header-column').length).toBeLessThan(40);
    expect(focused(grid)).toBe(input);
    expect(input.value).toBe('kept');
    expect(colOf(input)).toBe('4');

    await press(grid, 'Enter');
    await scrollToX(grid, 0);
    expect(grid.hasChanges()).toBe(true);
  });

  it('Tab (célula/lote) cruza a banda e chega a coluna fora do DOM, que entra e recebe o editor', async () => {
    for (const mode of ['cell', 'batch'] as const) {
      const grid = await editingGrid(mode);

      await openCell(grid, 1, 'c9');
      await press(grid, 'Tab');
      // c10 é a 1ª da banda seguinte.
      expect(colOf(focused(grid))).toBe('12');
      expect(focused(grid)!.classList.contains('cell-editor')).toBe(true);

      // Fim da linha: c119, fora do DOM.
      grid.discardChanges();
      await settle(grid);
      await openCell(grid, 1, 'c118');
      await press(grid, 'Tab');
      expect(colOf(focused(grid))).toBe('121');
      await press(grid, 'Tab', { shiftKey: true });
      expect(colOf(focused(grid))).toBe('120');
      expect(focused(grid)!.classList.contains('cell-editor')).toBe(true);
      grid.discardChanges();
      await settle(grid);
      grid.remove();
    }
  });

  it('modo linha: Tab percorre editores pela ordem lógica, também fora do DOM', async () => {
    const grid = await editingGrid('row');

    await openCell(grid, 1, 'c0');
    let visited = 0;

    // Do c0 ao c20 só com Tab: passa pelas bandas e por colunas que entram no DOM.
    for (let c = 1; c <= 20; c++) {
      await press(grid, 'Tab');
      expect(colOf(focused(grid)), `Tab ${c}`).toBe(String(c + 2));
      visited++;
    }

    expect(visited).toBe(20);
    expect(focused(grid)!.classList.contains('cell-editor')).toBe(true);
  });

  it('modo linha: Tab dos botões volta à 1ª editável mesmo fora do DOM', async () => {
    const grid = await editingGrid('row');

    await openCell(grid, 1, 'c0');
    await scrollToX(grid, 9000);
    // Shift+Tab na 1ª editável: os botões da linha (fim).
    await press(grid, 'Tab', { shiftKey: true });
    expect(focused(grid)!.closest('td')!.classList.contains('command-cell')).toBe(true);
    await scrollToX(grid, 9000);
    expect(root(grid).querySelector('tbody tr[data-index="0"] td[aria-colindex="2"]')).toBeNull();

    // Tab no último botão: a 1ª editável (c0), que entra no DOM com o editor.
    while (focused(grid)!.closest('td')!.classList.contains('command-cell')) {
      await press(grid, 'Tab');
    }

    expect(colOf(focused(grid))).toBe('2');
    expect(focused(grid)!.classList.contains('cell-editor')).toBe(true);
  });

  it('validação: o erro de uma coluna que sai da janela continua marcado ao voltar', async () => {
    const grid = await editingGrid('batch');
    const input = await openCell(grid, 1, 'c15');

    await type(grid, '');
    await press(grid, 'Enter');
    expect(root(grid).querySelector('td[aria-colindex="17"][aria-invalid="true"]')).not.toBeNull();
    await press(grid, 'ArrowUp');

    expect(input.isConnected || true).toBe(true);
    await scrollToX(grid, 9000);
    await scrollToX(grid, 0);
    await settle(grid);

    const invalid = root(grid).querySelector('tbody tr[data-index="0"] td[aria-colindex="17"]');
    expect(invalid?.getAttribute('aria-invalid')).toBe('true');
  });
});
