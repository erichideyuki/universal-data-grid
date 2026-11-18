import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

import { html } from 'lit';

import { describe, expect, it } from 'vitest';

import type { GridColumnDef, GridSummary } from './grid-column-def.js';

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

  it('renderiza colunas fixas, ocultas e alças de redimensionar (ar/RTL)', async () => {
    const wide: GridColumnDef[] = [
      { path: 'country', label: 'Country', fixed: 'start', width: 120 },
      { path: 'year', label: 'Year', visible: false },
      { path: 'code', label: 'Code', fixed: 'end' },
    ];

    const output = await renderToString(html`
      <u-grid dir="rtl" language="ar" column-resizing column-chooser .columns=${wide} .items=${items}></u-grid>`);

    expect(output).toContain('role="separator"');
    expect(output).toContain('fixed-start');
    expect(output).toContain('fixed-end');
    expect(output).toContain('منتقي الأعمدة');
    expect(output.match(/role="columnheader"/g)).toHaveLength(2);
  });

  it('renderiza totais, resumos e rodapé de grupo (pt e ar/RTL)', async () => {
    const summary: GridSummary = {
      total: [{ column: 'year', type: 'max' }, { column: 'year', type: 'count' }],
      group: [{ column: 'year', type: 'sum' }, { column: 'year', type: 'min', display: 'footer' }],
    };

    const output = await renderToString(html`
      <u-grid language="pt" auto-expand-groups .columns=${columns} .items=${items} .summary=${summary}></u-grid>`);

    expect(output).toContain('role="rowgroup"');
    expect(output).toContain('total-row');
    expect(output).toContain('Contagem: 2');
    expect(output).toContain('Máx.: 2021');
    expect(output).toContain('Soma de Year: 2.020');
    expect(output).toContain('group-footer-row');

    const rtl = await renderToString(html`
      <u-grid dir="rtl" language="ar" .columns=${columns} .items=${items} .summary=${summary}></u-grid>`);

    expect(rtl).toContain('المجموع');
  });

  it('não altera os dados do hospedeiro', async () => {
    const data = [{ country: 'b' }, { country: 'a' }];
    await renderToString(html`<u-grid .columns=${columns} .items=${data}></u-grid>`);

    expect(data.map(d => d.country)).toEqual(['b', 'a']);
  });

  it('renderiza a ordenação inicial (grupo desc + coluna) com aria-sort', async () => {
    const sorted: GridColumnDef[] = [
      { path: 'country', label: 'Country', groupIndex: 0, sortOrder: 'desc' },
      { path: 'year', label: 'Year', sortOrder: 'asc' },
    ];
    const output = await renderToString(html`<u-grid .columns=${sorted} .items=${items}></u-grid>`);

    expect(output.indexOf('Country: Brazil')).toBeLessThan(output.indexOf('Country: Argentina'));
    expect(output).toContain('aria-sort="ascending"');
  });

  it('formata tipos no idioma pedido', async () => {
    const typed: GridColumnDef[] = [
      { path: 'n', label: 'N', format: { minimumFractionDigits: 2 } },
      { path: 'd', label: 'D', dataType: 'date' },
      { path: 'b', label: 'B', groupIndex: 0 },
    ];
    const output = await renderToString(html`
      <u-grid language="de" auto-expand-groups .columns=${typed} .items=${[{ n: 1234.5, d: '2024-03-05', b: true }]}></u-grid>`);

    expect(output).toContain('1.234,50');
    expect(output).toContain('5.3.2024');
    expect(output).toContain('B: Wahr');
    expect(output).toContain('align-end');
  });

  it('booleano como ícone renderiza no servidor com nome acessível', async () => {
    const icon: GridColumnDef[] = [{ path: 'b', label: 'B', booleanDisplay: 'icon' }];
    const output = await renderToString(html`
      <u-grid language="de" .columns=${icon} .items=${[{ b: true }]}></u-grid>`);

    expect(output).toContain('role="img"');
    expect(output).toContain('aria-label="Wahr"');
  });
});
