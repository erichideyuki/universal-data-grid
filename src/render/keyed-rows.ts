import { type ChildPart, noChange } from 'lit';
import {
  getCommittedValue,
  insertPart,
  removePart,
  setChildPartValue,
  setCommittedValue,
} from 'lit/directive-helpers.js';
import { Directive, directive, type DirectiveResult, type PartInfo, PartType } from 'lit/directive.js';

type KeyOf<T> = (item: T) => unknown;
type TemplateOf<T> = (item: T) => unknown;

/**
 * Lista com chave (como o `repeat` do Lit) para as linhas do corpo, sem o
 * vazamento do `repeat` do lit-html 3.3: o `removePart` dele apaga o
 * conteúdo e o marcador de início da parte, mas deixa no DOM o marcador de
 * fim (`<!---->`). Cada linha que sai da janela virtual deixaria um
 * comentário a mais no `<tbody>`, para sempre (spec 14).
 *
 * Reconciliação simples, feita para janelas deslizantes: percorre a lista
 * nova de trás para frente e só move a parte que não está antes da
 * seguinte; partes sem chave na lista nova são removidas por inteiro.
 */
class KeyedRowsDirective<T> extends Directive {
  /** Chaves na ordem das partes hoje no DOM; `undefined` até o 1º render. */
  #keys?: unknown[];

  constructor(partInfo: PartInfo) {
    super(partInfo);

    if (partInfo.type !== PartType.CHILD) {
      throw new Error('keyedRows() só pode ser usado como conteúdo.');
    }
  }

  /** SSR e 1º render sem parte: só a lista. */
  render(items: readonly T[], _keyOf: KeyOf<T>, template: TemplateOf<T>): unknown[] {
    return items.map(item => template(item));
  }

  override update(containerPart: ChildPart, [items, keyOf, template]: [readonly T[], KeyOf<T>, TemplateOf<T>]): unknown {
    const committed = getCommittedValue(containerPart);

    // 1º render desta instância (inclusive vindo de "sem dados") ou
    // hidratação de SSR: devolve a lista e deixa o Lit criar as partes, como
    // o `repeat` faz. Na hidratação o `@lit-labs/ssr-client` chama este
    // `update` e precisa de um iterável para casar com os marcadores das
    // linhas que vieram do servidor; mexer no DOM aqui e devolver `noChange`
    // quebra a hidratação ("Primitive found where TemplateResult expected").
    // O iterável commitado pelo Lit é um array de `ChildPart`, um por item,
    // que os renders seguintes reaproveitam pela chave.
    if (!this.#keys || !Array.isArray(committed) || committed.length !== this.#keys.length) {
      this.#keys = items.map(keyOf);
      return this.render(items, keyOf, template);
    }

    const oldParts = committed as ChildPart[];
    const oldKeys = this.#keys;
    const reusable = new Map<unknown, ChildPart>();
    const stale: ChildPart[] = [];

    oldKeys.forEach((key, index) => {
      const duplicate = reusable.get(key);

      if (duplicate) {
        stale.push(duplicate);
      }

      reusable.set(key, oldParts[index]);
    });

    const newParts: ChildPart[] = new Array(items.length);
    const newKeys: unknown[] = new Array(items.length);
    let next: ChildPart | undefined;

    for (let index = items.length - 1; index >= 0; index--) {
      const key = keyOf(items[index]);
      let part = reusable.get(key);

      if (part) {
        // Chave repetida não reaproveita a mesma parte duas vezes.
        reusable.delete(key);
        insertPart(containerPart, next, part);
      } else {
        part = insertPart(containerPart, next);
      }

      setChildPartValue(part, template(items[index]));
      newParts[index] = part;
      newKeys[index] = key;
      next = part;
    }

    for (const part of [...stale, ...reusable.values()]) {
      removePart(part);
      // O que o `removePart` esquece (no-op se um dia ele passar a remover).
      part.endNode?.parentNode?.removeChild(part.endNode);
    }

    setCommittedValue(containerPart, newParts);
    this.#keys = newKeys;

    return noChange;
  }
}

export const keyedRows = directive(KeyedRowsDirective) as <T>(
  items: readonly T[],
  keyOf: KeyOf<T>,
  template: TemplateOf<T>,
) => DirectiveResult<typeof KeyedRowsDirective>;
