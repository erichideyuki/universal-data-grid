/**
 * Comparação de texto que ignora caixa e acento (o equivalente a
 * `Intl.Collator` com `sensitivity: 'base'` para busca de trecho, que o
 * `Collator` não faz).
 *
 * Para não alocar uma cópia "dobrada" de cada célula a cada tecla (1 milhão
 * de linhas × colunas visíveis), a busca vira uma `RegExp` sobre o texto
 * ORIGINAL: cada letra do termo vira a classe das suas variantes (`e` →
 * `[eéèêë…]`), seguida de marcas combinantes opcionais (texto em NFD).
 */

const MARKS = /\p{M}/gu;
/** Algum caractere fora do ASCII (só então vale normalizar). */
const NON_ASCII = /[^\t\n\r -~]/u;

/** Texto sem acento e em minúsculas (`ς` final vira `σ`, como na busca). */
export const foldText = (text: string): string => {
  if (!NON_ASCII.test(text)) {
    return text.toLowerCase();
  }

  const lower = text.normalize('NFD').replace(MARKS, '')
    .toLowerCase();

  return lower.replace(/ς/g, 'σ');
};

/**
 * Variantes de cada caractere dobrado de 1 caractere: `e` → `éèêëēĕėęě…`.
 * Construída uma vez, sob demanda (≈ 8 mil code points: Latin-1 a Latin
 * Extended Additional, grego e cirílico).
 */
let variants: Map<string, string> | undefined;

const RANGES: readonly [number, number][] = [
  [0x41, 0x5a],
  [0xc0, 0x24f],
  [0x370, 0x4ff],
  [0x1e00, 0x1fff],
];

const getVariants = (): Map<string, string> => {
  if (variants) {
    return variants;
  }

  variants = new Map();

  for (const [start, end] of RANGES) {
    for (let code = start; code <= end; code++) {
      const char = String.fromCodePoint(code);
      const folded = foldText(char);

      if (folded.length !== 1 || folded === char) {
        continue;
      }

      variants.set(folded, (variants.get(folded) ?? '') + char);
    }
  }

  return variants;
};

const escapeClassChar = (char: string): string =>
  (/[\\\]^-]/).test(char) ? `\\${char}` : char;

const escapeRegExp = (char: string): string =>
  (/[.*+?^${}()|[\]\\/-]/).test(char) ? `\\${char}` : char;

export type TextMatchMode = 'contains' | 'startswith' | 'endswith' | 'equals';

/**
 * `RegExp` que acha `term` em qualquer texto ignorando caixa e acento.
 * `null` para termo vazio (casa com tudo). `term` é texto do usuário: todo
 * caractere especial é escapado.
 */
export const createTextMatcher = (term: string, mode: TextMatchMode = 'contains'): RegExp | null => {
  const folded = foldText(term);

  if (!folded) {
    return null;
  }

  const table = getVariants();
  let source = '';

  for (const char of folded) {
    const extra = table.get(char);
    const upper = char.toUpperCase();
    const own = upper !== char && upper.length === 1 ? char + upper : char;

    source += extra || own.length > 1
      ? `[${[...new Set(own + (extra ?? ''))].map(escapeClassChar).join('')}]`
      : escapeRegExp(char);
    source += '\\p{M}*';
  }

  if (mode === 'startswith' || mode === 'equals') {
    source = `^${source}`;
  }

  if (mode === 'endswith' || mode === 'equals') {
    source = `${source}$`;
  }

  return new RegExp(source, 'u');
};

/**
 * Trechos de `text` que casam com `matcher` (para o destaque da busca):
 * lista alternada [fora, dentro, fora, …], sempre começando por "fora".
 */
export const splitMatches = (text: string, matcher: RegExp | null): string[] => {
  if (!matcher || !text) {
    return [text];
  }

  const global = new RegExp(matcher.source, 'gu');
  const parts: string[] = [];
  let last = 0;

  for (const match of text.matchAll(global)) {
    if (!match[0]) {
      break;
    }

    parts.push(text.slice(last, match.index), match[0]);
    last = match.index + match[0].length;
  }

  parts.push(text.slice(last));

  return parts;
};
