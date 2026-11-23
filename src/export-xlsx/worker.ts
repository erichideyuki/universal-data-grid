/**
 * Web Worker da exportação xlsx: configuração e blocos de linhas → o motor
 * (`grid-xlsx.wasm`) → o arquivo, devolvido no fim (transferido, sem cópia).
 */
import type { XlsxWorkerRequest, XlsxWorkerResponse } from './client.js';
import { type Exports, XlsxEngine, XlsxEngineError } from './engine.js';

interface WorkerScope {
  onmessage: ((event: MessageEvent<XlsxWorkerRequest>) => void) | null;
  postMessage(message: XlsxWorkerResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
let engine: XlsxEngine | null = null;

const reply = (message: XlsxWorkerResponse, transfer: Transferable[] = []) => scope.postMessage(message, transfer);

scope.onmessage = async (event: MessageEvent<XlsxWorkerRequest>) => {
  const r = event.data;

  try {
    switch (r.op) {
      case 'init':
        engine = new XlsxEngine((await WebAssembly.instantiate(r.module, {})).exports as unknown as Exports);
        reply({ id: r.id, ok: true });
        break;

      case 'begin':
        engine!.begin(new Uint8Array(r.config));
        reply({ id: r.id, ok: true });
        break;

      case 'append':
        reply({ id: r.id, ok: true, value: engine!.append(new Uint8Array(r.block)) });
        break;

      case 'finish': {
        const e = engine!;
        const { file, stats } = e.finish();
        e.dispose();
        engine = null;
        reply({ id: r.id, ok: true, file: file.buffer as ArrayBuffer, stats }, [file.buffer]);
        break;
      }
    }
  } catch (error) {
    reply({
      id: r.id,
      ok: false,
      code: error instanceof XlsxEngineError ? error.code : -1,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
