import { type DataRow, type DetailRow, type GroupFooterRow, type GroupNode, type LazyItems, MISSING, type Row } from './types.js';

export type RowKeyOf = (item: unknown) => string;

/**
 * Linhas de detalhe (master-detail) de um bloco de itens. `all: false`:
 * `positions` são as posições (no bloco, crescentes) dos itens COM detalhe.
 * `all: true` (todas expandidas por padrão): `positions` são as exceções,
 * os itens SEM detalhe. Nada por item: O(itens com estado diferente).
 */
export interface BlockDetails {
  all: boolean;
  positions: Int32Array;
}

/**
 * Bloco de itens (array ou bloco remoto preguiçoso, frente 08),
 * opcionalmente com linhas de detalhe intercaladas. Bloco remoto só usa
 * `all: false` (detalhe só de linha carregada).
 */
interface ItemBlock {
  items: readonly unknown[] | LazyItems;
  details: BlockDetails | undefined;
}

const isLazy = (items: readonly unknown[] | LazyItems): items is LazyItems => (items as LazyItems).lazy === true;

/** Item da posição (`MISSING` se o bloco remoto ainda não carregou; marca o pedaço como desejado). */
const itemAt = ({ items }: ItemBlock, position: number): unknown =>
  isLazy(items) ? items.get(position) : items[position];

/** Posição do 1º item do bloco que satisfaz `match` (remoto: só os carregados); `-1` se nenhum. */
const findPosition = ({ items }: ItemBlock, match: (item: unknown) => boolean): number =>
  isLazy(items) ? items.find(match) : items.findIndex(match);

/** Quantos valores de `sorted` (crescente) são menores que `value`. */
const countBelow = (sorted: Int32Array, value: number): number => {
  let low = 0;
  let high = sorted.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (sorted[middle] < value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
};

/** Quantas linhas o bloco ocupa. */
const blockLength = ({ items, details }: ItemBlock): number => {
  if (!details) {
    return items.length;
  }

  return details.all
    ? 2 * items.length - details.positions.length
    : items.length + details.positions.length;
};

/** Deslocamento (no bloco) da linha de dados do item `position`. */
const itemOffset = ({ details }: ItemBlock, position: number): number => {
  if (!details) {
    return position;
  }

  const below = countBelow(details.positions, position);

  return details.all ? 2 * position - below : position + below;
};

/** O item `position` tem linha de detalhe? */
const hasDetail = ({ details }: ItemBlock, position: number): boolean => {
  if (!details) {
    return false;
  }

  const { positions } = details;
  const index = countBelow(positions, position);
  const listed = index < positions.length && positions[index] === position;

  return details.all ? !listed : listed;
};

/** Linha `offset` do bloco: posição do item e se é a linha de detalhe dele. */
const locate = (block: ItemBlock, offset: number): { position: number; detail: boolean } => {
  const { details } = block;

  if (!details) {
    return { position: offset, detail: false };
  }

  if (!details.all) {
    // O detalhe j fica em `positions[j] + j + 1` (crescente em j).
    const { positions } = details;
    let low = 0;
    let high = positions.length;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);

      if (positions[middle] + middle + 1 <= offset) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    if (low > 0 && positions[low - 1] + low === offset) {
      return { position: positions[low - 1], detail: true };
    }

    return { position: offset - low, detail: false };
  }

  // Todas expandidas: maior item cuja linha começa em `offset` ou antes.
  let low = 0;
  let high = block.items.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);

    if (itemOffset(block, middle) <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return { position: low, detail: itemOffset(block, low) !== offset };
};

const isBlock = (segment: Row | ItemBlock): segment is ItemBlock => !('isGroup' in segment);

/** O que o grid lê das linhas: a lista inteira ou uma página dela (frente 08). */
export interface Rows {
  readonly length: number;
  /** Deslocamento da 1ª linha na lista inteira (página). */
  readonly offset: number;
  at(index: number): Row;
  slice(start?: number, end?: number): Row[];
  /** Índice da linha avulsa (grupo, rodapé) de chave `key`; `-1` se não está. */
  indexOfKey(key: string): number;
  /** Índice da 1ª linha de dados cuja chave (`keyOf(item)`; sem `keyOf`, o item) é `key`; `-1` se não está (ou não carregada). */
  indexOfDataKey(key: unknown, keyOf?: (item: unknown) => unknown): number;
  /** Índice da linha de detalhe da chave; `-1` se não há. */
  indexOfDetailKey(key: unknown, keyOf?: (item: unknown) => unknown): number;
  /** Quantas linhas de detalhe há. */
  readonly detailCount: number;
  /** Índices (crescentes) das linhas de detalhe. */
  detailIndices(): Int32Array;
}

/**
 * Lista de linhas visíveis, SEM um objeto por linha (spec 16): guarda só
 * segmentos — linhas avulsas (grupo) e blocos de itens — e cria o `DataRow`
 * quando alguém pede a linha (o render pede só as da janela virtual). Com 1
 * milhão de itens, montar a lista é O(grupos), não O(itens). Linhas de
 * detalhe (master-detail) ficam no bloco como posições, não como linhas.
 */
export class RowList implements Rows {
  readonly offset = 0;
  /** Início (índice da 1ª linha) de cada segmento, crescente. */
  readonly #starts: number[] = [];
  readonly #segments: (Row | ItemBlock)[] = [];
  readonly #keyOf: RowKeyOf;
  #length = 0;
  #details = 0;

  constructor(keyOf: RowKeyOf) {
    this.#keyOf = keyOf;
  }

  get length(): number {
    return this.#length;
  }

  /** Quantas linhas de detalhe há. */
  get detailCount(): number {
    return this.#details;
  }

  /** Acrescenta uma linha avulsa (grupo, rodapé…). */
  push(row: Row): void {
    this.#starts.push(this.#length);
    this.#segments.push(row);
    this.#length++;
  }

  /** Acrescenta um bloco de itens (array ou remoto); a listra (`index`) recomeça em cada bloco. */
  pushItems(items: readonly unknown[] | LazyItems, details?: BlockDetails): void {
    if (!items.length) {
      return;
    }

    const block: ItemBlock = { items, details: details && (details.all || details.positions.length) ? details : undefined };
    const length = blockLength(block);

    this.#starts.push(this.#length);
    this.#segments.push(block);
    this.#length += length;
    this.#details += length - items.length;
  }

  /** Último segmento que começa em `index` ou antes. */
  #segmentIndex(index: number): number {
    const starts = this.#starts;
    let low = 0;
    let high = starts.length - 1;

    while (low < high) {
      const middle = Math.floor((low + high + 1) / 2);

      if (starts[middle] <= index) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    return low;
  }

  /** Linha em `index` (0 ≤ index < length). */
  at(index: number): Row {
    const low = this.#segmentIndex(index);
    const segment = this.#segments[low];

    if (!isBlock(segment)) {
      return segment;
    }

    const { position, detail } = locate(segment, index - this.#starts[low]);
    const item = itemAt(segment, position);

    // Bloco remoto ainda não carregado: linha-esqueleto (frente 08).
    if (item === MISSING) {
      const id = (segment.items as LazyItems).id;
      return { isGroup: false, key: `s:${id}:${position}${detail ? ':x' : ''}`, item: undefined, index: position, skeleton: true } satisfies DataRow;
    }

    const key = `d:${this.#keyOf(item)}`;

    return detail
      ? { isGroup: false, isDetail: true, key: `x:${this.#keyOf(item)}`, item, masterKey: key } satisfies DetailRow
      : { isGroup: false, key, item, index: position } satisfies DataRow;
  }

  /** 1º bloco/posição cujo item tem a chave; `undefined` se não está (remoto: só os carregados). */
  #findKey(key: unknown, keyOf: ((item: unknown) => unknown) | undefined): { segment: number; position: number } | undefined {
    const match = keyOf ? (item: unknown) => keyOf(item) === key : (item: unknown) => item === key;

    for (let i = 0; i < this.#segments.length; i++) {
      const segment = this.#segments[i];

      if (isBlock(segment)) {
        const position = !keyOf && !isLazy(segment.items) ? segment.items.indexOf(key) : findPosition(segment, match);

        if (position >= 0 && position < segment.items.length) {
          return { segment: i, position };
        }
      }
    }

    return undefined;
  }

  /** Índice da 1ª linha de dados do item; `-1` se ele não está nas linhas (foco e seleção, frente 05). */
  indexOfItem(item: unknown): number {
    return this.indexOfDataKey(item);
  }

  indexOfDataKey(key: unknown, keyOf?: (item: unknown) => unknown): number {
    const found = this.#findKey(key, keyOf);
    return found ? this.#starts[found.segment] + itemOffset(this.#segments[found.segment] as ItemBlock, found.position) : -1;
  }

  /** Índice da linha de detalhe da 1ª ocorrência do item; `-1` se não há. */
  indexOfDetail(item: unknown): number {
    return this.indexOfDetailKey(item);
  }

  indexOfDetailKey(key: unknown, keyOf?: (item: unknown) => unknown): number {
    const found = this.#findKey(key, keyOf);

    if (!found) {
      return -1;
    }

    const segment = this.#segments[found.segment] as ItemBlock;

    return hasDetail(segment, found.position) ? this.#starts[found.segment] + itemOffset(segment, found.position) + 1 : -1;
  }

  /** Índices (crescentes) das linhas de detalhe — O(detalhes), para o virtualizador. */
  detailIndices(): Int32Array {
    const result = new Int32Array(this.#details);
    let next = 0;

    for (let i = 0; i < this.#segments.length; i++) {
      const segment = this.#segments[i];

      if (!isBlock(segment) || !segment.details) {
        continue;
      }

      const start = this.#starts[i];
      const { all, positions } = segment.details;

      if (!all) {
        positions.forEach((position, j) => {
          result[next++] = start + position + j + 1;
        });
        continue;
      }

      // Todas menos as exceções: anda pelos itens pulando as recolhidas.
      let exception = 0;
      let offset = start;

      for (let position = 0; position < segment.items.length; position++) {
        if (exception < positions.length && positions[exception] === position) {
          exception++;
          offset++;
        } else {
          result[next++] = offset + 1;
          offset += 2;
        }
      }
    }

    return result;
  }

  /** Índice da linha avulsa (grupo, rodapé de grupo) de chave `key`; `-1` se não está (recolhida). */
  indexOfKey(key: string): number {
    for (let i = 0; i < this.#segments.length; i++) {
      const segment = this.#segments[i];

      if (!isBlock(segment) && segment.key === key) {
        return this.#starts[i];
      }
    }

    return -1;
  }

  /**
   * Linhas de `start` (inclusive) a `end` (exclusive). Chaves repetidas na
   * fatia (o mesmo objeto duas vezes em `items`) ganham sufixo `#n`, para o
   * render com chave.
   */
  slice(start = 0, end = this.#length): Row[] {
    return sliceRows(this, start, end);
  }
}

const sliceRows = (rows: Rows, start: number, end: number): Row[] => {
  const result: Row[] = [];
  const seen = new Map<string, number>();

  for (let index = Math.max(0, start); index < Math.min(end, rows.length); index++) {
    const row = rows.at(index);
    const count = seen.get(row.key) ?? 0;

    seen.set(row.key, count + 1);
    result.push(count ? { ...row, key: `${row.key}#${count}` } : row);
  }

  return result;
};

/** Uma página (`offset`, até `size` linhas) de uma lista de linhas (frente 08). */
export class RowPage implements Rows {
  readonly #rows: Rows;
  readonly offset: number;
  readonly length: number;
  readonly size: number;
  #details: Int32Array | undefined;

  constructor(rows: Rows, offset: number, size: number) {
    this.#rows = rows;
    this.size = size;
    this.offset = Math.max(0, Math.min(offset, rows.length));
    this.length = Math.max(0, Math.min(size, rows.length - this.offset));
  }

  /** A lista inteira da qual esta é uma página. */
  get source(): Rows {
    return this.#rows;
  }

  detailIndices(): Int32Array {
    if (!this.#details) {
      const end = this.offset + this.length;
      this.#details = this.#rows.detailCount
        ? this.#rows.detailIndices().filter(index => index >= this.offset && index < end)
          .map(index => index - this.offset)
        : new Int32Array(0);
    }

    return this.#details;
  }

  get detailCount(): number {
    return this.detailIndices().length;
  }

  at(index: number): Row {
    return this.#rows.at(this.offset + index);
  }

  slice(start = 0, end = this.length): Row[] {
    return sliceRows(this, start, end);
  }

  indexOfKey(key: string): number {
    for (let index = 0; index < this.length; index++) {
      if (this.at(index).key === key) {
        return index;
      }
    }

    return -1;
  }

  #indexWhere(key: unknown, keyOf: ((item: unknown) => unknown) | undefined, detail: boolean): number {
    for (let index = 0; index < this.length; index++) {
      const row = this.at(index);
      const candidate = detail
        ? row.isDetail
        : !row.isGroup && !row.isFooter && !row.isDetail && !row.skeleton;

      if (candidate && (keyOf ? keyOf((row as DataRow | DetailRow).item) : (row as DataRow | DetailRow).item) === key) {
        return index;
      }
    }

    return -1;
  }

  indexOfDataKey(key: unknown, keyOf?: (item: unknown) => unknown): number {
    return this.#indexWhere(key, keyOf, false);
  }

  indexOfDetailKey(key: unknown, keyOf?: (item: unknown) => unknown): number {
    return this.#indexWhere(key, keyOf, true);
  }
}

/** Linhas de detalhe de um bloco de itens (`undefined` = nenhuma). */
export type DetailsOf = (items: readonly unknown[]) => BlockDetails | undefined;

/** Linhas de detalhe de um bloco remoto (frente 08): só `all: false`, só linhas carregadas. */
export type LazyDetailsOf = (items: LazyItems) => BlockDetails | undefined;

/**
 * Lista de linhas visíveis: grupos e, nos expandidos, os subgrupos ou os
 * itens (e, com `groupFooters`, o rodapé do grupo depois deles).
 * `isExpanded` decide por chave e nível do grupo.
 */
export const flattenRows = (
  items: readonly unknown[],
  groups: readonly GroupNode[],
  isExpanded: (key: string, level: number) => boolean,
  keyOf: RowKeyOf,
  groupFooters = false,
  detailsOf?: DetailsOf,
): RowList => {
  const rows = new RowList(keyOf);

  if (!groups.length) {
    rows.pushItems(items, detailsOf?.(items));
    return rows;
  }

  const visit = (nodes: readonly GroupNode[]) => {
    for (const node of nodes) {
      const expanded = isExpanded(node.key, node.level);

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
        path: node.path,
        summaries: node.summaries,
      });

      if (!expanded) {
        continue;
      }

      if (node.children.length) {
        visit(node.children);
      } else {
        rows.pushItems(node.items, detailsOf?.(node.items));
      }

      if (groupFooters) {
        rows.push({
          isGroup: false,
          isFooter: true,
          key: `f:${node.key}`,
          groupKey: node.key,
          level: node.level,
          path: node.path,
          summaries: node.summaries,
        } satisfies GroupFooterRow);
      }
    }
  };

  visit(groups);
  return rows;
};
