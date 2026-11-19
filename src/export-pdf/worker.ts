/**
 * Web Worker da exportação PDF: recebe fontes, configuração, imagens e blocos
 * de linhas; devolve os blocos do arquivo assim que ficam prontos.
 */
import type { Request, Response } from './client.js';
import { compileEngine, Engine, EngineError } from './engine.js';

interface WorkerScope {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(message: Response, transfer?: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;
let engine: Engine | null = null;

const reply = (message: Response, transfer: Transferable[] = []) => scope.postMessage(message, transfer);

const chunks = (e: Engine): ArrayBuffer[] => e.takeChunks().map(c => c.buffer as ArrayBuffer);

scope.onmessage = async (event: MessageEvent<Request>) => {
  const r = event.data;

  try {
    switch (r.op) {
      case 'init': {
        engine = new Engine((await WebAssembly.instantiate(await compileEngine(r.wasmUrl), {})).exports as unknown as ConstructorParameters<typeof Engine>[0]);
        reply({ id: r.id, ok: true });
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
