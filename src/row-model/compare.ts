/* eslint-disable no-bitwise -- radix e chaves de 64 bits dos postos rápidos (spec 16). */
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

/**
 * Collator que ignora caixa e acento (`sensitivity: 'base'`), para os
 * operadores de ordem do filtro em texto. Mesmo cache limitado.
 */
export const getBaseCollator = (language: string | undefined): Intl.Collator => {
  const key = `b:${language ?? ''}`;
  let collator = collators.get(key);

  if (!collator) {
    try {
      collator = new Intl.Collator(language, { numeric: true, sensitivity: 'base' });
    } catch {
      collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
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

// ------------------------------------------------------- postos rápidos (spec 16)

/**
 * Ordena `order` (índices) de forma ESTÁVEL por chaves de 64 bits sem sinal
 * (`high`, `low`, alinhadas aos índices): radix LSD de 4 passadas de 16 bits.
 * Linear, sem comparador nem busca binária (spec 16).
 */
const radixSort64 = (order: Int32Array, high: Uint32Array, low: Uint32Array): Int32Array => {
  const count = order.length;
  const DIGITS = 65_536;
  const counts = new Int32Array(4 * DIGITS);
  // Chaves copiadas na ordem atual (leitura sequencial) e os 4 histogramas
  // numa passada só. Reaproveita `order` como área de trabalho.
  let indexes: Int32Array = order;
  let highs = new Uint32Array(count);
  let lows = new Uint32Array(count);

  for (let i = 0; i < count; i++) {
    const index = indexes[i];
    const hi = high[index];
    const lo = low[index];

    highs[i] = hi;
    lows[i] = lo;
    counts[lo & 0xFFFF]++;
    counts[DIGITS + (lo >>> 16)]++;
    counts[2 * DIGITS + (hi & 0xFFFF)]++;
    counts[3 * DIGITS + (hi >>> 16)]++;
  }

  let nextIndexes: Int32Array = new Int32Array(count);
  let nextHighs = new Uint32Array(count);
  let nextLows = new Uint32Array(count);

  for (let pass = 0; pass < 4; pass++) {
    const base = pass * DIGITS;
    const shift = pass % 2 ? 16 : 0;
    const words = pass < 2 ? lows : highs;

    // Passada sem efeito (todos no mesmo dígito): pula.
    if (counts[base + ((words[0] >>> shift) & 0xFFFF)] === count) {
      continue;
    }

    let sum = 0;

    for (let digit = 0; digit < DIGITS; digit++) {
      const digitCount = counts[base + digit];

      counts[base + digit] = sum;
      sum += digitCount;
    }

    for (let i = 0; i < count; i++) {
      const position = counts[base + ((words[i] >>> shift) & 0xFFFF)]++;

      nextIndexes[position] = indexes[i];
      nextHighs[position] = highs[i];
      nextLows[position] = lows[i];
    }

    [indexes, nextIndexes] = [nextIndexes, indexes];
    [highs, nextHighs] = [nextHighs, highs];
    [lows, nextLows] = [nextLows, lows];
  }

  return indexes;
};

const float64 = new Float64Array(1);
const float64Words = new Uint32Array(float64.buffer);
/** Índice da palavra alta de um `double` na plataforma (quase sempre little-endian). */
const HIGH_WORD = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 1 : 0;

/** Bits de um `double` como inteiro sem sinal na MESMA ordem numérica. */
const sortableBits = (value: number, high: Uint32Array, low: Uint32Array, at: number): void => {
  float64[0] = value === 0 ? 0 : value; // -0 e 0: mesma chave
  let hi = float64Words[HIGH_WORD];
  let lo = float64Words[1 - HIGH_WORD];

  if (hi & 0x8000_0000) {
    // Negativo: inverte tudo (mais negativo = menor).
    hi = ~hi >>> 0;
    lo = ~lo >>> 0;
  } else {
    hi = (hi | 0x8000_0000) >>> 0;
  }

  high[at] = hi;
  low[at] = lo;
};

/**
 * Postos de valores TODOS números (ou todos `Date`) e vazios, por radix nos
 * bits do `double` — sem `Map` nem comparador em JS. Vazios (`null`,
 * `undefined`, `NaN`, data inválida) ficam no posto 0, como no comparador.
 * `undefined` se houver outro tipo (ou número e data juntos).
 */
const numericRanks = (values: readonly unknown[]): Int32Array | undefined => {
  const count = values.length;
  const high = new Uint32Array(count);
  const low = new Uint32Array(count);
  const ranks = new Int32Array(count);
  const present = new Int32Array(count);
  let presentCount = 0;
  let hasNumbers = false;
  let hasDates = false;

  for (let i = 0; i < count; i++) {
    const value = values[i];
    let numeric: number;

    if (typeof value === 'number') {
      numeric = value;
      hasNumbers = true;
    } else if (value instanceof Date) {
      numeric = value.getTime();
      hasDates = true;
    } else if (value === null || value === undefined) {
      continue;
    } else {
      return undefined;
    }

    if (!Number.isNaN(numeric)) {
      sortableBits(numeric, high, low, i);
      present[presentCount++] = i;
    }
  }

  if (hasNumbers && hasDates) {
    return undefined;
  }

  if (!presentCount) {
    return ranks;
  }

  const order = radixSort64(present.subarray(0, presentCount), high, low);
  let position = 1;

  for (let i = 0; i < order.length; i++) {
    const index = order[i];

    if (i) {
      const previous = order[i - 1];

      if (high[index] !== high[previous] || low[index] !== low[previous]) {
        position++;
      }
    }

    ranks[index] = position;
  }

  return ranks;
};

/** Ordem do atalho de texto: espaço < dígitos < letras (sem caixa). */
const PRIMARY_ORDER = ' 0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Peso PRIMÁRIO de cada caractere ASCII no collator raiz (-1 = sem atalho);
 * 0 é o fim do texto.
 */
const PRIMARY_WEIGHTS = (() => {
  const weights = new Int8Array(128).fill(-1);

  for (let i = 0; i < PRIMARY_ORDER.length; i++) {
    weights[PRIMARY_ORDER.charCodeAt(i)] = i + 1;
    weights[PRIMARY_ORDER.toUpperCase().charCodeAt(i)] = i + 1;
  }

  return weights;
})();

const WEIGHT_BASE = PRIMARY_ORDER.length + 1;
/** Caracteres por chave numérica: 38^10 < 2^53. */
const CHARS_PER_KEY = 10;

/**
 * Duas chaves numéricas (em `keys[at * 2]` e `keys[at * 2 + 1]`) com os pesos
 * primários dos 20 primeiros caracteres; `false` se algum deles estiver fora
 * do atalho.
 */
const primaryKeys = (text: string, keys: Float64Array, at: number): boolean => {
  for (let part = 0; part < 2; part++) {
    let key = 0;

    for (let i = part * CHARS_PER_KEY; i < (part + 1) * CHARS_PER_KEY; i++) {
      let weight = 0;

      if (i < text.length) {
        const code = text.charCodeAt(i);

        weight = code < 128 ? PRIMARY_WEIGHTS[code] : -1;

        if (weight < 0) {
          return false;
        }
      }

      key = key * WEIGHT_BASE + weight;
    }

    keys[at * 2 + part] = key;
  }

  return true;
};

/** Collators (não numéricos) já conferidos contra {@link PRIMARY_WEIGHTS}. */
const verifiedCollators = new WeakMap<Intl.Collator, boolean>();

/**
 * Confere UMA vez por collator que a ordem dele nos caracteres do atalho é a
 * dos pesos: todos os textos de 1 e 2 caracteres, em minúsculas e em
 * maiúsculas cruzadas, em ordem estrita. Pega idiomas que reordenam letras
 * ou têm contrações (tcheco "ch", dinamarquês "aa", lituano "y") e espaço
 * ignorável (tailandês) — esses ficam sem atalho.
 */
const collatorMatchesWeights = (collator: Intl.Collator): boolean => {
  let verified = verifiedCollators.get(collator);

  if (verified === undefined) {
    const texts: string[] = [];

    for (const first of PRIMARY_ORDER) {
      texts.push(first);

      for (const second of PRIMARY_ORDER) {
        texts.push(first + second);
      }
    }

    // Já em ordem de peso: o texto de 1 caractere (fim = 0) vem antes dos pares dele.
    verified = texts.every((text, i) => i === 0
      || (collator.compare(texts[i - 1], text) < 0
        && collator.compare(texts[i - 1].toUpperCase(), text) < 0
        && collator.compare(texts[i - 1], text.toUpperCase()) < 0));

    verifiedCollators.set(collator, verified);
  }

  return verified;
};

const TWO_32 = 2 ** 32;

/**
 * Ordem dos índices por chaves numéricas pares (`keys[2i]`, `keys[2i + 1]`,
 * inteiros < 2^53): radix nas duas chaves e, em cada sequência de pares
 * iguais, `tieBreak`.
 */
const orderByKeyPairs = (keys: Float64Array, count: number, tieBreak: (a: number, b: number) => number): Int32Array => {
  const high = new Uint32Array(count);
  const low = new Uint32Array(count);
  let order: Int32Array = new Int32Array(count);

  for (let i = 0; i < count; i++) {
    order[i] = i;
  }

  // LSD: a 2ª chave primeiro, depois a 1ª (estável).
  for (const part of [1, 0]) {
    for (let i = 0; i < count; i++) {
      const key = keys[i * 2 + part];

      high[i] = Math.floor(key / TWO_32);
      low[i] = key % TWO_32;
    }

    order = radixSort64(order, high, low);
  }

  for (let start = 0; start < count;) {
    let end = start + 1;
    const first = order[start];

    while (end < count && keys[order[end] * 2] === keys[first * 2] && keys[order[end] * 2 + 1] === keys[first * 2 + 1]) {
      end++;
    }

    if (end - start > 1) {
      order.subarray(start, end).sort(tieBreak);
    }

    start = end;
  }

  return order;
};

/** Distintos a partir dos quais vale montar as chaves primárias. */
const FAST_TEXT_MIN = 64;

/** Fração de distintos (na amostra) a partir da qual o texto pula o `Map` de distintos. */
const HIGH_CARDINALITY = 0.5;
const SAMPLE_SIZE = 1024;

/** Amostra espaçada: a maioria dos valores é distinta? */
const mostlyDistinct = (values: readonly unknown[]): boolean => {
  const step = Math.max(1, Math.floor(values.length / SAMPLE_SIZE));
  const seen = new Set<unknown>();
  let sampled = 0;

  for (let i = 0; i < values.length; i += step) {
    seen.add(values[i]);
    sampled++;
  }

  return seen.size > sampled * HIGH_CARDINALITY;
};

const ZERO = 48;
const NINE = 57;

const isAsciiDigit = (code: number): boolean => code >= ZERO && code <= NINE;

/**
 * Postos de textos quase todos distintos (nomes, códigos) — o pior caso de
 * ordenação (spec 16). Sem `Map` de distintos (cada valor é uma entrada; os
 * repetidos empatam), sem montar o texto preenchido de cada valor: a chave
 * primária sai de uma leitura dos caracteres, com as sequências de dígitos
 * preenchidas como em {@link paddedTextKeys}. O texto preenchido só é montado
 * para desempatar. `undefined` se não for o caso (o chamador segue no caminho
 * geral): algum valor não é texto, poucos distintos, collator sem o atalho,
 * dígito não ASCII, sequência de dígitos longa demais ou caractere fora do
 * atalho nos 20 primeiros.
 */
const distinctTextRanks = (values: readonly unknown[], language: string | undefined): Int32Array | undefined => {
  const count = values.length;

  if (count < FAST_TEXT_MIN || !values.every(value => typeof value === 'string') || !mostlyDistinct(values)) {
    return undefined;
  }

  const texts = values;
  const collator = getCollator(language, false);

  if (!collatorMatchesWeights(collator)) {
    return undefined;
  }

  // 1ª leitura: largura do preenchimento (maior sequência de dígitos) e
  // dígitos não ASCII (sem equivalência com o collator numérico).
  let width = 0;

  for (const text of texts) {
    let run = 0;

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);

      if (isAsciiDigit(code)) {
        run++;
        continue;
      }

      if (run > width) {
        width = run;
      }

      run = 0;

      if (code >= 128 && NON_ASCII_DIGIT.test(text[i])) {
        return undefined;
      }
    }

    if (run > width) {
      width = run;
    }
  }

  if (width > MAX_PADDED_DIGITS) {
    return undefined;
  }

  // 2ª leitura: pesos dos 20 primeiros caracteres do texto PREENCHIDO.
  const pairs = new Float64Array(count * 2);
  const limit = CHARS_PER_KEY * 2;

  const weights = new Int8Array(limit);
  const zeroWeight = PRIMARY_WEIGHTS[ZERO];

  for (let index = 0; index < count; index++) {
    const text = texts[index];
    let emitted = 0;
    let i = 0;

    while (emitted < limit && i < text.length) {
      const code = text.charCodeAt(i);

      if (isAsciiDigit(code)) {
        let end = i + 1;

        while (end < text.length && isAsciiDigit(text.charCodeAt(end))) {
          end++;
        }

        for (let pad = end - i; pad < width && emitted < limit; pad++) {
          weights[emitted++] = zeroWeight;
        }

        for (; i < end && emitted < limit; i++) {
          weights[emitted++] = PRIMARY_WEIGHTS[text.charCodeAt(i)];
        }

        i = end;
        continue;
      }

      const weight = code < 128 ? PRIMARY_WEIGHTS[code] : -1;

      if (weight < 0) {
        return undefined;
      }

      weights[emitted++] = weight;
      i++;
    }

    weights.fill(0, emitted);

    let first = 0;
    let second = 0;

    for (let w = 0; w < CHARS_PER_KEY; w++) {
      first = first * WEIGHT_BASE + weights[w];
      second = second * WEIGHT_BASE + weights[w + CHARS_PER_KEY];
    }

    pairs[index * 2] = first;
    pairs[index * 2 + 1] = second;
  }

  // Desempate (mesmos 20 primeiros pesos): o comparador completo, com o
  // texto preenchido montado só aqui.
  const padded: (string | undefined)[] = [];
  const paddedAt = (index: number): string =>
    padded[index] ??= width ? texts[index].replace(DIGIT_RUNS, run => run.padStart(width, '0')) : texts[index];

  const compareAt = (a: number, b: number): number => {
    const byKey = pairs[a * 2] - pairs[b * 2] || pairs[a * 2 + 1] - pairs[b * 2 + 1];

    if (byKey || texts[a] === texts[b]) {
      return byKey;
    }

    return collator.compare(paddedAt(a), paddedAt(b)) || compareCodeUnits(texts[a], texts[b]);
  };

  const order = orderByKeyPairs(pairs, count, compareAt);
  const ranks = new Int32Array(count);
  let position = 0;

  for (let i = 0; i < count; i++) {
    if (i && compareAt(order[i - 1], order[i]) !== 0) {
      position++;
    }

    ranks[order[i]] = position;
  }

  return ranks;
};

/**
 * Posto de cada valor na ordem de {@link createComparer}: ordena só os
 * valores DISTINTOS (colunas com repetição ficam baratas) e a ordenação
 * principal passa a comparar inteiros. Valores que o comparador considera
 * iguais (duas `Date` com o mesmo tempo) recebem o mesmo posto. Com
 * `dataType`, cada valor distinto é convertido UMA vez (`coerceValue`) — não
 * uma por linha.
 *
 * Atalhos (spec 16), sempre com a ordem do comparador: só números (ou só
 * datas) ordenam nativamente em `Float64Array`; textos só com espaço,
 * dígitos e letras ASCII nos 20 primeiros caracteres ordenam por chaves
 * numéricas dos pesos primários do collator (conferidos uma vez por
 * collator), e o collator só desempata; textos quase todos distintos nem
 * passam pelo `Map` de distintos ({@link distinctTextRanks}).
 */
export const rankValues = (
  values: readonly unknown[],
  language?: string,
  dataType?: GridColumnDataType | null,
): Int32Array => {
  if (!dataType || dataType === 'number') {
    const ranks = numericRanks(values);

    if (ranks) {
      return ranks;
    }
  }

  if (!dataType || dataType === 'string') {
    const ranks = distinctTextRanks(values, language);

    if (ranks) {
      return ranks;
    }
  }

  const compare = createComparer(language);
  // Id de cada valor distinto: uma consulta de `Map` por linha.
  const distinct = new Map<unknown, number>();
  const raw: unknown[] = [];
  const ids = new Int32Array(values.length);

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    let id = distinct.get(value);

    if (id === undefined) {
      id = raw.length;
      distinct.set(value, id);
      raw.push(value);
    }

    ids[i] = id;
  }

  const keys = dataType ? raw.map(value => coerceValue(value, dataType)) : raw;
  const count = keys.length;
  const padded = paddedTextKeys(keys);

  // Compara por posição em `keys` (`Array#sort` poria `undefined` no fim sem
  // consultar o comparador).
  let compareAt = (a: number, b: number): number => compare(keys[a], keys[b]);
  let order: Int32Array | undefined;

  if (padded) {
    const collator = getCollator(language, false);

    compareAt = (a, b) => {
      const textA = padded[a];
      const textB = padded[b];

      return textA === undefined || textB === undefined
        ? compare(keys[a], keys[b])
        : collator.compare(textA, textB) || compareCodeUnits(keys[a] as string, keys[b] as string);
    };

    // Chaves primárias: só se TODOS os distintos forem texto do atalho.
    if (count >= FAST_TEXT_MIN && collatorMatchesWeights(collator)) {
      const pairs = new Float64Array(count * 2);

      if (padded.every((text, i) => text !== undefined && primaryKeys(text, pairs, i))) {
        const slowCompare = compareAt;

        compareAt = (a, b) =>
          pairs[a * 2] - pairs[b * 2] || pairs[a * 2 + 1] - pairs[b * 2 + 1] || slowCompare(a, b);
        order = orderByKeyPairs(pairs, count, compareAt);
      }
    }
  }

  order ??= Int32Array.from(keys.keys()).sort(compareAt);

  const rankOfId = new Int32Array(count);
  let position = 0;

  for (let i = 0; i < order.length; i++) {
    if (i && compareAt(order[i - 1], order[i]) !== 0) {
      position++;
    }

    rankOfId[order[i]] = position;
  }

  const ranks = new Int32Array(values.length);

  for (let i = 0; i < values.length; i++) {
    ranks[i] = rankOfId[ids[i]];
  }

  return ranks;
};
