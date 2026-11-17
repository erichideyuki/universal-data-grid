import { type ChildPart, noChange } from 'lit';
import {
  clearPart,
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
  #parts: ChildPart[] = [];
  #keys: unknown[] = [];

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
    let oldParts = this.#parts;
    let oldKeys = this.#keys;

    // A parte mostrava outra coisa (ex.: "sem dados") ou é a 1ª vez: limpa.
    if (getCommittedValue(containerPart) !== oldParts) {
      clearPart(containerPart);
      oldParts = [];
      oldKeys = [];
    }

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
    this.#parts = newParts;
    this.#keys = newKeys;

    return noChange;
  }
}

export const keyedRows = directive(KeyedRowsDirective) as <T>(
  items: readonly T[],
  keyOf: KeyOf<T>,
  template: TemplateOf<T>,
) => DirectiveResult<typeof KeyedRowsDirective>;
