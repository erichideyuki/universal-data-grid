import type { GridColumnDef, GridSortOrder } from '../grid-column-def.js';
import type { Comparer } from './compare.js';
import { coerceValue } from './format.js';
import {
  accumulate,
  type Accumulator,
  createAccumulators,
  finishAccumulators,
  mergeAccumulators,
  releaseSummaryCaches,
  type SummarySpec,
} from './summary.js';
import type { GroupNode } from './types.js';
import { cellValueReader } from './value.js';

/** Identidade de um valor para agrupar: 1 e "1" são grupos diferentes. */
const valueIdentity = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'blank';
  }

  if (value instanceof Date) {
    return `date:${value.getTime()}`;
  }

  return `${typeof value}:${String(value)}`;
};

const columnIdentity = (column: GridColumnDef, level: number): string =>
  column.path ?? `#${level}:${column.label ?? ''}`;

/** Leitor do valor de agrupamento: a faixa (`groupValueGetter`) ou o valor da célula. */
const groupValueReader = (column: GridColumnDef): (item: unknown) => unknown => {
  const { groupValueGetter } = column;

  return groupValueGetter
    ? item => groupValueGetter(item)
    : cellValueReader(column);
};

/** Valores de agrupamento de um item, um por nível (os de \`GroupNode.value\`; caminho do grupo dele). */
export const groupValuesOf = (item: unknown, groupColumns: readonly GridColumnDef[]): unknown[] =>
  groupColumns.map(column => groupValueReader(column)(item));

/** Identidade de um valor de grupo; a faixa não passa pelo `dataType` da coluna. */
const groupIdentity = (value: unknown, column: GridColumnDef): string =>
  valueIdentity(column.groupValueGetter ? value : coerceValue(value, column.dataType));

/**
 * Chave de expansão do grupo de valores `path` (um por nível), a mesma de
 * `GroupNode.key`; `undefined` se o caminho for vazio ou mais fundo que o
 * agrupamento.
 */
export const groupKeyOf = (path: readonly unknown[], groupColumns: readonly GridColumnDef[]): string | undefined => {
  if (!path.length || path.length > groupColumns.length) {
    return undefined;
  }

  return JSON.stringify(path.map((value, level) => {
    const column = groupColumns[level];
    return [columnIdentity(column, level), groupIdentity(value, column)];
  }));
};

interface Bucket {
  value: unknown;
  items: unknown[];
  accumulators: Accumulator[] | undefined;
}

interface Built {
  nodes: GroupNode[];
  accumulators: Accumulator[][];
}

/**
 * Agrupa `items` pelas colunas de grupo, em todos os níveis. Não depende da
 * ordem de entrada (usa mapa, não "valores consecutivos") e não muta nada.
 * O valor é o de `getCellValue` (`valueGetter`/`path`); com `dataType`
 * informado, valores equivalentes no tipo (`10` e `"10"` numa coluna
 * `number`) caem no mesmo grupo. Grupos de cada nível em ordem do
 * comparador da coluna (`compareFor`, ou o `comparator` dela), na direção
 * de `orders[nível]` (padrão `asc`); itens na ordem de entrada — por isso o
 * grid ordena os itens ANTES de agrupar.
 *
 * Com `groupValueGetter` o grupo é a faixa devolvida: identidade e ordem
 * pelo próprio valor (o `compareFor` do grid já vem sem `dataType`), sem o
 * `comparator` da coluna.
 *
 * Resumos de grupo (`summaries`) na mesma passada: no último nível cada item
 * é acumulado no balde do seu valor cru enquanto é distribuído; valores
 * equivalentes juntam os acumuladores, e os pais juntam os filhos.
 */
export const buildGroups = (
  items: readonly unknown[],
  groupColumns: readonly GridColumnDef[],
  compareFor: (column: GridColumnDef) => Comparer,
  orders: readonly (GridSortOrder | undefined)[] = [],
  summaries: readonly SummarySpec[] = [],
): GroupNode[] => {

  const summarizing = summaries.length > 0;
  const lastLevel = groupColumns.length - 1;

  const build = (levelItems: readonly unknown[], level: number, parentKey: unknown[], parentPath: readonly unknown[]): Built => {
    const column = groupColumns[level];
    const compare = compareFor(column);
    const read = groupValueReader(column);
    const leaf = level === lastLevel;
    const accumulateHere = summarizing && leaf;
    // 1º por valor cru (uma consulta de `Map` por item, sem montar texto);
    // depois junta os valores equivalentes no tipo — poucos, os distintos
    // (spec 16).
    const byRaw = new Map<unknown, { items: unknown[]; accumulators: Accumulator[] | undefined }>();
    // `Date` por tempo (cada objeto seria uma entrada); o valor do grupo é a 1ª.
    const dates = new Map<string, Date>();

    const rawKeyOf = (value: unknown): unknown => {
      if (!(value instanceof Date)) {
        return value;
      }

      const key = `\0date:${value.getTime()}`;

      if (!dates.has(key)) {
        dates.set(key, value);
      }

      return key;
    };

    for (const item of levelItems) {
      const rawKey = rawKeyOf(read(item));
      let raw = byRaw.get(rawKey);

      if (raw) {
        raw.items.push(item);
      } else {
        raw = { items: [item], accumulators: accumulateHere ? createAccumulators(summaries) : undefined };
        byRaw.set(rawKey, raw);
      }

      if (accumulateHere) {
        accumulate(raw.accumulators!, summaries, item);
      }
    }

    const buckets = new Map<string, Bucket>();
    const identityOf = new Map<unknown, string>();
    let merged = false;

    for (const [rawKey, raw] of byRaw) {
      const value = typeof rawKey === 'string' ? dates.get(rawKey) ?? rawKey : rawKey;
      const identity = groupIdentity(value, column);
      const existing = buckets.get(identity);

      identityOf.set(rawKey, identity);

      if (existing) {
        merged = true;
        existing.items = [];

        if (existing.accumulators && raw.accumulators) {
          mergeAccumulators(existing.accumulators, raw.accumulators, summaries);
        }
      } else {
        buckets.set(identity, { value, items: raw.items, accumulators: raw.accumulators });
      }
    }

    // Valores crus diferentes no mesmo grupo (10 e "10"): refaz os itens
    // desses grupos na ordem de entrada.
    if (merged) {
      const refill = new Set([...buckets.values()].filter(bucket => !bucket.items.length));

      for (const item of levelItems) {
        const bucket = buckets.get(identityOf.get(rawKeyOf(read(item)))!)!;

        if (refill.has(bucket)) {
          bucket.items.push(item);
        }
      }
    }

    const direction = orders[level] === 'desc' ? -1 : 1;
    const comparator = column.groupValueGetter ? null : column.comparator;
    const sorted = [...buckets.entries()].sort(([, a], [, b]) => direction * (comparator
      ? comparator(a.value, b.value, a.items[0], b.items[0]) || 0
      : compare(a.value, b.value)));

    const nodes: GroupNode[] = [];
    const accumulators: Accumulator[][] = [];

    for (const [identity, bucket] of sorted) {
      const key = [...parentKey, [columnIdentity(column, level), identity]];
      // Congelado: vai no `detail` do evento de expansão (como o da API).
      const path = Object.freeze([...parentPath, bucket.value]);
      let children: GroupNode[] = [];
      let groupAccumulators = bucket.accumulators;

      if (!leaf) {
        const built = build(bucket.items, level + 1, key, path);
        children = built.nodes;

        if (summarizing) {
          groupAccumulators = createAccumulators(summaries);

          for (const child of built.accumulators) {
            mergeAccumulators(groupAccumulators, child, summaries);
          }
        }
      }

      if (groupAccumulators) {
        accumulators.push(groupAccumulators);
      }

      // Grupo pronto: os itens não mudam mais (o agregador próprio os recebe).
      Object.freeze(bucket.items);

      nodes.push({
        key: JSON.stringify(key),
        level,
        column,
        value: bucket.value,
        path,
        items: bucket.items,
        children,
        summaries: groupAccumulators ? finishAccumulators(groupAccumulators, summaries, bucket.items) : [],
      });
    }

    return { nodes, accumulators };
  };

  if (!groupColumns.length) {
    return [];
  }

  const { nodes } = build(items, 0, [], []);
  releaseSummaryCaches(summaries);
  return nodes;
};
