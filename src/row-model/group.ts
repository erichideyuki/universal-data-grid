import type { GridColumnDef } from '../grid-column-def.js';
import type { Comparer } from './compare.js';
import type { GroupNode } from './types.js';
import { getCellValue } from './value.js';

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
 * Grupos de cada nível em ordem de `compare`; itens na ordem original.
 */
export const buildGroups = (
  items: readonly unknown[],
  groupColumns: readonly GridColumnDef[],
  compare: Comparer,
): GroupNode[] => {

  const build = (levelItems: readonly unknown[], level: number, parentPath: unknown[]): GroupNode[] => {
    const column = groupColumns[level];
    const buckets = new Map<string, { value: unknown; items: unknown[] }>();

    for (const item of levelItems) {
      const value = getCellValue(item, column);
      const identity = valueIdentity(value);
      let bucket = buckets.get(identity);

      if (!bucket) {
        bucket = { value, items: [] };
        buckets.set(identity, bucket);
      }

      bucket.items.push(item);
    }

    const sorted = [...buckets.entries()].sort(([, a], [, b]) => compare(a.value, b.value));

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
