import type { GridColumnDef, GridSortOrder } from '../grid-column-def.js';
import type { Comparer } from './compare.js';
import { coerceValue } from './format.js';
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

/**
 * Agrupa `items` pelas colunas de grupo, em todos os níveis. Não depende da
 * ordem de entrada (usa mapa, não "valores consecutivos") e não muta nada.
 * O valor é o de `getCellValue` (`valueGetter`/`path`); com `dataType`
 * informado, valores equivalentes no tipo (`10` e `"10"` numa coluna
 * `number`) caem no mesmo grupo. Grupos de cada nível em ordem do
 * comparador da coluna (`compareFor`, ou o `comparator` dela), na direção
 * de `orders[nível]` (padrão `asc`); itens na ordem de entrada — por isso o
 * grid ordena os itens ANTES de agrupar.
 */
export const buildGroups = (
  items: readonly unknown[],
  groupColumns: readonly GridColumnDef[],
  compareFor: (column: GridColumnDef) => Comparer,
  orders: readonly (GridSortOrder | undefined)[] = [],
): GroupNode[] => {

  const build = (levelItems: readonly unknown[], level: number, parentPath: unknown[]): GroupNode[] => {
    const column = groupColumns[level];
    const compare = compareFor(column);
    const read = cellValueReader(column);
    // 1º por valor cru (uma consulta de `Map` por item, sem montar texto);
    // depois junta os valores equivalentes no tipo — poucos, os distintos
    // (spec 16).
    const byRaw = new Map<unknown, unknown[]>();
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
      const bucketItems = byRaw.get(rawKey);

      if (bucketItems) {
        bucketItems.push(item);
      } else {
        byRaw.set(rawKey, [item]);
      }
    }

    const buckets = new Map<string, { value: unknown; items: unknown[] }>();
    const identityOf = new Map<unknown, string>();
    let merged = false;

    for (const [rawKey, bucketItems] of byRaw) {
      const value = typeof rawKey === 'string' ? dates.get(rawKey) ?? rawKey : rawKey;
      const identity = valueIdentity(coerceValue(value, column.dataType));
      const existing = buckets.get(identity);

      identityOf.set(rawKey, identity);

      if (existing) {
        merged = true;
        existing.items = [];
      } else {
        buckets.set(identity, { value, items: bucketItems });
      }
    }

    // Valores crus diferentes no mesmo grupo (10 e "10"): refaz os itens
    // desses grupos na ordem de entrada.
    if (merged) {
      const refill = new Set([...buckets.values()].filter(bucket => !bucket.items.length));

      for (const item of levelItems) {
        const value = read(item);
        const bucket = buckets.get(identityOf.get(rawKeyOf(value))!)!;

        if (refill.has(bucket)) {
          bucket.items.push(item);
        }
      }
    }

    const direction = orders[level] === 'desc' ? -1 : 1;
    const comparator = column.comparator;
    const sorted = [...buckets.entries()].sort(([, a], [, b]) => direction * (comparator
      ? comparator(a.value, b.value, a.items[0], b.items[0]) || 0
      : compare(a.value, b.value)));

    return sorted.map(([identity, bucket]) => {
      const path = [...parentPath, [columnIdentity(column, level), identity]];

      return {
        key: JSON.stringify(path),
        level,
        column,
        value: bucket.value,
        items: bucket.items,
        children: level + 1 < groupColumns.length
          ? build(bucket.items, level + 1, path)
          : [],
      };
    });
  };

  return groupColumns.length
    ? build(items, 0, [])
    : [];
};
