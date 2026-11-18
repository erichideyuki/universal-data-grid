/**
 * Texto de exportação (frente 12): campos de CSV (RFC 4180), TSV e HTML da
 * área de transferência e a proteção contra injeção de fórmula. Funções
 * puras, sem DOM — testadas em Node (`csv.test.ts`).
 */

/** Primeiro caractere que faz o Excel/Sheets/LibreOffice ler a célula como fórmula (OWASP CSV Injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Número "puro" (`-5`, `+1.234,56`, `-12 %`, `-1e3`): começa com sinal mas não
 * é fórmula, então fica sem o prefixo — senão todo número negativo
 * formatado viraria texto na planilha. Sinal, depois dígitos e separadores
 * (o `\s` cobre os espaços do `Intl`: U+00A0, U+202F), expoente, `%` e
 * símbolo de moeda (`-$5.00`, `-5,00 €`) — sem letras, então `-$A$1` não passa.
 */
const PLAIN_NUMBER = /^(?:[+-][ \u00a0\u202f]?)?(?:\p{Sc}[ \u00a0\u202f]?)?[\d.,]*\d[\d\s.,'’]*(?:[eE][+-]?\d+)?\s?[%\p{Sc}]?$/u;

/**
 * Prefixa `'` no texto que uma planilha executaria como fórmula (começa com
 * `=`, `+`, `-`, `@`, tab ou CR), exceto número puro.
 */
export const escapeFormula = (text: string): string =>
  FORMULA_START.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;

/** O campo saiu de {@link escapeFormula} com o prefixo `'` (começa com `'` e um gatilho de fórmula). */
export const isFormulaEscaped = (field: string): boolean => field.startsWith('\'') && FORMULA_START.test(field.slice(1));

/** Campo de CSV (RFC 4180): entre aspas quando tem separador, aspas, CR ou LF; aspas dobradas. */
export const csvField = (text: string, separator: string): string =>
  text.includes('"') || text.includes('\n') || text.includes('\r') || text.includes(separator)
    ? `"${text.replaceAll('"', '""')}"`
    : text;

/** Campo de TSV (texto da área de transferência): como o Excel copia — aspas só quando tem tab, quebra ou aspas. */
export const tsvField = (text: string): string => csvField(text, '\t');

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
};

/** Texto escapado para HTML (conteúdo e atributo). */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, char => HTML_ESCAPES[char]);

/**
 * Separador do CSV: `auto` = `;` quando o idioma usa vírgula decimal (o
 * Excel desses idiomas espera `;`), senão `,`.
 */
export const resolveSeparator = (separator: string | undefined, language: string | undefined): string => {
  if (separator && separator !== 'auto') {
    return separator;
  }

  return decimalSeparator(language) === ',' ? ';' : ',';
};

const decimalSeparator = (language: string | undefined): string => {
  try {
    return new Intl.NumberFormat(language || undefined).formatToParts(1.5)
      .find(part => part.type === 'decimal')?.value ?? '.';
  } catch {
    return '.';
  }
};

/** BOM UTF-8: o Excel só lê o CSV como UTF-8 com ele. */
export const BOM = '\uFEFF';

/** Fim de linha do RFC 4180. */
export const CRLF = '\r\n';
