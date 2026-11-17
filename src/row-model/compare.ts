import type { GridColumnDataType } from '../grid-column-def.js';
import { coerceValue } from './format.js';

export type Comparer = (a: unknown, b: unknown) => number;

const collators = new Map<string, Intl.Collator>();

const getCollator = (language: string | undefined): Intl.Collator => {
  const key = language ?? '';
  let collator = collators.get(key);

  if (!collator) {
    try {
      collator = new Intl.Collator(language, { numeric: true });
    } catch {
      collator = new Intl.Collator(undefined, { numeric: true });
    }

    collators.set(key, collator);
  }

  return collator;
};

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
    return textA < textB ? -1 : textA > textB ? 1 : 0;
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
