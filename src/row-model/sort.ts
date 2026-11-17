import type { GridColumnDef, GridSort } from '../grid-column-def.js';
import { rankValues } from './compare.js';
import { coerceValue } from './format.js';
import { getCellValue } from './value.js';

/** Uma chave de ordenação: coluna + direção. */
export type SortSpec = GridSort;

/**
 * Postos já calculados por coluna, para os MESMOS `items` e idioma. Quem
 * chama é dono do cache e o esvazia quando os itens, as colunas ou o idioma
 * mudam; com ele, inverter a direção ou acrescentar uma coluna não reordena
 * de novo os textos já vistos.
 */
export type RankCache = Map<GridColumnDef, Int32Array>;

/** Chave já preparada: postos inteiros (comparador padrão) ou comparador por índice. */
interface RankKey {
  ranks: Int32Array;
  descending: boolean;
}

type PreparedKey = RankKey | { compare: (a: number, b: number) => number };

const prepareKey = (
  items: readonly unknown[],
  { column, order }: SortSpec,
  language: string | undefined,
  cache: RankCache | undefined,
): PreparedKey => {
  const descending = order === 'desc';
  const comparator = column.comparator;

  if (comparator) {
    const values = items.map(item => getCellValue(item, column));
    const direction = descending ? -1 : 1;

    return { compare: (a, b) => (comparator(values[a], values[b], items[a], items[b]) || 0) * direction };
  }

  let ranks = cache?.get(column);

  if (!ranks) {
    // Como no agrupamento: com `dataType` informado, compara no tipo ("10" > "9" em `number`).
    const dataType = column.dataType;
    const values = items.map(item => getCellValue(item, column));

    ranks = rankValues(dataType ? values.map(value => coerceValue(value, dataType)) : values, language);
    cache?.set(column, ranks);
  }

  return { ranks, descending };
};

/**
 * Counting sort estável de `order` pelos postos: O(n + postos). Em `desc` o
 * posto é invertido; empates mantêm a ordem que já estava em `order`.
 */
const countingSort = (order: Int32Array, ranks: Int32Array, descending: boolean): Int32Array => {
  let max = 0;

  for (const rank of ranks) {
    max = Math.max(max, rank);
  }

  const bucketOf = descending
    ? (index: number) => max - ranks[index]
    : (index: number) => ranks[index];
  const starts = new Int32Array(max + 2);

  for (const index of order) {
    starts[bucketOf(index) + 1]++;
  }

  for (let bucket = 1; bucket < starts.length; bucket++) {
    starts[bucket] += starts[bucket - 1];
  }

  const sorted = new Int32Array(order.length);

  for (const index of order) {
    sorted[starts[bucketOf(index)]++] = index;
  }

  return sorted;
};

/**
 * Devolve os itens ordenados pelas chaves, na ordem de prioridade. Não muta
 * `items` (sem chaves devolve o próprio array). Estável: empates mantêm a
 * ordem de entrada. Comparação padrão: a de `createComparer(language, dataType)`.
 * Vazios ficam no início em `asc` e no fim em `desc` (a direção inverte o
 * comparador inteiro, como no DevExtreme).
 *
 * Só com o comparador padrão, cada chave vira postos inteiros e a ordenação
 * é um radix LSD (counting sort estável da última chave para a primeira) —
 * linear no número de linhas. Com `comparator` próprio, ordenação por
 * comparação.
 */
export const sortItems = <T>(
  items: readonly T[],
  sorting: readonly SortSpec[],
  language?: string,
  cache?: RankCache,
): readonly T[] => {

  if (!sorting.length || items.length < 2) {
    return items;
  }

  const keys = sorting.map(spec => prepareKey(items, spec, language, cache));
  let order: Int32Array = Int32Array.from({ length: items.length }, (_, i) => i);

  if (keys.every((key): key is RankKey => 'ranks' in key)) {
    for (const key of [...keys].reverse()) {
      order = countingSort(order, key.ranks, key.descending);
    }
  } else {
    const comparers = keys.map(key => 'compare' in key
      ? key.compare
      : (a: number, b: number) => (key.ranks[a] - key.ranks[b]) * (key.descending ? -1 : 1));

    order.sort((a, b) => {
      for (const comparer of comparers) {
        const result = comparer(a, b);

        if (result) {
          return result;
        }
      }

      return a - b;
    });
  }

  return Array.from(order, i => items[i]);
};
