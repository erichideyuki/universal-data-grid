import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

import { html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

import { type HydrationScenario, hydrationScenarios, type HydrationScenarioName } from './hydration-scenarios.js';

import '../grid.js';

/**
 * Só em Node: renderiza um cenário de hidratação com o `@lit-labs/ssr`.
 * Carregado pelo comando `renderGridSsr` do `vitest.config.ts`
 * (`ssrLoadModule`), para o teste de navegador hidratar a saída real do SSR.
 */
export const renderScenario = (name: HydrationScenarioName): Promise<string> => {
  const scenario: HydrationScenario = hydrationScenarios[name];
  const { language, dir, columns, items } = scenario;

  // Como o demo (`dev/dev-root.ts`): agrupado, ordenação múltipla, redimensionar, seletor.
  return collectResult(render(html`
    <u-grid
      language=${language}
      dir=${ifDefined(dir)}
      style="display: block; height: 400px"
      auto-expand-groups
      sorting="multiple"
      column-resizing
      column-chooser
      .columns=${columns}
      .items=${items}></u-grid>`));
};
