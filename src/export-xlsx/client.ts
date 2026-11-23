/**
 * O motor de um lado só: no Web Worker (mensagens) ou na thread principal.
 * A API é a mesma; o arquivo volta inteiro no fim (o `uo-xlsx` comprime as
 * linhas enquanto chegam, então o que fica para o `finish` é pouco).
 */
import { compileEngine } from '../export/wasm.js';
import { type Exports, XlsxEngine, XlsxEngineError, type XlsxStats } from './engine.js';

export interface XlsxClient {
  begin(config: Uint8Array): Promise<void>;
  /** Entrega um bloco (passa a ser do cliente) e espera a escrita dele; devolve as linhas escritas. */
  append(block: Uint8Array): Promise<number>;
  finish(): Promise<{ file: Uint8Array; stats: XlsxStats }>;
  /** `true`: os blocos rodam na thread principal (o chamador os faz pequenos e cede a vez entre eles). */
  readonly local: boolean;
  dispose(): void;
}

/** Pedido ao worker. */
export type XlsxWorkerRequest =
  | { id: number; op: 'init'; module: WebAssembly.Module }
  | { id: number; op: 'begin'; config: ArrayBuffer }
  | { id: number; op: 'append'; block: ArrayBuffer }
  | { id: number; op: 'finish' };

/** Pedido sem o `id` (cada variante). */
type RequestBody = { [K in XlsxWorkerRequest['op']]: Omit<Extract<XlsxWorkerRequest, { op: K }>, 'id'> }[XlsxWorkerRequest['op']];

/** Resposta do worker. */
export type XlsxWorkerResponse =
  | { id: number; ok: true; value?: number; file?: ArrayBuffer; stats?: XlsxStats }
  | { id: number; ok: false; code: number; message: string };

/** Na thread principal: cada bloco é uma chamada síncrona ao motor. */
export const localClient = async (wasmUrl: string): Promise<XlsxClient> => {
  const engine = new XlsxEngine((await WebAssembly.instantiate(await compileEngine(wasmUrl), {})).exports as unknown as Exports);

  // erro síncrono do motor vira promessa rejeitada
  const run = <T>(f: () => T): Promise<T> => new Promise<T>(resolve => resolve(f()));

  return {
    local: true,
    begin: config => run(() => engine.begin(config)),
    append: block => run(() => engine.append(block)),
    finish: () => run(() => engine.finish()),
    dispose: () => engine.dispose(),
  };
};

/** Cópia do conteúdo num `ArrayBuffer` próprio (pode ser transferido). */
const own = (bytes: Uint8Array): ArrayBuffer =>
  bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer as ArrayBuffer : bytes.slice().buffer;

/**
 * Num Web Worker: pedidos com `id`, respostas casadas pelo `id`. Encerrar
 * (`dispose`) termina o worker e rejeita o pedido pendente com `AbortError`.
 */
export const workerClient = async (worker: Worker, wasmUrl: string): Promise<XlsxClient> => {
  let next = 0;
  const pending = new Map<number, { resolve: (r: XlsxWorkerResponse & { ok: true }) => void; reject: (e: unknown) => void }>();

  const fail = (error: unknown) => {
    for (const p of pending.values()) {
      p.reject(error);
    }

    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<XlsxWorkerResponse>) => {
    const r = event.data;
    const p = pending.get(r.id);

    if (!p) {
      return;
    }

    pending.delete(r.id);

    if (r.ok) {
      p.resolve(r);
    } else {
      p.reject(new XlsxEngineError(r.code, r.message));
    }
  };

  worker.onerror = event => {
    event.preventDefault();
    fail(new Error(`xlsx worker failed: ${event.message || 'unknown error'}`));
  };

  const call = (request: RequestBody, transfer: Transferable[] = []): Promise<XlsxWorkerResponse & { ok: true }> => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...request, id }, transfer);
  });

  // o módulo compilado uma vez na thread principal (o código e a otimização ficam entre exportações)
  await call({ op: 'init', module: await compileEngine(wasmUrl) });

  return {
    local: false,
    begin: async config => {
      const buffer = own(config);
      await call({ op: 'begin', config: buffer }, [buffer]);
    },
    append: async block => {
      const buffer = own(block);
      return (await call({ op: 'append', block: buffer }, [buffer])).value ?? 0;
    },
    finish: async () => {
      const r = await call({ op: 'finish' });
      return { file: new Uint8Array(r.file!), stats: r.stats ?? { droppedLinks: 0, cutTexts: 0 } };
    },
    dispose: () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      fail(new DOMException('The xlsx export was aborted.', 'AbortError'));
    },
  };
};
