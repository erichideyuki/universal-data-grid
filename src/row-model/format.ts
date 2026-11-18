import type { GridColumnAlignment, GridColumnDataType, GridColumnDef } from '../grid-column-def.js';
import { LruCache } from './lru.js';
import { getCellValue, toDisplayText } from './value.js';

// ------------------------------------------------------------------ valores

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i;

const daysInMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();

const validParts = (year: number, month: number, day: number): boolean =>
  month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);

/**
 * Converte para `Date`: `Date` válida, número (epoch em ms) ou string ISO.
 * Data sem hora (`2024-03-05`) é meia-noite LOCAL — `new Date()` a leria
 * como UTC e o dia "andaria" a oeste de Greenwich. Datas que transbordam
 * (`2024-02-30`) são inválidas, não 1º de março.
 */
export const toDate = (value: unknown): Date | undefined => {

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? new Date(value) : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const text = value.trim();
  const dateOnly = ISO_DATE.exec(text);

  if (dateOnly) {
    const [year, month, day] = dateOnly.slice(1).map(Number);
    return validParts(year, month, day) ? new Date(year, month - 1, day) : undefined;
  }

  const dateTime = ISO_DATE_TIME.exec(text);

  if (!dateTime) {
    return undefined;
  }

  const [year, month, day, hour, minute, second = 0] = dateTime.slice(1).map(part => Number(part ?? 0));

  if (!validParts(year, month, day) || hour > 23 || minute > 59 || second > 59) {
    return undefined;
  }

  const date = new Date(text.replace(' ', 'T'));

  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** Número de `number`/`bigint` ou de string numérica; senão `undefined`. */
export const toNumber = (value: unknown): number | bigint | undefined => {

  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? undefined : numeric;
  }

  return undefined;
};

/** Valor no tipo da coluna (para comparar); o original quando não converte. */
export const coerceValue = (value: unknown, dataType: GridColumnDataType | null | undefined): unknown => {

  if (value === null || value === undefined || !dataType) {
    return value;
  }

  switch (dataType) {
    case 'number':
      return toNumber(value) ?? value;
    case 'date':
    case 'datetime':
      return toDate(value) ?? value;
    case 'boolean':
      return typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : value;
    case 'string':
      return toDisplayText(value);
  }
};

// ----------------------------------------------------------------- inferência

const typeOfValue = (value: unknown): GridColumnDataType | undefined => {
  switch (typeof value) {
    case 'number':
    case 'bigint':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string':
      return 'string';
    default:
      return value instanceof Date ? 'date' : undefined;
  }
};

/**
 * `dataType` da coluna: o informado ou o tipo do 1º valor não nulo (como o
 * DevExtreme). String ISO não vira data por inferência — só com `dataType`.
 */
export const resolveDataType = (items: readonly unknown[], column: GridColumnDef): GridColumnDataType | undefined => {

  if (column.dataType) {
    return column.dataType;
  }

  if (!column.path && !column.valueGetter) {
    return undefined;
  }

  for (const item of items) {
    const value = getCellValue(item, column);

    if (value !== null && value !== undefined) {
      return typeOfValue(value);
    }
  }

  return undefined;
};

export const resolveAlignment = (column: GridColumnDef, dataType: GridColumnDataType | undefined): GridColumnAlignment =>
  column.alignment
  ?? (dataType === 'number' ? 'end' : dataType === 'boolean' ? 'center' : 'start');

// ---------------------------------------------------------------- formatadores

const DEFAULT_NUMBER: Intl.NumberFormatOptions = { useGrouping: false, maximumFractionDigits: 20 };
export const DEFAULT_DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
export const DEFAULT_DATETIME: Intl.DateTimeFormatOptions = { ...DEFAULT_DATE, hour: 'numeric', minute: '2-digit' };

/**
 * Limite do cache de formatadores (spec 14): a chave inclui idioma e opções
 * do hospedeiro, então sem limite cresceria com cada combinação nova.
 */
export const FORMATTER_CACHE_LIMIT = 128;

const formatters = new LruCache<string, Intl.NumberFormat | Intl.DateTimeFormat>(FORMATTER_CACHE_LIMIT);

/** Diagnóstico/testes de vazamento. */
export const _formatterCacheSize = (): number => formatters.size;

/**
 * Formatador `Intl` em cache por (idioma, opções). Idioma ou opções
 * inválidos caem no padrão em vez de lançar no meio do render.
 */
const getFormatter = (
  kind: 'number' | 'date',
  language: string | undefined,
  options: object,
  fallback: object,
): Intl.NumberFormat | Intl.DateTimeFormat => {

  const key = `${kind}|${language ?? ''}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);

  if (!formatter) {
    const create = (locale: string | undefined, opts: object) =>
      kind === 'number'
        ? new Intl.NumberFormat(locale, opts)
        : new Intl.DateTimeFormat(locale, opts);

    try {
      formatter = create(language, options);
    } catch {
      try {
        formatter = create(language, fallback);
      } catch {
        formatter = create(undefined, fallback);
      }
    }

    formatters.set(key, formatter);
  }

  return formatter;
};

export const getNumberFormat = (language: string | undefined, options: Intl.NumberFormatOptions = DEFAULT_NUMBER): Intl.NumberFormat =>
  getFormatter('number', language, options, DEFAULT_NUMBER) as Intl.NumberFormat;

export const getDateTimeFormat = (
  language: string | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback: Intl.DateTimeFormatOptions = DEFAULT_DATE,
): Intl.DateTimeFormat =>
  getFormatter('date', language, options, fallback) as Intl.DateTimeFormat;

// ------------------------------------------------------------------- exibição

export interface FormatContext {
  language: string | undefined;
  dataType: GridColumnDataType | undefined;
  trueText: string;
  falseText: string;
}

const isBlank = (value: unknown): boolean =>
  value === null
  || value === undefined
  || (typeof value === 'number' && Number.isNaN(value))
  || (value instanceof Date && Number.isNaN(value.getTime()));

/**
 * Texto exibido de um valor, na ordem: `displayValue` → vazio (`emptyText`)
 * → `format` função → `format` `Intl` / padrão do tipo. Valor que não
 * converte no tipo (string que não é data) sai como texto bruto.
 */
export const formatCellValue = (
  value: unknown,
  item: unknown,
  column: GridColumnDef,
  context: FormatContext,
): string => {

  if (column.displayValue) {
    return toDisplayText(column.displayValue(value, item));
  }

  if (isBlank(value)) {
    return column.emptyText ?? '';
  }

  const { format } = column;

  if (typeof format === 'function') {
    return toDisplayText(format(value, item));
  }

  const { dataType } = context;

  if (dataType === 'number') {
    const numeric = toNumber(value);

    return numeric === undefined
      ? toDisplayText(value)
      : getNumberFormat(context.language, format ?? undefined).format(numeric);
  }

  if (dataType === 'date' || dataType === 'datetime') {
    const date = toDate(value);
    const fallback = dataType === 'date' ? DEFAULT_DATE : DEFAULT_DATETIME;

    return date
      ? getDateTimeFormat(context.language, format ?? fallback, fallback).format(date)
      : toDisplayText(value);
  }

  if (dataType === 'boolean' && typeof value === 'boolean') {
    return value ? context.trueText : context.falseText;
  }

  return toDisplayText(value);
};

/**
 * Valor a desenhar como ícone (coluna `boolean` com `booleanDisplay:
 * 'icon'`), ou `undefined` para exibir texto. `displayValue` e `format`
 * função continuam mandando no texto; vazio segue `emptyText`.
 */
export const booleanIconValue = (value: unknown, column: GridColumnDef, context: FormatContext): boolean | undefined => {

  if (column.booleanDisplay !== 'icon' || context.dataType !== 'boolean' || column.displayValue || typeof column.format === 'function') {
    return undefined;
  }

  const coerced = coerceValue(value, 'boolean');

  return typeof coerced === 'boolean' ? coerced : undefined;
};

/** Texto exibido da célula de `item` na coluna. */
export const formatCell = (item: unknown, column: GridColumnDef, context: FormatContext): string =>
  formatCellValue(getCellValue(item, column), item, column, context);
