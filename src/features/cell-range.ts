/**
 * Intervalo de células (frente 19): tipos públicos, normalização do modo e
 * o resumo (contagem/soma/média) calculado em fatias. O estado e os gestos
 * vivem no grid (teclado, arrasto, render); os retângulos em
 * `row-model/cell-range.ts`.
 */
import type { GridChangeSource } from '../change-source.js';
import { createSlicer } from '../export/slice.js';
import type { GridColumnDef, GridColumnRef } from '../grid-column-def.js';
import type { RowBand } from '../row-model/cell-range.js';

/**
 * Cell range selection: `none` (default), `single` (one rectangular range
 * at a time — not one cell) or `multiple` (Ctrl/Cmd+click, Ctrl/Cmd+drag
 * and Shift+F8 add ranges).
 */
export type GridCellSelectionMode = 'none' | 'single' | 'multiple';

export const normalizeCellSelectionMode = (mode: unknown): GridCellSelectionMode =>
  mode === 'single' || mode === 'multiple' ? mode : 'none';

/**
 * A rectangular range of data cells (frozen). Row indices are positions in
 * the displayed body (the current page with `paging`), counting group,
 * detail and footer rows (which are never selected); the header, the filter
 * row and pinned rows do not count. `start` is the anchor; `end` is the
 * corner that moves (it may come before the anchor). Use `getRowKey` and
 * `getRowIndex` to map indices and keys.
 */
export interface GridCellRange<TItem = any> {
  readonly startRowIndex: number;
  readonly endRowIndex: number;
  readonly startColumn: GridColumnDef<TItem>;
  readonly endColumn: GridColumnDef<TItem>;
}

/** Argument of `selectCellRange`: like `GridCellRange`, columns by definition, `name` or `path`. */
export interface GridCellRangeInit<TItem = any> {
  startRowIndex: number;
  endRowIndex: number;
  startColumn: GridColumnRef<TItem>;
  endColumn: GridColumnRef<TItem>;
}

/** Result of `getCellRangeSummary`. */
export interface GridCellRangeSummary {
  /** Non-empty selected cells (each cell once, even under overlapping ranges). */
  count: number;
  /** Selected cells with a numeric value. */
  numericCount: number;
  /** Sum of the numeric values; `null` without numbers. */
  sum: number | null;
  /** Average of the numeric values; `null` without numbers. */
  avg: number | null;
  /** `false` when rows not loaded yet (remote data source) were left out. */
  complete: boolean;
}

/** `detail` of `u-grid-cell-range-change`. */
export interface GridCellRangeChangeEventDetail<TItem = any> {
  /** Ranges after the change, in creation order (the last one is the active range). */
  ranges: readonly GridCellRange<TItem>[];
  /** Ranges before the change. */
  previous: readonly GridCellRange<TItem>[];
  /**
   * `user` (gesture, or a gesture that cleared the ranges — sorting by the
   * header…) or `api` (methods and setters such as `items`, `columns`,
   * `cellSelectionMode`).
   */
  source: GridChangeSource;
}

/** `detail` of `u-grid-pasting` (user only: Ctrl/Cmd+V). */
export interface GridPasteEventDetail<TItem = any> {
  /** The pasted `text/plain`. */
  readonly text: string;
  /**
   * The parsed cells, one array per row, before tiling. Owned by the grid:
   * change the strings in place (or rows' length) to transform what is
   * pasted; reassigning `values` is ignored.
   */
  readonly values: string[][];
  /** Area that will be written (after tiling and clipping at the grid edges). */
  readonly range: GridCellRange<TItem>;
  /** The clipboard of the native `paste` event. After `preventDefault()` the grid changes nothing and the native paste goes on. */
  readonly clipboardData: DataTransfer;
}

/** Linha de uma faixa para o resumo: item exibido, ou `null` (não é de dados), ou `undefined` (não carregada). */
export type SummaryRowItem = (row: number) => unknown;

/** Sem linha de dados aqui (grupo, detalhe, rodapé). */
export const NOT_DATA = Symbol('not-data');
/** Linha de dados ainda não carregada (fonte remota). */
export const NOT_LOADED = Symbol('not-loaded');

const isEmpty = (value: unknown): boolean => value === null || value === undefined || value === '';

/**
 * Resumo da união das faixas, em fatias (spec 16): uma linha de dados por
 * unidade de trabalho; um intervalo de milhões de células não vira tarefa
 * longa. `valueOf(item, column)` = valor da célula (o que o grid mostra).
 */
export const summarizeRange = async (
  bands: readonly RowBand[],
  itemAt: (row: number) => unknown,
  columnAt: (col: number) => GridColumnDef | undefined,
  valueOf: (item: unknown, column: GridColumnDef) => unknown,
  signal?: AbortSignal,
): Promise<GridCellRangeSummary> => {
  const slicer = createSlicer();
  let count = 0;
  let numericCount = 0;
  let sum = 0;
  let complete = true;

  for (const band of bands) {
    const columns: GridColumnDef[] = [];

    for (const [left, right] of band.columns) {
      for (let col = left; col <= right; col++) {
        const column = columnAt(col);

        if (column) {
          columns.push(column);
        }
      }
    }

    for (let row = band.top; row <= band.bottom; row++) {
      const pause = slicer.tick();

      if (pause) {
        await pause;
      }

      signal?.throwIfAborted();

      const item = itemAt(row);

      if (item === NOT_DATA) {
        continue;
      }

      if (item === NOT_LOADED) {
        complete = false;
        continue;
      }

      for (const column of columns) {
        const value = valueOf(item, column);

        if (isEmpty(value)) {
          continue;
        }

        count++;

        if (typeof value === 'number' && Number.isFinite(value)) {
          numericCount++;
          sum += value;
        } else if (typeof value === 'bigint') {
          numericCount++;
          sum += Number(value);
        }
      }
    }
  }

  return Object.freeze({
    count,
    numericCount,
    sum: numericCount ? sum : null,
    avg: numericCount ? sum / numericCount : null,
    complete,
  });
};
