/**
 * O motor WebAssembly (`grid-pdf.wasm`, crate `pdf/`) por trás de uma API
 * síncrona. Roda no worker ou na thread principal. Sem imports do grid.
 */
export { compileEngine, readFileUrl } from '../export/wasm.js';

export interface Exports {
  memory: WebAssembly.Memory;
  alloc(len: number): number;
  create(deferred: number): void;
  asm_create(): void;
  asm_push(ptr: number, len: number): number;
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

/** Copia `bytes` para a memória do wasm (o motor consome o buffer). */
const put = (x: Exports, bytes: Uint8Array): number => {
  const ptr = x.alloc(bytes.length);
  new Uint8Array(x.memory.buffer, ptr, bytes.length).set(bytes);
  return ptr;
};

/** Código negativo vira `EngineError` com a mensagem do motor. */
const check = (x: Exports, code: number): number => {
  if (code < 0) {
    const len = x.error();
    const message = new TextDecoder().decode(new Uint8Array(x.memory.buffer, x.out_ptr(), len));
    throw new EngineError(code, message);
  }

  return code;
};

/** Blocos prontos (cópias: a memória do wasm não guarda o PDF). */
const takeChunks = (x: Exports): Uint8Array[] => {
  const chunks: Uint8Array[] = [];
  let len: number;

  while ((len = x.take_chunk()) > 0) {
    chunks.push(new Uint8Array(x.memory.buffer, x.out_ptr(), len).slice());
  }

  return chunks;
};

/**
 * O motor: layout e escrita. `deferred`: a saída são segmentos crus (sem
 * deflate nem offsets) para um {@link Assembler} noutro worker, que comprime
 * em paralelo com o layout das próximas linhas.
 */
export class Engine {
  readonly #x: Exports;

  constructor(x: Exports, deferred = false) {
    this.#x = x;
    x.create(deferred ? 1 : 0);
  }

  addFont(bytes: Uint8Array, bold: boolean, italic: boolean): void {
    check(this.#x, this.#x.add_font(put(this.#x, bytes), bytes.length, bold ? 1 : 0, italic ? 1 : 0));
  }

  begin(config: Uint8Array): void {
    check(this.#x, this.#x.begin(put(this.#x, config), config.length));
  }

  addImage(bytes: Uint8Array, format: number, width: number, height: number): number {
    return check(this.#x, this.#x.add_image(put(this.#x, bytes), bytes.length, format, width, height));
  }

  pushRows(data: Uint8Array): void {
    check(this.#x, this.#x.push_rows(put(this.#x, data), data.length));
  }

  endInput(): void {
    this.#x.end_input();
  }

  /** Até `pages` páginas novas; `true` quando terminou (depois de `endInput`). */
  layout(pages: number): boolean {
    return check(this.#x, this.#x.layout(pages)) === 1;
  }

  get pendingRows(): number {
    return this.#x.pending_rows();
  }

  get pageCount(): number {
    return this.#x.page_count();
  }

  finish(): void {
    check(this.#x, this.#x.finish());
  }

  /** Blocos prontos do arquivo (ou segmentos, no modo adiado). */
  takeChunks(): Uint8Array[] {
    return takeChunks(this.#x);
  }

  dispose(): void {
    this.#x.dispose();
  }
}

/** Montador do arquivo a partir dos segmentos de um {@link Engine} adiado (outra instância). */
export class Assembler {
  readonly #x: Exports;

  constructor(x: Exports) {
    this.#x = x;
    x.asm_create();
  }

  /** Consome um bloco de segmentos; `true` depois do fim do documento. */
  push(segments: Uint8Array): boolean {
    return check(this.#x, this.#x.asm_push(put(this.#x, segments), segments.length)) === 1;
  }

  takeChunks(): Uint8Array[] {
    return takeChunks(this.#x);
  }

  dispose(): void {
    this.#x.dispose();
  }
}
