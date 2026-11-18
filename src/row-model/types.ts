import type { GridColumnDef } from '../grid-column-def.js';

/** Nó da árvore de grupos — imutável depois de construído. */
export interface GroupNode {
  /** Chave estável: caminho de (coluna, valor) desde o 1º nível. */
  key: string;
  level: number;
  column: GridColumnDef;
  value: unknown;
  /** Valores do grupo desde o 1º nível (`GridGroupPath`). */
  path: readonly unknown[];
  /** Itens do grupo, na ordem original de `items`. */
  items: readonly unknown[];
  /** Subgrupos (vazio no último nível). */
  children: GroupNode[];
  /** Valores dos resumos de grupo, na ordem de `summary.group`. */
  summaries: readonly unknown[];
}

export interface GroupRow {
  isGroup: true;
  isFooter?: false;
  isDetail?: false;
  key: string;
  /** Chave do nó (`GroupNode.key`), usada no estado de expansão. */
  groupKey: string;
  level: number;
  column: GridColumnDef;
  value: unknown;
  expanded: boolean;
  itemCount: number;
  /** 1º item do grupo — passado a `displayValue` no texto do grupo. */
  firstItem: unknown;
  /** Valores do grupo desde o 1º nível. */
  path: readonly unknown[];
  summaries: readonly unknown[];
}

/** Rodapé de um grupo expandido (resumos `display: 'footer'`). */
export interface GroupFooterRow {
  isGroup: false;
  isFooter: true;
  isDetail?: false;
  key: string;
  groupKey: string;
  level: number;
  path: readonly unknown[];
  summaries: readonly unknown[];
}

export interface DataRow {
  isGroup: false;
  isFooter?: false;
  isDetail?: false;
  key: string;
  item: any;
  /** Posição da linha dentro do bloco de dados (do grupo ou do grid) — define a listra. */
  index: number;
}

/** Linha de detalhe (master-detail) logo depois da linha de dados do item. */
export interface DetailRow {
  isGroup: false;
  isFooter?: false;
  isDetail: true;
  key: string;
  item: any;
  /** Chave da linha mestre (`DataRow.key`). */
  masterKey: string;
}

export type Row = GroupRow | GroupFooterRow | DataRow | DetailRow;
