/**
 * Web Worker da exportação PDF, em um de dois papéis: o motor (fontes,
 * configuração, imagens e blocos de linhas → segmentos do arquivo) ou o
 * montador (segmentos → blocos do arquivo comprimido).
 */
import type { WorkerRequest, WorkerResponse } from './client.js';
import { Assembler, Engine, EngineError, type Exports } from './engine.js';

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
let engine: Engine | null = null;
let assembler: Assembler | null = null;

const reply = (message: WorkerResponse, transfer: Transferable[] = []) => scope.postMessage(message, transfer);

const chunks = (e: Engine | Assembler): ArrayBuffer[] => e.takeChunks().map(c => c.buffer as ArrayBuffer);

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const r = event.data;

  try {
    switch (r.op) {
      case 'init': {
        const exports = (await WebAssembly.instantiate(r.module, {})).exports as unknown as Exports;

        if (r.role === 'assembler') {
          assembler = new Assembler(exports);
        } else {
          engine = new Engine(exports, r.deferred);
        }

        reply({ id: r.id, ok: true });
        break;
      }

      case 'segments': {
        const a = assembler!;
        let done = false;

        for (const data of r.data) {
          done = a.push(new Uint8Array(data));
        }

        const out = chunks(a);
        reply({ id: r.id, ok: true, chunks: out, done }, out);

        if (done) {
          a.dispose();
          assembler = null;
        }

        break;
      }

      case 'font':
        engine!.addFont(new Uint8Array(r.bytes), r.bold, r.italic);
        reply({ id: r.id, ok: true });
        break;

      case 'begin':
        engine!.begin(new Uint8Array(r.config));
        reply({ id: r.id, ok: true });
        break;

      case 'image':
        reply({ id: r.id, ok: true, value: engine!.addImage(new Uint8Array(r.bytes), r.format, r.width, r.height) });
        break;

      case 'rows': {
        const e = engine!;
        e.pushRows(new Uint8Array(r.data));

        if (r.last) {
          e.endInput();
        }

        let done = false;

        do {
          done = e.layout(20);
        } while (!done && e.pendingRows > 0);

        const out = chunks(e);
        reply({ id: r.id, ok: true, chunks: out, pages: e.pageCount, done }, out);
        break;
      }

      case 'finish': {
        const e = engine!;
        e.finish();
        const out = chunks(e);
        reply({ id: r.id, ok: true, chunks: out }, out);
        e.dispose();
        engine = null;
        break;
      }
    }
  } catch (error) {
    reply({
      id: r.id,
      ok: false,
      code: error instanceof EngineError ? error.code : -1,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
