import type { DataRow, GroupNode, Row } from './types.js';

export type RowKeyOf = (item: unknown) => string;

/**
 * Lista de linhas visíveis: grupos e, nos expandidos, os subgrupos ou os
 * itens. `isExpanded` decide por chave do grupo.
 */
export const flattenRows = (
  items: readonly unknown[],
  groups: readonly GroupNode[],
  isExpanded: (key: string) => boolean,
  keyOf: RowKeyOf,
): Row[] => {

  const rows: Row[] = [];
  const usedKeys = new Map<string, number>();

  const pushItems = (groupItems: readonly unknown[]) => {
    let index = 0;

    for (const item of groupItems) {
      let key = `d:${keyOf(item)}`;
      const seen = usedKeys.get(key) ?? 0;
      usedKeys.set(key, seen + 1);

      // O mesmo objeto duas vezes em items: chave distinta para o repeat.
      if (seen) {
        key = `${key}#${seen}`;
      }

      rows.push({ isGroup: false, key, item, index: index++ } satisfies DataRow);
    }
  };

  if (!groups.length) {
    pushItems(items);
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
      });

      if (!expanded) {
        continue;
      }

      if (node.children.length) {
        visit(node.children);
      } else {
        pushItems(node.items);
      }
    }
  };

  visit(groups);
  return rows;
};
