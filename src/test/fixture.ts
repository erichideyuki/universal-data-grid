import type { GridColumnDef } from '../grid-column-def.js';
import type { DataGrid } from '../grid.js';

import '../grid.js';

export const nextFrame = (): Promise<void> =>
  new Promise(resolve => requestAnimationFrame(() => resolve()));

/** Espera o render do Lit e as notificações do virtualizador assentarem. */
export const settle = async (grid: DataGrid): Promise<void> => {
  for (let i = 0; i < 3; i++) {
    await grid.updateComplete;
    await nextFrame();
  }

  await grid.updateComplete;
};

export interface CreateGridOptions {
  columns?: GridColumnDef[];
  items?: any[];
  /** Define colunas/itens antes (`before`) ou depois (`after`) de conectar. */
  setBeforeConnect?: boolean;
  height?: string;
  configure?: (grid: DataGrid) => void;
}

export const createGrid = async (options: CreateGridOptions = {}): Promise<DataGrid> => {
  const grid = document.createElement('u-grid');
  grid.style.display = 'block';
  grid.style.height = options.height ?? '400px';
  options.configure?.(grid);

  const assign = () => {
    if (options.columns) {
      grid.columns = options.columns;
    }

    if (options.items) {
      grid.items = options.items;
    }
  };

  if (options.setBeforeConnect) {
    assign();
    document.body.append(grid);
  } else {
    document.body.append(grid);
    await settle(grid);
    assign();
  }

  await settle(grid);
  return grid;
};

export const cleanup = (): void => {
  document.querySelectorAll('u-grid').forEach(grid => grid.remove());
};

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;

export const headerLabels = (grid: DataGrid): string[] =>
  [...root(grid).querySelectorAll('th.header-column')].map(th => th.querySelector('.header-text')?.textContent.trim() ?? '');

/** Rótulo das linhas de grupo, sem a contagem/resumos (`groupInfos`). */
export const groupLabels = (grid: DataGrid): string[] =>
  [...root(grid).querySelectorAll('.grouping-cell')].map(td => {
    const info = td.querySelector('.group-info')?.textContent ?? '';
    const text = td.textContent;

    return (info ? text.slice(0, text.lastIndexOf(info)) : text).trim();
  });

/** Contagem e resumos `inline` das linhas de grupo (`"(3)"`). */
export const groupInfos = (grid: DataGrid): string[] =>
  [...root(grid).querySelectorAll('.grouping-cell')].map(td => td.querySelector('.group-info')?.textContent.trim() ?? '');

export const bodyRows = (grid: DataGrid): HTMLTableRowElement[] =>
  [...root(grid).querySelectorAll<HTMLTableRowElement>('tbody tr[role=row]:not(.no-data-row)')];

export const dataRows = (grid: DataGrid): HTMLTableRowElement[] =>
  bodyRows(grid).filter(tr => !tr.classList.contains('group-row') && !tr.classList.contains('summary-row'));

export const groupToggles = (grid: DataGrid): HTMLElement[] =>
  [...root(grid).querySelectorAll<HTMLElement>('button.group-toggle')];

export const cellText = (cell: Element): string => {
  const slot = cell.querySelector('slot');

  if (slot) {
    return slot.assignedElements().map(e => e.textContent)
      .join('')
      .trim();
  }

  return cell.textContent.trim();
};
