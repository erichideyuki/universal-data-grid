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
  /** Linha de fonte remota ainda não carregada (esqueleto; `item` indefinido). */
  skeleton?: true;
  /** Esqueleto de uma lista de subgrupos remota: nível (0-based) dos grupos dela. */
  level?: number;
  /** Linha fixa (frente 20): item do hospedeiro fora do row model, no topo ou no fundo. */
  fixed?: 'top' | 'bottom';
}

/** Item de bloco remoto ainda não carregado (linha-esqueleto). */
export const MISSING: unique symbol = Symbol('missing');

/**
 * Bloco de linhas carregado sob demanda (fonte remota, frente 08). `get`
 * marca o pedaço que falta como desejado; `peek` só olha. Item ausente =
 * `MISSING`.
 */
export interface LazyItems {
  readonly lazy: true;
  /** Identidade estável do bloco (chave das linhas-esqueleto). */
  readonly id: string;
  /** Lista de subgrupos (agrupamento remoto): nível dos grupos dela. */
  readonly level?: number;
  readonly length: number;
  get(position: number): unknown;
  peek(position: number): unknown;
  /** Posição do 1º item CARREGADO que satisfaz `match` (sem varrer o que falta); `-1` se nenhum. */
  find(match: (item: unknown) => boolean): number;
  /** Posições (crescentes) dos itens CARREGADOS que satisfazem `match` (linhas de detalhe). */
  loadedPositions(match: (item: unknown) => boolean): number[];
}

/** Bloco preguiçoso (fonte remota), e não um array de itens. */
export const isLazyItems = (items: readonly unknown[] | LazyItems): items is LazyItems => (items as LazyItems).lazy === true;

/** Linha de detalhe (master-detail) logo depois da linha de dados do item. */
export interface DetailRow {
  isGroup: false;
  isFooter?: false;
  isDetail: true;
  key: string;
  item: any;
  /** Chave da linha mestre (`DataRow.key`). */
  masterKey: string;
  /** Detalhe de uma linha fixa (frente 21: a fixa também expande). */
  fixed?: 'top' | 'bottom';
}

export type Row = GroupRow | GroupFooterRow | DataRow | DetailRow;
