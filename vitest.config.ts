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
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            commands: { renderGridSsr },
          },
        },
      },
    ],
  },
});
