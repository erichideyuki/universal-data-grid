/**
 * Medição de vazamento de memória nos testes de navegador (Chromium).
 *
 * `collectGarbage()` força coleta completa pelo CDP
 * (`HeapProfiler.collectGarbage`). `track()` + `expectCollected()` provam
 * que objetos sem referência foram coletados (via `WeakRef`).
 * `measureHeap()` lê heap JS e contadores do Blink (nós, listeners,
 * documentos) depois de coletar — para comparar com uma linha de base.
 *
 * Cuidados ao escrever o teste: crie e use o grid DENTRO de uma função
 * `async` que devolve só os `WeakRef`s (variáveis locais do teste mantêm o
 * objeto vivo); não guarde o grid em `expect`, mocks ou closures que
 * sobrevivam ao cenário.
 */
import type {} from '@vitest/browser-playwright';
import { cdp } from 'vitest/browser';

/** Próxima tarefa: um `WeakRef` criado na tarefa atual segura o alvo até o fim dela. */
const nextTask = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

export const collectGarbage = async (): Promise<void> => {
  // Duas passadas: a 1ª pode só soltar o que segura o resto (finalizadores,
  // efêmerons de WeakMap).
  for (let i = 0; i < 2; i++) {
    await nextTask();
    await cdp().send('HeapProfiler.collectGarbage');
  }
};

export type Tracked = Record<string, WeakRef<object>>;

/** `WeakRef` de cada objeto, pelo nome que aparece na mensagem de erro. */
export const track = (targets: Record<string, object>): Tracked =>
  Object.fromEntries(Object.entries(targets).map(([name, target]) => [name, new WeakRef(target)]));

/** Nomes dos objetos rastreados que ainda estão vivos depois de coletar. */
export const aliveAfterGc = async (tracked: Tracked, attempts = 3): Promise<string[]> => {
  let alive: string[] = [];

  for (let i = 0; i < attempts; i++) {
    await collectGarbage();
    alive = Object.entries(tracked)
      .filter(([, ref]) => ref.deref() !== undefined)
      .map(([name]) => name);

    if (!alive.length) {
      break;
    }
  }

  return alive;
};

/** Falha listando o que não foi coletado. */
export const expectCollected = async (tracked: Tracked): Promise<void> => {
  const alive = await aliveAfterGc(tracked);

  if (alive.length) {
    throw new Error(`Não coletados (vazamento): ${alive.join(', ')}`);
  }
};

export interface HeapSample {
  /** Heap JS usado (bytes) do isolate do V8 — inclui o orquestrador do Vitest. */
  jsHeapUsed: number;
  /** Nós DOM vivos no processo (inclui os desconectados ainda não coletados). */
  nodes: number;
  /** Listeners de evento JS registrados. */
  listeners: number;
  documents: number;
}

let performanceEnabled = false;

/** Coleta e lê heap e contadores do Blink. */
export const measureHeap = async (): Promise<HeapSample> => {
  await collectGarbage();

  const session = cdp();

  if (!performanceEnabled) {
    await session.send('Performance.enable');
    performanceEnabled = true;
  }

  const { usedSize } = await session.send('Runtime.getHeapUsage');
  const { metrics } = await session.send('Performance.getMetrics');
  const metric = (name: string): number => metrics.find(m => m.name === name)?.value ?? Number.NaN;

  return {
    jsHeapUsed: usedSize,
    nodes: metric('Nodes'),
    listeners: metric('JSEventListeners'),
    documents: metric('Documents'),
  };
};

/** Diferença `after - before`, campo a campo. */
export const heapDelta = (before: HeapSample, after: HeapSample): HeapSample => ({
  jsHeapUsed: after.jsHeapUsed - before.jsHeapUsed,
  nodes: after.nodes - before.nodes,
  listeners: after.listeners - before.listeners,
  documents: after.documents - before.documents,
});

/** `n` em KiB, para mensagens. */
export const kib = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KiB`;
