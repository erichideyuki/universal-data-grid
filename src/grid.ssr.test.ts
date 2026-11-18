import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

import { html } from 'lit';

import { describe, expect, it } from 'vitest';

import type { GridColumnDef, GridDetailRenderer, GridFilterExpression, GridSummary } from './grid-column-def.js';
import type { GridToolbarItem, GridToolbarItemName } from './grid.js';

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

  it('aria-label do hospedeiro nomeia a tabela no servidor; aria-labelledby não quebra', async () => {
    const output = await renderToString(html`
      <u-grid aria-label="Sales" .columns=${columns} .items=${items}></u-grid>
      <u-grid aria-labelledby="t" .columns=${columns} .items=${items}></u-grid>`);

    expect(output).toMatch(/<table[^>]*role="treegrid"[^>]*aria-label="Sales"/);
    expect(output.match(/aria-label="Sales"/g)).toHaveLength(2);
  });

  it('com state-storage: renderiza "carregando estado" (sem linhas, sem "sem dados") e não toca storage', async () => {
    const output = await renderToString(html`
      <u-grid language="pt" state-storage="local" state-storage-key="k" .columns=${columns} .items=${items}></u-grid>`);

    expect(output).toContain('aria-busy="true"');
    expect(output).toContain('aria-rowcount="-1"');
    expect(output).toContain('part="load-panel"');
    expect(output).toContain('state-loading');
    expect(output).not.toContain('Country: Argentina');
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
  it('renderiza filtro (linha, busca com destaque, funil) já filtrado, em ar/RTL', async () => {
    const people: GridColumnDef[] = [
      { path: 'name', label: 'Name' },
      { path: 'age', label: 'Age' },
    ];
    const data = [{ name: 'Ana <b>', age: 30 }, { name: 'José', age: 41 }, { name: 'Bob', age: 30 }];
    const filter: GridFilterExpression = ['age', '=', 30];
    const output = await renderToString(html`
      <u-grid dir="rtl" language="ar" show-filter-row show-search-panel header-filter search-text="an"
        .filterValue=${filter} .columns=${people} .items=${data}></u-grid>`);

    expect(output).toContain('part="filter-row"');
    expect(output).toContain('aria-label="تصفية Name"');
    expect(output).toContain('part="search-input"');
    expect(output).toContain('part="header-filter-button"');
    const plain = output.replace(/<!--[^>]*-->|<\?>/g, '');

    expect(plain).toContain('<mark class="search-highlight" part="search-highlight">An</mark>a &lt;b&gt;');
    expect(output).not.toContain('José');
    expect(output).not.toContain('>Bob<');
  });

  it('renderiza seleção, caixas e roving tabindex sem erro', async () => {
    const output = await renderToString(html`
      <u-grid language="en" selection-mode="multiple" show-checkboxes .columns=${columns} .items=${items}></u-grid>`);

    expect(output).toContain('role="treegrid"');
    expect(output).toContain('aria-multiselectable="true"');
    expect(output).toContain('aria-label="Select all rows"');
    expect(output).toContain('aria-checked="false"');
    // Um ponto de Tab na tabela (e outro no chip da barra de grupos).
    expect(output.slice(output.indexOf('<table')).match(/tabindex="0"/g)).toHaveLength(1);
  });

  it('renderiza com clipboard-mode e colunas exportáveis/não exportáveis (pt e ar/RTL)', async () => {
    const exportColumns: GridColumnDef[] = [
      { path: 'country', label: 'Country', exportable: false },
      { path: 'year', label: 'Year' },
    ];

    for (const [language, dir] of [['pt', 'ltr'], ['ar', 'rtl']] as const) {
      const output = await renderToString(html`
        <u-grid dir=${dir} language=${language} clipboard-mode="none" selection-mode="multiple"
          .columns=${exportColumns} .items=${items}></u-grid>`);

      expect(output).toContain('Country');
      expect(output).toContain('2021');
    }
  });

  it('o módulo do adaptador xlsx carrega no servidor (sem DOM nem ExcelJS)', async () => {
    const adapter = await import('./export-xlsx/index.js');

    expect(typeof adapter.exportXlsx).toBe('function');
    expect(Object.keys(adapter).sort()).toEqual(['createXlsxExporter', 'downloadXlsx', 'exportXlsx']);
  });

  it('renderiza templates (célula, cabeçalho, grupo, detalhe) no servidor (frente 10)', async () => {
    const templated: GridColumnDef[] = [
      { path: 'country', label: 'Country', groupIndex: 0, groupRenderer: ctx => html`<b class="g">${ctx.text}·${ctx.itemCount}</b>` },
      {
        path: 'year',
        label: 'Year',
        headerRenderer: ({ column }) => html`<i class="h">${column.label}?</i>`,
        renderer: (item: { year: number }, ctx) => html`<span class="y" part="year">${item.year}/${ctx.text}</span>`,
      },
    ];
    const detail: GridDetailRenderer = (item: { country: string }) => html`<p class="d">About ${item.country}</p>`;
    const output = await renderToString(html`
      <u-grid language="en" auto-expand-groups auto-expand-rows
        .detailRenderer=${detail}
        .columns=${templated} .items=${items}></u-grid>`);
    const plain = output.replace(/<!--[^>]*-->|<\?>/g, '');

    expect(plain).toContain('<i class="h">Year?</i>');
    expect(plain).toContain('<b class="g">Argentina·1</b>');
    expect(plain).toContain('<span class="y" part="year">2021/2021</span>');
    expect(plain).toContain('<p class="d">About Brazil</p>');
    expect(output).toContain('part="row detail-row"');
    expect(output).toContain('aria-label="Row details"');
    expect(output).toContain('aria-expanded="true"');
  });

  it('renderer que monta DOM vira o slot no servidor, sem erro; vazio por renderer', async () => {
    const domColumns: GridColumnDef[] = [
      {
        path: 'year',
        label: 'Year',
        renderer: () => document.createElement('b'),
      },
    ];
    const output = await renderToString(html`<u-grid .columns=${domColumns} .items=${items}></u-grid>`);

    expect(output).toMatch(/<slot name="u-grid-internal:cell:[^"]+"><\/slot>/);

    const empty = await renderToString(html`<u-grid .columns=${domColumns} .items=${[]}
      .noDataRenderer=${() => html`<em class="none">Nothing here</em>`}></u-grid>`);

    expect(empty.replace(/<!--[^>]*-->|<\?>/g, '')).toContain('<em class="none">Nothing here</em>');
  });
});

describe('SSR — fonte de dados e paginação (frente 08)', () => {
  it('com dataSource renderiza o painel de carregamento sem chamar a fonte', async () => {
    let calls = 0;
    const dataSource = { load: () => {
      calls++; return Promise.resolve({ data: [] });
    } };
    const output = await renderToString(html`
      <u-grid language="pt" key-expr="id" remote-operations .columns=${columns} .dataSource=${dataSource}></u-grid>`);

    expect(calls).toBe(0);
    expect(output).toContain('part="load-panel"');
    expect(output).toContain('aria-busy="true"');
    expect(output).toContain('Carregando…');
    expect(output).not.toContain('Sem dados');
  });

  it('renderiza o pager traduzido (pt e ar/RTL)', async () => {
    const many = Array.from({ length: 45 }, (_, index) => ({ country: `C${index}`, year: 2000 + index }));
    const flat: GridColumnDef[] = [{ path: 'country', label: 'Country' }, { path: 'year', label: 'Year' }];
    const pt = await renderToString(html`
      <u-grid language="pt" paging page-size="20" page-index="1" .columns=${flat} .items=${many}></u-grid>`);

    expect(pt).toContain('part="pager"');
    expect(pt).toContain('Página 2 de 3 (45 itens)');
    expect(pt).toContain('aria-label="Paginação"');
    expect(pt).toContain('aria-rowindex="22"');

    const ar = await renderToString(html`
      <u-grid dir="rtl" language="ar" paging .columns=${flat} .items=${many}></u-grid>`);

    expect(ar).toContain('الصفحة 1 من 3');
  });
});

describe('SSR — edição (frente 09)', () => {
  it('renderiza a barra, a coluna de botões e aria-readonly (pt e ar/RTL)', async () => {
    const flat: GridColumnDef[] = [
      { path: 'country', label: 'Country' },
      { path: 'year', label: 'Year', editable: false },
    ];
    const pt = await renderToString(html`
      <u-grid language="pt" key-expr="country" allow-editing allow-adding allow-removing edit-mode="batch"
        .columns=${flat} .items=${items}></u-grid>`);

    expect(pt).toContain('Adicionar linha');
    expect(pt).toContain('Salvar alterações');
    expect(pt).toContain('part="command-cell"');
    expect(pt).toContain('Excluir');
    expect(pt).toContain('aria-readonly="true"');
    expect(pt).toContain('id="edit-desc-modified"');

    const ar = await renderToString(html`
      <u-grid dir="rtl" language="ar" key-expr="country" allow-editing edit-mode="row" .columns=${flat} .items=${items}></u-grid>`);

    expect(ar).toContain('تعديل');
  });
});

describe('SSR com bandas e virtualização de colunas (frente 13)', () => {
  it('cabeçalho multinível com colspan/rowspan e as primeiras colunas da janela', async () => {
    const banded: GridColumnDef[] = [
      { path: 'country', label: 'Country' },
      { label: 'When', columns: [{ path: 'year', label: 'Year' }] },
    ];
    const output = await renderToString(html`<u-grid .columns=${banded} .items=${items}></u-grid>`);

    expect(output).toMatch(/<th[^>]*class="band-header[^"]*"[^>]*colspan="1"/);
    expect(output).toMatch(/<th[^>]*rowspan="2"/);
    expect(output).toContain('When');

    const wide: GridColumnDef[] = Array.from({ length: 200 }, (_, i) => ({ path: `c${i}`, label: `Col${i}` }));
    const wideOutput = await renderToString(html`<u-grid .columns=${wide} .items=${[{ c0: 'x' }]}></u-grid>`);

    expect(wideOutput).toContain('aria-colcount="200"');
    expect(wideOutput).toContain('Col0');
    // 1920 px ÷ 150 px + folga: só as primeiras colunas.
    expect(wideOutput).not.toContain('Col100');
    expect(wideOutput).toContain('column-spacer');
  });

  it('intervalo de células: modo, barra de resumo e aria-multiselectable no servidor (pt e ar/RTL)', async () => {
    const flat: GridColumnDef[] = [{ path: 'country', label: 'Country' }, { path: 'year', label: 'Year' }];
    const output = await renderToString(html`
      <u-grid language="pt" cell-selection-mode="multiple" show-cell-range-summary .columns=${flat} .items=${items}></u-grid>
      <u-grid language="ar" dir="rtl" cell-selection-mode="single" clipboard-mode="copy-paste" .columns=${flat} .items=${items}></u-grid>`);

    expect(output).toMatch(/<table[^>]*aria-multiselectable="true"/);
    expect(output).toContain('cell-range-mode');
    expect(output).toMatch(/class="cell-range-summary" role="status"[^>]*aria-label="Resumo da seleção"/);
    expect(output).not.toContain('aria-selected="true"');
  });
});

describe('SSR da barra (frente 18)', () => {
  it('barra com embutidos, botão e conteúdo do hospedeiro, sem "mais" (a medida é do cliente)', async () => {
    const toolbarItems: (GridToolbarItemName | GridToolbarItem)[] = [
      'groupPanel',
      'exportButton',
      'columnChooserButton',
      'searchPanel',
      { text: 'Refresh', action: () => undefined },
      { text: 'Print', action: () => undefined, locateInMenu: 'always' },
      { renderer: () => html`<span class="host-content">Host</span>` },
    ];
    const output = await renderToString(html`
      <u-grid language="pt" column-chooser show-search-panel .exportFormats=${['csv'] as const} .toolbarItems=${toolbarItems} .columns=${columns} .items=${items}></u-grid>`);

    expect(output).toMatch(/<div[^>]*class="toolbar-roving"[^>]*role="toolbar"/);
    expect(output).toContain('Barra de ferramentas da grade');
    expect(output).toContain('Exportar para CSV');
    expect(output).toContain('Refresh');
    expect(output).toContain('host-content');
    // `always` vai ao "mais" já no servidor.
    expect(output).toContain('toolbar-more-button');
    expect(output).not.toContain('>Print<');
  });
});

describe('SSR das linhas fixas e da linha inteira (frente 20)', () => {
  it('linhas fixas e linha inteira (frente 20), em pt e ar/RTL; renderer que monta DOM fica com as colunas', async () => {
    const flat: GridColumnDef[] = [{ path: 'country', label: 'Country' }, { path: 'year', label: 'Year' }];
    const rowRenderer = (item: { year: number }) => item.year === 2021 && html`<b class="wide">Wide ${item.year}</b>`;
    const output = await renderToString(html`
      <u-grid language="pt" .columns=${flat} .items=${items} .fixedTopItems=${[{ country: 'Meta', year: 1 }]}
        .fixedBottomItems=${[{ country: 'Média', year: 2 }]} .rowRenderer=${rowRenderer}></u-grid>
      <u-grid language="ar" dir="rtl" .columns=${flat} .items=${items} .fixedTopItems=${[{ country: 'X', year: 3 }]}></u-grid>
      <u-grid .columns=${flat} .items=${items} .rowRenderer=${() => document.createElement('div')}></u-grid>`);

    expect(output).toMatch(/<tbody[^>]*class="fixed-rows fixed-top-rows"[^>]*aria-label="Linhas fixadas no topo"/);
    expect(output).toMatch(/aria-label="Linhas fixadas no rodapé"/);
    expect(output).toContain('Meta');
    expect(output).toContain('Média');
    expect(output).toMatch(/class="full-width-cell"[^>]*aria-colindex="1"[^>]*aria-colspan="2"/);
    expect(output).toContain('class="wide"');
    expect(output).toContain('aria-rowcount="5"');
    expect(output).toMatch(/aria-label="الصفوف المثبتة في الأعلى"/);
    // Sem `document` no servidor o renderer lança: a linha fica com as colunas (mesma estrutura no cliente que lança igual).
    expect(output.match(/class="full-width-cell"/g)).toHaveLength(1);
  });
});
