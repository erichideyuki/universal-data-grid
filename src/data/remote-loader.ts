import type { GridFilterExpression, GridGroupPath } from '../grid-column-def.js';
import type { GridColumnDef } from '../grid-column-def.js';
import { type LazyDetailsOf, RowList, type RowKeyOf } from '../row-model/flatten.js';
import { groupKeyOf } from '../row-model/group.js';
import { LruCache } from '../row-model/lru.js';
import { type GroupNode, type LazyItems, MISSING } from '../row-model/types.js';
import {
  deepFreeze,
  type GridLoadGroup,
  type GridLoadGroupResult,
  type GridLoadOptions,
  type GridLoadResult,
  type GridLoadSort,
  type GridLoadSummary,
  type GridLoadTree,
} from './data-source.js';

/**
 * Carregador da fonte remota (frente 08): sem DOM, testado em Node.
 *
 * Cada consulta (ordenação, filtro, agrupamento, resumos, tamanho do bloco)
 * é uma GERAÇÃO com cache próprio. Trocar a consulta aborta tudo o que está
 * pendente (`AbortController`) e cria uma geração nova; a anterior continua
 * na tela até a nova responder (sem piscar) e respostas de gerações velhas
 * são descartadas mesmo que a fonte ignore o `signal` (corrida de
 * respostas).
 *
 * Dados em BLOCOS de `blockSize` linhas (`skip`/`take`), num `LruCache` por
 * geração: o modo virtual com 5 milhões de linhas guarda só os blocos
 * vistos por último. Linhas de bloco ausente viram esqueleto; o render marca
 * o bloco como desejado (`LazyItems.get`) e `flush()` pede os desejados. Sem
 * paginação remota (`blockSize` infinito) cada nó carrega numa chamada só.
 *
 * Grupos remotos são preguiçosos: a raiz pede o 1º nível (chaves, contagens,
 * resumos); expandir um grupo pede o nível seguinte, ou as linhas do grupo,
 * com `groupPath`.
 */

/** Consulta de uma geração (o que não muda entre os pedidos dela). */
export interface LoaderQuery {
  sort: readonly GridLoadSort[];
  filter: GridFilterExpression | null;
  filterValue: GridFilterExpression | null;
  searchText: string;
  group: readonly GridLoadGroup[];
  totalSummary: readonly GridLoadSummary[];
  groupSummary: readonly GridLoadSummary[];
  /** Linhas por pedido; `Infinity` = cada nó numa chamada (sem `skip`/`take`). */
  blockSize: number;
  /** Rolagem infinita: sem `totalCount`, a lista cresce até um bloco curto. */
  infinite: boolean;
  /** Árvore (frente 25): os nós pedidos; `null` = lista comum. */
  tree?: GridLoadTree | null;
  /** Dados do hospedeiro presos à consulta (fora da chave de consulta). */
  context?: unknown;
}

export interface LoaderHost {
  /** Chama a fonte (com os eventos); `null` = carga cancelada pelo hospedeiro. */
  request(options: GridLoadOptions, signal: AbortSignal): Promise<GridLoadResult> | null;
  /** Algo chegou (dados, erro, troca de geração): renderizar de novo. */
  changed(): void;
}

/** Grupo remoto (um nível). */
export interface RemoteGroup {
  value: unknown;
  count: number;
  summary: readonly unknown[];
  /** Valores do grupo desde o 1º nível. */
  path: readonly unknown[];
}

export { MISSING };

/** Limite de blocos guardados por geração (o resto volta do servidor se reaparecer). */
export const BLOCK_CACHE_LIMIT = 200;

/** Pedido em voo ou falho: chave do nó + bloco. */
const NODE_SEP = '\u0000';

const pathKey = (path: GridGroupPath | null): string => path ? JSON.stringify(path.map(serialize)) : '';

const serialize = (value: unknown): unknown =>
  value instanceof Date ? { date: value.getTime() } : value === undefined ? null : value;

/** Linhas de dados de um nó (a raiz sem grupos, ou um grupo do último nível). */
class DataNode implements LazyItems {
  readonly lazy = true;
  readonly id: string;
  readonly path: GridGroupPath | null;
  /** Total de linhas (conhecido pelo grupo, pelo `totalCount` ou por um bloco curto). */
  count: number | undefined;
  /** Fim da última linha carregada (infinito: a lista cresce a partir dele). */
  loadedEnd = 0;
  readonly #generation: Generation;

  constructor(generation: Generation, id: string, path: GridGroupPath | null, count: number | undefined) {
    this.#generation = generation;
    this.id = id;
    this.path = path;
    this.count = count;
  }

  get length(): number {
    if (this.count !== undefined) {
      return this.count;
    }

    // Infinito: o que já veio + um bloco de esqueleto (pede o próximo).
    return this.loadedEnd + this.#generation.blockSizeFor(this);
  }

  /** Item na posição; marca o bloco como desejado quando falta. */
  get(position: number): unknown {
    const item = this.peek(position);

    if (item === MISSING) {
      this.#generation.want(this, this.#generation.blockOf(position));
    }

    return item;
  }

  find(match: (item: unknown) => boolean): number {
    return this.#generation.find(this, match);
  }

  loadedPositions(match: (item: unknown) => boolean): number[] {
    return this.#generation.loadedPositions(this, match);
  }

  /** Item na posição sem pedir nada (`MISSING` se o bloco não está em cache). */
  peek(position: number): unknown {
    const size = this.#generation.blockSizeFor(this);
    const block = this.#generation.block(this, Math.floor(position / size));

    if (!block) {
      return MISSING;
    }

    const offset = position % size;

    return offset < block.length ? block[offset] : MISSING;
  }
}

/** Lista de grupos de um nível (filhos da raiz ou de um grupo). */
class GroupListNode implements LazyItems {
  readonly lazy = true;
  readonly id: string;
  readonly path: GridGroupPath | null;
  readonly level: number;
  groups: RemoteGroup[] | undefined;
  readonly #generation: Generation;

  constructor(generation: Generation, id: string, path: GridGroupPath | null, level: number) {
    this.#generation = generation;
    this.id = id;
    this.path = path;
    this.level = level;
  }

  /** Antes de carregar: uma linha de esqueleto. */
  get length(): number {
    return this.groups ? 0 : 1;
  }

  get(): unknown {
    this.#generation.want(this, 0);
    return MISSING;
  }

  peek(): unknown {
    return MISSING;
  }

  find(): number {
    return -1;
  }

  loadedPositions(): number[] {
    return [];
  }
}

export type RemoteNode = DataNode | GroupListNode;
export type { DataNode, GroupListNode };

/** Uma consulta e tudo o que veio dela. */
class Generation {
  readonly query: LoaderQuery;
  readonly #host: LoaderHost;
  readonly #onSettled: (generation: Generation) => void;
  readonly root: RemoteNode;
  readonly #blocks = new LruCache<string, readonly unknown[]>(BLOCK_CACHE_LIMIT);
  readonly #lists = new Map<string, GroupListNode>();
  readonly #data = new Map<string, DataNode>();
  readonly #pending = new Map<string, AbortController>();
  readonly #wanted = new Map<string, { node: RemoteNode; block: number }>();
  readonly #failed = new Set<string>();
  /** A raiz respondeu (contagem e resumos conhecidos). */
  ready = false;
  totalCount: number | undefined;
  summary: readonly unknown[] = [];
  error: unknown = undefined;
  hasError = false;
  disposed = false;
  /** O 1º pedido da raiz (o que traz total e resumos) já saiu. */
  #headAsked = false;
  /** Muda a cada resposta aplicada (o grid refaz as linhas). */
  version = 0;

  constructor(query: LoaderQuery, host: LoaderHost, onSettled: (generation: Generation) => void) {
    this.query = query;
    this.#host = host;
    this.#onSettled = onSettled;
    this.root = query.group.length
      ? this.#list(null, 0)
      : this.#dataNode(null, undefined);
  }

  get blocksCached(): number {
    return this.#blocks.size;
  }

  get pendingCount(): number {
    return this.#pending.size;
  }

  blockSizeFor(node: DataNode): number {
    return Number.isFinite(this.query.blockSize) ? this.query.blockSize : Math.max(node.count ?? node.loadedEnd, 1);
  }

  blockOf(position: number): number {
    return Number.isFinite(this.query.blockSize) ? Math.floor(position / this.query.blockSize) : 0;
  }

  /** Posição do 1º item carregado do nó que satisfaz `match` (só blocos em cache). */
  find(node: DataNode, match: (item: unknown) => boolean): number {
    const prefix = node.id + NODE_SEP;
    const size = this.blockSizeFor(node);
    let best = -1;

    for (const [key, block] of this.#blocks.entries()) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      const start = Number(key.slice(prefix.length)) * (Number.isFinite(this.query.blockSize) ? size : 0);
      const offset = block.findIndex(match);

      if (offset >= 0 && (best < 0 || start + offset < best)) {
        best = start + offset;
      }
    }

    return best;
  }

  /** Posições (crescentes) dos itens carregados do nó que satisfazem `match` (linhas de detalhe). */
  loadedPositions(node: DataNode, match: (item: unknown) => boolean): number[] {
    const prefix = node.id + NODE_SEP;
    const size = Number.isFinite(this.query.blockSize) ? this.blockSizeFor(node) : 0;
    const positions: number[] = [];

    for (const [key, block] of this.#blocks.entries()) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      const start = Number(key.slice(prefix.length)) * size;

      block.forEach((item, offset) => {
        if (match(item)) {
          positions.push(start + offset);
        }
      });
    }

    return positions.sort((a, b) => a - b);
  }

  /** Itens da raiz numa carga única (modo sem paginação nem grupos remotos). */
  rootItems(): readonly unknown[] | undefined {
    return this.root instanceof DataNode ? this.block(this.root, 0) : undefined;
  }

  block(node: DataNode, index: number): readonly unknown[] | undefined {
    return this.#blocks.get(node.id + NODE_SEP + index);
  }

  #list(path: GridGroupPath | null, level: number): GroupListNode {
    const id = `l${pathKey(path)}`;
    let node = this.#lists.get(id);

    if (!node) {
      node = new GroupListNode(this, id, path, level);
      this.#lists.set(id, node);
    }

    return node;
  }

  #dataNode(path: GridGroupPath | null, count: number | undefined): DataNode {
    const id = `d${pathKey(path)}`;
    let node = this.#data.get(id);

    if (!node) {
      node = new DataNode(this, id, path, count);
      this.#data.set(id, node);
    }

    return node;
  }

  /** Lista de subgrupos JÁ criada de um grupo (sem criar). */
  loadedList(group: RemoteGroup): GroupListNode | undefined {
    return this.#lists.get(`l${pathKey(group.path)}`);
  }

  /** Filhos de um grupo expandido: o próximo nível ou as linhas. */
  childrenOf(group: RemoteGroup): RemoteNode {
    return group.path.length < this.query.group.length
      ? this.#list(group.path, group.path.length)
      : this.#dataNode(group.path, group.count);
  }

  want(node: RemoteNode, block: number): void {
    const key = node.id + NODE_SEP + block;

    if (!this.disposed && !this.#pending.has(key) && !this.#failed.has(key)) {
      this.#wanted.set(key, { node, block });
    }
  }

  /** Pede os blocos desejados desde o último `flush`. */
  flush(): void {
    const wanted = [...this.#wanted.values()];
    this.#wanted.clear();

    for (const { node, block } of wanted) {
      this.#load(node, block);
    }
  }

  #options(node: RemoteNode, block: number, head: boolean): GridLoadOptions {
    const { query } = this;
    const isList = node instanceof GroupListNode;
    const paged = !isList && Number.isFinite(query.blockSize);
    const options: { -readonly [K in keyof GridLoadOptions]: GridLoadOptions[K] } = {
      sort: query.sort,
      filter: query.filter,
      filterValue: query.filterValue,
      searchText: query.searchText,
      group: query.group,
      groupPath: node.path,
      requireTotalCount: head && !query.infinite,
      requireGroupCount: isList,
      totalSummary: head ? query.totalSummary : [],
      groupSummary: isList ? query.groupSummary : [],
      tree: query.tree ?? null,
    };

    if (paged) {
      options.skip = block * query.blockSize;
      options.take = query.blockSize;
    }

    return deepFreeze(options);
  }

  #load(node: RemoteNode, block: number): void {
    const key = node.id + NODE_SEP + block;

    if (this.disposed || this.#pending.has(key)) {
      return;
    }

    const controller = new AbortController();
    const head = node === this.root && !this.#headAsked;
    const options = this.#options(node, block, head);

    if (head) {
      this.#headAsked = true;
    }

    let request: Promise<GridLoadResult> | null;

    try {
      request = this.#host.request(options, controller.signal);
    } catch (error) {
      request = Promise.reject(error);
    }

    if (!request) {
      // Cancelada pelo hospedeiro (`u-grid-loading`): fica como está.
      if (head) {
        this.#headAsked = false;
      }

      this.#settle();
      return;
    }

    this.#pending.set(key, controller);

    request.then(
      result => {
        if (this.#pending.get(key) !== controller || controller.signal.aborted || this.disposed) {
          return;
        }

        this.#pending.delete(key);
        this.#apply(node, block, result, head);
        this.version++;
        this.#settle();
        this.#host.changed();
      },
      (error: unknown) => {
        if (this.#pending.get(key) !== controller || controller.signal.aborted || this.disposed) {
          return;
        }

        this.#pending.delete(key);
        this.#failed.add(key);

        if (head) {
          this.#headAsked = false;
        }

        this.error = error;
        this.hasError = true;
        this.version++;
        this.#settle();
        this.#host.changed();
      },
    );
  }

  #settle(): void {
    this.#onSettled(this);
  }

  #apply(node: RemoteNode, block: number, result: GridLoadResult, head: boolean): void {
    const data = Array.isArray(result?.data) ? result.data : [];

    if (head) {
      this.ready = true;
      this.summary = result.summary ?? [];

      if (typeof result.totalCount === 'number' && result.totalCount >= 0) {
        this.totalCount = result.totalCount;
      }
    }

    if (node instanceof GroupListNode) {
      const groups = (data as readonly GridLoadGroupResult[]).map(group => ({
        value: group?.key,
        count: Math.max(0, Number(group?.count) || 0),
        summary: group?.summary ?? [],
        path: [...node.path ?? [], group?.key],
      }));

      node.groups = groups;

      if (node === this.root && this.totalCount === undefined) {
        this.totalCount = groups.reduce((sum, group) => sum + group.count, 0);
      }

      return;
    }

    const size = this.query.blockSize;

    this.#blocks.set(node.id + NODE_SEP + block, data);

    if (!Number.isFinite(size)) {
      node.count = data.length;
      node.loadedEnd = data.length;
      return;
    }

    const end = block * size + data.length;
    node.loadedEnd = Math.max(node.loadedEnd, end);

    if (node === this.root && !this.query.infinite && this.totalCount !== undefined) {
      node.count = this.totalCount;
    }

    // Bloco curto: acabou (infinito, ou servidor sem `totalCount`).
    if (data.length < size && (node.count === undefined || node.count > end)) {
      node.count = end;

      if (node === this.root) {
        this.totalCount = end;
      }
    }
  }

  /** Tenta de novo o que falhou. */
  retry(): void {
    this.hasError = false;
    this.error = undefined;
    this.#failed.clear();
  }

  /** Itens carregados (seleção, `applyChanges`, `getSelectedItems`). */
  *loadedItems(): Generator {
    for (const [, block] of this.#blocks.entries()) {
      yield* block;
    }
  }

  /**
   * Itens carregados na ordem da tela (exportação): grupos carregados na
   * ordem deles e, em cada nó de dados, os blocos em cache por posição. Não
   * pede nada nem mexe na ordem do LRU.
   */
  loadedInOrder(): unknown[] {
    const byNode = new Map<string, [number, readonly unknown[]][]>();

    for (const [key, block] of this.#blocks.entries()) {
      const separator = key.lastIndexOf(NODE_SEP);
      const id = key.slice(0, separator);
      let blocks = byNode.get(id);

      if (!blocks) {
        blocks = [];
        byNode.set(id, blocks);
      }

      blocks.push([Number(key.slice(separator + 1)), block]);
    }

    const items: unknown[] = [];

    const visit = (node: RemoteNode | undefined): void => {
      if (!node) {
        return;
      }

      if (node instanceof DataNode) {
        for (const [, block] of (byNode.get(node.id) ?? []).sort((a, b) => a[0] - b[0])) {
          for (const item of block) {
            items.push(item);
          }
        }

        return;
      }

      for (const group of node.groups ?? []) {
        visit(group.path.length < this.query.group.length
          ? this.#lists.get(`l${pathKey(group.path)}`)
          : this.#data.get(`d${pathKey(group.path)}`));
      }
    };

    visit(this.root);
    return items;
  }

  /** Troca, nos blocos em cache, os itens cuja chave está em `updates`. */
  updateItems(keyOf: (item: unknown) => unknown, updates: Map<unknown, unknown>): number {
    let count = 0;

    for (const [id, block] of this.#blocks.entries()) {
      let copy: unknown[] | undefined;

      block.forEach((item, index) => {
        const next = updates.get(keyOf(item));

        if (next !== undefined) {
          copy ??= [...block];
          copy[index] = next;
          count++;
        }
      });

      if (copy) {
        this.#blocks.replace(id, copy);
      }
    }

    if (count) {
      this.version++;
    }

    return count;
  }

  /** Aborta o que está em voo; a geração continua usável (pede de novo se precisar). */
  abortPending(): void {
    for (const controller of this.#pending.values()) {
      controller.abort();
    }

    this.#pending.clear();

    if (!this.ready) {
      this.#headAsked = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.#wanted.clear();
    this.abortPending();
  }
}

export type { Generation };

/**
 * Gerações da fonte remota: a exibida (`current`) e a que está carregando
 * (`next`). O grid lê sempre `current`.
 */
export class RemoteLoader {
  readonly #host: LoaderHost;
  #current: Generation | undefined;
  #next: Generation | undefined;
  /** Promessas de `refresh()` esperando a geração em carga responder. */
  #waiting: (() => void)[] = [];

  constructor(host: LoaderHost) {
    this.#host = host;
  }

  /** Geração exibida (`undefined` antes da 1ª resposta). */
  get current(): Generation | undefined {
    return this.#current;
  }

  /** Há carga da consulta inteira em andamento (painel de carregamento). */
  get loading(): boolean {
    return !!this.#next && !this.#next.hasError;
  }

  /** Pedidos em voo (diagnóstico e testes de vazamento). */
  get pending(): number {
    return (this.#current?.pendingCount ?? 0) + (this.#next?.pendingCount ?? 0);
  }

  get blocksCached(): number {
    return (this.#current?.blocksCached ?? 0) + (this.#next?.blocksCached ?? 0);
  }

  /** A geração em carga falhou antes de responder (linha de erro sem dados novos). */
  get error(): { error: unknown } | undefined {
    const generation = this.#next?.hasError ? this.#next : this.#current?.hasError ? this.#current : undefined;
    return generation ? { error: generation.error } : undefined;
  }

  /**
   * Nova consulta: aborta tudo o que está pendente e começa a carregar.
   * `hintRow`: 1ª linha visível (o 1º pedido já traz o bloco dela).
   */
  reset(query: LoaderQuery, hintRow = 0): void {
    this.#next?.dispose();
    // A exibida segue na tela (e rolável) até a nova responder; o que ela
    // tinha em voo é da consulta velha.
    this.#current?.abortPending();

    const generation = new Generation(query, this.#host, settled => this.#settled(settled));
    this.#next = generation;

    const { root } = generation;

    if (root instanceof GroupListNode || !Number.isFinite(query.blockSize) || query.infinite) {
      generation.want(root, 0);
    } else {
      // O total vem com o 1º bloco; o da linha visível vem junto se for outro.
      generation.want(root, 0);

      const block = Math.floor(Math.max(0, hintRow) / query.blockSize);

      if (block > 0) {
        generation.want(root, block);
      }
    }

    generation.flush();
  }

  #settled(generation: Generation): void {
    if (generation !== this.#next) {
      return;
    }

    if (generation.ready) {
      this.#current?.dispose();
      this.#current = generation;
      this.#next = undefined;
      this.#resolveWaiting();
    } else if (generation.hasError) {
      // Falhou antes de responder: a anterior segue na tela, com a linha de erro.
      this.#resolveWaiting();
    } else if (!generation.pendingCount) {
      // Cancelada pelo hospedeiro: a anterior segue na tela.
      generation.dispose();
      this.#next = undefined;
      this.#resolveWaiting();
      this.#host.changed();
    }
  }

  /** Resolve quando a carga em andamento termina (ou já, sem carga). */
  whenSettled(): Promise<void> {
    if (!this.#next || (!this.#next.pendingCount && !this.#next.ready)) {
      return Promise.resolve();
    }

    return new Promise(resolve => this.#waiting.push(resolve));
  }

  #resolveWaiting(): void {
    const waiting = this.#waiting;
    this.#waiting = [];
    waiting.forEach(resolve => resolve());
  }

  /** Pede o que o último render marcou. */
  flush(): void {
    this.#current?.flush();
    this.#next?.flush();
  }

  /** "Tentar de novo": refaz os pedidos que falharam. */
  retry(): void {
    const next = this.#next;

    if (next?.hasError && !next.ready) {
      next.retry();
      next.want(next.root, 0);
      next.flush();
      this.#host.changed();
      return;
    }

    this.#current?.retry();
    this.#host.changed();
  }

  /** Aborta tudo (grid desconectado); `reset` recomeça. */
  dispose(): void {
    this.#next?.dispose();
    this.#current?.dispose();
    this.#next = undefined;
    this.#current = undefined;
    this.#resolveWaiting();
  }
}

/**
 * Linhas da geração: grupos carregados (os expandidos com filhos) e blocos
 * preguiçosos de dados. O(grupos), nunca O(linhas).
 */
export const flattenRemote = (
  generation: Generation,
  groupColumns: readonly GridColumnDef[],
  isExpanded: (key: string, level: number) => boolean,
  keyOf: RowKeyOf,
  groupSummaries: (summary: readonly unknown[]) => readonly unknown[],
  groupFooters = false,
  detailsOf?: LazyDetailsOf,
): RowList => {
  const rows = new RowList(keyOf);

  const visit = (node: RemoteNode) => {
    if (node instanceof DataNode) {
      rows.pushItems(node, detailsOf?.(node));
      return;
    }

    if (!node.groups) {
      rows.pushItems(node);
      return;
    }

    for (const group of node.groups) {
      const level = group.path.length - 1;
      const column = groupColumns[level];
      const key = groupKeyOf(group.path, groupColumns) ?? JSON.stringify(group.path.map(serialize));
      const expanded = isExpanded(key, level);
      const summaries = groupSummaries(group.summary);

      rows.push({
        isGroup: true,
        key: `g:${key}`,
        groupKey: key,
        level,
        column,
        value: group.value,
        expanded,
        itemCount: group.count,
        firstItem: undefined,
        path: group.path,
        summaries,
      });

      if (!expanded) {
        continue;
      }

      visit(generation.childrenOf(group));

      if (groupFooters) {
        rows.push({ isGroup: false, isFooter: true, key: `f:${key}`, groupKey: key, level, path: group.path, summaries });
      }
    }
  };

  visit(generation.root);
  return rows;
};

/**
 * Árvore de grupos carregados como `GroupNode` (sem itens): a API de
 * expansão e `getSummaryValues(groupPath)` do grid andam nela.
 */
export const remoteGroupNodes = (
  generation: Generation,
  groupColumns: readonly GridColumnDef[],
  groupSummaries: (summary: readonly unknown[]) => readonly unknown[],
): GroupNode[] => {
  const build = (node: GroupListNode | undefined): GroupNode[] =>
    node?.groups?.map(group => ({
      key: groupKeyOf(group.path, groupColumns) ?? JSON.stringify(group.path.map(serialize)),
      level: group.path.length - 1,
      column: groupColumns[group.path.length - 1],
      value: group.value,
      path: group.path,
      items: [],
      children: build(generation.loadedList(group)),
      summaries: groupSummaries(group.summary),
    })) ?? [];

  return generation.root instanceof GroupListNode ? build(generation.root) : [];
};
