/**
 * Fatias de tempo para exportar sem travar a interface (frente 12, spec 16):
 * o laço chama `maybeYield()` a cada linha; passado o orçamento, devolve o
 * controle ao navegador (eventos, pintura) e continua na próxima tarefa.
 */

/** Orçamento de uma fatia, em ms de relógio — numa máquina 4× mais lenta continua abaixo de 50 ms. */
export const SLICE_MS = 8;

/** Linhas entre duas leituras do relógio (`performance.now()` custa). */
const CHECK_EVERY = 256;

interface HostScheduler {
  yield?: () => Promise<void>;
}

/** Próxima tarefa: `scheduler.yield()` quando existe (mantém a prioridade), senão um `setTimeout`. */
export const yieldToHost = (): Promise<void> => {
  const scheduler = typeof window === 'undefined' ? undefined : (window as { scheduler?: HostScheduler }).scheduler;

  return scheduler?.yield
    ? scheduler.yield()
    : new Promise(resolve => setTimeout(resolve, 0));
};

export interface Slicer {
  /** Conta uma unidade de trabalho; devolve uma promessa quando é hora de ceder a vez (senão `undefined`). */
  tick(): Promise<void> | undefined;
}

export const createSlicer = (budget = SLICE_MS, now: () => number = () => performance.now()): Slicer => {
  let count = 0;
  let start = now();

  return {
    tick: () => {
      if (++count < CHECK_EVERY) {
        return undefined;
      }

      count = 0;

      if (now() - start < budget) {
        return undefined;
      }

      return yieldToHost().then(() => {
        start = now();
      });
    },
  };
};
