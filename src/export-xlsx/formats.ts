/**
 * Formatos do Excel (`numFmt`) a partir das opções `Intl` da coluna — interno
 * do adaptador `export-xlsx` (não é exportado pela entrada do pacote).
 */
import type { GridColumnDataType } from '../grid-column-def.js';
import { getDateTimeFormat, getNumberFormat } from '../row-model/format.js';

/**
 * `numFmt` próximo das opções `Intl` da coluna: casas decimais, milhar,
 * porcentagem e símbolo da moeda. Com casas opcionais (padrão do grid: até
 * 20 casas, sem milhar) fica `General`.
 */
export const numberFormatOf = (format: Intl.NumberFormatOptions | null | undefined, language: string | undefined): string | undefined => {
  const formatter = getNumberFormat(language, format ?? undefined);
  const options = formatter.resolvedOptions();
  const min = options.minimumFractionDigits ?? 0;
  const max = options.maximumFractionDigits ?? min;

  // Casas opcionais (`0.##`) deixam "5." no Excel: melhor o `General`.
  if (min === 0 && max > 0 && options.style !== 'percent' && options.style !== 'currency') {
    return undefined;
  }

  const decimals = '0'.repeat(min) + '#'.repeat(Math.max(max - min, 0));
  const integer = options.useGrouping ? '#,##0' : '0';
  let body = decimals ? `${integer}.${decimals}` : integer;

  if (options.style === 'percent') {
    body += '%';
  } else if (options.style === 'currency') {
    const parts = formatter.formatToParts(1);
    const symbol = parts.find(part => part.type === 'currency')?.value ?? '';
    const before = parts.findIndex(part => part.type === 'currency') < parts.findIndex(part => part.type === 'integer');
    const quoted = `"${symbol.replaceAll('"', '')}"`;
    body = before ? `${quoted}${body}` : `${body} ${quoted}`;
  }

  return body;
};

/** Padrão de data do Excel na ordem do idioma (`dd/mm/yyyy`, `m/d/yyyy`…); `datetime` com hora. */
export const datePatternOf = (dataType: GridColumnDataType, language: string | undefined): string => {
  const parts = getDateTimeFormat(language, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(2024, 10, 22));
  const tokens: Record<string, string> = { year: 'yyyy', month: 'mm', day: 'dd' };
  const date = parts
    .map(part => tokens[part.type] ?? (part.type === 'literal' ? part.value.replace(/[^\s/.\-,]/g, '') : ''))
    .join('');

  return dataType === 'datetime' ? `${date} hh:mm` : date;
};
