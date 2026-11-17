import type { GridColumnDef, GridSortOrder } from '../grid-column-def.js';
import type { SortSpec } from '../row-model/sort.js';

/** How the user sorts from the headers: `none`, `single` (default) or `multiple` (Shift+click). */
export type GridSortMode = 'none' | 'single' | 'multiple';

/** @deprecated Use `GridSortMode`. */
export type GridSortingMode = GridSortMode;

/** Modificadores de um clique/tecla no cabeçalho, já interpretados. */
export interface SortGesture {
  /** Ctrl/Cmd: tira a coluna da ordenação. */
  remove: boolean;
  /** Shift: acrescenta (só no modo `multiple`). */
  append: boolean;
}

export const sortGestureOf = (event: MouseEvent | KeyboardEvent): SortGesture => ({
  remove: event.ctrlKey || event.metaKey,
  append: event.shiftKey,
});

export const toggleOrder = (order: GridSortOrder | undefined): GridSortOrder =>
  order === 'asc' ? 'desc' : 'asc';

/**
 * Estado depois de `sortColumn(column, order, { append })`. Sem `append`, a
 * coluna substitui as outras — menos as colunas agrupadas, cuja entrada é a
 * direção do grupo e sobrevive. Uma coluna agrupada (ou já presente, com
 * `append`) muda a direção no lugar, sem perder a prioridade.
 */
export const nextSorting = (
  sorting: readonly SortSpec[],
  column: GridColumnDef,
  order: GridSortOrder | null,
  append: boolean,
  isGrouped: (column: GridColumnDef) => boolean,
): SortSpec[] => {

  if (!order) {
    return sorting.filter(spec => spec.column !== column);
  }

  const index = sorting.findIndex(spec => spec.column === column);

  if (append || isGrouped(column)) {
    return index < 0
      ? [...sorting, { column, order }]
      : sorting.map((spec, i) => i === index ? { column, order } : spec);
  }

  return [
    ...sorting.filter(spec => spec.column !== column && isGrouped(spec.column)),
    { column, order },
  ];
};

/**
 * Clique/tecla no cabeçalho (comportamento medido no DevExtreme): alterna
 * asc → desc → asc; Ctrl/Cmd remove; Shift acrescenta no modo `multiple`
 * (numa coluna já ordenada, alterna sem mudar a prioridade); sem Shift, a
 * coluna passa a ser a única.
 */
export const sortingAfterGesture = (
  sorting: readonly SortSpec[],
  column: GridColumnDef,
  gesture: SortGesture,
  mode: GridSortMode,
  isGrouped: (column: GridColumnDef) => boolean,
): SortSpec[] => {

  if (gesture.remove) {
    return nextSorting(sorting, column, null, false, isGrouped);
  }

  const current = sorting.find(spec => spec.column === column)?.order;

  return nextSorting(sorting, column, toggleOrder(current), gesture.append && mode === 'multiple', isGrouped);
};

export const sameSorting = (a: readonly SortSpec[], b: readonly SortSpec[]): boolean =>
  a.length === b.length && a.every((spec, i) => spec.column === b[i].column && spec.order === b[i].order);

/**
 * Ordenação inicial declarada nas colunas (`sortOrder` + `sortIndex`):
 * primeiro as que têm `sortIndex`, por ele; depois as outras, na ordem da
 * definição.
 */
export const initialSorting = (columns: readonly GridColumnDef[]): SortSpec[] =>
  columns
    .map((column, position) => ({ column, position }))
    .filter(({ column }) => column.sortOrder === 'asc' || column.sortOrder === 'desc')
    .sort((a, b) =>
      (a.column.sortIndex ?? Infinity) - (b.column.sortIndex ?? Infinity) || a.position - b.position)
    .map(({ column }) => ({ column, order: column.sortOrder! }));

/** Troca `{nome}` pelos parâmetros (texto puro; o Lit renderiza como texto). */
export const formatMessage = (template: string, params: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
