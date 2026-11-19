/**
 * O motor WebAssembly (`grid-pdf.wasm`, crate `pdf/`) por trás de uma API
 * síncrona. Roda no worker ou na thread principal. Sem imports do grid.
 */

export interface Exports {
  memory: WebAssembly.Memory;
  alloc(len: number): number;
  create(): void;
  add_font(ptr: number, len: number, bold: number, italic: number): number;
  begin(ptr: number, len: number): number;
  add_image(ptr: number, len: number, format: number, width: number, height: number): number;
  push_rows(ptr: number, len: number): number;
  end_input(): void;
  layout(pages: number): number;
  pending_rows(): number;
  page_count(): number;
  rows_done(): number;
  finish(): number;
  take_chunk(): number;
  out_ptr(): number;
  error(): number;
  dispose(): void;
}

/** Códigos de erro do motor (`pdf/src/lib.rs`). */
export const EngineCode = { Invalid: -1, Font: -2, MissingGlyph: -3, Image: -4, State: -5 } as const;

export class EngineError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

const compiled = new Map<string, Promise<WebAssembly.Module>>();

/** Compila o `.wasm` (uma vez por URL). */
export const compileEngine = (url: string): Promise<WebAssembly.Module> => {
  let module = compiled.get(url);

  if (!module) {
    module = (async () => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`could not load ${url} (${response.status})`);
      }

      return typeof WebAssembly.compileStreaming === 'function' && response.headers.get('content-type')?.includes('wasm')
        ? WebAssembly.compileStreaming(response)
        : WebAssembly.compile(await response.arrayBuffer());
    })();
    module.catch(() => compiled.delete(url));
    compiled.set(url, module);
  }

  return module;
};

export class Engine {
  readonly #x: Exports;

  constructor(x: Exports) {
    this.#x = x;
    x.create();
  }

  static async create(module: WebAssembly.Module): Promise<Engine> {
    const instance = await WebAssembly.instantiate(module, {});

    return new Engine(instance.exports as unknown as Exports);
  }

  #put(bytes: Uint8Array): number {
    const ptr = this.#x.alloc(bytes.length);
    new Uint8Array(this.#x.memory.buffer, ptr, bytes.length).set(bytes);
    return ptr;
  }

  #check(code: number): number {
    if (code < 0) {
      const len = this.#x.error();
      const message = new TextDecoder().decode(new Uint8Array(this.#x.memory.buffer, this.#x.out_ptr(), len));
      throw new EngineError(code, message);
    }

    return code;
  }

  addFont(bytes: Uint8Array, bold: boolean, italic: boolean): void {
    this.#check(this.#x.add_font(this.#put(bytes), bytes.length, bold ? 1 : 0, italic ? 1 : 0));
  }

  begin(config: Uint8Array): void {
    this.#check(this.#x.begin(this.#put(config), config.length));
  }

  addImage(bytes: Uint8Array, format: number, width: number, height: number): number {
    return this.#check(this.#x.add_image(this.#put(bytes), bytes.length, format, width, height));
  }

  pushRows(data: Uint8Array): void {
    this.#check(this.#x.push_rows(this.#put(data), data.length));
  }

  endInput(): void {
    this.#x.end_input();
  }

  /** Até `pages` páginas novas; `true` quando terminou (depois de `endInput`). */
  layout(pages: number): boolean {
    return this.#check(this.#x.layout(pages)) === 1;
  }

  get pendingRows(): number {
    return this.#x.pending_rows();
  }

  get pageCount(): number {
    return this.#x.page_count();
  }

  finish(): void {
    this.#check(this.#x.finish());
  }

  /** Blocos prontos do arquivo (cópias: a memória do wasm não guarda o PDF). */
  takeChunks(): Uint8Array[] {
    const chunks: Uint8Array[] = [];
    let len: number;

    while ((len = this.#x.take_chunk()) > 0) {
      chunks.push(new Uint8Array(this.#x.memory.buffer, this.#x.out_ptr(), len).slice());
    }

    return chunks;
  }

  dispose(): void {
    this.#x.dispose();
  }
}
