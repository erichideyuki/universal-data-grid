import type {
  GridFilterExpression,
  GridGroupPath,
  GridSortOrder,
  GridSummaryType,
} from '../grid-column-def.js';
import { getValueByPath } from '../row-model/value.js';

/** Key of a row read by `keyExpr`. */
export type GridRowKey = string | number;

/** `keyExpr` of `<u-grid>`: a property `path` (dots allowed) or a function that returns the key of an item. */
export type GridKeyExpr<TItem = any> = string | ((item: TItem) => GridRowKey);

/** How rows scroll: `virtual` (all rows, rendered on demand) or `infinite` (the next block loads at the end; `dataSource` only). */
export type GridScrollMode = 'virtual' | 'infinite';

/** A column of `GridLoadOptions.sort`. */
export interface GridLoadSort {
  /** Column `path`. */
  readonly path: string;
  /** Direction. */
  readonly order: GridSortOrder;
}

/** A grouping level of `GridLoadOptions.group`, outermost first. */
export interface GridLoadGroup {
  /** Column `path`. */
  readonly path: string;
  /** Order of the group keys. */
  readonly order: GridSortOrder;
  /** `false`: return only the keys, counts and summaries of the level (`items: null`). The grid always asks `false`. */
  readonly expanded: boolean;
}

/** A summary the server computes (`totalSummary`, `groupSummary`). */
export interface GridLoadSummary {
  /** Column `path`. */
  readonly path: string;
  /** Aggregate (custom aggregate functions are never sent). */
  readonly type: GridSummaryType;
  /** The `name` of the summary item, when it has one. */
  readonly name?: string;
}

/**
 * What the grid asks the data source. Frozen data: the host builds the
 * request from it — the grid never builds URLs or queries. `filter`,
 * `filterValue`, `searchText` and the paths come from the user and must be
 * validated by the server (allow-list of paths and operations).
 */
export interface GridLoadOptions {
  /** Rows to skip (absent = from the start). */
  readonly skip?: number;
  /** Rows to return (absent = all). */
  readonly take?: number;
  /** Sorting, in priority order (grouped columns included, with the direction of their groups). */
  readonly sort: readonly GridLoadSort[];
  /** Column filter `and` search — the same as `getCombinedFilter()`; `null` without filter. */
  readonly filter: GridFilterExpression | null;
  /** Column filter only (the `filterValue` property). */
  readonly filterValue: GridFilterExpression | null;
  /** Raw search text (already part of `filter`), for servers with their own text search. */
  readonly searchText: string;
  /**
   * All grouping levels, outermost first (empty = not grouped). Return groups
   * (`GridLoadGroupResult[]`) of level `groupPath.length` while it is less than
   * `group.length`; items when it is equal.
   */
  readonly group: readonly GridLoadGroup[];
  /** Values of the open group, outermost first: only rows of that group (exact equality). `null` = all rows. */
  readonly groupPath: GridGroupPath | null;
  /** Return `totalCount`. */
  readonly requireTotalCount: boolean;
  /** Return `groupCount` (number of groups of the level). */
  readonly requireGroupCount: boolean;
  /** Summaries over all matching rows, returned in `GridLoadResult.summary` in this order. */
  readonly totalSummary: readonly GridLoadSummary[];
  /** Summaries of each returned group, in `GridLoadGroupResult.summary` in this order. */
  readonly groupSummary: readonly GridLoadSummary[];
  /** Tree data (`treeMode="flat"`): which nodes to return; absent or `null` = a plain list. */
  readonly tree?: GridLoadTree | null;
}

/** `GridLoadOptions.tree`: what a tree asks the data source (items with their `parentKeyExpr`). */
export interface GridLoadTree {
  /**
   * Return the children of these nodes (`[rootParentKey]` = the root nodes;
   * keys as set — text when `root-parent-key` came from the attribute).
   * `null` = a remote filter is active: return the matching nodes AND all
   * their ancestors, at once.
   */
  readonly parentKeys: readonly (GridRowKey | null)[] | null;
}

/** A group returned when `GridLoadOptions.group` is not empty. */
export interface GridLoadGroupResult<TItem = any> {
  /** Group value. */
  key: unknown;
  /** Number of data rows in the group. */
  count: number;
  /** `null` (the grid always asks collapsed groups); items or subgroups are accepted and ignored. */
  items: readonly TItem[] | readonly GridLoadGroupResult<TItem>[] | null;
  /** Values of `groupSummary`, in its order. */
  summary?: readonly unknown[];
}

/** What `GridDataSource.load` resolves to. */
export interface GridLoadResult<TItem = any> {
  /** Items, or groups when `group` was not empty. */
  data: readonly TItem[] | readonly GridLoadGroupResult<TItem>[];
  /** Number of matching rows (when `requireTotalCount`). */
  totalCount?: number;
  /** Number of groups of the level (when `requireGroupCount`). */
  groupCount?: number;
  /** Values of `totalSummary`, in its order. */
  summary?: readonly unknown[];
}

/**
 * Data source of `<u-grid>`: the grid calls `load` and the host fetches the
 * data. `signal` aborts when the request is no longer needed (sorting,
 * filtering or grouping changed, `refresh()`, grid removed).
 */
export interface GridDataSource<TItem = any> {
  load(options: GridLoadOptions, signal: AbortSignal): Promise<GridLoadResult<TItem>>;
}

/**
 * Operations done by the server (`remoteOperations`). Remote `paging` or
 * `grouping` also turn on `filtering`, `sorting` and `summary`, and `paging`
 * turns on `grouping` (console warning); `summary` alone is ignored (the
 * grid has every row and computes it).
 */
export interface GridRemoteOperations {
  /** The server applies `filter` (or `filterValue` + `searchText`). */
  filtering?: boolean;
  /** The server applies `sort`. */
  sorting?: boolean;
  /** The server applies `skip`/`take` (rows load in blocks of `pageSize`). */
  paging?: boolean;
  /** The server returns groups (`group`, `groupPath`). */
  grouping?: boolean;
  /** The server computes `totalSummary`/`groupSummary` (with remote paging or grouping). */
  summary?: boolean;
}

/** Changes for `applyChanges()`: `update` and `remove` find rows by key (`keyExpr`). */
export interface GridDataChanges<TItem = any> {
  /** New items (appended to the loaded rows, or at their sorted place with `reshapeOnChanges`; with remote paging the rows reload). */
  add?: readonly TItem[];
  /** New versions of items (same key). */
  update?: readonly TItem[];
  /** Keys of the rows to remove. */
  remove?: readonly unknown[];
}

/** Operações remotas já normalizadas (dependências aplicadas). */
export interface RemoteFlags {
  filtering: boolean;
  sorting: boolean;
  paging: boolean;
  grouping: boolean;
  summary: boolean;
}

export const NO_REMOTE: RemoteFlags = Object.freeze({
  filtering: false,
  sorting: false,
  paging: false,
  grouping: false,
  summary: false,
});

/**
 * Normaliza `remoteOperations`: paginação ou agrupamento no servidor exigem
 * filtrar e ordenar lá; paginar no servidor exige agrupar lá (os grupos
 * precisam de todas as linhas); resumo remoto só existe com paginação ou
 * agrupamento remotos (senão o grid tem todas as linhas e calcula).
 * `forced` lista o que foi ligado por dependência (para o aviso).
 */
export const normalizeRemoteOperations = (
  value: boolean | GridRemoteOperations | null | undefined,
): { flags: RemoteFlags; forced: string[] } => {
  if (!value) {
    return { flags: NO_REMOTE, forced: [] };
  }

  if (value === true) {
    return { flags: { filtering: true, sorting: true, paging: true, grouping: true, summary: true }, forced: [] };
  }

  const forced: string[] = [];
  const flags: RemoteFlags = {
    filtering: !!value.filtering,
    sorting: !!value.sorting,
    paging: !!value.paging,
    grouping: !!value.grouping,
    summary: !!value.summary,
  };

  const force = (name: keyof RemoteFlags) => {
    if (!flags[name]) {
      flags[name] = true;
      forced.push(name);
    }
  };

  if (flags.paging) {
    force('grouping');
  }

  if (flags.paging || flags.grouping) {
    force('filtering');
    force('sorting');
    force('summary');
  } else {
    flags.summary = false;
  }

  return { flags, forced };
};

/** Leitor da chave de linha: `keyExpr` ou, sem ela, o próprio item. */
export const keyReader = (keyExpr: GridKeyExpr | null | undefined): (item: unknown) => unknown => {
  if (typeof keyExpr === 'function') {
    return keyExpr as (item: unknown) => unknown;
  }

  if (typeof keyExpr === 'string' && keyExpr) {
    if (!keyExpr.includes('.')) {
      return item => item === null || item === undefined ? undefined : (item as Record<string, unknown>)[keyExpr];
    }

    return item => getValueByPath(item, keyExpr);
  }

  return item => item;
};

/** Texto da chave para o `key` das linhas renderizadas (`1` e `"1"` são chaves diferentes). */
export const keyText = (key: unknown): string =>
  typeof key === 'string' ? `s${key}` : typeof key === 'number' ? `n${key}` : `${typeof key}:${String(key)}`;

/** Congela opções em profundidade (arrays e objetos simples). */
export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value) && !(value instanceof Date)) {
    Object.freeze(value);

    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
  }

  return value;
};
