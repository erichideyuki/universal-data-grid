/**
 * Janela horizontal da virtualização de colunas (frente 13): dadas as
 * larguras das colunas roláveis (as fixas ficam de fora), devolve quais
 * entram no DOM. Somas de prefixo + busca binária; sem DOM.
 */

export interface ColumnWindow {
  /** Primeira e última coluna (índices nas roláveis) dentro da janela; `last < first` = nenhuma. */
  first: number;
  last: number;
}

/** Somas de prefixo: `offsets[i]` = início da coluna `i`; `offsets[n]` = largura total. */
export const prefixOffsets = (widths: readonly number[]): number[] => {
  const offsets = new Array<number>(widths.length + 1);
  offsets[0] = 0;

  for (let index = 0; index < widths.length; index++) {
    offsets[index + 1] = offsets[index] + Math.max(widths[index], 0);
  }

  return offsets;
};

/** Maior `i` com `offsets[i] <= position` (limitado a `0..n-1`). */
const columnAt = (offsets: readonly number[], position: number): number => {
  const count = offsets.length - 1;
  let low = 0;
  let high = count - 1;

  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);

    if (offsets[middle] <= position) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
};

/**
 * Colunas que cruzam `[start - overscan, start + size + overscan)`.
 * `start` é a distância rolada desde o começo das roláveis (já sem as fixas).
 */
export const columnWindow = (offsets: readonly number[], start: number, size: number, overscan: number): ColumnWindow => {
  const count = offsets.length - 1;

  if (count <= 0) {
    return { first: 0, last: -1 };
  }

  const from = Math.max(start - overscan, 0);
  const to = Math.max(start + Math.max(size, 0) + overscan, from);

  const first = columnAt(offsets, from);
  let last = columnAt(offsets, to);

  // A coluna que começa exatamente no fim da janela não entra.
  if (last > first && offsets[last] >= to) {
    last--;
  }

  return { first, last };
};
