import { type Rows, sliceRows } from './flatten.js';
import type { DataRow, Row } from './types.js';

/** Linha nova (frente 09) inserida antes da linha `position` da lista base. */
export interface AddedRow {
  /** Posição na lista base (a linha nova fica antes dela; `length` = no fim). */
  position: number;
  /** Chave provisória da linha nova. */
  rowKey: unknown;
  row: DataRow;
}

/**
 * Lista de linhas com as linhas novas da edição inseridas, sem copiar a base
 * (spec 16: nada por linha). As novas vêm em ordem de posição (empate: na
 * ordem dada); o índice final da k-ésima é `position + k`.
 */
export class RowsWithAdded implements Rows {
  readonly #base: Rows;
  readonly #added: readonly AddedRow[];
  /** Índice final de cada nova, crescente. */
  readonly #finals: Int32Array;

  constructor(base: Rows, added: readonly AddedRow[]) {
    this.#base = base;
    this.#added = [...added].sort((a, b) => a.position - b.position);
    this.#finals = Int32Array.from(this.#added, (entry, index) => Math.min(entry.position, base.length) + index);
  }

  get base(): Rows {
    return this.#base;
  }

  get offset(): number {
    return this.#base.offset;
  }

  get length(): number {
    return this.#base.length + this.#added.length;
  }

  get detailCount(): number {
    return this.#base.detailCount;
  }

  /** Quantas novas têm índice final menor que `index`. */
  #before(index: number): number {
    let low = 0;
    let high = this.#finals.length;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);

      if (this.#finals[middle] < index) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    return low;
  }

  /** Índice base → índice final (as novas na posição dele vêm antes). */
  #toFinal(index: number): number {
    if (index < 0) {
      return index;
    }

    let low = 0;
    let high = this.#added.length;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);

      if (Math.min(this.#added[middle].position, this.#base.length) <= index) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    return index + low;
  }

  at(index: number): Row {
    const before = this.#before(index);

    if (before < this.#finals.length && this.#finals[before] === index) {
      return this.#added[before].row;
    }

    return this.#base.at(index - before);
  }

  slice(start = 0, end = this.length): Row[] {
    return sliceRows(this, start, end);
  }

  dataRowsBefore(index: number): number {
    const end = Math.min(Math.max(index, 0), this.length);
    const added = this.#before(end);
    return added + this.#base.dataRowsBefore(end - added);
  }

  indexOfKey(key: string): number {
    const index = this.#added.findIndex(entry => entry.row.key === key);
    return index >= 0 ? this.#finals[index] : this.#toFinal(this.#base.indexOfKey(key));
  }

  indexOfDataKey(key: unknown, keyOf?: (item: unknown) => unknown): number {
    const index = this.#added.findIndex(entry => entry.rowKey === key);
    return index >= 0 ? this.#finals[index] : this.#toFinal(this.#base.indexOfDataKey(key, keyOf));
  }

  indexOfDetailKey(key: unknown, keyOf?: (item: unknown) => unknown): number {
    return this.#toFinal(this.#base.indexOfDetailKey(key, keyOf));
  }

  detailIndices(): Int32Array {
    return this.#base.detailIndices().map(index => this.#toFinal(index));
  }

  indexOfSkeletonKey(key: string): number {
    return this.#toFinal(this.#base.indexOfSkeletonKey(key));
  }
}
