import type { GridColumnDef, GridValidationContext, GridValidationRule } from '../grid-column-def.js';
import { formatMessage } from './sorting.js';

/**
 * Validação de um valor editado (frente 09). Funções puras: as regras
 * síncronas respondem na hora; a 1ª `custom` que devolve promessa torna o
 * resultado assíncrono (as regras depois dela esperam a resposta). Uma
 * mensagem por célula: a da 1ª regra que falha.
 */

/** Textos padrão das regras (da tradução do grid); `{min}`/`{max}` são substituídos. */
export interface ValidationTexts {
  validationRequired: string;
  validationRange: string;
  validationRangeMin: string;
  validationRangeMax: string;
  validationStringLength: string;
  validationStringLengthMin: string;
  validationStringLengthMax: string;
  validationPattern: string;
  validationEmail: string;
  validationNumber: string;
  validationDate: string;
  validationInvalid: string;
}

/** Regra que falhou (`rule` é `'number'`/`'date'` para valor que não converte no tipo da coluna). */
export interface ValidationFailure {
  rule: GridValidationRule | 'number' | 'date';
  message: string;
}

export type ValidationResult = ValidationFailure | null;

/** Valor digitado que não converte no tipo da coluna (número/data inválidos). */
export class UnparsedValue {
  readonly text: string;
  readonly kind: 'number' | 'date';

  constructor(text: string, kind: 'number' | 'date') {
    this.text = text;
    this.kind = kind;
  }
}

/** Vazio para as regras: `null`, `undefined`, `''` (e só espaços com `trim`). */
export const isEmptyValue = (value: unknown, trim = true): boolean =>
  value === null
  || value === undefined
  || (typeof value === 'string' && (trim ? value.trim() === '' : value === ''))
  || (typeof value === 'number' && Number.isNaN(value));

// Regra do `<input type="email">` (HTML Living Standard).
const EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** Expressões de `pattern` em texto, compiladas uma vez (limitado: textos do hospedeiro). */
const patternCache = new Map<string, RegExp | null>();

const compilePattern = (pattern: string): RegExp | null => {
  let compiled = patternCache.get(pattern);

  if (compiled === undefined) {
    try {
      compiled = new RegExp(`^(?:${pattern})$`, 'u');
    } catch {
      console.error(`<u-grid>: invalid validation pattern "${pattern}"; the rule is ignored.`);
      compiled = null;
    }

    if (patternCache.size > 64) {
      patternCache.clear();
    }

    patternCache.set(pattern, compiled);
  }

  return compiled;
};

const matchesPattern = (pattern: RegExp | string, text: string): boolean => {
  if (typeof pattern === 'string') {
    const compiled = compilePattern(pattern);
    return !compiled || compiled.test(text);
  }

  pattern.lastIndex = 0;
  return pattern.test(text);
};

const comparable = (value: unknown): number => {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const date = Date.parse(value);
    return Number.isNaN(date) ? Number(value) : date;
  }

  return Number(value);
};

/** Formata `min`/`max` para a mensagem. */
export type BoundFormatter = (bound: number | Date) => string;

const message = (rule: GridValidationRule, template: string, params: Record<string, string> = {}): ValidationFailure => ({
  rule,
  message: rule.message || formatMessage(template, params),
});

/** Uma regra síncrona (`custom` não entra aqui). */
const checkSyncRule = (
  rule: Exclude<GridValidationRule, { type: 'custom' }>,
  value: unknown,
  texts: ValidationTexts,
  formatBound: BoundFormatter,
): ValidationResult => {
  if (rule.type === 'required') {
    return isEmptyValue(value, rule.trim ?? true) ? message(rule, texts.validationRequired) : null;
  }

  if (isEmptyValue(value, false)) {
    return null;
  }

  switch (rule.type) {
    case 'range': {
      const amount = comparable(value);
      const below = rule.min !== undefined && rule.min !== null && amount < comparable(rule.min);
      const above = rule.max !== undefined && rule.max !== null && amount > comparable(rule.max);

      if (!below && !above && !Number.isNaN(amount)) {
        return null;
      }

      const params = {
        min: rule.min === undefined || rule.min === null ? '' : formatBound(rule.min),
        max: rule.max === undefined || rule.max === null ? '' : formatBound(rule.max),
      };
      const template = params.min && params.max
        ? texts.validationRange
        : params.min ? texts.validationRangeMin : texts.validationRangeMax;

      return message(rule, template, params);
    }

    case 'stringLength': {
      const length = String(value).length;

      if ((rule.min === undefined || length >= rule.min) && (rule.max === undefined || length <= rule.max)) {
        return null;
      }

      const params = { min: rule.min === undefined ? '' : String(rule.min), max: rule.max === undefined ? '' : String(rule.max) };
      const template = params.min && params.max
        ? texts.validationStringLength
        : params.min ? texts.validationStringLengthMin : texts.validationStringLengthMax;

      return message(rule, template, params);
    }

    case 'pattern':
      return matchesPattern(rule.pattern, String(value)) ? null : message(rule, texts.validationPattern);
    case 'email':
      return EMAIL.test(String(value)) ? null : message(rule, texts.validationEmail);
    default:
      return null;
  }
};

/** Resposta de uma regra `custom` → falha ou `null`. */
const customOutcome = (rule: GridValidationRule, outcome: unknown, texts: ValidationTexts): ValidationResult => {
  if (outcome === true) {
    return null;
  }

  if (typeof outcome === 'string' && outcome) {
    return { rule, message: outcome };
  }

  return message(rule, texts.validationInvalid);
};

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  !!value && typeof (value as PromiseLike<unknown>).then === 'function';

/**
 * Valida `ctx.value` contra as regras da coluna, na ordem. Devolve o
 * resultado já (`ValidationResult`) ou uma promessa dele quando uma regra
 * `custom` responde com promessa. Abortar `signal` não rejeita: a promessa
 * resolve `null` (quem chamou descarta a resposta velha).
 */
export const validateValue = (
  rules: readonly GridValidationRule[] | null | undefined,
  ctx: GridValidationContext,
  texts: ValidationTexts,
  formatBound: BoundFormatter,
  signal: AbortSignal,
): ValidationResult | Promise<ValidationResult> => {
  const { value } = ctx;

  if (value instanceof UnparsedValue) {
    return { rule: value.kind, message: value.kind === 'number' ? texts.validationNumber : texts.validationDate };
  }

  const list = rules ?? [];

  for (let index = 0; index < list.length; index++) {
    const rule = list[index];

    if (!rule || typeof rule !== 'object') {
      continue;
    }

    if (rule.type !== 'custom') {
      const failure = checkSyncRule(rule, value, texts, formatBound);

      if (failure) {
        return failure;
      }

      continue;
    }

    if (typeof rule.validate !== 'function') {
      continue;
    }

    let outcome: unknown;

    try {
      outcome = rule.validate(ctx, signal);
    } catch (error) {
      console.error('<u-grid>: a custom validation rule threw.', error);
      return message(rule, texts.validationInvalid);
    }

    if (isThenable(outcome)) {
      const rest = list.slice(index + 1);

      return Promise.resolve(outcome).then(
        result => {
          if (signal.aborted) {
            return null;
          }

          const failure = customOutcome(rule, result, texts);
          return failure ?? validateValue(rest, ctx, texts, formatBound, signal);
        },
        (error: unknown) => {
          if (signal.aborted) {
            return null;
          }

          console.error('<u-grid>: a custom validation rule rejected.', error);
          return message(rule, texts.validationInvalid);
        },
      );
    }

    const failure = customOutcome(rule, outcome, texts);

    if (failure) {
      return failure;
    }
  }

  return null;
};

/** A coluna tem regra assíncrona possível (só `custom`)? */
export const hasCustomRule = (column: GridColumnDef): boolean =>
  !!column.validationRules?.some(rule => rule?.type === 'custom');
