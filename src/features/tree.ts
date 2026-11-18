import { type GridRowKey } from '../data/data-source.js';
import {
  ancestorsOfMatches,
  buildFlatIndex,
  buildNestedIndex,
  childrenReader,
  type TreeIndex,
  type TreeKeyOf,
} from '../row-model/tree.js';
import { getValueByPath } from '../row-model/value.js';

/** How `<u-grid>` reads `items` (attribute `tree-mode`): a plain list, or a tree from nested children or from parent keys. */
export type GridTreeMode = 'none' | 'nested' | 'flat';

/** What filtering and searching show in a tree (attribute `tree-filter-mode`). */
export type GridTreeFilterMode = 'with-ancestors' | 'full-branch' | 'match-only';

/** `childrenExpr`: a property `path` (dots allowed) or a function that returns the children of an item. */
export type GridChildrenExpr<TItem = any> = string | ((item: TItem) => readonly TItem[] | null | undefined);

/** `parentKeyExpr`: a property `path` or a function that returns the key of the parent (`null`/`undefined` = root). */
export type GridParentKeyExpr<TItem = any> = string | ((item: TItem) => GridRowKey | null | undefined);

/** `hasChildrenExpr`: a property `path` or a function that tells whether a remote node has children to load. */
export type GridHasChildrenExpr<TItem = any> = string | ((item: TItem) => boolean);

export const normalizeTreeMode = (value: unknown): GridTreeMode =>
  value === 'nested' || value === 'flat' ? value : 'none';

export const normalizeTreeFilterMode = (value: unknown): GridTreeFilterMode =>
  value === 'full-branch' || value === 'match-only' ? value : 'with-ancestors';

/** Lê uma expressão (`path` ou função). */
export const exprReader = <T>(expr: string | ((item: any) => T)): (item: unknown) => T =>
  typeof expr === 'function' ? expr : (item: unknown) => getValueByPath(item, expr) as T;

/** Configuração que define o índice: trocar qualquer uma refaz a árvore. */
export interface TreeConfig {
  mode: GridTreeMode;
  childrenExpr: GridChildrenExpr | null;
  parentKeyExpr: GridParentKeyExpr | null;
  rootParentKey: GridRowKey | null;
  /** Chave do item (`keyExpr`), `undefined` = o próprio item. */
  keyOf: TreeKeyOf | undefined;
}

/**
 * Estado da árvore do grid (frente 25): o índice (refeito quando `items`
 * ou a configuração mudam) e a expansão por chave — exceções ao padrão
 * (`autoExpandNodes`/`expandAllNodes`), como a expansão de grupos.
 */
export class TreeState {
  #index: TreeIndex | undefined;
  #items: readonly unknown[] | undefined;
  #config: TreeConfig | undefined;
  /** Padrão posto por `expandAllNodes`/`collapseAllNodes`; `null` = `autoExpandNodes`. */
  all: boolean | null = null;
  /** Chaves cujo estado difere do padrão. */
  readonly exceptions = new Set<unknown>();
  /** Muda a cada mudança de expansão (estado, render). */
  version = 0;

  /** Índice para os itens e a configuração (o mesmo objeto enquanto nada mudou). */
  indexFor(items: readonly unknown[], config: TreeConfig): TreeIndex {
    const previous = this.#config;

    if (
      this.#index && this.#items === items
      && previous?.mode === config.mode && previous.childrenExpr === config.childrenExpr
      && previous.parentKeyExpr === config.parentKeyExpr && previous.rootParentKey === config.rootParentKey
      && previous.keyOf === config.keyOf
    ) {
      return this.#index;
    }

    this.#items = items;
    this.#config = { ...config };
    this.#index = config.mode === 'flat' && config.parentKeyExpr !== null && config.keyOf
      ? buildFlatIndex(items, config.keyOf, exprReader(config.parentKeyExpr), config.rootParentKey)
      : buildNestedIndex(items, childrenReader(config.childrenExpr ?? 'children'), config.keyOf);

    return this.#index;
  }

  get index(): TreeIndex | undefined {
    return this.#index;
  }

  /** Solta o índice (modo desligado, grid desconectado). */
  release(): void {
    this.#index = undefined;
    this.#items = undefined;
  }

  defaultExpanded(auto: boolean): boolean {
    return this.all ?? auto;
  }

  isExpanded(key: unknown, auto: boolean): boolean {
    return this.defaultExpanded(auto) !== this.exceptions.has(key);
  }

  /** Muda um nó; devolve se mudou. */
  set(key: unknown, expanded: boolean, auto: boolean): boolean {
    if (this.isExpanded(key, auto) === expanded) {
      return false;
    }

    if (this.exceptions.has(key)) {
      this.exceptions.delete(key);
    } else {
      this.exceptions.add(key);
    }

    this.version++;
    return true;
  }

  setAll(expanded: boolean): void {
    this.all = expanded;
    this.exceptions.clear();
    this.version++;
  }

  reset(): void {
    this.all = null;
    this.exceptions.clear();
    this.version++;
  }

  /** Expande os ancestrais dos nós que passam no filtro; devolve se algo mudou. */
  expandAncestors(match: Uint8Array, keyOfNode: (node: number) => unknown, auto: boolean): boolean {
    const index = this.#index;

    if (!index) {
      return false;
    }

    const ancestors = ancestorsOfMatches(index, match);
    let changed = false;

    for (let node = 0; node < ancestors.length; node++) {
      if (ancestors[node] && this.set(keyOfNode(node), true, auto)) {
        changed = true;
      }
    }

    return changed;
  }
}
