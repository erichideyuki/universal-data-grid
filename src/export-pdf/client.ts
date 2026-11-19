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
  /** Entrega um bloco de linhas (passa a ser do cliente) e espera o layout dele (`last`: fecha a entrada). */
  rows(data: Uint8Array, last: boolean): Promise<RowsResult>;
  finish(): Promise<Uint8Array[]>;
  dispose(): void;
}

/** Pedido ao worker. */
export type WorkerRequest =
  | { id: number; op: 'init'; module: WebAssembly.Module; role: 'engine' | 'assembler'; deferred: boolean }
  | { id: number; op: 'segments'; data: ArrayBuffer[] }
  | { id: number; op: 'font'; bytes: ArrayBuffer; bold: boolean; italic: boolean }
  | { id: number; op: 'begin'; config: ArrayBuffer }
  | { id: number; op: 'image'; bytes: ArrayBuffer; format: number; width: number; height: number }
  | { id: number; op: 'rows'; data: ArrayBuffer; last: boolean }
  | { id: number; op: 'finish' };

/** Pedido sem o `id` (cada variante). */
type RequestBody = { [K in WorkerRequest['op']]: Omit<Extract<WorkerRequest, { op: K }>, 'id'> }[WorkerRequest['op']];

/** Resposta do worker. */
export type WorkerResponse =
  | { id: number; ok: true; value?: number; chunks?: ArrayBuffer[]; pages?: number; done?: boolean }
  | { id: number; ok: false; code: number; message: string };

/** Orçamento de uma fatia na thread principal (ms). */
const SLICE_MS = 8;

/** Na thread principal: layout em fatias com `scheduler.yield()` entre elas. */
export const localClient = async (wasmUrl: string): Promise<Client> => {
  const engine = new Engine(
    (await WebAssembly.instantiate(await compileEngine(wasmUrl), {})).exports as unknown as ConstructorParameters<typeof Engine>[0],
  );

  // erro síncrono do motor vira promessa rejeitada
  const run = <T>(f: () => T): Promise<T> => new Promise<T>(resolve => resolve(f()));

  return {
    addFont: (bytes, bold, italic) => run(() => engine.addFont(bytes, bold, italic)),
    begin: config => run(() => engine.begin(config)),
    addImage: (bytes, format, width, height) => run(() => engine.addImage(bytes, format, width, height)),
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
    finish: () => run(() => {
      engine.finish();
      return engine.takeChunks();
    }),
    dispose: () => engine.dispose(),
  };
};

/** Cópia do conteúdo num `ArrayBuffer` próprio (pode ser transferido sem esvaziar o do hospedeiro). */
const own = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer;

/** Canal de pedidos a um worker: cada pedido com `id`, resposta casada pelo `id`. */
const channel = (worker: Worker) => {
  let next = 0;
  const pending = new Map<number, { resolve: (r: WorkerResponse & { ok: true }) => void; reject: (e: unknown) => void }>();

  const fail = (error: unknown) => {
    for (const p of pending.values()) {
      p.reject(error);
    }

    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
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

  const call = (request: RequestBody, transfer: Transferable[] = []): Promise<WorkerResponse & { ok: true }> => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...request, id }, transfer);
  });

  return { call, fail };
};

/** Montagens em voo antes de o motor esperar (limita os segmentos crus na fila do montador). */
const ASSEMBLER_INFLIGHT = 2;

/**
 * Em Web Workers: o motor faz o layout e entrega segmentos crus; o montador
 * (segundo worker) comprime e escreve o arquivo, em paralelo com o layout das
 * próximas linhas. Encerrar (`dispose`) rejeita o pedido pendente com
 * `AbortError`.
 */
export const workerClient = async (worker: Worker, assemblerWorker: Worker, wasmUrl: string): Promise<Client> => {
  const engine = channel(worker);
  const asm = channel(assemblerWorker);
  // o módulo compilado uma vez na thread principal (o código e a otimização ficam entre exportações)
  const module = await compileEngine(wasmUrl);
  await Promise.all([
    engine.call({ op: 'init', module, role: 'engine', deferred: true }),
    asm.call({ op: 'init', module, role: 'assembler', deferred: false }),
  ]);

  // blocos do arquivo na ordem em que o montador os devolve; montagens em voo, na ordem
  const ready: Uint8Array[] = [];
  const inflight: Promise<unknown>[] = [];
  let done = false;

  const assemble = (segments: ArrayBuffer[]) => {
    const p = asm.call({ op: 'segments', data: segments }, segments).then(r => {
      ready.push(...(r.chunks ?? []).map(c => new Uint8Array(c)));
      done ||= !!r.done;
    });
    // falha tratada no próximo `await` dela (sem "unhandled rejection")
    p.catch(() => undefined);
    inflight.push(p);
  };

  const drain = async (keep: number) => {
    while (inflight.length > keep) {
      await inflight.shift();
    }
  };

  return {
    addFont: async (bytes, bold, italic) => {
      const buffer = own(bytes);
      await engine.call({ op: 'font', bytes: buffer, bold, italic }, [buffer]);
    },
    begin: async config => {
      const buffer = own(config);
      await engine.call({ op: 'begin', config: buffer }, [buffer]);
    },
    addImage: async (bytes, format, width, height) => {
      const buffer = own(bytes);
      return (await engine.call({ op: 'image', bytes: buffer, format, width, height }, [buffer])).value ?? 0;
    },
    rows: async (data, last) => {
      // o bloco é do cliente a partir daqui: transfere sem copiar quando ocupa o buffer inteiro
      const buffer = data.byteOffset === 0 && data.byteLength === data.buffer.byteLength ? data.buffer as ArrayBuffer : own(data);
      const r = await engine.call({ op: 'rows', data: buffer, last }, [buffer]);
      assemble(r.chunks ?? []);
      await drain(ASSEMBLER_INFLIGHT);
      return { chunks: ready.splice(0), pages: r.pages ?? 0, done: !!r.done };
    },
    finish: async () => {
      assemble((await engine.call({ op: 'finish' })).chunks ?? []);
      await drain(0);

      if (!done) {
        throw new Error('PDF assembler did not finish the file');
      }

      return ready.splice(0);
    },
    dispose: () => {
      worker.terminate();
      assemblerWorker.terminate();
      const abort = new DOMException('The PDF export was aborted.', 'AbortError');
      engine.fail(abort);
      asm.fail(abort);
    },
  };
};
