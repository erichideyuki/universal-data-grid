import type { GridDataSource, GridLoadOptions, GridLoadResult } from '../data/data-source.js';
import { LocalDataSource } from '../data/local-source.js';

export interface FakeCall {
  options: GridLoadOptions;
  signal: AbortSignal;
  /** Terminou (resolveu, falhou ou foi abortada). */
  settled: boolean;
}

/**
 * "Servidor" falso para os testes da frente 08: aplica `GridLoadOptions`
 * sobre um array (`LocalDataSource`) e responde depois de `latency` ms.
 * Respeita o `signal` (rejeita com `AbortError` e solta o timer), a não ser
 * com `ignoreAbort` (simula fonte que ignora o cancelamento — corrida de
 * respostas). `fail` faz os próximos pedidos falharem.
 */
export class FakeSource implements GridDataSource {
  readonly calls: FakeCall[] = [];
  latency: number;
  fail = 0;
  ignoreAbort = false;
  /** Latência por pedido (sobrepõe `latency`). */
  latencyOf: ((options: GridLoadOptions) => number) | undefined;
  readonly #source: LocalDataSource;
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(items: readonly unknown[], latency = 20) {
    this.#source = new LocalDataSource(items);
    this.latency = latency;
  }

  /** Timers ainda pendentes (vazamento). */
  get pendingTimers(): number {
    return this.#timers.size;
  }

  load(options: GridLoadOptions, signal: AbortSignal): Promise<GridLoadResult> {
    const call: FakeCall = { options, signal, settled: false };
    const failing = this.fail > 0;

    this.calls.push(call);

    if (failing) {
      this.fail--;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#timers.delete(timer);
        signal.removeEventListener('abort', onAbort);
        call.settled = true;

        if (failing) {
          reject(new Error('Server error'));
        } else {
          resolve(this.#source.query(options));
        }
      }, this.latencyOf?.(options) ?? this.latency);

      const onAbort = () => {
        if (this.ignoreAbort) {
          return;
        }

        clearTimeout(timer);
        this.#timers.delete(timer);
        call.settled = true;
        reject(new DOMException('Aborted', 'AbortError'));
      };

      this.#timers.add(timer);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

/** Espera `condition` ficar verdadeira (polling por quadro), até `timeout` ms. */
export const waitFor = async (condition: () => boolean, timeout = 3000): Promise<void> => {
  const start = performance.now();

  while (!condition()) {
    if (performance.now() - start > timeout) {
      throw new Error('waitFor: timed out');
    }

    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
