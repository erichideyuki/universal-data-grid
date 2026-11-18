/**
 * `Map`/`Set` com contador de versão (frente 11): o grid percebe mudança do
 * estado comparando versões a cada render, sem varrer o conteúdo nem
 * espalhar marcações por todos os pontos que escrevem nele.
 */
export class VersionedMap<K, V> extends Map<K, V> {
  version = 0;

  override set(key: K, value: V): this {
    if (!super.has(key) || super.get(key) !== value) {
      this.version++;
    }

    return super.set(key, value);
  }

  override delete(key: K): boolean {
    const deleted = super.delete(key);

    if (deleted) {
      this.version++;
    }

    return deleted;
  }

  override clear(): void {
    if (this.size) {
      this.version++;
    }

    super.clear();
  }
}

export class VersionedSet<T> extends Set<T> {
  version = 0;

  override add(value: T): this {
    if (!super.has(value)) {
      this.version++;
    }

    return super.add(value);
  }

  override delete(value: T): boolean {
    const deleted = super.delete(value);

    if (deleted) {
      this.version++;
    }

    return deleted;
  }

  override clear(): void {
    if (this.size) {
      this.version++;
    }

    super.clear();
  }
}
