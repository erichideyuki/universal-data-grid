import { render as renderLit } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result';
import { template } from './template.ts';
import { PopulationService } from './population-service';

import './dev-root.ts';

const population = await PopulationService.get();

/**
 * @param {string} _url
 */
export async function render(_url) {
  return await collectResult(renderLit(template(population)));
}
