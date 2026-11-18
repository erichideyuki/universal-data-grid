import type { ComplexAttributeConverter } from 'lit';

import type { GridExportFormat } from './export/types.js';
import type { GridFilterOperation } from './grid-column-def.js';

/**
 * Booleano de atributo que também desliga (spec 15): sem atributo = padrão;
 * `"false"` = `false`; qualquer outro valor (inclusive vazio) = `true`.
 * Necessário para os booleanos com padrão `true`, que um atributo de
 * presença não conseguiria desligar.
 */
export const booleanAttribute = (defaultValue: boolean): ComplexAttributeConverter<boolean> => ({
  fromAttribute: (value: string | null): boolean => value === null ? defaultValue : value !== 'false',
  toAttribute: (value: boolean): string | null => value ? '' : null,
});

/** Tri-estado: sem atributo = `null` (padrão calculado); `"false"` desliga; outro valor liga. */
export const optionalBooleanAttribute: ComplexAttributeConverter<boolean | null> = {
  fromAttribute: (value: string | null): boolean | null => value === null ? null : value !== 'false',
  toAttribute: (value: boolean | null): string | null => value === null ? null : String(value),
};

/**
 * Atributos renomeados (antigo → novo). O elemento observa os antigos e os
 * repassa ao novo com aviso de deprecação uma vez por instância.
 */
export type LegacyAttributes = Readonly<Record<string, string>>;

const FILTER_OPERATION_TOKENS = new Set(
  '= <> < <= > >= contains notcontains startswith endswith between anyof noneof isblank isnotblank'.split(' '),
);

/** Uma operação (`default-filter-operation`); desconhecida avisa e vira `null`. */
export const filterOperationAttribute = {
  fromAttribute: (value: string | null): GridFilterOperation | null => {
    if (value === null) {
      return null;
    }

    if (!FILTER_OPERATION_TOKENS.has(value)) {
      console.warn(`<u-grid-column>: unknown filter operation ignored: ${value}.`);
      return null;
    }

    return value as GridFilterOperation;
  },
};

/**
 * Lista de operações separada por espaço (`filter-operations="contains ="`),
 * à moda de `DOMTokenList`. Só lê (não reflete); token desconhecido é
 * ignorado com aviso.
 */
export const filterOperationsAttribute = {
  fromAttribute: (value: string | null): GridFilterOperation[] | null => {
    if (value === null) {
      return null;
    }

    const tokens = value.split(/\s+/).filter(Boolean);
    const unknown = tokens.filter(token => !FILTER_OPERATION_TOKENS.has(token));

    if (unknown.length) {
      console.warn(`<u-grid-column>: unknown filter operation(s) ignored: ${unknown.join(', ')}.`);
    }

    return tokens.filter(token => FILTER_OPERATION_TOKENS.has(token)) as GridFilterOperation[];
  },
};

/**
 * Lista de números separada por vírgula ou espaço (`page-size-options="10, 20, 50"`).
 * Só lê (não reflete); valores que não são inteiros positivos são ignorados;
 * sem atributo = `defaultValue` (vazio = lista vazia). Exceção registrada à
 * regra "array = `attribute: false`" (spec 15, frente 08).
 */
export const numberListAttribute = (defaultValue: readonly number[]) => ({
  fromAttribute: (value: string | null): readonly number[] => {
    if (value === null) {
      return defaultValue;
    }

    return value.split(/[\s,]+/).filter(Boolean)
      .map(Number)
      .filter(size => Number.isInteger(size) && size > 0);
  },
});

const EXPORT_FORMAT_TOKENS = new Set(['csv', 'xlsx']);

/**
 * Formatos da exportação pela interface (`export-formats="csv xlsx"`, frente
 * 18): palavras separadas por espaço ou vírgula; desconhecida avisa e é
 * ignorada; repetidas contam uma vez. Só lê (não reflete); sem atributo =
 * lista vazia. Exceção registrada à regra "array = `attribute: false`".
 */
export const exportFormatsAttribute = {
  fromAttribute: (value: string | null): readonly GridExportFormat[] => {
    if (value === null) {
      return [];
    }

    const tokens = value.split(/[\s,]+/).filter(Boolean);
    const unknown = tokens.filter(token => !EXPORT_FORMAT_TOKENS.has(token));

    if (unknown.length) {
      console.warn(`<u-grid>: unknown export format(s) ignored: ${unknown.join(', ')}.`);
    }

    return [...new Set(tokens.filter(token => EXPORT_FORMAT_TOKENS.has(token)))] as GridExportFormat[];
  },
};
