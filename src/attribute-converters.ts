import type { ComplexAttributeConverter } from 'lit';

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
