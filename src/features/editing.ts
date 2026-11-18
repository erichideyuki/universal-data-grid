import type { GridColumnDataType, GridColumnDef, GridValidationRule } from '../grid-column-def.js';
import { UnparsedValue } from './validation.js';

/** How rows are edited: one cell at a time (saved on commit), a whole row (Save/Cancel buttons) or many changes saved together (batch). */
export type GridEditMode = 'cell' | 'row' | 'batch';

/** Gesture that opens a cell editor (keyboard: Enter or F2). */
export type GridEditTrigger = 'click' | 'dblclick';

/** A pending change (`getChanges()`, `u-grid-saving`). */
export interface GridEditChange<TItem = any> {
  /** `add`: new row; `update`: edited fields of a row; `remove`: row to remove. */
  type: 'add' | 'update' | 'remove';
  /** Row key (a new row has an opaque provisional key). */
  rowKey: unknown;
  /** `add`: the new item; `update`: only the edited fields (nested objects for dotted paths); absent for `remove`. */
  data?: Partial<TItem>;
  /** The original item (`update` and `remove`). */
  item?: TItem;
}

/** A broken validation rule (`u-grid-row-validating`). */
export interface GridValidationError<TItem = any> {
  /** The column of the value; `null` for a row error (`setError` without column). */
  column: GridColumnDef<TItem> | null;
  /** The broken rule; `null` for errors set by `setError` and for text that is not a number or a date. */
  rule: GridValidationRule<TItem> | null;
  /** Error text. */
  message: string;
}

// ------------------------------------------------------------ dados

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/** Grava `value` em `path` (com pontos cria objetos aninhados) no `data` da mudança — objeto do grid. */
export const setValueByPath = (data: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split('.');
  let target = data;

  for (let index = 0; index < keys.length - 1; index++) {
    const key = keys[index];
    const next = target[key];

    if (!isPlainObject(next)) {
      target[key] = {};
    }

    target = target[key] as Record<string, unknown>;
  }

  target[keys[keys.length - 1]] = value;
};

/** Cópia profunda dos objetos simples de uma mudança (o hospedeiro recebe cópias). */
export const copyData = <T>(data: T): T => {
  if (!isPlainObject(data)) {
    return data;
  }

  const copy: Record<string, unknown> = {};

  for (const key of Object.keys(data)) {
    copy[key] = copyData(data[key]);
  }

  return copy as T;
};

/**
 * Item com a mudança aplicada, sem tocar no original: objetos simples se
 * fundem campo a campo; o resto é trocado. Mantém o protótipo do item.
 */
export const mergeItem = <T>(item: T, data: Record<string, unknown>): T => {
  if (!item || typeof item !== 'object') {
    return copyData(data) as T;
  }

  const merged = Object.assign(Object.create(Object.getPrototypeOf(item)), item) as Record<string, unknown>;

  for (const key of Object.keys(data)) {
    const value = data[key];
    const current = merged[key];
    merged[key] = isPlainObject(value) && isPlainObject(current) ? mergeItem(current, value) : copyData(value);
  }

  return merged as T;
};

// ------------------------------------------------- valores dos editores

/** Separadores do número no idioma (cache pequeno por idioma). */
const separators = new Map<string, { decimal: string; group: string }>();

export const numberSeparators = (language: string | undefined): { decimal: string; group: string } => {
  const key = language ?? '';
  let found = separators.get(key);

  if (!found) {
    const parts = new Intl.NumberFormat(language || undefined).formatToParts(11111.5);
    found = {
      decimal: parts.find(part => part.type === 'decimal')?.value ?? '.',
      group: parts.find(part => part.type === 'group')?.value ?? ',',
    };

    if (separators.size > 32) {
      separators.clear();
    }

    separators.set(key, found);
  }

  return found;
};

/** Número no texto do editor: separador decimal do idioma, sem agrupamento. */
export const formatEditorNumber = (value: unknown, language: string | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value === null || value === undefined ? '' : String(value);
  }

  const { decimal } = numberSeparators(language);
  const text = String(value);

  // Notação exponencial (muito grande/pequeno) fica como está.
  return decimal === '.' || (/e/i).test(text) ? text : text.replace('.', decimal);
};

const NBSP = /\s/g;

/**
 * Texto do editor → número, no idioma (aceita o separador de milhar do
 * idioma e o ponto como decimal quando o idioma usa vírgula e não há
 * vírgula no texto). Vazio = `null`; texto inválido = `UnparsedValue`.
 */
export const parseEditorNumber = (text: string, language: string | undefined): number | null | UnparsedValue => {
  const trimmed = text.replace(NBSP, '');

  if (!trimmed) {
    return null;
  }

  const { decimal, group } = numberSeparators(language);
  let normalized = trimmed.replace(/[−‒–]/g, '-');

  if (decimal !== '.') {
    if (normalized.includes(decimal)) {
      normalized = normalized.split(group.replace(NBSP, '') || '\u0000').join('')
        .replace(decimal, '.');
    } else if (group === '.' && (/^-?\d{1,3}(\.\d{3})+$/).test(normalized)) {
      // "1.234" num idioma de vírgula decimal é milhar.
      normalized = normalized.replace(/\./g, '');
    }
  } else if (group) {
    normalized = normalized.split(group.replace(NBSP, '') || '\u0000').join('');
  }

  const value = (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i).test(normalized) ? Number(normalized) : NaN;

  return Number.isFinite(value) ? value : new UnparsedValue(text, 'number');
};

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/** Data (Date, texto ISO ou timestamp) → valor de `<input type=date|datetime-local>`. */
export const formatEditorDate = (value: unknown, withTime: boolean): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value as string | number);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return withTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
};

/**
 * Valor do `<input type=date|datetime-local>` → valor da coluna, no MESMO
 * tipo do original (Date, texto ou número), para não trocar o tipo do dado.
 */
export const parseEditorDate = (text: string, original: unknown, withTime: boolean): unknown => {
  if (!text) {
    return null;
  }

  const match = (/^(\d{4,})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/).exec(text);

  if (!match) {
    return new UnparsedValue(text, 'date');
  }

  const [, year, month, day, hours = '0', minutes = '0'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), withTime ? Number(hours) : 0, withTime ? Number(minutes) : 0);

  if (typeof original === 'number') {
    return date.getTime();
  }

  if (typeof original === 'string') {
    // Texto: só a data ("2024-05-01") ou ISO completo, como era.
    return original.length <= 10 && !withTime ? text : date.toISOString();
  }

  return date;
};

/** Tipo do editor embutido para o tipo de dado da coluna. */
export type EditorKind = 'text' | 'number' | 'date' | 'datetime' | 'boolean';

export const editorKindOf = (dataType: GridColumnDataType | null | undefined): EditorKind =>
  dataType === 'number' || dataType === 'date' || dataType === 'datetime' || dataType === 'boolean' ? dataType : 'text';

// --------------------------------------------------------- mudanças

/** Chave provisória de uma linha nova: objeto opaco congelado. */
export const createProvisionalKey = (): object => Object.freeze({});

/** Mudança pendente de uma linha (estado do grid; o hospedeiro recebe cópias). */
export interface PendingRow {
  type: 'add' | 'update' | 'remove';
  rowKey: unknown;
  /** Item original (`update`/`remove`); objeto vazio nas novas. */
  item: unknown;
  /** Campos editados (linha nova: todos). */
  data: Record<string, unknown>;
  /** Removida no lote, guardando o que já tinha sido editado (restaurar volta a `update`). */
  removedFrom?: 'update' | undefined;
  /** Item com a mudança (cache; `undefined` = por calcular). */
  merged?: unknown;
  /** Colunas editadas desta linha (marca de "alterado"). */
  readonly modified: Set<GridColumnDef>;
  /** Texto que não converteu no tipo da coluna (inválido; não vai para `data`). */
  readonly unparsed: Map<GridColumnDef, UnparsedValue>;
  /** Erro por coluna. */
  readonly errors: Map<GridColumnDef, string>;
  /** Regra que deu o erro da coluna (`u-grid-row-validating`); ausente = `setError` ou valor que não converte. */
  readonly errorRules: Map<GridColumnDef, GridValidationRule>;
  /** Erro da linha (`setError` sem coluna). */
  rowError?: string;
}

/** Mudanças pendentes por chave, na ordem em que começaram. */
export class EditStore {
  readonly #rows = new Map<unknown, PendingRow>();
  /** Muda a cada alteração (o render compara). */
  version = 0;

  get size(): number {
    return this.#rows.size;
  }

  get(rowKey: unknown): PendingRow | undefined {
    return this.#rows.get(rowKey);
  }

  has(rowKey: unknown): boolean {
    return this.#rows.has(rowKey);
  }

  values(): IterableIterator<PendingRow> {
    return this.#rows.values();
  }

  /** Linha pendente da chave (cria `update` vazia se não há). */
  ensure(rowKey: unknown, item: unknown): PendingRow {
    let row = this.#rows.get(rowKey);

    if (!row) {
      row = { type: 'update', rowKey, item, data: {}, modified: new Set(), unparsed: new Map(), errors: new Map(), errorRules: new Map() };
      this.#rows.set(rowKey, row);
    }

    return row;
  }

  add(rowKey: unknown, data: Record<string, unknown>): PendingRow {
    const row: PendingRow = { type: 'add', rowKey, item: {}, data, modified: new Set(), unparsed: new Map(), errors: new Map(), errorRules: new Map() };
    this.#rows.set(rowKey, row);
    this.touch();
    return row;
  }

  delete(rowKey: unknown): boolean {
    const deleted = this.#rows.delete(rowKey);

    if (deleted) {
      this.touch();
    }

    return deleted;
  }

  clear(): void {
    if (this.#rows.size) {
      this.#rows.clear();
      this.touch();
    }
  }

  /** Troca a chave de uma linha (sem `keyExpr`, a chave é o item). */
  rekey(rowKey: unknown, next: unknown): void {
    const row = this.#rows.get(rowKey);

    if (row) {
      this.#rows.delete(rowKey);
      row.rowKey = next;
      this.#rows.set(next, row);
      this.touch();
    }
  }

  touch(row?: PendingRow): void {
    if (row) {
      row.merged = undefined;
    }

    this.version++;
  }

  /** Item exibido da linha pendente (original + mudança). */
  mergedOf(row: PendingRow): unknown {
    if (row.merged === undefined) {
      row.merged = row.type === 'add' ? copyData(row.data) : Object.keys(row.data).length ? mergeItem(row.item, row.data) : row.item;
    }

    return row.merged;
  }

  /** A linha não muda nada (update sem campos): sai. */
  prune(row: PendingRow): void {
    if (row.type === 'update' && !Object.keys(row.data).length && !row.unparsed.size && !row.errors.size && !row.rowError) {
      this.delete(row.rowKey);
    }
  }
}

/** Mudança pública (cópia) de uma linha pendente. */
export const publicChange = (row: PendingRow): GridEditChange => {
  if (row.type === 'remove') {
    return { type: 'remove', rowKey: row.rowKey, item: row.item };
  }

  if (row.type === 'add') {
    return { type: 'add', rowKey: row.rowKey, data: copyData(row.data) };
  }

  return { type: 'update', rowKey: row.rowKey, data: copyData(row.data), item: row.item };
};
