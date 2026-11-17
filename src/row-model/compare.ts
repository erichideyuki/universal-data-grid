import type { GridColumnDataType } from '../grid-column-def.js';
import { coerceValue } from './format.js';
import { LruCache } from './lru.js';

export type Comparer = (a: unknown, b: unknown) => number;

/** Limite do cache de collators por idioma (spec 14). */
export const COLLATOR_CACHE_LIMIT = 32;

const collators = new LruCache<string, Intl.Collator>(COLLATOR_CACHE_LIMIT);

/** Diagnóstico/testes de vazamento. */
export const _collatorCacheSize = (): number => collators.size;

const getCollator = (language: string | undefined, numeric = true): Intl.Collator => {
  const key = `${numeric ? 'n' : 't'}:${language ?? ''}`;
  let collator = collators.get(key);

  if (!collator) {
    try {
      collator = new Intl.Collator(language, { numeric });
    } catch {
      collator = new Intl.Collator(undefined, { numeric });
    }

    collators.set(key, collator);
  }

  return collator;
};

const compareCodeUnits = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

const isBlank = (value: unknown): boolean =>
  value === null
  || value === undefined
  || (typeof value === 'number' && Number.isNaN(value))
  || (value instanceof Date && Number.isNaN(value.getTime()));

const rank = (value: unknown): number => {
  if (typeof value === 'number' || typeof value === 'bigint') {
    return 0;
  }

  if (value instanceof Date) {
    return 1;
  }

  if (typeof value === 'boolean') {
    return 2;
  }

  return 3;
};

const createValueComparer = (collator: Intl.Collator): Comparer =>
  (a, b) => {
    const aBlank = isBlank(a);
    const bBlank = isBlank(b);

    if (aBlank || bBlank) {
      return aBlank === bBlank ? 0 : aBlank ? -1 : 1;
    }

    const rankDiff = rank(a) - rank(b);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    if (typeof a === 'number' || typeof a === 'bigint') {
      return a < (b as number) ? -1 : a > (b as number) ? 1 : 0;
    }

    if (a instanceof Date) {
      return a.getTime() - (b as Date).getTime();
    }

    if (typeof a === 'boolean') {
      return Number(a) - Number(b);
    }

    const textA = String(a);
    const textB = String(b);
    const result = collator.compare(textA, textB);

    if (result !== 0) {
      return result;
    }

    // Desempate por código: textos canonicamente iguais mas diferentes não
    // podem se intercalar.
    return compareCodeUnits(textA, textB);
  };

/**
 * Comparador por tipo: vazios primeiro; número, data e booleano pelo valor;
 * o resto como texto com `Intl.Collator` numérico ("item 2" < "item 10") no
 * idioma do grid. Tipos diferentes na mesma coluna seguem uma ordem fixa
 * (número < data < booleano < texto) para a ordenação ser total.
 *
 * Com `dataType` informado, os valores são convertidos antes: `"10"` vs `"9"`
 * em coluna `number` compara como número; string ISO em coluna `date`, como
 * data; em coluna `string`, tudo como texto. O que não converte (data
 * inválida) fica como texto, depois dos convertidos.
 */
export const createComparer = (language?: string, dataType?: GridColumnDataType | null): Comparer => {
  const collator = getCollator(language);
  const compare = createValueComparer(collator);

  return dataType
    ? (a, b) => compare(coerceValue(a, dataType), coerceValue(b, dataType))
    : compare;
};

/** Maior sequência de dígitos que o atalho de texto aceita preencher. */
const MAX_PADDED_DIGITS = 64;
const DIGIT_RUNS = /[0-9]+/g;
/** Dígitos decimais fora do ASCII (árabe-índicos, de largura total…). */
const NON_ASCII_DIGIT = /[^\P{Nd}0-9]/u;

/**
 * Chaves para o collator NÃO numérico ordenar como o numérico: toda sequência
 * de dígitos é preenchida com zeros até a mesma largura, e então a ordem
 * caractere a caractere dos dígitos é a ordem numérica (zeros à esquerda já
 * não contam no modo numérico). O collator não numérico do V8 tem atalho
 * para Latin-1 e é ~4× mais rápido — é o que deixa 100 mil textos únicos
 * abaixo de 200 ms. Alinhado com `keys` (`undefined` onde não é texto); sem
 * garantia de equivalência (dígitos não ASCII, sequência longa demais)
 * devolve `undefined`.
 */
const paddedTextKeys = (keys: readonly unknown[]): (string | undefined)[] | undefined => {
  let width = 0;
  let texts = 0;

  for (const key of keys) {
    if (typeof key !== 'string') {
      continue;
    }

    if (NON_ASCII_DIGIT.test(key)) {
      return undefined;
    }

    texts++;

    for (const run of key.match(DIGIT_RUNS) ?? []) {
      width = Math.max(width, run.length);
    }
  }

  if (texts < 2 || width > MAX_PADDED_DIGITS) {
    return undefined;
  }

  return keys.map(key => typeof key !== 'string'
    ? undefined
    : width ? key.replace(DIGIT_RUNS, run => run.padStart(width, '0')) : key);
};

/**
 * Posto de cada valor na ordem de {@link createComparer}: ordena só os
 * valores DISTINTOS (colunas com repetição ficam baratas) e a ordenação
 * principal passa a comparar inteiros. Valores que o comparador considera
 * iguais (duas `Date` com o mesmo tempo) recebem o mesmo posto.
 */
export const rankValues = (values: readonly unknown[], language?: string): Int32Array => {
  const compare = createComparer(language);
  const distinct = new Map<unknown, number>();

  for (const value of values) {
    distinct.set(value, 0);
  }

  const keys = [...distinct.keys()];
  const padded = paddedTextKeys(keys);
  // Compara por posição em `keys` (`Array#sort` poria `undefined` no fim sem
  // consultar o comparador).
  let compareAt = (a: number, b: number): number => compare(keys[a], keys[b]);

  if (padded) {
    const collator = getCollator(language, false);

    compareAt = (a, b) => {
      const textA = padded[a];
      const textB = padded[b];

      return textA === undefined || textB === undefined
        ? compare(keys[a], keys[b])
        : collator.compare(textA, textB) || compareCodeUnits(keys[a] as string, keys[b] as string);
    };
  }

  const order = keys.map((_, i) => i).sort(compareAt);
  let position = 0;

  for (let i = 0; i < order.length; i++) {
    if (i && compareAt(order[i - 1], order[i]) !== 0) {
      position++;
    }

    distinct.set(keys[order[i]], position);
  }

  const ranks = new Int32Array(values.length);

  for (let i = 0; i < values.length; i++) {
    ranks[i] = distinct.get(values[i])!;
  }

  return ranks;
};
