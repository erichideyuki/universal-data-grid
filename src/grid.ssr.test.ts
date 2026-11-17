import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

import { html } from 'lit';

import { describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';

import './grid.js';

const columns: GridColumnDef[] = [
  { path: 'country', label: 'Country', groupIndex: 0 },
  { path: 'year', label: 'Year' },
];

const items = [
  { country: 'Brazil', year: 2020 },
  { country: 'Argentina', year: 2021 },
];

const renderToString = (template: unknown) => collectResult(render(template));

describe('SSR', () => {
  it('renderiza cabeçalhos e grupos sem erro, no idioma pedido', async () => {
    const output = await renderToString(html`
      <u-grid language="pt" .columns=${columns} .items=${items}></u-grid>`);

    expect(output).toContain('Year');
    expect(output).toContain('Country: Argentina');
    expect(output.indexOf('Country: Argentina')).toBeLessThan(output.indexOf('Country: Brazil'));
    expect(output).not.toContain('Sem dados');
  });

  it('sem itens mostra o texto de vazio traduzido', async () => {
    const output = await renderToString(html`
      <u-grid language="pt" .columns=${columns} .items=${[]}></u-grid>`);

    expect(output).toContain('Sem dados');
  });

  it('não altera os dados do hospedeiro', async () => {
    const data = [{ country: 'b' }, { country: 'a' }];
    await renderToString(html`<u-grid .columns=${columns} .items=${data}></u-grid>`);

    expect(data.map(d => d.country)).toEqual(['b', 'a']);
  });
});
