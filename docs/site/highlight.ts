/**
 * Realce mínimo de TypeScript/HTML para os blocos de código. Monta nós de
 * texto (nunca `innerHTML`): o código é nosso, mas a regra do projeto vale
 * aqui também.
 */
const KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete',
  'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'if', 'import', 'in',
  'instanceof', 'interface', 'let', 'new', 'null', 'of', 'readonly', 'return', 'satisfies', 'static',
  'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'void', 'while', 'yield',
]);

const TOKEN = new RegExp([
  String.raw`(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)`,
  String.raw`(?<string>'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|\`(?:\\.|[^\`\\])*\`)`,
  String.raw`(?<number>\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)`,
  String.raw`(?<word>[A-Za-z_$][\w$]*)`,
].join('|'), 'g');

export const highlight = (code: string): DocumentFragment => {
  const fragment = document.createDocumentFragment();
  let last = 0;

  const push = (text: string, kind?: string) => {
    if (!text) {
      return;
    }

    if (!kind) {
      fragment.append(text);
      return;
    }

    const span = document.createElement('span');
    span.className = `tok-${kind}`;
    span.textContent = text;
    fragment.append(span);
  };

  for (const match of code.matchAll(TOKEN)) {
    const groups = match.groups!;
    push(code.slice(last, match.index));

    if (groups['word'] !== undefined) {
      const word = groups['word'];
      const next = code[match.index + word.length];
      push(word, KEYWORDS.has(word) ? 'keyword' : next === '(' ? 'call' : /^[A-Z]/.test(word) ? 'type' : undefined);
    } else {
      push(match[0], groups['comment'] !== undefined ? 'comment' : groups['string'] !== undefined ? 'string' : 'number');
    }

    last = match.index + match[0].length;
  }

  push(code.slice(last));
  return fragment;
};

/** `code` e **negrito** nos textos das páginas. */
export const inline = (text: string): DocumentFragment => {
  const fragment = document.createDocumentFragment();

  for (const part of text.split(/(`[^`]+`|\*\*[^*]+\*\*)/)) {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      const code = document.createElement('code');
      code.textContent = part.slice(1, -1);
      fragment.append(code);
    } else if (part.startsWith('**') && part.endsWith('**') && part.length > 3) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      fragment.append(strong);
    } else {
      fragment.append(part);
    }
  }

  return fragment;
};
