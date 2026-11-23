/**
 * Frente 30: com `scroll-container`, o eixo `block` (padrão) deixa a rolagem
 * vertical no contêiner externo e traz a horizontal para dentro do grid, em
 * faixas (cabeçalho, corpo, rodapé) com o mesmo `<colgroup>` e uma barra
 * horizontal própria no rodapé grudado. O eixo `both` (0.4.x) segue em
 * `parent-scroll.browser.test.ts`.
 */
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { settle } from './test/fixture.js';

import './grid.js';

const ROW = 48;
const cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups.splice(0).forEach(fn => fn());
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  vi.restoreAllMocks();
});

type Port = 'element' | 'window';

interface MakeOptions {
  rows?: number;
  cols?: number;
  rtl?: boolean;
  bands?: boolean;
  totals?: boolean;
  /** Larguras das colunas (`undefined` = sem `width`). */
  width?: (index: number) => number | undefined;
  configure?: (grid: DataGrid) => void;
}

const make = async (port: Port, options: MakeOptions = {}) => {
  const { rows = 1000, cols = 12, totals = true, width = () => 150 } = options;
  const parent = document.createElement('div');
  parent.id = 'hs-outer';

  if (port === 'element') {
    parent.style.cssText = 'height:400px;width:700px;overflow:auto;';
  }

  if (options.rtl) {
    parent.dir = 'rtl';
  }

  const above = Object.assign(document.createElement('div'), { style: 'height:300px' });
  const below = Object.assign(document.createElement('div'), { style: 'height:600px' });
  const grid = document.createElement('u-grid');
  grid.setAttribute('scroll-container', port === 'element' ? 'hs-outer' : 'window');
  grid.rowHeight = ROW;
  grid.keyExpr = 'c0';
  const leaves: GridColumnDef[] = Array.from({ length: cols }, (_, i) => ({
    path: `c${i}`, label: `C${i}`, width: width(i), fixed: i === 0 ? 'start' as const : undefined,
  }));
  grid.columns = options.bands ? [leaves[0], { label: 'Band', columns: leaves.slice(1, 3) }, ...leaves.slice(3)] : leaves;
  grid.items = Array.from({ length: rows }, (_, r) => Object.fromEntries(leaves.map((__, c) => [`c${c}`, c ? `${r}-${c}` : `r${r}`])));

  if (totals) {
    grid.summary = { total: [{ column: 'c1', type: 'count' }] };
  }

  options.configure?.(grid);
  parent.append(above, grid, below);
  document.body.append(parent);
  cleanups.push(() => parent.remove());
  await settle(grid);
  await settle(grid);

  const scroller = port === 'element' ? parent : document.scrollingElement as HTMLElement;

  const scrollTo = async (y: number) => {
    if (port === 'element') {
      parent.scrollTop = y;
    } else {
      window.scrollTo({ top: y, behavior: 'instant' });
    }

    await settle(grid);
    await settle(grid);
  };

  const rect = () => {
    if (port === 'window') {
      return { top: 0, bottom: document.documentElement.clientHeight };
    }

    const box = parent.getBoundingClientRect();
    return { top: box.top, bottom: box.top + parent.clientHeight };
  };

  return { grid, parent, scroller, scrollTo, rect };
};

const sh = (grid: DataGrid) => grid.shadowRoot!;
const band = (grid: DataGrid, name: 'head' | 'body' | 'foot-rows') => sh(grid).querySelector<HTMLElement>(`.band-${name}`)!;
const bar = (grid: DataGrid) => sh(grid).querySelector<HTMLElement>('.hscroll')!;

const scrollBody = async (grid: DataGrid, left: number) => {
  band(grid, 'body').scrollLeft = left;
  await settle(grid);
};

/** Bordas de cada coluna (pelo `aria-colindex`) numa faixa. */
const edges = (grid: DataGrid, selector: string): Map<string, { left: number; right: number }> => {
  const result = new Map<string, { left: number; right: number }>();

  for (const cell of sh(grid).querySelectorAll<HTMLElement>(selector)) {
    const box = cell.getBoundingClientRect();
    result.set(cell.getAttribute('aria-colindex')!, { left: box.left, right: box.right });
  }

  return result;
};

/** Cabeçalho, 1ª linha do corpo e totais com as mesmas bordas (±0,5px). */
const expectAligned = (grid: DataGrid) => {
  const head = edges(grid, '.band-head th.header-column');
  const body = edges(grid, '.band-body tbody.body-rows > tr[data-index]:not(.pinned) > td[aria-colindex]');
  const foot = edges(grid, '.band-foot-rows tfoot td[aria-colindex]');

  expect(head.size).toBeGreaterThan(3);

  for (const [col, box] of head) {
    const cell = body.get(col);
    expect(cell, `coluna ${col} no corpo`).toBeDefined();
    expect(Math.abs(cell!.left - box.left), `borda inicial da coluna ${col}`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(cell!.right - box.right), `borda final da coluna ${col}`).toBeLessThanOrEqual(0.5);

    const total = foot.get(col);

    if (total) {
      expect(Math.abs(total.left - box.left), `borda dos totais da coluna ${col}`).toBeLessThanOrEqual(0.5);
    }
  }
};

const activeCell = (grid: DataGrid) =>
  sh(grid).querySelector<HTMLElement>('table > :is(thead, tbody, tfoot) > tr > [tabindex="0"]')!;

const press = async (grid: DataGrid, key: string, init: KeyboardEventInit = {}) => {
  const target = (sh(grid).activeElement ?? activeCell(grid)) as HTMLElement;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
  await settle(grid);
};

describe('rolagem horizontal no grid (spec 30, eixo block)', () => {
  for (const port of ['element', 'window'] as const) {
    for (const rtl of [false, true]) {
      describe(`${port}${rtl ? ', RTL' : ''}`, () => {
        it('o grid fica na largura dada e o contêiner não rola na horizontal', async () => {
          const { grid, parent, scroller } = await make(port, { rtl, cols: 20 });
          const root = sh(grid);

          expect(root.querySelector('.layout')!.classList.contains('axis-block')).toBe(true);
          expect(Math.round(grid.getBoundingClientRect().width)).toBe(parent.clientWidth);
          expect(scroller.scrollWidth).toBe(scroller.clientWidth);
          expect(parent.scrollWidth).toBe(parent.clientWidth);
          // A tabela é mais larga: quem rola é o corpo, e a barra própria aparece.
          expect(band(grid, 'body').scrollWidth).toBeGreaterThan(band(grid, 'body').clientWidth);
          expect(bar(grid).hidden).toBe(false);
        });

        it('rolar o corpo move cabeçalho, rodapé e barra; a barra move o corpo; colunas alinhadas', async () => {
          const { grid } = await make(port, { rtl, cols: 20, bands: true });
          const sign = rtl ? -1 : 1;

          expectAligned(grid);
          await scrollBody(grid, sign * 900);
          expect(Math.abs(band(grid, 'body').scrollLeft)).toBe(900);
          expect(band(grid, 'head').scrollLeft).toBe(band(grid, 'body').scrollLeft);
          expect(band(grid, 'foot-rows').scrollLeft).toBe(band(grid, 'body').scrollLeft);
          expect(bar(grid).scrollLeft).toBe(band(grid, 'body').scrollLeft);
          expectAligned(grid);

          bar(grid).scrollLeft = sign * 300;
          await settle(grid);
          expect(band(grid, 'body').scrollLeft).toBe(sign * 300);
          expect(band(grid, 'head').scrollLeft).toBe(sign * 300);
          expectAligned(grid);

          // O navegador rola o cabeçalho sozinho (foco por Tab, Ctrl+F): o corpo acompanha.
          band(grid, 'head').scrollLeft = sign * 600;
          await settle(grid);
          expect(band(grid, 'body').scrollLeft).toBe(sign * 600);
          expectAligned(grid);
        });

        it('coluna fixa parada na borda do grid em qualquer ponto da rolagem', async () => {
          const { grid } = await make(port, { rtl, cols: 20 });
          const box = grid.getBoundingClientRect();

          for (const left of [0, 700, 5000]) {
            await scrollBody(grid, (rtl ? -1 : 1) * left);

            for (const selector of ['.band-head th.fixed', '.band-body td.fixed', '.band-foot-rows td.fixed']) {
              const fixed = sh(grid).querySelector(selector)!.getBoundingClientRect();
              expect(Math.round(rtl ? box.right - fixed.right : fixed.left - box.left), selector).toBe(0);
            }
          }
        });
      });
    }

    it(`${port}: cabeçalho gruda no topo e totais + barra no pé da porta`, async () => {
      const { grid, scrollTo, rect } = await make(port, { cols: 20 });
      await scrollTo(3000);
      const p = rect();
      const head = band(grid, 'head').getBoundingClientRect();
      const toolbar = sh(grid).querySelector('.header');
      const foot = sh(grid).querySelector('.band-foot')!.getBoundingClientRect();

      expect(Math.round(head.top - (toolbar ? toolbar.getBoundingClientRect().bottom : p.top))).toBe(0);
      expect(Math.round(p.bottom - foot.bottom)).toBe(0);
      expect(Math.round(bar(grid).getBoundingClientRect().bottom)).toBe(Math.round(p.bottom));
    });
  }

  it('Shift+roda e roda horizontal sobre o cabeçalho rolam o corpo; roda vertical passa', async () => {
    const { grid } = await make('element', { cols: 20 });
    const head = band(grid, 'head');

    const shift = new WheelEvent('wheel', { deltaY: 120, shiftKey: true, bubbles: true, cancelable: true });
    head.dispatchEvent(shift);
    await settle(grid);
    expect(shift.defaultPrevented).toBe(true);
    expect(band(grid, 'body').scrollLeft).toBe(120);
    expect(head.scrollLeft).toBe(120);

    const sideways = new WheelEvent('wheel', { deltaX: 80, bubbles: true, cancelable: true });
    band(grid, 'foot-rows').dispatchEvent(sideways);
    await settle(grid);
    expect(band(grid, 'body').scrollLeft).toBe(200);

    const vertical = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    head.dispatchEvent(vertical);
    expect(vertical.defaultPrevented).toBe(false);
  });

  it('larguras: autor, usuário, column-auto-width e 150px padrão — alinhadas nas três faixas', async () => {
    const { grid } = await make('element', { cols: 8, width: i => i === 1 ? 210 : i % 2 ? undefined : 120 });
    const colWidth = (index: number) => sh(grid).querySelector<HTMLElement>(`.band-head th.header-column[aria-colindex="${index + 1}"]`)!.offsetWidth;

    expect(colWidth(1)).toBe(210);
    expect(colWidth(2)).toBe(120);
    // Sem `width`: 150px, nunca medida pelo conteúdo de cada tabela.
    expect(colWidth(3)).toBe(150);
    expectAligned(grid);

    grid.setColumnWidth(grid.columns[3], 260);
    await settle(grid);
    expect(colWidth(3)).toBe(260);
    expectAligned(grid);

    grid.columnAutoWidth = true;
    await settle(grid);
    await settle(grid);
    expectAligned(grid);
  });

  it('column-auto-width: rolar o grid não muda nenhuma largura (mede uma vez e congela)', async () => {
    const { grid, scrollTo } = await make('element', {
      cols: 6,
      width: () => undefined,
      configure: g => {
        g.columnAutoWidth = true;
        g.items = Array.from({ length: 1000 }, (_, r) => ({ c0: `r${r}`, c1: r === 800 ? 'a very long text in row 800 that would widen the column' : 'x', c2: 'y', c3: 'z', c4: 'w', c5: 'v' }));
      },
    });
    const widths = () => [...sh(grid).querySelectorAll<HTMLElement>('.band-head th.header-column')].map(th => th.offsetWidth);
    const before = widths();

    await scrollTo(300 + 790 * ROW);
    await scrollBody(grid, 400);
    expect(widths()).toEqual(before);
    expectAligned(grid);
  });

  it('teclado: coluna fora da vista revelada no corpo e no cabeçalho; RTL no cabeçalho', async () => {
    for (const rtl of [false, true]) {
      const { grid } = await make('element', { cols: 20, rtl });
      expect(grid.focusCell('r0', 'c0')).toBe(true);
      await settle(grid);
      await settle(grid);

      await press(grid, 'End');
      const cell = activeCell(grid);
      const body = band(grid, 'body').getBoundingClientRect();
      const box = cell.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(body.left - 0.5);
      expect(box.right).toBeLessThanOrEqual(body.right + 0.5);
      expect(band(grid, 'head').scrollLeft).toBe(band(grid, 'body').scrollLeft);

      // Volta ao começo pelo cabeçalho: a 2ª coluna (depois da fixa) aparece inteira, fora da fixa.
      await press(grid, 'Home', { ctrlKey: true });
      await press(grid, 'ArrowUp');
      await press(grid, 'End');
      await press(grid, 'Home');
      await press(grid, rtl ? 'ArrowLeft' : 'ArrowRight');
      const th = activeCell(grid);
      expect(th.tagName).toBe('TH');
      const fixed = sh(grid).querySelector('.band-head th.fixed')!.getBoundingClientRect();
      const thBox = th.getBoundingClientRect();
      expect(rtl ? thBox.right <= fixed.left + 0.5 : thBox.left >= fixed.right - 0.5).toBe(true);
      expect(band(grid, 'body').scrollLeft).toBe(band(grid, 'head').scrollLeft);
      cleanups.splice(0).forEach(fn => fn());
    }
  });

  it('foco não obscurecido (2.4.11): última linha e última coluna ficam acima dos totais e da barra', async () => {
    const { grid, rect } = await make('element', { cols: 20 });
    grid.focusCell('r999', 'c19');
    await settle(grid);
    await settle(grid);
    await settle(grid);

    const cell = activeCell(grid).getBoundingClientRect();
    const foot = sh(grid).querySelector('.band-foot')!.getBoundingClientRect();
    expect(cell.bottom).toBeLessThanOrEqual(foot.top + 0.5);
    expect(cell.top).toBeGreaterThanOrEqual(band(grid, 'head').getBoundingClientRect().bottom - 0.5);
    expect(cell.right).toBeLessThanOrEqual(band(grid, 'body').getBoundingClientRect().right + 0.5);
    expect(foot.bottom).toBeLessThanOrEqual(rect().bottom + 0.5);
  });

  it('cursor num campo da linha de filtro rola o cabeçalho: o corpo realinha', async () => {
    const { grid } = await make('element', { cols: 20, configure: g => {
      g.showFilterRow = true;
    } });
    const inputs = [...sh(grid).querySelectorAll<HTMLInputElement>('.band-head .filter-row input')];
    const last = inputs.at(-1)!;

    last.focus();
    await settle(grid);
    await settle(grid);
    expect(band(grid, 'head').scrollLeft).toBeGreaterThan(0);
    expect(band(grid, 'body').scrollLeft).toBe(band(grid, 'head').scrollLeft);
  });

  it('uma grade só: role na div das faixas, tabelas presentation, bandas com aria-colspan', async () => {
    const { grid } = await make('element', { bands: true });
    const root = sh(grid);
    const holder = root.querySelector('.grid-bands')!;

    expect(holder.getAttribute('role')).toBe('grid');
    expect(holder.getAttribute('aria-colcount')).toBe('12');
    expect(root.querySelectorAll('[role=grid], [role=treegrid]')).toHaveLength(1);

    for (const table of root.querySelectorAll('table.grid-table')) {
      expect(table.getAttribute('role')).toBe('presentation');
    }

    expect(root.querySelector('th.band-header')!.getAttribute('aria-colspan')).toBe('2');
    // Folhas sem banda acima cobrem os dois níveis.
    expect(root.querySelector('th.header-column[aria-colindex="1"]')!.getAttribute('aria-rowspan')).toBe('2');
  });

  it('Tab não para na barra própria (aria-hidden, tabindex -1)', async () => {
    const { grid } = await make('element', { cols: 20 });
    const before = document.createElement('button');
    before.textContent = 'before';
    grid.before(before);

    expect(bar(grid).getAttribute('aria-hidden')).toBe('true');
    expect(bar(grid).tabIndex).toBe(-1);

    before.focus();
    const visited: Element[] = [];

    for (let i = 0; i < 6; i++) {
      await userEvent.keyboard('{Tab}');
      visited.push(sh(grid).activeElement ?? document.activeElement!);
    }

    expect(visited).not.toContain(bar(grid));
    expect(visited.some(element => element.classList.contains('band'))).toBe(false);

    // E de volta com Shift+Tab, também com a linha de filtro e sem dados.
    grid.showFilterRow = true;
    grid.items = [];
    await settle(grid);

    for (let i = 0; i < 8; i++) {
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      const active = sh(grid).activeElement;
      expect(active === bar(grid) || !!active?.classList.contains('band')).toBe(false);
    }
  });

  it('axe sem violações: com bandas, agrupado, RTL, sem dados e carregando', async () => {
    const extras = (g: DataGrid) => {
      g.selectionMode = 'multiple';
      g.showFilterRow = true;
      g.fixedTopItems = [g.items[0]];
      g.fixedBottomItems = [g.items[1]];
    };

    for (const options of [
      { bands: true, rtl: true },
      { rtl: true, configure: extras },
      { configure: (g: DataGrid) => {
        g.columns = g.columns.map((c, i) => i === 2 ? { ...c, groupIndex: 0 } : c);
      } },
    ] as MakeOptions[]) {
      const { grid, parent } = await make('element', { cols: 20, ...options });
      await scrollBody(grid, 500);
      const result = await axe.run(parent, { resultTypes: ['violations'] });
      expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.html.slice(0, 120) + ' / ' + n.failureSummary).join(' | ')}`), JSON.stringify(options)).toEqual([]);

      grid.items = [];
      await settle(grid);
      // A faixa do corpo transborda mesmo vazia: a regra de área rolável se aplica (não fica "inaplicável").
      expect(band(grid, 'body').scrollWidth).toBeGreaterThan(band(grid, 'body').clientWidth);
      const rolable = await axe.run(parent, { runOnly: ['scrollable-region-focusable'] });
      expect(rolable.violations.map(v => v.id)).toEqual([]);
      expect([...rolable.passes, ...rolable.incomplete].map(v => v.id)).toContain('scrollable-region-focusable');
      const empty = await axe.run(parent, { resultTypes: ['violations'] });
      expect(empty.violations.map(v => v.id)).toEqual([]);

      grid.loading = true;
      await settle(grid);
      const loading = await axe.run(parent, { resultTypes: ['violations'] });
      expect(loading.violations.map(v => v.id)).toEqual([]);
      cleanups.splice(0).forEach(fn => fn());
    }
  });

  it('eixo both (atributo): o comportamento da 0.4.x, uma tabela só', async () => {
    const { grid, parent } = await make('element', { cols: 20, configure: g => g.setAttribute('scroll-container-axis', 'both') });
    const root = sh(grid);

    expect(root.querySelector('.layout')!.classList.contains('axis-block')).toBe(false);
    expect(root.querySelector('.grid-bands')).toBeNull();
    expect(root.querySelector('table.grid-table')!.getAttribute('role')).toBe('grid');
    expect(parent.scrollWidth).toBeGreaterThan(parent.clientWidth);

    // E de volta ao padrão pela propriedade.
    grid.scrollContainerAxis = 'block';
    await settle(grid);
    await settle(grid);
    expect(root.querySelector('.grid-bands')).not.toBeNull();
    expect(parent.scrollWidth).toBe(parent.clientWidth);
    expectAligned(grid);
  });

  it('num pai flex: block encolhe o grid até o pai; both pela propriedade volta ao min-width automático', async () => {
    const { grid, parent } = await make('element', { cols: 20, configure: g => g.style.setProperty('flex', '1') });
    parent.style.display = 'flex';
    parent.style.flexDirection = 'row';
    await settle(grid);

    expect(getComputedStyle(grid).minInlineSize).toBe('0px');
    expect(Math.round(grid.getBoundingClientRect().width)).toBe(parent.clientWidth);

    grid.scrollContainerAxis = 'both';
    await settle(grid);
    await settle(grid);
    expect(getComputedStyle(grid).minInlineSize).toBe('auto');
    expect(grid.getBoundingClientRect().width).toBeGreaterThan(parent.clientWidth);
  });

  it('clique no vazio do corpo ou na barra própria: o foco volta à célula, nunca fica na faixa', async () => {
    const { grid } = await make('element', { cols: 20, rows: 3 });
    expect(grid.focusCell('r1', 'c2')).toBe(true);
    await settle(grid);
    const cell = sh(grid).activeElement;

    for (const target of [band(grid, 'body'), bar(grid)]) {
      target.focus();
      await settle(grid);
      expect(sh(grid).activeElement).toBe(cell);
    }
  });

  it('aria-colspan explícito no rótulo de grupo e na célula sem dados', async () => {
    const { grid } = await make('element', {
      cols: 6,
      configure: g => {
        g.columns = g.columns.map((c, i) => i === 2 ? { ...c, groupIndex: 0 } : c);
      },
    });
    const colCount = () => sh(grid).querySelector('.grid-bands')!.getAttribute('aria-colcount');
    const label = sh(grid).querySelector('td.grouping-cell')!;
    expect(label.getAttribute('aria-colspan')).toBe(colCount());

    grid.items = [];
    await settle(grid);
    const empty = sh(grid).querySelector('td[part="no-data"]')!;
    expect(empty.getAttribute('aria-colspan')).toBe(colCount());
    expect(empty.getAttribute('tabindex')).toBe('-1');
  });

  it('regra dos 50%: porta baixa, as faixas deixam de grudar; porta alta, voltam', async () => {
    const { grid, parent, scrollTo } = await make('element', {
      cols: 20,
      configure: g => {
        g.showFilterRow = true;
        g.showGroupPanel = true;
      },
    });
    parent.style.height = '220px';
    await settle(grid);
    await settle(grid);
    const container = sh(grid).querySelector('.container')!;
    expect(container.classList.contains('bands-scroll')).toBe(true);
    expect(getComputedStyle(band(grid, 'head')).position).toBe('relative');

    await scrollTo(3000);
    expect(grid.focusCell('r500', 'c3')).toBe(true);
    await settle(grid);
    await settle(grid);
    const cell = activeCell(grid).getBoundingClientRect();
    const toolbar = sh(grid).querySelector('.header')!.getBoundingClientRect();
    expect(cell.top).toBeGreaterThanOrEqual(toolbar.bottom - 0.5);

    parent.style.height = '900px';
    await settle(grid);
    await settle(grid);
    expect(container.classList.contains('bands-scroll')).toBe(false);
    expect(getComputedStyle(band(grid, 'head')).position).toBe('sticky');
  });

  it('valor inválido: block, com um aviso por valor', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
    });
    const { grid } = await make('element', { configure: g => g.setAttribute('scroll-container-axis', 'inline') });

    expect(sh(grid).querySelector('.grid-bands')).not.toBeNull();
    const calls = warn.mock.calls.flat().filter(text => String(text).includes('scroll-container-axis="inline"'));
    expect(calls).toHaveLength(1);
  });

  it('sem scroll-container o eixo não tem efeito', async () => {
    const grid = document.createElement('u-grid');
    grid.style.cssText = 'display:block;height:300px;width:500px';
    grid.scrollContainerAxis = 'block';
    grid.columns = [{ path: 'a', label: 'A' }];
    grid.items = [{ a: 1 }];
    document.body.append(grid);
    cleanups.push(() => grid.remove());
    await settle(grid);

    expect(sh(grid).querySelector('.grid-bands')).toBeNull();
    expect(sh(grid).querySelector('table.grid-table')!.getAttribute('role')).toBe('grid');
  });
});
