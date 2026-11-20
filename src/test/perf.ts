/**
 * Harness de desempenho no perfil de "máquina fraca" (spec 16).
 *
 * O projeto `perf` do `vitest.config.ts` abre o Chromium sem GPU, com heap de
 * 1 GiB e viewport 1366×768. A CPU fraca é emulada assim:
 *
 * Modo normalizado (padrão, o que vale para orçamento e linha de base): mede
 * o TRABALHO do quadro/interação (script, estilo e layout) sem estrangular e
 * multiplica pelo fator `slowdown` = {@link BENCH_REFERENCE_MS} ÷ tempo do
 * {@link benchmark} nesta máquina, agora. O micro-benchmark fixo define a
 * máquina fraca (4× o desktop do usuário); máquina mais rápida, mais lenta
 * ou ocupada dá o mesmo número.
 *
 * Modo CDP (`PERF_CPU_RATE=n`): estrangula de verdade pelo
 * `Emulation.setCPUThrottlingRate` e não multiplica. Para inspecionar; não
 * compara com a linha de base. No Windows o estrangulamento do CDP é
 * superlinear e instável (spec 16), por isso não é o padrão.
 *
 * Uso: `const perf = await startPerf()` no `beforeAll`; `perf.throttle()`
 * depois de gerar os dados (só age no modo CDP); `perf.report('cenário',
 * métricas)` confere contra a linha de base; `await perf.finish()` no
 * `afterAll` grava `perf-results.json`.
 */
import type {} from '@vitest/browser-playwright';
import { cdp, commands } from 'vitest/browser';

import type { DataGrid } from '../grid.js';
import { measureHeap } from './leak.js';

type PerfMetrics = Record<string, Record<string, number>>;

declare module 'vitest/browser' {
  interface BrowserCommands {
    perfSetup: () => Promise<{ baseline: PerfMetrics; update: boolean; cpuRate?: number }>;
    perfRecord: (results: PerfMetrics) => Promise<void>;
  }
}

/**
 * Tempo (mediana, ms) do {@link benchmark} na máquina fraca de referência:
 * 4× o da máquina do usuário (desktop recente, 10–12,6 ms; 11,5 ms de
 * referência) — o 4× do perfil "mobile" do Lighthouse. Medido em 2026-11-18.
 */
export const BENCH_REFERENCE_MS = 46;

/** Faixa aceita para o fator calculado. */
const MIN_SLOWDOWN = 1;
const MAX_SLOWDOWN = 20;

let sink = 0;

/**
 * Micro-benchmark fixo e determinístico: o que o row model faz (objetos,
 * textos, `Map`, ordenação por comparação). Devolve ms.
 */
export const benchmarkOnce = (): number => {
  const start = performance.now();
  const rows: { id: number; name: string; value: number }[] = [];

  for (let i = 0; i < 40_000; i++) {
    rows.push({ id: i, name: `item ${(i * 7919) % 40_000}`, value: (i * 2_654_435_761) % 1000 });
  }

  const byName = new Map<string, { id: number }>();

  for (const row of rows) {
    byName.set(row.name, row);
  }

  rows.sort((a, b) => a.value - b.value || a.id - b.id);

  let checksum = 0;

  for (const row of rows) {
    checksum += row.value + byName.get(row.name)!.id;
  }

  sink = checksum;
  return performance.now() - start;
};

/** Mediana de `runs` execuções, depois de aquecer o JIT. */
export const benchmark = (runs = 9): number => {
  benchmarkOnce();
  benchmarkOnce();
  const times = Array.from({ length: runs }, benchmarkOnce);

  return percentile(times, 50) + sink * 0;
};

/**
 * Antes de uma medida longa (exportação em fatias): coleta o lixo dos
 * cenários anteriores. A maior fatia é um MÁXIMO — uma pausa de GC que caia
 * no meio dela (lixo de outra medida) passa por trabalho do código medido.
 */
export const quietHeap = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
  await cdp().send('HeapProfiler.collectGarbage');
};

/**
 * Melhor de `repeats` execuções de uma medida ruidosa, depois de `warmUp`
 * execuções descartadas (JIT, caches de formatação) e com o heap coletado
 * antes de cada uma. O ruído (carga da máquina, GC) só SOMA tempo: o mínimo
 * por métrica é o estimador estável; a mediana mostra o espalhamento.
 */
export const bestOfQuiet = async <T extends Record<string, number>>(
  measure: () => Promise<T>,
  { repeats = 5, warmUp = 1 }: { repeats?: number; warmUp?: number } = {},
): Promise<{ best: T; median: T; last: T }> => {
  for (let i = 0; i < warmUp; i++) {
    await quietHeap();
    await measure();
  }

  const runs: T[] = [];

  for (let i = 0; i < repeats; i++) {
    await quietHeap();
    runs.push(await measure());
  }

  const last = runs[runs.length - 1];
  const keys = Object.keys(last) as (keyof T)[];
  const best = { ...last };
  const median = { ...last };

  for (const key of keys) {
    const values = runs.map(run => run[key]).sort((a, b) => a - b);
    best[key] = values[0];
    median[key] = values[Math.floor(values.length / 2)];
  }

  return { best, median, last };
};

export const percentile = (values: readonly number[], p: number): number => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));

  return sorted[index];
};

export const setCpuRate = async (rate: number): Promise<void> => {
  await cdp().send('Emulation.setCPUThrottlingRate', { rate });
};

export const nextFrame = (): Promise<number> =>
  new Promise(resolve => requestAnimationFrame(resolve));

/** Espera o Lit terminar TODAS as atualizações encadeadas (o `updated` pode pedir outra). */
export const updatesDone = async (grid: DataGrid): Promise<void> => {
  for (let i = 0; i < 10 && !await grid.updateComplete; i++) {
    // continua até uma atualização terminar sem pedir outra
  }
};

/** Atualizações feitas e o quadro seguinte pintado. */
export const painted = async (grid: DataGrid): Promise<void> => {
  await updatesDone(grid);
  await nextFrame();
  await updatesDone(grid);
  await nextFrame();
};

/** O que rola o grid: o contêiner interno, ou o contêiner externo (frente 27). */
export const scrollerOf = (grid: DataGrid): HTMLElement =>
  grid._scrollElement ?? grid.shadowRoot!.querySelector<HTMLElement>('.scroll-container')!;

/** Força estilo e layout pendentes (o trabalho que o quadro faria antes de pintar). */
const forceLayout = (grid: DataGrid): number =>
  scrollerOf(grid).offsetHeight;

/**
 * Trabalho síncrono de uma interação: a ação, o render do Lit (todas as
 * atualizações encadeadas) e o estilo/layout resultantes — o que bloqueia a
 * página. Sem esperar quadro (o tempo ocioso não conta).
 */
export const measureWork = async (grid: DataGrid, action: () => void): Promise<number> => {
  await painted(grid);
  const start = performance.now();

  action();
  await updatesDone(grid);
  forceLayout(grid);

  const ms = performance.now() - start;

  await painted(grid);
  return ms;
};

export interface ScrollResult {
  /** p95 do trabalho por passo de rolagem (ms). */
  p95Ms: number;
  /** Pior passo (ms). */
  worstMs: number;
}

/**
 * Rola um passo por quadro e mede o trabalho de cada passo: do evento de
 * rolagem (captura no ancestral, antes do virtualizador) ao render do Lit
 * e ao estilo/layout das linhas novas.
 */
export const measureScroll = async (grid: DataGrid, positions: readonly number[]): Promise<ScrollResult> => {
  const scroller = scrollerOf(grid);
  const container = scroller.parentElement!;
  const work: number[] = [];
  let start = 0;

  const onCapture = () => {
    start = performance.now();
  };

  container.addEventListener('scroll', onCapture, { capture: true });
  await painted(grid);

  try {
    for (const position of positions) {
      const before = scroller.scrollTop;

      scroller.scrollTop = position;

      if (Math.abs(scroller.scrollTop - before) < 1) {
        continue;
      }

      await new Promise(resolve => scroller.addEventListener('scroll', resolve, { once: true }));
      await updatesDone(grid);
      forceLayout(grid);
      work.push(performance.now() - start);
      await nextFrame();
    }
  } finally {
    container.removeEventListener('scroll', onCapture, { capture: true });
  }

  await painted(grid);
  return { p95Ms: percentile(work, 95), worstMs: Math.max(0, ...work) };
};

/**
 * Rolagem HORIZONTAL (virtualização de colunas, frente 13): como
 * `measureScroll`, pelo `scrollLeft`. Em RTL as posições são negativas.
 */
export const measureHorizontalScroll = async (grid: DataGrid, positions: readonly number[]): Promise<ScrollResult> => {
  const scroller = scrollerOf(grid);
  const container = scroller.parentElement!;
  const work: number[] = [];
  let start = 0;

  const onCapture = () => {
    start = performance.now();
  };

  container.addEventListener('scroll', onCapture, { capture: true });
  await painted(grid);

  try {
    for (const position of positions) {
      const before = scroller.scrollLeft;

      scroller.scrollLeft = position;

      if (Math.abs(scroller.scrollLeft - before) < 1) {
        continue;
      }

      await new Promise(resolve => scroller.addEventListener('scroll', resolve, { once: true }));
      await updatesDone(grid);
      forceLayout(grid);
      work.push(performance.now() - start);
      await nextFrame();
    }
  } finally {
    container.removeEventListener('scroll', onCapture, { capture: true });
  }

  await painted(grid);
  return { p95Ms: percentile(work, 95), worstMs: Math.max(0, ...work) };
};

/** Passos horizontais de roda (`delta` px) e saltos espalhados pela largura toda. */
export const horizontalPositions = (grid: DataGrid, steps: number, delta: number | 'jump'): number[] => {
  const scroller = scrollerOf(grid);
  const max = scroller.scrollWidth - scroller.clientWidth;
  const start = scroller.scrollLeft;

  return Array.from({ length: steps }, (_, i) => delta === 'jump'
    ? Math.round(((i * 0.618_034) % 1) * max)
    : Math.min(start + (i + 1) * delta, max));
};

/** Rolagem de roda/trackpad: `steps` passos de `delta` px a partir da posição atual. */
export const wheelPositions = (grid: DataGrid, steps: number, delta: number): number[] => {
  const start = scrollerOf(grid).scrollTop;

  return Array.from({ length: steps }, (_, i) => start + (i + 1) * delta);
};

/** Arrasto da barra de rolagem: saltos espalhados por toda a altura (pseudoaleatórios, fixos). */
export const jumpPositions = (grid: DataGrid, steps: number): number[] => {
  const scroller = scrollerOf(grid);
  const max = scroller.scrollHeight - scroller.clientHeight;

  return Array.from({ length: steps }, (_, i) => Math.round(((i * 0.618_034) % 1) * max));
};

/** Elementos no shadow root do grid (DOM que o navegador mantém). */
export const domNodes = (grid: DataGrid): number =>
  grid.shadowRoot!.querySelectorAll('*').length;

/** Heap JS usado (MiB), depois de coletar. */
export const heapMiB = async (): Promise<number> =>
  (await measureHeap()).jsHeapUsed / 1024 / 1024;

// ------------------------------------------------------------- linha de base

/** Tolerância sobre a linha de base (spec 16). */
export const TOLERANCE = {
  /**
   * Tempos: +50% e no mínimo +25 ms. Medido: duas execuções seguidas com
   * outras sessões usando a máquina variam até ~40%; regressão de verdade
   * (o dobro) passa disso.
   */
  time: { ratio: 0.5, floor: 25 },
  /**
   * Rolagem (trabalho por passo, poucos ms reais): layout oscila mais que
   * script. +100% e no mínimo +33 ms (dois quadros); o pior passo
   * (`…WorstMs`) só tem orçamento, não entra na comparação.
   */
  scroll: { ratio: 1, floor: 33 },
  /** Memória: +15% e no mínimo +2 MiB. */
  memory: { ratio: 0.15, floor: 2 },
  /** Nós do DOM: +10% e no mínimo +20. */
  count: { ratio: 0.1, floor: 20 },
};

const toleranceOf = (metric: string) => {
  if ((/(scroll|jump)P95Ms$/).test(metric)) {
    return TOLERANCE.scroll;
  }

  return metric.endsWith('Ms')
    ? TOLERANCE.time
    : metric.endsWith('MiB')
      ? TOLERANCE.memory
      : TOLERANCE.count;
};

/** Métricas só com orçamento (ruidosas demais para comparar com a linha de base). */
const comparable = (metric: string): boolean => !metric.endsWith('WorstMs');

/** Limite permitido para `metric` dado o valor da linha de base. */
export const allowedOver = (metric: string, baseline: number): number => {
  const { ratio, floor } = toleranceOf(metric);

  return baseline + Math.max(baseline * ratio, floor);
};

export interface PerfSession {
  /** Multiplicador aplicado aos tempos medidos (1 no modo CDP). */
  slowdown: number;
  /** Fator do CDP (modo CDP) ou 1. */
  cpuRate: number;
  benchLocalMs: number;
  /** Tempo medido → tempo na máquina fraca (ms), com o fator da última calibração. */
  weak: (ms: number) => number;
  /**
   * Refaz o benchmark (curto) e o fator, logo antes de medir: a carga da
   * máquina muda durante a execução (outras sessões, GC de cenários grandes).
   */
  recalibrate: () => void;
  throttle: () => Promise<void>;
  unthrottle: () => Promise<void>;
  /**
   * Registra as métricas do cenário e devolve as que pioraram além da
   * tolerância em relação à linha de base (vazio sem linha de base, no modo
   * CDP ou em `PERF_UPDATE_BASELINE=1`).
   */
  report: (scenario: string, metrics: Record<string, number>) => string[];
  finish: () => Promise<void>;
}

export const startPerf = async (): Promise<PerfSession> => {
  const setup = await commands.perfSetup();
  await setCpuRate(1);

  const benchLocalMs = benchmark(15);
  const cpuRate = setup.cpuRate ?? 1;
  const factorFor = (benchMs: number) => setup.cpuRate
    ? 1
    : Math.min(MAX_SLOWDOWN, Math.max(MIN_SLOWDOWN, BENCH_REFERENCE_MS / benchMs));
  const slowdown = factorFor(benchLocalMs);
  let current = slowdown;
  const results: PerfMetrics = {};

  console.log(setup.cpuRate
    ? `[perf] modo CDP: CPU estrangulada em ${cpuRate}× (benchmark sem estrangular ${benchLocalMs.toFixed(1)} ms); sem comparar com a linha de base`
    : `[perf] máquina fraca = ${slowdown.toFixed(2)}× esta (benchmark ${benchLocalMs.toFixed(1)} ms; referência ${BENCH_REFERENCE_MS} ms)`);

  return {
    slowdown,
    cpuRate,
    benchLocalMs,
    weak: ms => ms * current,
    recalibrate: () => {
      if (!setup.cpuRate) {
        current = factorFor(benchmark(5));
      }
    },
    throttle: () => setCpuRate(cpuRate),
    unthrottle: () => setCpuRate(1),
    report: (scenario, metrics) => {
      const rounded = Object.fromEntries(Object.entries(metrics)
        .map(([key, value]) => [key, Math.round(value * 10) / 10]));

      results[scenario] = rounded;

      const line = Object.entries(rounded).map(([key, value]) => `${key}=${value}`)
        .join(' ');

      console.log(`[perf] ${scenario}: ${line}`);

      const baseline = setup.baseline[scenario];

      if (setup.update || setup.cpuRate || !baseline) {
        return [];
      }

      return Object.entries(rounded)
        .filter(([key, value]) => comparable(key) && key in baseline && value > allowedOver(key, baseline[key]))
        .map(([key, value]) => `${scenario}.${key}: ${value} > linha de base ${baseline[key]} (+tolerância = ${allowedOver(key, baseline[key]).toFixed(1)})`);
    },
    finish: async () => {
      await setCpuRate(1);

      if (!setup.cpuRate) {
        await commands.perfRecord(results);
      }
    },
  };
};
