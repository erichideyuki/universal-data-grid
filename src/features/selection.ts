/**
 * Estado da seleção de linhas, por CHAVE (sem `keyExpr`, a frente 08, a
 * chave é o próprio objeto do item). Sem DOM: o grid decide quais chaves
 * entram e dispara os eventos com o que `commit` devolve.
 *
 * A ordem é a da seleção (o `Set` guarda a ordem de inserção). Chaves que
 * não estão em `items` ficam guardadas — a seleção sobrevive a filtro e a
 * troca de `items` — e são soltas por `clear`/`deselect`.
 */

/** Selection mode of `<u-grid>` (attribute `selection-mode`). */
export type GridSelectionMode = 'none' | 'single' | 'multiple';

export const normalizeSelectionMode = (mode: unknown): GridSelectionMode =>
  mode === 'single' || mode === 'multiple' ? mode : 'none';

export interface SelectionChange {
  selectedKeys: readonly unknown[];
  previous: readonly unknown[];
  added: readonly unknown[];
  removed: readonly unknown[];
}

export class SelectionModel {
  #keys = new Set<unknown>();
  /** Array congelado devolvido por `keys` (mesma instância até mudar). */
  #frozen: readonly unknown[] | undefined = Object.freeze([]);
  /** Muda a cada alteração: quem guarda contagens derivadas compara. */
  version = 0;

  get size(): number {
    return this.#keys.size;
  }

  get keys(): readonly unknown[] {
    this.#frozen ??= Object.freeze([...this.#keys]);
    return this.#frozen;
  }

  has(key: unknown): boolean {
    return this.#keys.has(key);
  }

  /**
   * Troca o conjunto inteiro. Devolve a mudança (ou `undefined` se nada
   * mudou); `previous` é o array congelado anterior.
   */
  replace(keys: Iterable<unknown>): SelectionChange | undefined {
    const next = new Set(keys);
    const added: unknown[] = [];
    const removed: unknown[] = [];

    for (const key of next) {
      if (!this.#keys.has(key)) {
        added.push(key);
      }
    }

    for (const key of this.#keys) {
      if (!next.has(key)) {
        removed.push(key);
      }
    }

    if (!added.length && !removed.length) {
      return undefined;
    }

    return this.#commit(next, added, removed);
  }

  /** Acrescenta `keys` (as já selecionadas mantêm a posição). */
  add(keys: Iterable<unknown>): SelectionChange | undefined {
    const added: unknown[] = [];
    let next: Set<unknown> | undefined;

    for (const key of keys) {
      if (this.#keys.has(key) || next?.has(key)) {
        continue;
      }

      next ??= new Set(this.#keys);
      next.add(key);
      added.push(key);
    }

    return next ? this.#commit(next, added, []) : undefined;
  }

  remove(keys: Iterable<unknown>): SelectionChange | undefined {
    const removed: unknown[] = [];
    let next: Set<unknown> | undefined;

    for (const key of keys) {
      if (!(next ?? this.#keys).has(key)) {
        continue;
      }

      next ??= new Set(this.#keys);
      next.delete(key);
      removed.push(key);
    }

    return next ? this.#commit(next, [], removed) : undefined;
  }

  #commit(next: Set<unknown>, added: unknown[], removed: unknown[]): SelectionChange {
    const previous = this.keys;

    this.#keys = next;
    this.#frozen = undefined;
    this.version++;

    return { selectedKeys: this.keys, previous, added, removed };
  }
}

/** Conta quantos de `keys` estão selecionados (para o estado do "selecionar tudo"). */
export const countSelected = (selection: SelectionModel, items: readonly unknown[], keyOf?: (item: unknown) => unknown): number => {
  if (!selection.size) {
    return 0;
  }

  let count = 0;

  for (const item of items) {
    if (selection.has(keyOf ? keyOf(item) : item)) {
      count++;
    }
  }

  return count;
};
