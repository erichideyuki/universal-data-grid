import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { playwright } from '@vitest/browser-playwright';
import type { BrowserCommand } from 'vitest/node';
import { defineConfig } from 'vitest/config';

/**
 * Renderiza no servidor (Node, `@lit-labs/ssr`) um cenário de
 * `src/test/hydration-scenarios.ts` e devolve o HTML para o teste de
 * navegador hidratar (`src/grid.hydration.browser.test.ts`).
 */
const renderGridSsr: BrowserCommand<[name: string]> = async ({ project }, name) => {
  const { renderScenario } = await project.vite.ssrLoadModule('/src/test/ssr-render.ts');

  return renderScenario(name);
};

/**
 * Emula preferências de mídia do usuário (spec 17): `forced-colors: active`
 * (alto contraste do Windows) e `prefers-reduced-motion: reduce`. `null`
 * volta ao padrão.
 */
const emulateMedia: BrowserCommand<[options: {
  forcedColors?: 'active' | 'none' | null;
  reducedMotion?: 'reduce' | 'no-preference' | null;
}]> = ({ page }, options) => page.emulateMedia(options);

/**
 * Escala da tela (`devicePixelRatio`, ex.: 1.1 = Windows em 110%) pelo CDP,
 * para conferir na pintura o que só aparece em pixel físico fracionário.
 * `null` volta ao padrão. A sessão CDP fica aberta até voltar ao padrão:
 * fechá-la desfaz a emulação.
 */
let scaleSession: Awaited<ReturnType<ReturnType<Parameters<BrowserCommand<[]>>[0]['page']['context']>['newCDPSession']>> | undefined;

const emulateScale: BrowserCommand<[factor: number | null]> = async ({ page }, factor) => {
  scaleSession ??= await page.context().newCDPSession(page);

  if (factor) {
    const { width, height } = page.viewportSize() ?? { width: 1280, height: 720 };
    await scaleSession.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: factor, mobile: false });
  } else {
    await scaleSession.send('Emulation.clearDeviceMetricsOverride');
    await scaleSession.detach();
    scaleSession = undefined;
  }
};

/** Screenshot da página inteira em pixel físico (PNG em base64), com a escala de `emulateScale`. */
const captureDevicePixels: BrowserCommand<[]> = async ({ page }) => {
  const session = scaleSession ?? await page.context().newCDPSession(page);
  const { data } = await session.send('Page.captureScreenshot', { format: 'png' });

  if (session !== scaleSession) {
    await session.detach();
  }

  return data;
};

// ------------------------------------------------------- perfil "máquina fraca"
// Spec 16. O teste de perf lê a linha de base e grava os resultados pelo Node
// (o navegador não acessa o disco).

const PERF_BASELINE = resolve(import.meta.dirname, '.specs/16-performance.baseline.json');
const PERF_RESULTS = resolve(import.meta.dirname, 'perf-results.json');

type PerfMetrics = Record<string, Record<string, number>>;

const readJson = (path: string): PerfMetrics => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PerfMetrics;
  } catch {
    return {};
  }
};

/** Linha de base + configuração do perfil (variáveis de ambiente, spec 16). */
const perfSetup: BrowserCommand<[]> = () => ({
  baseline: readJson(PERF_BASELINE),
  update: Boolean(process.env.PERF_UPDATE_BASELINE),
  cpuRate: process.env.PERF_CPU_RATE ? Number(process.env.PERF_CPU_RATE) : undefined,
});

/**
 * Junta os resultados de um arquivo de teste em `perf-results.json` e, com
 * `PERF_UPDATE_BASELINE`, na linha de base: `=1` substitui os cenários
 * medidos; `=max` fica com o maior valor de cada métrica (rodar `=1` e depois
 * `=max` grava uma linha de base que não depende de uma execução de sorte).
 */
const perfRecord: BrowserCommand<[results: PerfMetrics]> = (_, results) => {
  const write = (path: string, keepMax = false) => {
    const previous = readJson(path);
    const merged = { ...previous, ...results };

    if (keepMax) {
      for (const [scenario, metrics] of Object.entries(results)) {
        merged[scenario] = Object.fromEntries(Object.entries(metrics)
          .map(([metric, value]) => [metric, Math.max(value, previous[scenario]?.[metric] ?? value)]));
      }
    }

    const sorted = Object.fromEntries(Object.keys(merged).sort().map(key => [key, merged[key]]));
    writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
  };

  write(PERF_RESULTS);

  if (process.env.PERF_UPDATE_BASELINE) {
    write(PERF_BASELINE, process.env.PERF_UPDATE_BASELINE === 'max');
  }
};

/**
 * Perfil de máquina fraca (spec 16): GPU desligada (raster por software),
 * heap do V8 de um notebook de 4 GB e a resolução de tela mais comum. A CPU
 * fraca é emulada pelo harness (`src/test/perf.ts`): trabalho medido × fator
 * calibrado; `PERF_CPU_RATE=n` estrangula de verdade pelo CDP.
 */
const WEAK_MACHINE_ARGS = [
  '--disable-gpu',
  '--disable-gpu-compositing',
  '--js-flags=--max-old-space-size=1024',
];

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        // Descoberto só ao rodar o teste de hidratação: sem isto o Vite
        // reotimiza no meio da execução e recarrega os testes.
        optimizeDeps: { include: ['@lit-labs/ssr-client/lit-element-hydrate-support.js'] },
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          exclude: ['src/**/*.perf.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            commands: { renderGridSsr, emulateMedia, emulateScale, captureDevicePixels },
          },
        },
      },
      {
        extends: true,
        // Mede o Lit de produção (o de desenvolvimento valida e avisa a cada render).
        resolve: { conditions: ['module', 'browser', 'production'] },
        test: {
          name: 'perf',
          include: ['src/**/*.perf.browser.test.ts'],
          // Um arquivo por vez: dois medindo juntos disputam a CPU.
          fileParallelism: false,
          testTimeout: 600_000,
          hookTimeout: 120_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({ launchOptions: { args: WEAK_MACHINE_ARGS } }),
            instances: [{ browser: 'chromium' }],
            viewport: { width: 1366, height: 768 },
            commands: { perfSetup, perfRecord },
          },
        },
      },
    ],
  },
});
