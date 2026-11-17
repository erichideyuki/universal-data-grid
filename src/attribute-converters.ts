import type { ComplexAttributeConverter } from 'lit';

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
