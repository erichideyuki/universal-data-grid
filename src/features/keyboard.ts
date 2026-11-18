/**
 * Navegação por teclado do padrão "Data Grid" da WAI-ARIA APG, sem DOM:
 * dada a célula ativa e a tecla, devolve a próxima célula. O grid aplica
 * (roving tabindex, rolagem, foco).
 *
 * Linhas: `-1` = cabeçalho; `0..rowCount-1` = linhas do corpo (dados e
 * grupos, na ordem achatada). Colunas: índice entre as navegáveis (caixa de
 * seleção + colunas visíveis). A linha de grupo tem uma célula só: a coluna
 * é lembrada para quando a navegação voltar a uma linha de dados.
 */

export const HEADER_ROW = -1;

export interface CellPosition {
  row: number;
  col: number;
}

export type NavigationKey =
  | 'left' | 'right' | 'up' | 'down'
  | 'home' | 'end' | 'gridHome' | 'gridEnd'
  | 'pageUp' | 'pageDown';

export interface NavigationContext {
  rowCount: number;
  colCount: number;
  hasHeader: boolean;
  /** Linhas do corpo que cabem na área visível (passo do PageUp/PageDown). */
  pageSize: number;
  isGroupRow: (row: number) => boolean;
}

/**
 * Tecla → direção lógica. ←/→ invertem em RTL; Ctrl/⌘ com Home/End vão ao
 * grid inteiro. `undefined` = não é tecla de navegação.
 */
export const navigationKeyOf = (event: KeyboardEvent, rtl: boolean): NavigationKey | undefined => {
  const ctrl = event.ctrlKey || event.metaKey;

  switch (event.key) {
    case 'ArrowLeft':
      return rtl ? 'right' : 'left';
    case 'ArrowRight':
      return rtl ? 'left' : 'right';
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'Home':
      return ctrl ? 'gridHome' : 'home';
    case 'End':
      return ctrl ? 'gridEnd' : 'end';
    case 'PageUp':
      return 'pageUp';
    case 'PageDown':
      return 'pageDown';
    default:
      return undefined;
  }
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Próxima célula; a mesma posição quando já está na borda. */
export const nextCell = (from: CellPosition, key: NavigationKey, context: NavigationContext): CellPosition => {
  const { rowCount, colCount, hasHeader, pageSize } = context;
  const firstRow = hasHeader ? HEADER_ROW : 0;
  const lastRow = rowCount - 1;
  const lastCol = Math.max(colCount - 1, 0);
  const row = clamp(from.row, firstRow, Math.max(lastRow, firstRow));
  const col = clamp(from.col, 0, lastCol);
  const inGroup = row >= 0 && context.isGroupRow(row);

  switch (key) {
    case 'left':
      return { row, col: inGroup ? col : Math.max(col - 1, 0) };
    case 'right':
      return { row, col: inGroup ? col : Math.min(col + 1, lastCol) };
    case 'up':
      return { row: Math.max(row - 1, firstRow), col };
    case 'down':
      return { row: Math.min(row + 1, Math.max(lastRow, firstRow)), col };
    case 'home':
      return { row, col: inGroup ? col : 0 };
    case 'end':
      return { row, col: inGroup ? col : lastCol };
    case 'gridHome':
      return { row: firstRow, col: 0 };
    case 'gridEnd':
      return { row: Math.max(lastRow, firstRow), col: lastCol };

    case 'pageUp': {
      // Do cabeçalho não sobe; da 1ª página do corpo vai à 1ª linha (não ao cabeçalho).
      const target = row === HEADER_ROW ? HEADER_ROW : Math.max(row - Math.max(pageSize, 1), 0);
      return { row: target, col };
    }

    case 'pageDown': {
      const target = row === HEADER_ROW ? Math.min(Math.max(pageSize, 1) - 1, lastRow) : Math.min(row + Math.max(pageSize, 1), lastRow);
      return { row: Math.max(target, firstRow), col };
    }
  }
};

/** Índices de `from` a `to` (inclusive), em qualquer ordem. */
export const rangeBetween = (from: number, to: number): number[] => {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const result: number[] = [];

  for (let index = start; index <= end; index++) {
    result.push(index);
  }

  return result;
};
