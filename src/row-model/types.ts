import type { GridColumnDef } from '../grid-column-def.js';

/** Nó da árvore de grupos — imutável depois de construído. */
export interface GroupNode {
  /** Chave estável: caminho de (coluna, valor) desde o 1º nível. */
  key: string;
  level: number;
  column: GridColumnDef;
  value: unknown;
  /** Itens do grupo, na ordem original de `items`. */
  items: readonly unknown[];
  /** Subgrupos (vazio no último nível). */
  children: GroupNode[];
}

export interface GroupRow {
  isGroup: true;
  key: string;
  /** Chave do nó (`GroupNode.key`), usada no estado de expansão. */
  groupKey: string;
  level: number;
  column: GridColumnDef;
  value: unknown;
  expanded: boolean;
  itemCount: number;
}

export interface DataRow {
  isGroup: false;
  key: string;
  item: any;
  /** Posição da linha dentro do bloco de dados (do grupo ou do grid) — define a listra. */
  index: number;
}

export type Row = GroupRow | DataRow;
