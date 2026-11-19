/**
 * O motor de um lado só: no Web Worker (mensagens) ou na thread principal
 * (fatias de tempo). A API é a mesma; o PDF volta em blocos.
 */
import { yieldToHost } from '../export/slice.js';
import { compileEngine, Engine, EngineError } from './engine.js';

export interface RowsResult {
  chunks: Uint8Array[];
  pages: number;
  done: boolean;
}

export interface Client {
  addFont(bytes: Uint8Array, bold: boolean, italic: boolean): Promise<void>;
  begin(config: Uint8Array): Promise<void>;
  addImage(bytes: Uint8Array, format: number, width: number, height: number): Promise<number>;
  /** Entrega um bloco de linhas e espera o layout dele (`last`: fecha a entrada). */
  rows(data: Uint8Array, last: boolean): Promise<RowsResult>;
  finish(): Promise<Uint8Array[]>;
  dispose(): void;
}

/** Pedido ao worker. */
export type Request =
  | { id: number; op: 'init'; wasmUrl: string }
  | { id: number; op: 'font'; bytes: ArrayBuffer; bold: boolean; italic: boolean }
  | { id: number; op: 'begin'; config: ArrayBuffer }
  | { id: number; op: 'image'; bytes: ArrayBuffer; format: number; width: number; height: number }
  | { id: number; op: 'rows'; data: ArrayBuffer; last: boolean }
  | { id: number; op: 'finish' };

/** Pedido sem o `id` (cada variante). */
type RequestBody = { [K in Request['op']]: Omit<Extract<Request, { op: K }>, 'id'> }[Request['op']];

/** Resposta do worker. */
export type Response =
  | { id: number; ok: true; value?: number; chunks?: ArrayBuffer[]; pages?: number; done?: boolean }
  | { id: number; ok: false; code: number; message: string };

/** Orçamento de uma fatia na thread principal (ms). */
const SLICE_MS = 8;

/** Na thread principal: layout em fatias com `scheduler.yield()` entre elas. */
export const localClient = async (wasmUrl: string): Promise<Client> => {
  const engine = new Engine(
    (await WebAssembly.instantiate(await compileEngine(wasmUrl), {})).exports as unknown as ConstructorParameters<typeof Engine>[0],
  );

  return {
    addFont: async (bytes, bold, italic) => engine.addFont(bytes, bold, italic),
    begin: async config => engine.begin(config),
    addImage: async (bytes, format, width, height) => engine.addImage(bytes, format, width, height),
    rows: async (data, last) => {
      engine.pushRows(data);

      if (last) {
        engine.endInput();
      }

      let done = false;
      const chunks: Uint8Array[] = [];

      for (;;) {
        const start = performance.now();

        do {
          done = engine.layout(1);
        } while (!done && engine.pendingRows > 0 && performance.now() - start < SLICE_MS);

        chunks.push(...engine.takeChunks());

        if (done || engine.pendingRows === 0) {
          break;
        }

        await yieldToHost();
      }

      return { chunks, pages: engine.pageCount, done };
    },
    finish: async () => {
      engine.finish();
      return engine.takeChunks();
    },
    dispose: () => engine.dispose(),
  };
};

/** Cópia do conteúdo num `ArrayBuffer` próprio (pode ser transferido sem esvaziar o do hospedeiro). */
const own = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer;

/** No Web Worker. Encerrar (`dispose`) rejeita o pedido pendente com `AbortError`. */
export const workerClient = async (worker: Worker, wasmUrl: string): Promise<Client> => {
  let next = 0;
  const pending = new Map<number, { resolve: (r: Response & { ok: true }) => void; reject: (e: unknown) => void }>();

  const fail = (error: unknown) => {
    for (const p of pending.values()) {
      p.reject(error);
    }

    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<Response>) => {
    const r = event.data;
    const p = pending.get(r.id);

    if (!p) {
      return;
    }

    pending.delete(r.id);

    if (r.ok) {
      p.resolve(r);
    } else {
      p.reject(new EngineError(r.code, r.message));
    }
  };
  worker.onerror = event => {
    event.preventDefault();
    fail(new Error(`PDF worker failed: ${event.message || 'unknown error'}`));
  };

  const call = (request: RequestBody, transfer: Transferable[] = []): Promise<Response & { ok: true }> => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...request, id }, transfer);
  });

  await call({ op: 'init', wasmUrl });

  return {
    addFont: async (bytes, bold, italic) => {
      const buffer = own(bytes);
      await call({ op: 'font', bytes: buffer, bold, italic }, [buffer]);
    },
    begin: async config => {
      const buffer = own(config);
      await call({ op: 'begin', config: buffer }, [buffer]);
    },
    addImage: async (bytes, format, width, height) => {
      const buffer = own(bytes);
      return (await call({ op: 'image', bytes: buffer, format, width, height }, [buffer])).value ?? 0;
    },
    rows: async (data, last) => {
      const buffer = own(data);
      const r = await call({ op: 'rows', data: buffer, last }, [buffer]);
      return { chunks: (r.chunks ?? []).map(c => new Uint8Array(c)), pages: r.pages ?? 0, done: !!r.done };
    },
    finish: async () => ((await call({ op: 'finish' })).chunks ?? []).map(c => new Uint8Array(c)),
    dispose: () => {
      worker.terminate();
      fail(new DOMException('The PDF export was aborted.', 'AbortError'));
    },
  };
};
