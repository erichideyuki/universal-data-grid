/**
 * Correções da revisão do site de documentação (problemas vistos nos
 * exemplos ao vivo): cada teste falhava antes da correção.
 */
import { html } from 'lit';

import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { DataGrid, GridColumnDef } from './grid.js';
import { cleanup, createGrid, nextFrame, settle } from './test/fixture.js';

interface Order {
  id: number;
  name: string;
  country: string;
  total: number;
}

const orders = (count: number): Order[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Name ${i + 1}`, country: `Country ${i % 7}`, total: i * 10 }));

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const scroller = (grid: DataGrid): HTMLElement => root(grid).querySelector<HTMLElement>('.scroll-container')!;

/** Faixas verticais da área útil (abaixo do cabeçalho) sem nenhuma linha renderizada. */
const blankBands = (grid: DataGrid): string[] => {
  const area = scroller(grid).getBoundingClientRect();
  const top = root(grid).querySelector('thead')!.getBoundingClientRect().bottom;
  const bottom = Math.min(area.bottom, root(grid).querySelector('tbody.body-rows')!.getBoundingClientRect().bottom);
  const rows = [...root(grid).querySelectorAll<HTMLElement>('tbody.body-rows > tr[data-index]')]
    .map(row => row.getBoundingClientRect())
    .sort((a, b) => a.top - b.top);
  const bands: string[] = [];
  let y = top;

  for (const rect of rows) {
    if (rect.bottom <= y) {
      continue;
    }

    if (rect.top > y + 1) {
      bands.push(`${Math.round(y)}–${Math.round(rect.top)}`);
    }

    y = Math.max(y, rect.bottom);
  }

  if (y < bottom - 1) {
    bands.push(`${Math.round(y)}–${Math.round(bottom)}`);
  }

  return bands;
};

const columns = (): GridColumnDef<Order>[] => [
  { path: 'id', label: 'Order', width: 100, dataType: 'number' },
  { path: 'name', label: 'Name', width: 200 },
  { path: 'country', label: 'Country', width: 160 },
  { path: 'total', label: 'Total', width: 140, dataType: 'number' },
];

const headerCell = (grid: DataGrid, label: string): HTMLElement =>
  [...root(grid).querySelectorAll<HTMLElement>('thead th')].find(th => th.querySelector('.header-text')?.textContent.trim() === label)!;

const bandColumns = (): GridColumnDef<Order>[] => [
  { label: 'Order', columns: [{ path: 'id', label: 'Number', width: 100, dataType: 'number' }] },
  { label: 'Customer', columns: [
    { path: 'name', label: 'Name', width: 180 },
    { label: 'Place', columns: [{ path: 'country', label: 'Country', width: 150 }] },
  ] },
  { path: 'total', label: 'Total', width: 120, dataType: 'number' },
];

const pointer = (type: string, target: EventTarget, x: number, y: number) => target.dispatchEvent(new PointerEvent(type, {
  bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y,
  pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
}));

describe('revisão do site de documentação', () => {
  afterEach(cleanup);

  it('bandas: nenhuma linha horizontal atravessa as células com rowspan; banda no início, folhas embaixo', async () => {
    const grid = await createGrid({ columns: bandColumns(), items: orders(5), configure: g => g.showRowLines = true });
    const rows = [...root(grid).querySelectorAll('thead > tr')];

    // A linha entre os níveis vem das bandas (célula), não da <tr> inteira.
    expect(rows.map(tr => getComputedStyle(tr).boxShadow)).toEqual(rows.map(() => 'none'));

    expect(getComputedStyle(headerCell(grid, 'Customer')).textAlign).toBe('start');
    expect(getComputedStyle(headerCell(grid, 'Name')).verticalAlign).toBe('bottom');
    // Horizontal: a regra da coluna (número no fim, texto no início), como na referência.
    expect(getComputedStyle(headerCell(grid, 'Total')).textAlign).toBe('end');
    expect(getComputedStyle(headerCell(grid, 'Name')).textAlign).toBe('start');
  });

  it('bandas com linha de filtro: a linha entre o cabeçalho e o filtro continua', async () => {
    const grid = await createGrid({ columns: bandColumns(), items: orders(5), configure: g => {
      g.showRowLines = true;
      g.showFilterRow = true;
    } });
    const beforeFilter = [...root(grid).querySelectorAll('thead > tr')].find(tr => tr.nextElementSibling?.classList.contains('filter-row'))!;

    expect(getComputedStyle(beforeFilter).boxShadow).not.toBe('none');
  });

  it('agrupado: as células sticky do corpo não cobrem o painel de grupo ao rolar', async () => {
    const grid = await createGrid({
      columns: [{ path: 'country', label: 'Country', groupIndex: 0 }, ...columns().filter(column => column.path !== 'country')],
      items: orders(300),
      configure: g => g.autoExpandGroups = true,
    });

    scroller(grid).scrollTop = 300;
    await settle(grid);

    const toolbar = root(grid).querySelector<HTMLElement>('.header')!;
    const rect = toolbar.getBoundingClientRect();
    // Ponto do painel sobre a coluna de recuo (onde passa a célula sticky do grupo).
    const hit = root(grid).elementFromPoint(rect.left + 10, rect.top + rect.height / 2)!;

    expect(toolbar.contains(hit)).toBe(true);
  });

  it('cabeçalho: realce no hover; o botão ⋮ só ocupa espaço no hover', async () => {
    const grid = await createGrid({ columns: columns(), items: orders(5) });
    const th = headerCell(grid, 'Name');
    const button = th.querySelector<HTMLElement>('.column-header-menu-button')!;

    expect(getComputedStyle(th).backgroundImage).toBe('none');
    expect(button.getBoundingClientRect().width).toBe(0);

    await userEvent.hover(th);

    expect(getComputedStyle(th).backgroundImage).toContain('gradient');
    expect(button.getBoundingClientRect().width).toBeGreaterThan(0);

    await userEvent.unhover(th);
  });

  it.each(['{Escape}', '{Tab}'])('menu do ⋮ aberto pelo teclado: %s devolve o foco ao cabeçalho, não ao <body>', async closeKey => {
    const grid = await createGrid({ columns: columns(), items: orders(5) });
    const th = headerCell(grid, 'Name');

    th.focus();
    await userEvent.keyboard('{F2}');
    await settle(grid);
    expect(root(grid).activeElement?.classList.contains('column-header-menu-button')).toBe(true);

    await userEvent.keyboard('{Enter}');
    await settle(grid);
    expect(root(grid).querySelector('.column-header-menu')).not.toBeNull();

    await userEvent.keyboard(closeKey);
    await settle(grid);

    const active = root(grid).activeElement;
    expect(active === th || active === th.querySelector('.column-header-menu-button')).toBe(true);
  });

  it('arrasto do cabeçalho: o clone tem a largura e a altura da célula (com rowspan)', async () => {
    const grid = await createGrid({ columns: bandColumns(), items: orders(5) });
    const th = headerCell(grid, 'Name');
    const rect = th.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    pointer('pointerdown', th, x, y);
    pointer('pointermove', th, x + 5, y);
    pointer('pointermove', document, x + 30, y);
    await nextFrame();

    const clone = root(grid).querySelector<HTMLElement>('.move-container > th')!.getBoundingClientRect();
    pointer('pointerup', document, x + 30, y);
    await settle(grid);

    expect({ width: Math.round(clone.width), height: Math.round(clone.height) })
      .toEqual({ width: Math.round(rect.width), height: Math.round(rect.height) });
  });

  it('larguras definidas: a última coluna leva a sobra e a tabela ocupa a largura do grid', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: orders(5),
      configure: g => {
        g.style.width = '1000px';
        g.selectionMode = 'multiple';
        g.showCheckboxes = true;
      },
    });
    const total = headerCell(grid, 'Total');

    expect(root(grid).querySelector('table')!.getBoundingClientRect().width).toBeCloseTo(scroller(grid).clientWidth, 0);
    expect(headerCell(grid, 'Name').getBoundingClientRect().width).toBeCloseTo(200, 0);
    expect(total.getBoundingClientRect().width).toBeGreaterThan(140);

    // Mais estreito que a soma: nada estica, a rolagem horizontal aparece.
    grid.style.width = '400px';
    await settle(grid);
    expect(total.getBoundingClientRect().width).toBeCloseTo(140, 0);
    expect(scroller(grid).scrollWidth).toBeGreaterThan(scroller(grid).clientWidth);
  });

  it('filtro booleano: botão de menu estilizável no lugar do <select>, pelo teclado', async () => {
    const grid = await createGrid({
      columns: [...columns(), { path: 'active', label: 'Active', dataType: 'boolean', width: 120 }],
      items: orders(6).map((order, i) => ({ ...order, active: i % 2 === 0 })),
      configure: g => g.showFilterRow = true,
    });
    const cell = root(grid).querySelectorAll<HTMLElement>('tr.filter-row td.filter-cell')[4];

    expect(cell.querySelector('select')).toBeNull();

    const button = cell.querySelector<HTMLButtonElement>('button.filter-editor')!;
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(getComputedStyle(button).backgroundColor).toBe('rgba(0, 0, 0, 0)');

    button.focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(root(grid).activeElement?.textContent).toContain('(All)');

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await settle(grid);

    expect(root(grid).querySelector('.filter-menu')).toBeNull();
    expect(grid.filterValue).toEqual(['active', '=', false]);
    expect(root(grid).activeElement).toBe(button);
    expect(button.getAttribute('aria-label')).toMatch(/, False$/);
  });

  it.each(['{Escape}', '{Tab}'])('filtro booleano: ↑ abre no último item; %s fecha e devolve o foco ao botão; axe sem violações', async closeKey => {
    const grid = await createGrid({
      columns: [...columns(), { path: 'active', label: 'Active', dataType: 'boolean', width: 120 }],
      items: orders(6).map((order, i) => ({ ...order, active: i % 2 === 0 })),
      configure: g => g.showFilterRow = true,
    });
    const button = root(grid).querySelector<HTMLButtonElement>('button.filter-value-button')!;

    button.focus();
    await userEvent.keyboard('{ArrowUp}');
    await settle(grid);
    expect(root(grid).activeElement?.textContent).toContain('False');

    const open = await axe.run(root(grid).querySelector('.container')!, { runOnly: ['wcag2a', 'wcag2aa'] });
    expect(open.violations.map(violation => violation.id)).toEqual([]);

    await userEvent.keyboard(closeKey);
    await settle(grid);
    expect(root(grid).activeElement).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(grid.filterValue).toBeNull();
  });

  it('coluna booleana com operações: cada botão abre o próprio menu e só ele fica expandido', async () => {
    const grid = await createGrid({
      columns: [...columns(), { path: 'active', label: 'Active', dataType: 'boolean', width: 160, filterOperations: ['=', '<>'] }],
      items: orders(6).map((order, i) => ({ ...order, active: i % 2 === 0 })),
      configure: g => g.showFilterRow = true,
    });
    const cell = root(grid).querySelectorAll<HTMLElement>('tr.filter-row td.filter-cell')[4];
    const operation = cell.querySelector<HTMLButtonElement>('.filter-operation-button')!;
    const value = cell.querySelector<HTMLButtonElement>('.filter-value-button')!;
    const labels = () => [...root(grid).querySelectorAll('.filter-menu [role^=menuitem]')].map(item => item.textContent.trim().replace(/\s+/g, ' '));

    operation.click();
    await settle(grid);
    expect(labels().some(text => text.includes('(All)'))).toBe(false);
    expect([operation.getAttribute('aria-expanded'), value.getAttribute('aria-expanded')]).toEqual(['true', 'false']);

    value.click();
    await settle(grid);
    expect(labels().some(text => text.includes('(All)'))).toBe(true);
    expect([operation.getAttribute('aria-expanded'), value.getAttribute('aria-expanded')]).toEqual(['false', 'true']);

    await userEvent.keyboard('{Escape}');
    await settle(grid);
    expect(root(grid).activeElement).toBe(value);
  });

  it('filtro: campo sem fundo preenchido; a lupa fica centrada no botão da operação', async () => {
    const grid = await createGrid({ columns: columns(), items: orders(5), configure: g => g.showFilterRow = true });
    const button = root(grid).querySelectorAll<HTMLElement>('.filter-operation-button')[1];
    const icon = button.querySelector('svg')!.getBoundingClientRect();
    const box = button.getBoundingClientRect();

    expect(Math.abs((icon.top + icon.bottom) / 2 - (box.top + box.bottom) / 2)).toBeLessThan(1);
    expect(getComputedStyle(root(grid).querySelector('input.filter-editor')!).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it.each(['template', 'nested grid'])('master-detail (%s): rolar mostra as linhas virtualizadas (nenhuma faixa vazia)', async kind => {
    const grid = await createGrid({
      columns: columns(),
      items: orders(200),
      height: '460px',
      setBeforeConnect: true,
      configure: g => {
        g.keyExpr = 'id';
        g.style.width = '520px';
        g.detailRenderer = kind === 'template'
          ? (order: Order) => html`<div style="height: 90px">Detail of ${order.id}</div>`
          : (order: Order) => html`<u-grid style="display: block; height: 220px" .columns=${columns()} .items=${orders(order.id % 5 + 2)}></u-grid>`;
        // Como no exemplo: expande antes do 1º render.
        g.expandRow(1);
      },
    });

    // O usuário abriu o detalhe pelo botão: a linha 1 fica com a célula ativa
    // (no DOM, invisível, quando sai da janela).
    root(grid).querySelector<HTMLElement>('tbody.body-rows .detail-toggle-cell')!.focus();
    await settle(grid);

    const failures: string[] = [];

    for (let top = 37; top <= 3000; top += 37) {
      scroller(grid).scrollTop = top;
      // Um quadro: o que o usuário vê na rolagem (sem esperar o grid assentar).
      await nextFrame();
      await grid.updateComplete;

      const bands = blankBands(grid);

      if (bands.length) {
        failures.push(`${top}: ${bands.join(', ')}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('adicionar e cancelar a linha nova devolve a rolagem e o tamanho do corpo', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: orders(300),
      configure: g => {
        g.keyExpr = 'id';
        g.allowEditing = true;
        g.allowAdding = true;
      },
    });
    const body = () => root(grid).querySelector<HTMLElement>('tbody.body-rows')!;
    const before = { height: body().style.height, scrollHeight: scroller(grid).scrollHeight };

    scroller(grid).scrollTop = 2000;
    await settle(grid);
    grid.addRow();
    await settle(grid);
    const added = { top: scroller(grid).scrollTop, bands: blankBands(grid) };

    grid.discardChanges();
    await settle(grid);

    expect(added.bands).toEqual([]);
    expect({ height: body().style.height, scrollHeight: scroller(grid).scrollHeight }).toEqual(before);
    expect(blankBands(grid)).toEqual([]);

    // A rolagem continua viva: ir a outro ponto renderiza as linhas de lá.
    for (const top of [1000, 5000, 0]) {
      scroller(grid).scrollTop = top;
      await settle(grid);
      expect(blankBands(grid), `scrollTop ${top} (depois de adicionar em ${added.top})`).toEqual([]);
    }
  });
});

describe('rolagem sem salto', () => {
  afterEach(cleanup);

  it('1 milhão de linhas com totais: a posição não é corrigida e as linhas andam junto', async () => {
    const items = Array.from({ length: 1_000_000 }, (_, i) => ({ id: i, name: `Name ${i}`, country: `C${i % 9}`, total: i }));
    const grid = await createGrid({
      columns: columns(),
      items,
      height: '480px',
      configure: g => {
        g.keyExpr = 'id';
        g.style.width = '500px';
        g.showFilterRow = true;
        g.summary = { total: [{ column: 'id', type: 'count' }, { column: 'total', type: 'sum' }] };
      },
    });
    const sc = scroller(grid);
    const log: string[] = [];

    // Célula ativa numa linha que sai da janela ao rolar (fica no DOM, invisível).
    root(grid).querySelector<HTMLElement>('tbody.body-rows > tr[data-index="1"] > td')!.focus();
    await settle(grid);
    const rowTop = (index: number) => root(grid).querySelector<HTMLElement>(`tbody.body-rows > tr[data-index="${index}"]`)
      ?.getBoundingClientRect().top;
    const footer = () => root(grid).querySelector('tfoot')!.getBoundingClientRect().top;
    const f0 = footer();

    for (let i = 0; i < 60; i++) {
      const before = sc.scrollTop;
      const anchor = [...root(grid).querySelectorAll<HTMLElement>('tbody.body-rows > tr[data-index]')][5];
      const index = Number(anchor.dataset.index);
      const top0 = anchor.getBoundingClientRect().top;
      sc.scrollTop = before + 37;
      await nextFrame();
      await grid.updateComplete;
      const after = sc.scrollTop;
      const top1 = rowTop(index);

      if (Math.abs(after - before - 37) > 0.5 || top1 === undefined || Math.abs(top0 - top1 - 37) > 0.5 || Math.abs(footer() - f0) > 0.5) {
        log.push(`${i}: st ${before}→${after} row ${index} ${top0}→${top1} footer ${footer()}`);
      }
    }

    for (let i = 0; i < 30; i++) {
      sc.scrollLeft += 23;
      await nextFrame();
      await grid.updateComplete;

      if (Math.abs(footer() - f0) > 0.5) {
        log.push(`h${i}: footer ${footer()}`);
      }
    }

    expect(log).toEqual([]);
  });
});
