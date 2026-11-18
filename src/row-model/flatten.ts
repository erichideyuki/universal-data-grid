import type { DataRow, GroupNode, Row } from './types.js';

export type RowKeyOf = (item: unknown) => string;

/**
 * Lista de linhas visíveis, SEM um objeto por linha (spec 16): guarda só
 * segmentos — linhas avulsas (grupo) e blocos de itens — e cria o `DataRow`
 * quando alguém pede a linha (o render pede só as da janela virtual). Com 1
 * milhão de itens, montar a lista é O(grupos), não O(itens).
 */
export class RowList {
  /** Início (índice da 1ª linha) de cada segmento, crescente. */
  readonly #starts: number[] = [];
  readonly #segments: (Row | readonly unknown[])[] = [];
  readonly #keyOf: RowKeyOf;
  #length = 0;

  constructor(keyOf: RowKeyOf) {
    this.#keyOf = keyOf;
  }

  get length(): number {
    return this.#length;
  }

  /** Acrescenta uma linha avulsa (grupo, rodapé…). */
  push(row: Row): void {
    this.#starts.push(this.#length);
    this.#segments.push(row);
    this.#length++;
  }

  /** Acrescenta um bloco de itens; a listra (`index`) recomeça em cada bloco. */
  pushItems(items: readonly unknown[]): void {
    if (!items.length) {
      return;
    }

    this.#starts.push(this.#length);
    this.#segments.push(items);
    this.#length += items.length;
  }

  /** Linha em `index` (0 ≤ index < length). */
  at(index: number): Row {
    const starts = this.#starts;
    let low = 0;
    let high = starts.length - 1;

    // Último segmento que começa em `index` ou antes.
    while (low < high) {
      const middle = Math.floor((low + high + 1) / 2);

      if (starts[middle] <= index) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    const segment = this.#segments[low];

    if (!Array.isArray(segment)) {
      return segment as Row;
    }

    const position = index - starts[low];
    const item = segment[position];

    return { isGroup: false, key: `d:${this.#keyOf(item)}`, item, index: position } satisfies DataRow;
  }

  /**
   * Linhas de `start` (inclusive) a `end` (exclusive). Chaves repetidas na
   * fatia (o mesmo objeto duas vezes em `items`) ganham sufixo `#n`, para o
   * render com chave.
   */
  slice(start = 0, end = this.#length): Row[] {
    const rows: Row[] = [];
    const seen = new Map<string, number>();

    for (let index = Math.max(0, start); index < Math.min(end, this.#length); index++) {
      const row = this.at(index);
      const count = seen.get(row.key) ?? 0;

      seen.set(row.key, count + 1);
      rows.push(count ? { ...row, key: `${row.key}#${count}` } : row);
    }

    return rows;
  }
}

/**
 * Lista de linhas visíveis: grupos e, nos expandidos, os subgrupos ou os
 * itens. `isExpanded` decide por chave do grupo.
 */
export const flattenRows = (
  items: readonly unknown[],
  groups: readonly GroupNode[],
  isExpanded: (key: string) => boolean,
  keyOf: RowKeyOf,
): RowList => {
  const rows = new RowList(keyOf);

  if (!groups.length) {
    rows.pushItems(items);
    return rows;
  }

  const visit = (nodes: readonly GroupNode[]) => {
    for (const node of nodes) {
      const expanded = isExpanded(node.key);

      rows.push({
        isGroup: true,
        key: `g:${node.key}`,
        groupKey: node.key,
        level: node.level,
        column: node.column,
        value: node.value,
        expanded,
        itemCount: node.items.length,
        firstItem: node.items[0],
      });

      if (!expanded) {
        continue;
      }

      if (node.children.length) {
        visit(node.children);
      } else {
        rows.pushItems(node.items);
      }
    }
  };

  visit(groups);
  return rows;
};
