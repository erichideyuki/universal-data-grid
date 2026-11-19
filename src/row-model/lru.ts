/**
 * Cache com limite de entradas (descarta a usada há mais tempo). Para caches
 * de módulo cujas chaves vêm do hospedeiro (idioma, opções de formato): sem
 * limite, cresceriam a cada idioma/opção nova enquanto a página viver.
 */
export class LruCache<K, V> {
  readonly #entries = new Map<K, V>();
  readonly #limit: number;

  constructor(limit: number) {
    this.#limit = limit;
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: K): V | undefined {
    const value = this.#entries.get(key);

    if (value !== undefined) {
      // reinsere: a ordem do Map é a ordem de uso
      this.#entries.delete(key);
      this.#entries.set(key, value);
    }

    return value;
  }

  /** Entradas da menos para a mais usada, sem mexer na ordem. */
  entries(): IterableIterator<[K, V]> {
    return this.#entries.entries();
  }

  /** Troca o valor de uma entrada existente sem mexer na ordem de uso. */
  replace(key: K, value: V): void {
    if (this.#entries.has(key)) {
      this.#entries.set(key, value);
    }
  }

  clear(): void {
    this.#entries.clear();
  }

  delete(key: K): void {
    this.#entries.delete(key);
  }

  set(key: K, value: V): void {
    this.#entries.delete(key);
    this.#entries.set(key, value);

    if (this.#entries.size > this.#limit) {
      this.#entries.delete(this.#entries.keys().next().value as K);
    }
  }
}
