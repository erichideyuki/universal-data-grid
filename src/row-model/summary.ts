import type {
  GridColumnDataType,
  GridColumnDef,
  GridSummaryAggregator,
  GridSummaryFormat,
  GridSummaryType,
} from '../grid-column-def.js';
import type { Comparer } from './compare.js';
import { coerceValue, DEFAULT_DATE, DEFAULT_DATETIME, getDateTimeFormat, getNumberFormat, toDate, toNumber } from './format.js';
import { cellValueReader, toDisplayText } from './value.js';

/**
 * Resumo pronto para calcular: coluna já resolvida (`undefined` quando a
 * referência não achou coluna — só `count` e função fazem sentido), tipo de
 * dado efetivo e comparador (para `min`/`max`).
 */
export interface SummarySpec {
  column: GridColumnDef | undefined;
  type: GridSummaryType | GridSummaryAggregator;
  dataType?: GridColumnDataType;
  compare?: Comparer;
  /** Leitor do valor da coluna, criado no 1º uso (spec 16: `path` quebrado uma vez). */
  read?: (item: unknown) => unknown;
  /**
   * Chave numérica de `min`/`max` por texto cru (data ISO, número em texto):
   * converte cada valor distinto uma vez. Só durante uma passada
   * ({@link releaseSummaryCaches} solta no fim).
   */
  keys?: Map<string, number>;
}

/** Solta os caches de uma passada (não seguram os textos dos itens). */
export const releaseSummaryCaches = (specs: readonly SummarySpec[]): void => {
  for (const spec of specs) {
    spec.keys = undefined;
  }
};

/** Estado parcial de UM resumo; combinável entre grupos irmãos (sum/min/max/avg/count). */
export interface Accumulator {
  /** Linhas vistas (`count`). */
  rows: number;
  /** Valores numéricos somados (`sum`/`avg`). */
  count: number;
  sum: number;
  /** Menor/maior valor não vazio, cru (convertido no fim). */
  min: unknown;
  max: unknown;
  /**
   * Chave numérica de `min`/`max` (número, tempo da data) para comparar sem
   * converter de novo; `NaN` = comparar pelo comparador (texto, booleano).
   */
  minKey: number | undefined;
  maxKey: number | undefined;
}

export const createAccumulators = (specs: readonly SummarySpec[]): Accumulator[] =>
  specs.map(() => ({ rows: 0, count: 0, sum: 0, min: undefined, max: undefined, minKey: undefined, maxKey: undefined }));

const isEmpty = (value: unknown): boolean =>
  value === null
  || value === undefined
  || value === ''
  || (typeof value === 'number' && Number.isNaN(value))
  || (value instanceof Date && Number.isNaN(value.getTime()));

/** Ordem natural de `min`/`max` quando não há comparador: números, datas e textos. */
const naturalCompare: Comparer = (a, b) => {
  const left = a instanceof Date ? a.getTime() : a as number;
  const right = b instanceof Date ? b.getTime() : b as number;

  return left < right ? -1 : left > right ? 1 : 0;
};

/**
 * Chave numérica de um valor cru para `min`/`max` no tipo da coluna, ou
 * `undefined` quando só o comparador decide (texto, booleano); `NaN` =
 * vazio/inválido.
 */
const numericKey = (spec: SummarySpec, raw: unknown): number | undefined => {
  const { dataType } = spec;

  if (dataType === 'string' || dataType === 'boolean') {
    return undefined;
  }

  if (typeof raw === 'number') {
    return raw;
  }

  if (raw instanceof Date) {
    return raw.getTime();
  }

  if (typeof raw !== 'string' || (dataType !== 'number' && dataType !== 'date' && dataType !== 'datetime')) {
    return undefined;
  }

  spec.keys ??= new Map();
  let key = spec.keys.get(raw);

  if (key === undefined) {
    const value = dataType === 'number' ? toNumber(raw) : toDate(raw)?.getTime();
    key = value === undefined ? Number.NaN : Number(value);
    spec.keys.set(raw, key);
  }

  return key;
};

/** `a` vem antes de `b`? Pelas chaves quando as duas existem; senão pelo comparador. */
const before = (spec: SummarySpec, a: unknown, aKey: number | undefined, b: unknown, bKey: number | undefined): boolean =>
  aKey !== undefined && bKey !== undefined && !Number.isNaN(aKey) && !Number.isNaN(bKey)
    ? aKey < bKey
    : (spec.compare ?? naturalCompare)(coerceValue(a, spec.dataType), coerceValue(b, spec.dataType)) < 0;

/** Soma `item` em cada acumulador (uma leitura de valor por resumo). */
export const accumulate = (accumulators: Accumulator[], specs: readonly SummarySpec[], item: unknown): void => {
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const acc = accumulators[i];
    acc.rows++;

    if (typeof spec.type === 'function' || spec.type === 'count' || !spec.column) {
      continue;
    }

    spec.read ??= cellValueReader(spec.column);
    const raw = spec.read(item);

    if (spec.type === 'sum' || spec.type === 'avg') {
      const amount = typeof raw === 'number' ? raw : Number(toNumber(raw));

      if (Number.isFinite(amount)) {
        acc.sum += amount;
        acc.count++;
      }

      continue;
    }

    if (raw === null || raw === undefined || raw === '') {
      continue;
    }

    let key = numericKey(spec, raw);

    if (key === undefined) {
      // Só o comparador decide: confere se o valor é válido no tipo.
      if (isEmpty(coerceValue(raw, spec.dataType))) {
        continue;
      }

      key = Number.NaN;
    } else if (Number.isNaN(key)) {
      // Número/data que não converte no tipo da coluna: fora de min/max.
      continue;
    }

    if (spec.type === 'min') {
      if (acc.min === undefined || before(spec, raw, key, acc.min, acc.minKey)) {
        acc.min = raw;
        acc.minKey = key;
      }
    } else if (acc.max === undefined || before(spec, acc.max, acc.maxKey, raw, key)) {
      acc.max = raw;
      acc.maxKey = key;
    }
  }
};

/** Junta `source` em `target` (grupo pai a partir dos filhos). */
export const mergeAccumulators = (target: Accumulator[], source: readonly Accumulator[], specs: readonly SummarySpec[]): void => {
  for (let i = 0; i < specs.length; i++) {
    const into = target[i];
    const from = source[i];
    const spec = specs[i];

    into.rows += from.rows;
    into.count += from.count;
    into.sum += from.sum;

    if (from.min !== undefined && (into.min === undefined || before(spec, from.min, from.minKey, into.min, into.minKey))) {
      into.min = from.min;
      into.minKey = from.minKey;
    }

    if (from.max !== undefined && (into.max === undefined || before(spec, into.max, into.maxKey, from.max, from.maxKey))) {
      into.max = from.max;
      into.maxKey = from.maxKey;
    }
  }
};

/**
 * Valores finais. `items` é o conjunto do grupo (ou todos), usado só pelas
 * funções próprias. Sem valores: `sum` = 0, `avg`/`min`/`max` = `null`.
 */
export const finishAccumulators = (
  accumulators: readonly Accumulator[],
  specs: readonly SummarySpec[],
  items: readonly unknown[],
): unknown[] =>
  specs.map((spec, i) => {
    const acc = accumulators[i];

    if (typeof spec.type === 'function') {
      const { column } = spec;
      const read = column ? cellValueReader(column) : undefined;
      const values = read ? items.map(read) : [];

      // O agregador do hospedeiro não pode mudar os dados (cópia só se ainda não congelado).
      return spec.type(Object.freeze(values), Object.isFrozen(items) ? items : Object.freeze([...items]));
    }

    switch (spec.type) {
      case 'count':
        return acc.rows;
      case 'sum':
        return acc.sum;
      case 'avg':
        return acc.count ? acc.sum / acc.count : null;
      case 'min':
        return acc.min === undefined ? null : coerceValue(acc.min, spec.dataType);
      case 'max':
        return acc.max === undefined ? null : coerceValue(acc.max, spec.dataType);
      default:
        return null;
    }
  });

/** Resumos de uma lista inteira (totais), numa passada. */
export const summarize = (items: readonly unknown[], specs: readonly SummarySpec[]): unknown[] => {
  if (!specs.length) {
    return [];
  }

  const accumulators = createAccumulators(specs);

  for (const item of items) {
    accumulate(accumulators, specs, item);
  }

  releaseSummaryCaches(specs);
  return finishAccumulators(accumulators, specs, items);
};

// ------------------------------------------------------------------ exibição

export interface SummaryFormatContext {
  language: string | undefined;
  trueText: string;
  falseText: string;
}

/** Número de resumo sem `format`: separador de milhar do idioma e até 2 casas (a média raramente é exata). */
const SUMMARY_NUMBER: Intl.NumberFormatOptions = { maximumFractionDigits: 2 };

/**
 * `min`/`max` são valores de célula: sem `format`, saem como a célula (sem
 * separador de milhar — um ano 2021 não vira "2,021"); os demais, como resumo.
 */
const defaultNumberFormat = (spec: SummarySpec): Intl.NumberFormatOptions | undefined =>
  spec.type === 'min' || spec.type === 'max' ? undefined : SUMMARY_NUMBER;

/** Tipo de dado do VALOR do resumo (soma de datas não existe: é número). */
const resultTypeOf = (spec: SummarySpec, value: unknown): GridColumnDataType | undefined => {
  if (spec.type === 'count' || spec.type === 'sum' || spec.type === 'avg') {
    return 'number';
  }

  if (spec.type === 'min' || spec.type === 'max') {
    return spec.dataType;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return 'number';
  }

  return value instanceof Date ? 'date' : undefined;
};

/**
 * Texto do valor de um resumo: `format` do item → `format` `Intl` da coluna
 * (não o de função: ele espera o valor de uma célula) → padrão do tipo.
 * `count` só usa o `format` do próprio item.
 */
export const formatSummaryValue = (
  value: unknown,
  spec: SummarySpec,
  itemFormat: GridSummaryFormat | null | undefined,
  context: SummaryFormatContext,
): string => {

  if (isEmpty(value)) {
    return '';
  }

  const columnFormat = spec.type === 'count' || typeof spec.column?.format === 'function'
    ? undefined
    : spec.column?.format as Intl.NumberFormatOptions | Intl.DateTimeFormatOptions | undefined;
  const format = itemFormat ?? columnFormat;

  if (typeof format === 'function') {
    return toDisplayText(format(value));
  }

  const dataType = resultTypeOf(spec, value);

  if (dataType === 'number') {
    const numeric = toNumber(value);

    return numeric === undefined
      ? toDisplayText(value)
      : getNumberFormat(context.language, format ?? defaultNumberFormat(spec)).format(numeric);
  }

  if (dataType === 'date' || dataType === 'datetime') {
    const date = toDate(value);
    const fallback = dataType === 'date' ? DEFAULT_DATE : DEFAULT_DATETIME;

    return date
      ? getDateTimeFormat(context.language, format ?? fallback, fallback).format(date)
      : toDisplayText(value);
  }

  if (typeof value === 'boolean') {
    return value ? context.trueText : context.falseText;
  }

  return toDisplayText(value);
};
