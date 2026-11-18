/**
 * Estado do usuário do `<u-grid>` (frente 11): tipos públicos e validação.
 *
 * Tudo o que entra por `setState` ou pelo storage passa por
 * {@link parseGridState}: o storage é controlável pelo usuário e por
 * extensões, então nada é aplicado sem conferir forma, tipos e tamanho.
 * Só lê campos conhecidos (nunca espalha/copia o objeto recebido), então
 * chaves como `__proto__` não chegam a lugar nenhum.
 */
import type { GridChangeSource } from '../change-source.js';
import type { GridRowKey } from '../data/data-source.js';
import type { GridColumnFixed, GridFilterExpression, GridSortOrder } from '../grid-column-def.js';

/** Version written by {@link DataGrid.getState}. */
export const GRID_STATE_VERSION = 1;

/**
 * State of one column. In `setState` only `name` is required; a missing field
 * takes the value of the column definition.
 */
export interface GridColumnState {
  /** Column id: its `name`, or its `path` without one. */
  name: string;
  /** Width chosen by the user (px); `null` = the width of the definition. */
  width?: number | null;
  /** Shown (`false` = hidden in the column chooser). */
  visible?: boolean;
  /** Side the column is fixed to; `null` = not fixed. */
  fixed?: GridColumnFixed;
  /** Grouping level (0-based); `null` = not grouped. */
  groupIndex?: number | null;
  /** Sort direction; `null` = not sorted (for a grouped column: the direction of its groups). */
  sortOrder?: GridSortOrder | null;
  /** Priority in the sorting (0 = first). */
  sortIndex?: number | null;
}

/** Values of a group from the outermost level; dates are ISO text. */
export type GridStateGroupPath = readonly (string | number | boolean | null)[];

/** Group expansion: the defaults and the groups that differ from them. */
export interface GridGroupExpansionState {
  /** Set by `expandAllGroups()`/`collapseAllGroups()` without a level; `null` = `autoExpandGroups`. */
  all: boolean | null;
  /** Default of each level set by `expandAllGroups(n)`/`collapseAllGroups(n)`; `null` = the one above. */
  levels: (boolean | null)[];
  /** Groups expanded although their level default is collapsed. */
  expanded: GridStateGroupPath[];
  /** Groups collapsed although their level default is expanded. */
  collapsed: GridStateGroupPath[];
}

/** Detail rows (master-detail) whose expansion differs from `autoExpandRows`. */
export interface GridRowExpansionState {
  /** Keys of rows expanded although `autoExpandRows` is off. */
  expanded: GridRowKey[];
  /** Keys of rows collapsed although `autoExpandRows` is on. */
  collapsed: GridRowKey[];
}

/**
 * The user state of a grid: JSON serializable, without row data (rows only
 * by key). Columns are identified by `name` (or `path`); `filterValue`
 * refers to columns by `path`, like the `filterValue` property.
 */
export interface GridState {
  /** Format version; older versions are migrated by `setState`. */
  version: 1;
  /**
   * Columns in the order of `moveColumn` (the regular columns; hidden ones
   * count), then the grouped ones (their order does not matter: `groupIndex`
   * gives it).
   */
  columns?: GridColumnState[];
  /** Column filter (like the `filterValue` property: columns by `path`, dates as ISO text). */
  filterValue?: GridFilterExpression | null;
  /** Text of the search panel. */
  searchText?: string;
  /** Expanded and collapsed groups. */
  groupExpansion?: GridGroupExpansionState;
  /** Only with `keyExpr` and string/number keys. */
  selectedKeys?: GridRowKey[];
  /** Only with `keyExpr` and string/number keys. */
  rowExpansion?: GridRowExpansionState;
  /** Current page (0-based). */
  pageIndex?: number;
  /** Rows per page (restored only when offered by `pageSizeOptions` or equal to the initial `pageSize`). */
  pageSize?: number;
}

/** Custom storage of `stateStorage`. Errors and rejections are logged and ignored. */
export interface GridStateStorage {
  /** The saved state (`null`: none). Called when the grid connects. */
  load(): GridState | null | Promise<GridState | null>;
  /** Saves the state (after `stateChangeDelay`, on disconnect and on `pagehide`). */
  save(state: GridState): void | Promise<void>;
}

/** Who changed the state: a user gesture, a method/property, or the restore from `stateStorage`. */
export type GridStateChangeSource = GridChangeSource | 'storage';

/** `detail` of `u-grid-state-change`. */
export interface GridStateChangeEventDetail {
  /** The state after the burst of changes (a new object). */
  state: GridState;
  /** Sources of the changes of the burst. */
  sources: readonly GridStateChangeSource[];
}

// ------------------------------------------------------------------ limites

/** Limites do que se aceita de fora (o storage pode ter qualquer coisa). */
export const STATE_LIMITS = {
  columns: 2_000,
  nameLength: 1_000,
  /** Chaves de seleção/expansão de linhas. */
  keys: 1_000_000,
  keyLength: 1_000,
  /** Grupos com expansão própria. */
  groups: 100_000,
  groupLevels: 64,
  textLength: 10_000,
  filterDepth: 32,
  filterNodes: 10_000,
  width: 100_000,
  pageIndex: 1_000_000_000,
  pageSize: 100_000,
} as const;

// ---------------------------------------------------------------- validação

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Lê uma propriedade PRÓPRIA (não a herdada de `Object.prototype`). */
const own = (object: Json, key: string): unknown =>
  Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined;

const has = (object: Json, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key) && object[key] !== undefined;

const isName = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= STATE_LIMITS.nameLength;

const isRowKey = (value: unknown): value is GridRowKey =>
  (typeof value === 'string' && value.length <= STATE_LIMITS.keyLength) || (typeof value === 'number' && Number.isFinite(value));

const isIndex = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

const optionalBoolean = (value: unknown): boolean | null | undefined =>
  value === true || value === false ? value : value === null ? null : undefined;

class InvalidState extends Error {
}

const fail = (message: string): never => {
  throw new InvalidState(message);
};

const keyList = (value: unknown, what: string): GridRowKey[] => {
  if (!Array.isArray(value) || value.length > STATE_LIMITS.keys) {
    return fail(`"${what}" must be an array of at most ${STATE_LIMITS.keys} keys`);
  }

  const keys: GridRowKey[] = [];

  for (const key of value) {
    if (!isRowKey(key)) {
      return fail(`"${what}" has a key that is not a string or a finite number`);
    }

    keys.push(key);
  }

  return keys;
};

const parseColumn = (value: unknown): GridColumnState => {
  if (!isObject(value) || !isName(own(value, 'name'))) {
    return fail('every column needs a "name"');
  }

  const column: GridColumnState = { name: own(value, 'name') as string };
  const width = own(value, 'width');
  const visible = own(value, 'visible');
  const fixed = own(value, 'fixed');
  const groupIndex = own(value, 'groupIndex');
  const sortOrder = own(value, 'sortOrder');
  const sortIndex = own(value, 'sortIndex');

  if (width === null || (typeof width === 'number' && Number.isFinite(width) && width >= 0 && width <= STATE_LIMITS.width)) {
    column.width = width;
  } else if (width !== undefined) {
    fail(`column "${column.name}": invalid "width"`);
  }

  if (visible === true || visible === false) {
    column.visible = visible;
  } else if (visible !== undefined) {
    fail(`column "${column.name}": invalid "visible"`);
  }

  if (fixed === 'start' || fixed === 'end' || fixed === null) {
    column.fixed = fixed;
  } else if (fixed !== undefined) {
    fail(`column "${column.name}": invalid "fixed"`);
  }

  if (groupIndex === null || isIndex(groupIndex, STATE_LIMITS.columns)) {
    column.groupIndex = groupIndex;
  } else if (groupIndex !== undefined) {
    fail(`column "${column.name}": invalid "groupIndex"`);
  }

  if (sortOrder === 'asc' || sortOrder === 'desc' || sortOrder === null) {
    column.sortOrder = sortOrder;
  } else if (sortOrder !== undefined) {
    fail(`column "${column.name}": invalid "sortOrder"`);
  }

  if (sortIndex === null || isIndex(sortIndex, STATE_LIMITS.columns)) {
    column.sortIndex = sortIndex;
  } else if (sortIndex !== undefined) {
    fail(`column "${column.name}": invalid "sortIndex"`);
  }

  return column;
};

const parseColumns = (value: unknown): GridColumnState[] => {
  if (!Array.isArray(value) || value.length > STATE_LIMITS.columns) {
    return fail(`"columns" must be an array of at most ${STATE_LIMITS.columns} columns`);
  }

  const seen = new Set<string>();
  const columns: GridColumnState[] = [];

  for (const entry of value) {
    const column = parseColumn(entry);

    // Repetida: vale a 1ª (como `name` repetido nas definições).
    if (!seen.has(column.name)) {
      seen.add(column.name);
      columns.push(column);
    }
  }

  return columns;
};

/**
 * Expressão de filtro: só arrays, textos, números finitos, booleanos e
 * `null`, com profundidade e tamanho limitados. A semântica (operações,
 * colunas) quem confere é o compilador do filtro, que avisa e ignora.
 */
const parseFilter = (value: unknown): GridFilterExpression | null => {
  if (value === null) {
    return null;
  }

  let nodes = 0;

  const copy = (node: unknown, depth: number): unknown => {
    if (++nodes > STATE_LIMITS.filterNodes || depth > STATE_LIMITS.filterDepth) {
      return fail('"filterValue" is too large or too deep');
    }

    if (Array.isArray(node)) {
      return node.map(child => copy(child, depth + 1));
    }

    if (typeof node === 'string') {
      return node.length <= STATE_LIMITS.textLength ? node : fail('"filterValue" has a text too long');
    }

    if (node === null || typeof node === 'boolean' || (typeof node === 'number' && Number.isFinite(node))) {
      return node;
    }

    // `getState` já entrega datas em ISO; um estado montado à mão pode trazer `Date`.
    if (node instanceof Date && !Number.isNaN(node.getTime())) {
      return node.toISOString();
    }

    return fail('"filterValue" may only hold arrays, texts, finite numbers, booleans, dates and null');
  };

  if (!Array.isArray(value)) {
    return fail('"filterValue" must be an array or null');
  }

  return copy(value, 0) as GridFilterExpression;
};

const parseGroupPath = (value: unknown): GridStateGroupPath => {
  if (!Array.isArray(value) || !value.length || value.length > STATE_LIMITS.groupLevels) {
    return fail('a group path must be a non-empty array');
  }

  for (const part of value) {
    const ok = part === null
      || typeof part === 'boolean'
      || (typeof part === 'number' && Number.isFinite(part))
      || (typeof part === 'string' && part.length <= STATE_LIMITS.textLength);

    if (!ok) {
      return fail('a group path may only hold texts, finite numbers, booleans and null');
    }
  }

  return [...value] as GridStateGroupPath;
};

const parseGroupExpansion = (value: unknown): GridGroupExpansionState => {
  if (!isObject(value)) {
    return fail('"groupExpansion" must be an object');
  }

  const all = optionalBoolean(own(value, 'all'));
  const levels = own(value, 'levels') ?? [];
  const expanded = own(value, 'expanded') ?? [];
  const collapsed = own(value, 'collapsed') ?? [];

  if (all === undefined && has(value, 'all')) {
    fail('"groupExpansion.all" must be a boolean or null');
  }

  if (!Array.isArray(levels) || levels.length > STATE_LIMITS.groupLevels || levels.some(level => optionalBoolean(level) === undefined)) {
    fail('"groupExpansion.levels" must be an array of booleans or null');
  }

  if (!Array.isArray(expanded) || !Array.isArray(collapsed) || expanded.length + collapsed.length > STATE_LIMITS.groups) {
    fail(`"groupExpansion" may list at most ${STATE_LIMITS.groups} groups`);
  }

  return {
    all: all ?? null,
    levels: (levels as unknown[]).map(level => optionalBoolean(level) ?? null),
    expanded: (expanded as unknown[]).map(parseGroupPath),
    collapsed: (collapsed as unknown[]).map(parseGroupPath),
  };
};

const parseRowExpansion = (value: unknown): GridRowExpansionState => {
  if (!isObject(value)) {
    return fail('"rowExpansion" must be an object');
  }

  return {
    expanded: keyList(own(value, 'expanded') ?? [], 'rowExpansion.expanded'),
    collapsed: keyList(own(value, 'collapsed') ?? [], 'rowExpansion.collapsed'),
  };
};

/**
 * Migrações por versão de origem: cada uma leva o estado à versão seguinte.
 * A v1 é a primeira; estados de versão sem migração são descartados.
 * @internal
 */
export const STATE_MIGRATIONS = new Map<number, (state: Json) => Json>();

/** Resultado da validação: o estado limpo, ou o motivo da recusa. */
export type ParsedState = { state: GridState } | { error: string };

/**
 * Valida e copia um estado vindo de fora (`setState`, storage). Devolve só
 * os campos conhecidos, já limpos; qualquer valor fora do formato recusa o
 * estado inteiro (aplicar metade de um estado adulterado é pior que nada).
 */
export const parseGridState = (input: unknown): ParsedState => {
  try {
    if (!isObject(input)) {
      return fail('the state must be an object');
    }

    let source: Json = input;
    let version = own(source, 'version');

    while (version !== GRID_STATE_VERSION) {
      const migrate = typeof version === 'number' ? STATE_MIGRATIONS.get(version) : undefined;

      if (!migrate) {
        return fail(`unknown state version ${JSON.stringify(version) ?? 'undefined'}`);
      }

      source = migrate(source);

      if (!isObject(source)) {
        return fail('migration failed');
      }

      const next: unknown = own(source, 'version');

      if (typeof next !== 'number' || next <= (version as number)) {
        return fail('migration failed');
      }

      version = next;
    }

    const state: GridState = { version: GRID_STATE_VERSION };

    if (has(source, 'columns')) {
      state.columns = parseColumns(own(source, 'columns'));
    }

    if (has(source, 'filterValue')) {
      state.filterValue = parseFilter(own(source, 'filterValue'));
    }

    if (has(source, 'searchText')) {
      const text = own(source, 'searchText');
      state.searchText = typeof text === 'string' && text.length <= STATE_LIMITS.textLength ? text : fail('"searchText" must be a text');
    }

    if (has(source, 'groupExpansion')) {
      state.groupExpansion = parseGroupExpansion(own(source, 'groupExpansion'));
    }

    if (has(source, 'selectedKeys')) {
      state.selectedKeys = keyList(own(source, 'selectedKeys'), 'selectedKeys');
    }

    if (has(source, 'rowExpansion')) {
      state.rowExpansion = parseRowExpansion(own(source, 'rowExpansion'));
    }

    if (has(source, 'pageIndex')) {
      const pageIndex = own(source, 'pageIndex');
      state.pageIndex = isIndex(pageIndex, STATE_LIMITS.pageIndex) ? pageIndex : fail('"pageIndex" must be a non-negative integer');
    }

    if (has(source, 'pageSize')) {
      const pageSize = own(source, 'pageSize');
      state.pageSize = isIndex(pageSize, STATE_LIMITS.pageSize) && pageSize > 0 ? pageSize : fail('"pageSize" must be a positive integer');
    }

    return { state };
  } catch (error) {
    if (error instanceof InvalidState) {
      return { error: error.message };
    }

    // Getter/Proxy hostil: recusa sem propagar.
    return { error: 'the state could not be read' };
  }
};

/** Valor de grupo como vai no estado: datas em ISO; outro objeto não cabe (`undefined`). */
export const groupValueToState = (value: unknown): string | number | boolean | null | undefined => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  return typeof value === 'string' || typeof value === 'boolean' ? value : undefined;
};
