import { type BlockDetails, RowList, type RowKeyOf } from './flatten.js';

/**
 * Dados em árvore (frente 25): funções puras, sem DOM. Nada por nó além de
 * arrays tipados (`Int32Array`) e, quando precisa, do mapa chave → índice:
 * nenhum objeto por nó (spec 16). O row model guarda a árvore como
 * "compressed sparse rows": `childStart[p]..childStart[p + 1]` em
 * `children` são os filhos (visíveis, na ordem) do nó `p`; o nó virtual
 * `n` é a raiz.
 */

/** Chave → índice do nó (1ª ocorrência). */
export interface KeyLookup {
  get(key: unknown): number | undefined;
  has(key: unknown): boolean;
}

/**
 * Chaves inteiras não negativas e densas (o caso comum: ids numéricos): uma
 * tabela `Int32Array` em vez de um `Map` de 1 milhão de entradas (spec 16:
 * memória e tempo de montagem).
 */
class DenseKeys implements KeyLookup {
  readonly #table: Int32Array;

  constructor(table: Int32Array) {
    this.#table = table;
  }

  get(key: unknown): number | undefined {
    if (typeof key !== 'number' || !Number.isInteger(key) || key < 0 || key >= this.#table.length) {
      return undefined;
    }

    const index = this.#table[key];
    return index < 0 ? undefined : index;
  }

  has(key: unknown): boolean {
    return this.get(key) !== undefined;
  }
}

/** Índice estrutural: muda só com `items` ou com as expressões. */
export interface TreeIndex {
  /** Todos os nós. Plana: o próprio `items`; aninhada: pré-ordem. */
  readonly nodes: readonly unknown[];
  /** Índice do pai (`-1` = raiz). */
  readonly parent: Int32Array;
  /** Profundidade estrutural (0 = raiz). */
  readonly level: Int32Array;
  /** Ordem em que todo pai vem antes dos filhos (`null` = a própria ordem de `nodes`). */
  readonly topo: Int32Array | null;
  /** Chave → índice (1ª ocorrência). */
  readonly keyIndex: KeyLookup;
  /** Nós com pai inexistente (viraram raiz). */
  readonly orphans: number;
  /** Nós que fechavam um ciclo (viraram raiz) ou repetidos na entrada aninhada (ignorados). */
  readonly cycles: number;
  /** Chaves repetidas (a 1ª ocorrência vale no mapa). */
  readonly duplicates: number;
}

export type TreeKeyOf = (item: unknown) => unknown;
export type ChildrenOf = (item: unknown) => readonly unknown[] | null | undefined;

const isRootValue = (value: unknown, rootValue: unknown): boolean =>
  value === null || value === undefined || value === rootValue
  || (rootValue !== null && rootValue !== undefined && String(value) === String(rootValue));

/** Tabela densa das chaves (todas inteiras ≥ 0 e até 4× o número de nós) ou um `Map`. */
const keyLookup = (keys: readonly unknown[]): { lookup: KeyLookup; duplicates: number } => {
  const n = keys.length;
  let max = -1;
  let dense = true;

  for (let i = 0; i < n && dense; i++) {
    const key = keys[i];

    if (typeof key === 'number' && Number.isInteger(key) && key >= 0 && key < 4 * n + 1024) {
      max = Math.max(max, key);
    } else {
      dense = false;
    }
  }

  let duplicates = 0;

  if (dense) {
    const table = new Int32Array(max + 1).fill(-1);

    for (let i = 0; i < n; i++) {
      const key = keys[i] as number;

      if (table[key] >= 0) {
        duplicates++;
      } else {
        table[key] = i;
      }
    }

    return { lookup: new DenseKeys(table), duplicates };
  }

  const map = new Map<unknown, number>();

  for (let i = 0; i < n; i++) {
    const key = keys[i];

    if (map.has(key)) {
      duplicates++;
    } else {
      map.set(key, i);
    }
  }

  return { lookup: map, duplicates };
};

/**
 * Entrada plana: cada item diz a chave do pai. `rootValue`, `null`,
 * `undefined` ou pai inexistente = raiz. Um ciclo é cortado no nó em que a
 * subida volta (ele vira raiz).
 */
export const buildFlatIndex = (
  items: readonly unknown[],
  keyOf: TreeKeyOf,
  parentOf: TreeKeyOf,
  rootValue: unknown,
): TreeIndex => {
  const n = items.length;
  const keys = new Array<unknown>(n);

  for (let i = 0; i < n; i++) {
    keys[i] = keyOf(items[i]);
  }

  const { lookup: keyIndex, duplicates } = keyLookup(keys);
  const parent = new Int32Array(n);
  let orphans = 0;
  // Pais sempre antes dos filhos (o caso comum): níveis numa passada só.
  let ordered = true;

  for (let i = 0; i < n; i++) {
    const value = parentOf(items[i]);

    if (isRootValue(value, rootValue)) {
      parent[i] = -1;
      continue;
    }

    const p = keyIndex.get(value);

    if (p === undefined || p === i) {
      parent[i] = -1;
      orphans += p === undefined ? 1 : 0;
      continue;
    }

    parent[i] = p;
    ordered &&= p < i;
  }

  const level = new Int32Array(n);

  if (ordered) {
    for (let i = 0; i < n; i++) {
      const p = parent[i];
      level[i] = p < 0 ? 0 : level[p] + 1;
    }

    return { nodes: items, parent, level, topo: null, keyIndex, orphans, cycles: 0, duplicates };
  }

  // Profundidade e ordem topológica; 0 = por visitar, 1 = na pilha, 2 = pronto.
  const state = new Uint8Array(n);
  const topo = new Int32Array(n);
  const path: number[] = [];
  let next = 0;
  let cycles = 0;

  for (let i = 0; i < n; i++) {
    if (state[i] === 2) {
      continue;
    }

    // Sobe até um nó pronto (ou raiz), depois desce numerando.
    let node = i;
    path.length = 0;

    while (node >= 0 && state[node] === 0) {
      state[node] = 1;
      path.push(node);
      node = parent[node];
    }

    if (node >= 0 && state[node] === 1) {
      // Ciclo: `node` está no caminho; ele vira raiz.
      parent[node] = -1;
      cycles++;
    }

    for (let j = path.length - 1; j >= 0; j--) {
      const current = path[j];
      const p = parent[current];
      level[current] = p < 0 ? 0 : level[p] + 1;
      state[current] = 2;
      topo[next++] = current;
    }
  }

  return { nodes: items, parent, level, topo, keyIndex, orphans, cycles, duplicates };
};

/**
 * Entrada aninhada: `roots` e os filhos de cada item por `childrenOf`. Os
 * nós saem em pré-ordem (pai antes dos filhos). Sem `keyOf`, a chave é o
 * próprio item; um item que aparece de novo (ciclo ou repetido) é
 * ignorado.
 */
export const buildNestedIndex = (
  roots: readonly unknown[],
  childrenOf: ChildrenOf,
  keyOf?: TreeKeyOf,
): TreeIndex => {
  const nodes: unknown[] = [];
  const parents: number[] = [];
  const levels: number[] = [];
  const keyIndex = new Map<unknown, number>();
  const seen = keyOf ? new Set<unknown>() : keyIndex;
  let cycles = 0;
  let duplicates = 0;

  // Pilha de (lista, posição, pai, nível) sem objeto por nó: arrays paralelos.
  const lists: (readonly unknown[])[] = [roots];
  const positions: number[] = [0];
  const owners: number[] = [-1];

  while (lists.length) {
    const top = lists.length - 1;
    const list = lists[top];
    const position = positions[top];

    if (position >= list.length) {
      lists.pop();
      positions.pop();
      owners.pop();
      continue;
    }

    positions[top] = position + 1;
    const item = list[position];

    if (keyOf ? (seen as Set<unknown>).has(item) : keyIndex.has(item)) {
      cycles++;
      continue;
    }

    const index = nodes.length;
    const owner = owners[top];

    nodes.push(item);
    parents.push(owner);
    levels.push(owner < 0 ? 0 : levels[owner] + 1);

    if (keyOf) {
      (seen as Set<unknown>).add(item);
      const key = keyOf(item);

      if (keyIndex.has(key)) {
        duplicates++;
      } else {
        keyIndex.set(key, index);
      }
    } else {
      keyIndex.set(item, index);
    }

    const children = childrenOf(item);

    if (Array.isArray(children) && children.length) {
      lists.push(children);
      positions.push(0);
      owners.push(index);
    }
  }

  if (keyOf) {
    (seen as Set<unknown>).clear();
  }

  return {
    nodes,
    parent: Int32Array.from(parents),
    level: Int32Array.from(levels),
    topo: null,
    keyIndex,
    orphans: 0,
    cycles,
    duplicates,
  };
};

/** Lê os filhos por caminho (`a.b`) ou função; não-array = sem filhos. */
export const childrenReader = (expr: string | ((item: any) => readonly unknown[] | null | undefined)): ChildrenOf => {
  if (typeof expr === 'function') {
    return expr;
  }

  const parts = expr.split('.');

  return (item: unknown) => {
    let value: any = item;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }

      value = value[part];
    }

    return Array.isArray(value) ? value : undefined;
  };
};

/** O que o filtro mostra (`treeFilterMode`). */
export type TreeFilterMode = 'with-ancestors' | 'full-branch' | 'match-only';

/** Visão da árvore depois de filtrar e ordenar. */
export interface TreeView {
  /** Nós visíveis (`null` = todos). */
  readonly visible: Uint8Array | null;
  /** Quantos nós visíveis. */
  readonly count: number;
  /** Início dos filhos de cada nó em `children` (`n` = raiz virtual; tamanho n + 2). */
  readonly childStart: Int32Array;
  /** Filhos visíveis, agrupados por pai, na ordem da ordenação. */
  readonly children: Int32Array;
  /** Pai efetivo (`match-only`: o ancestral visível mais próximo); `-1` = raiz. */
  readonly parent: Int32Array;
  /** Profundidade efetiva (0 = raiz). */
  readonly level: Int32Array;
}

/** Percorre os nós com pai antes de filho. */
const forEachTopo = (index: TreeIndex, visit: (node: number) => void): void => {
  const { topo } = index;
  const n = index.nodes.length;

  for (let k = 0; k < n; k++) {
    visit(topo ? topo[k] : k);
  }
};

/**
 * Nós visíveis pelo filtro (`match[i]` = o nó passa; `null` = sem filtro)
 * conforme o modo: `with-ancestors` acrescenta os ancestrais dos que
 * passam; `full-branch`, também os descendentes; `match-only`, só os que
 * passam (pendurados no ancestral visível mais próximo).
 */
export const treeVisibility = (index: TreeIndex, match: Uint8Array | null, mode: TreeFilterMode): Uint8Array | null => {
  if (!match) {
    return null;
  }

  const n = index.nodes.length;
  const { parent } = index;

  if (mode === 'match-only') {
    return match;
  }

  const visible = new Uint8Array(n);

  // Ancestrais: sobe de cada nó que passa até um já marcado.
  for (let i = 0; i < n; i++) {
    if (!match[i]) {
      continue;
    }

    let node = i;

    while (node >= 0 && !visible[node]) {
      visible[node] = 1;
      node = parent[node];
    }
  }

  if (mode === 'full-branch') {
    // Descendentes: pai antes do filho; um filho de nó que passa (ou já descendente) entra.
    const inBranch = new Uint8Array(n);

    forEachTopo(index, node => {
      const p = parent[node];

      if (match[node] || (p >= 0 && inBranch[p])) {
        inBranch[node] = 1;
        visible[node] = 1;
      }
    });
  }

  return visible;
};

/**
 * Monta a visão: filhos visíveis de cada nó, na ordem `order` (índices de
 * `nodes` ordenados; `null` = a ordem de `nodes`, que na aninhada é a dos
 * filhos e na plana a de `items`). Uma passada para contar, outra para
 * preencher: O(n).
 */
export const buildTreeView = (
  index: TreeIndex,
  visible: Uint8Array | null,
  order: Int32Array | null,
  mode: TreeFilterMode,
): TreeView => {
  const n = index.nodes.length;
  let parent = index.parent;
  let level = index.level;

  if (visible && mode === 'match-only') {
    // Pai efetivo: o ancestral visível mais próximo; nível pela cadeia efetiva.
    const effective = new Int32Array(n);
    const effectiveLevel = new Int32Array(n);

    forEachTopo(index, node => {
      const p = index.parent[node];
      const up = p < 0 ? -1 : visible[p] ? p : effective[p];
      effective[node] = up;
      effectiveLevel[node] = up < 0 ? 0 : effectiveLevel[up] + 1;
    });

    parent = effective;
    level = effectiveLevel;
  }

  const childStart = new Int32Array(n + 2);
  let count = 0;

  for (let i = 0; i < n; i++) {
    if (!visible || visible[i]) {
      const p = parent[i];
      childStart[(p < 0 ? n : p) + 1]++;
      count++;
    }
  }

  for (let i = 1; i < n + 2; i++) {
    childStart[i] += childStart[i - 1];
  }

  const fill = childStart.slice(0, n + 1);
  const children = new Int32Array(count);

  for (let k = 0; k < n; k++) {
    const i = order ? order[k] : k;

    if (!visible || visible[i]) {
      const p = parent[i];
      children[fill[p < 0 ? n : p]++] = i;
    }
  }

  return { visible, count, childStart, children, parent, level };
};

/** Quantos filhos visíveis o nó tem. */
export const childCount = (view: TreeView, node: number): number =>
  view.childStart[node + 1] - view.childStart[node];

/**
 * Ancestrais (estruturais) dos nós que passam no filtro — os que expandem
 * quando o filtro muda (como `expandNodesOnFiltering` do DevExtreme).
 */
export const ancestorsOfMatches = (index: TreeIndex, match: Uint8Array): Uint8Array => {
  const n = index.nodes.length;
  const result = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    if (!match[i]) {
      continue;
    }

    let node = index.parent[i];

    while (node >= 0 && !result[node]) {
      result[node] = 1;
      node = index.parent[node];
    }
  }

  return result;
};

/**
 * Linhas visíveis da árvore: em pré-ordem, descendo nos nós expandidos.
 * Cada trecho de irmãos entre dois nós expandidos é um segmento da
 * `RowList` (nada por linha). `expanded(node)` só é perguntado para nós
 * com filhos; `extra(node)` acrescenta linhas avulsas depois dos filhos de
 * um nó expandido (rodapé de resumo, esqueleto de carga).
 */
export const flattenTree = (
  index: TreeIndex,
  view: TreeView,
  expanded: (node: number) => boolean,
  keyOf: RowKeyOf,
  hasChildren?: (node: number) => boolean,
  after?: (node: number, rows: RowList) => void,
  detailsOf?: (children: Int32Array, from: number, to: number) => BlockDetails | undefined,
): RowList => {
  const rows = new RowList(keyOf);
  const n = index.nodes.length;
  const { childStart, children } = view;
  const opens = (node: number): boolean =>
    (childStart[node + 1] > childStart[node] || (!!hasChildren && hasChildren(node))) && expanded(node);

  // Pilha: nó pai, próxima posição a varrer e início do trecho pendente.
  const owners: number[] = [n];
  const cursors: number[] = [childStart[n]];
  const runs: number[] = [childStart[n]];

  while (owners.length) {
    const top = owners.length - 1;
    const owner = owners[top];
    const start = childStart[owner];
    const end = childStart[owner + 1];
    let cursor = cursors[top];
    let descended = false;

    while (cursor < end) {
      const node = children[cursor++];

      if (opens(node)) {
        rows.pushTreeRun(index.nodes, children, runs[top], cursor, start, end - start, view.level[node], detailsOf?.(children, runs[top], cursor));
        cursors[top] = cursor;
        runs[top] = cursor;
        owners.push(node);
        cursors.push(childStart[node]);
        runs.push(childStart[node]);
        descended = true;
        break;
      }
    }

    if (descended) {
      continue;
    }

    if (runs[top] < end) {
      const level = owner === n ? 0 : view.level[owner] + 1;
      rows.pushTreeRun(index.nodes, children, runs[top], end, start, end - start, level, detailsOf?.(children, runs[top], end));
    }

    owners.pop();
    cursors.pop();
    runs.pop();

    if (owner !== n && after) {
      after(owner, rows);
    }
  }

  return rows;
};

// ------------------------------------------------------- seleção recursiva

/** Estrutura sem filtro (todos os filhos, na ordem de `nodes`), para a seleção recursiva. */
export const structuralView = (index: TreeIndex): TreeView => buildTreeView(index, null, null, 'with-ancestors');

/**
 * Seleção recursiva: marcar um nó marca todos os descendentes e cada
 * ancestral cujos filhos ficaram todos marcados; desmarcar desmarca os
 * descendentes e todos os ancestrais. Devolve os nós que mudam (sem
 * repetir), O(subárvore + profundidade).
 */
export const recursiveSelectionChange = (
  index: TreeIndex,
  structure: TreeView,
  node: number,
  select: boolean,
  isSelected: (node: number) => boolean,
): number[] => {
  const changed: number[] = [];
  const marked = new Set<number>();
  const { childStart, children } = structure;
  const state = (candidate: number): boolean => marked.has(candidate) ? select : isSelected(candidate);

  const mark = (candidate: number) => {
    if (state(candidate) !== select && !marked.has(candidate)) {
      changed.push(candidate);
    }

    marked.add(candidate);
  };

  // Subárvore (pilha explícita).
  const stack = [node];

  while (stack.length) {
    const current = stack.pop()!;
    mark(current);

    for (let k = childStart[current]; k < childStart[current + 1]; k++) {
      stack.push(children[k]);
    }
  }

  // Ancestrais.
  for (let up = index.parent[node]; up >= 0; up = index.parent[up]) {
    if (!select) {
      mark(up);
      continue;
    }

    let all = true;

    for (let k = childStart[up]; k < childStart[up + 1] && all; k++) {
      all = state(children[k]);
    }

    if (!all) {
      break;
    }

    mark(up);
  }

  return changed;
};

/**
 * Nós com algum descendente marcado (caixa mista quando o próprio nó não
 * está marcado). Uma passada de baixo para cima: O(n).
 */
export const partialSelection = (index: TreeIndex, isSelected: (node: number) => boolean): Uint8Array => {
  const n = index.nodes.length;
  const partial = new Uint8Array(n);
  const { topo, parent } = index;

  for (let k = n - 1; k >= 0; k--) {
    const node = topo ? topo[k] : k;
    const p = parent[node];

    if (p >= 0 && (partial[node] || isSelected(node))) {
      partial[p] = 1;
    }
  }

  return partial;
};

// ------------------------------------------------------- resumos por nó

/**
 * Descendentes visíveis de `node` (sem ele), em pré-ordem — base dos
 * resumos por nó. Calculado sob demanda para os nós que aparecem: O(subárvore).
 */
export const visibleDescendants = (index: TreeIndex, view: TreeView, node: number): unknown[] => {
  const result: unknown[] = [];
  const { childStart, children } = view;
  const stack: number[] = [];

  for (let k = childStart[node + 1] - 1; k >= childStart[node]; k--) {
    stack.push(children[k]);
  }

  while (stack.length) {
    const current = stack.pop()!;
    result.push(index.nodes[current]);

    for (let k = childStart[current + 1] - 1; k >= childStart[current]; k--) {
      stack.push(children[k]);
    }
  }

  return result;
};
