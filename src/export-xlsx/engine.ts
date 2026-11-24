/**
 * O motor WebAssembly (`grid-xlsx.wasm`, crate `xlsx/`, sobre o `uo-xlsx` do
 * Universal Office) por trás de uma API síncrona. Roda no worker ou na thread
 * principal. Sem imports do grid.
 */

export interface Exports {
  memory: WebAssembly.Memory;
  alloc(len: number): number;
  create(): void;
  begin(ptr: number, len: number): number;
  append(ptr: number, len: number): number;
  finish(ptr: number, len: number): number;
  rows_written(): number;
  dropped_links(): number;
  cut_texts(): number;
  file_ptr(): number;
  out_ptr(): number;
  error(): number;
  dispose(): void;
}

/** Códigos de erro do motor (`xlsx/src/lib.rs`). */
export const XlsxEngineCode = { Invalid: -1, Limit: -2, State: -5 } as const;

export class XlsxEngineError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/** O que o motor conta e o JS avisa no fim. */
export interface XlsxStats {
  droppedLinks: number;
  cutTexts: number;
}

/** Copia `bytes` para a memória do wasm (o motor consome o buffer). */
const put = (x: Exports, bytes: Uint8Array): number => {
  const ptr = x.alloc(bytes.length);
  new Uint8Array(x.memory.buffer, ptr, bytes.length).set(bytes);
  return ptr;
};

/** Código negativo vira `XlsxEngineError` com a mensagem do motor. */
const check = (x: Exports, code: number): number => {
  if (code < 0) {
    const len = x.error();
    const message = new TextDecoder().decode(new Uint8Array(x.memory.buffer, x.out_ptr(), len));
    throw new XlsxEngineError(code, message);
  }

  return code;
};

/** Uma exportação: `begin` → `append`… → `finish`. */
export class XlsxEngine {
  readonly #x: Exports;

  constructor(x: Exports) {
    this.#x = x;
    x.create();
  }

  begin(config: Uint8Array): void {
    check(this.#x, this.#x.begin(put(this.#x, config), config.length));
  }

  /** Estilos novos e linhas; devolve as linhas escritas. */
  append(block: Uint8Array): number {
    return check(this.#x, this.#x.append(put(this.#x, block), block.length));
  }

  /** O arquivo (cópia: a memória do wasm não o guarda) e as contagens; `filter` = o AutoFilter (protocolo do motor). */
  finish(filter?: Uint8Array): { file: Uint8Array; stats: XlsxStats } {
    const x = this.#x;
    const stats = { droppedLinks: x.dropped_links(), cutTexts: x.cut_texts() };
    const len = check(x, filter?.length ? x.finish(put(x, filter), filter.length) : x.finish(0, 0));
    const file = new Uint8Array(x.memory.buffer, x.file_ptr(), len).slice();
    return { file, stats };
  }

  dispose(): void {
    this.#x.dispose();
  }
}
