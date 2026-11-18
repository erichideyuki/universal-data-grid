import { render as renderLit } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result';
import { template } from './template.ts';
import { PopulationService } from './population-service';

import './dev-root.ts';

const MAX_ROWS = 1_000_000;

/**
 * @param {string} url
 */
export async function render(url) {
  const params = new URL(url, 'http://localhost').searchParams;
  const rows = Math.min(Math.max(Number(params.get('rows')) || 1000, 0), MAX_ROWS);
  const population = await PopulationService.get({ rows, remote: params.has('remote') });
  // `?columns=30`: demo largo (colunas fixas, rolagem horizontal); acima de
  // 50 liga a virtualização de colunas. `?bands`: métricas em bandas de 10 (frente 13).
  const columns = Math.min(Math.max(Number(params.get('columns')) || 4, 4), 300);

  return await collectResult(renderLit(template(population, columns, params.has('bands'))));
}
