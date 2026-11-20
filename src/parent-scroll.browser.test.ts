/**
 * Frente 27: rolagem por contêiner externo (um ancestral ou a janela). O
 * grid perde a rolagem própria; o que gruda gruda no contêiner; linhas e
 * colunas continuam virtualizadas pela parte visível dele.
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
  document.documentElement.style.scrollPaddingTop = '';
  document.documentElement.style.scrollBehavior = '';
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  vi.restoreAllMocks();
});

type Port = 'element' | 'window';

interface MakeOptions {
  rows?: number;
  above?: number;
  below?: number;
  cols?: number;
  bands?: boolean;
  rtl?: boolean;
  /** Liga pelo atributo (padrão) ou pela propriedade. */
  by?: 'attribute' | 'property';
  totals?: boolean;
  configure?: (grid: DataGrid) => void;
}

const make = async (port: Port, options: MakeOptions = {}) => {
  const { rows = 1000, above = 300, below = 600, cols = 6, by = 'attribute', totals = true } = options;
  const parent = document.createElement('div');
  parent.id = 'outer-scroller';

  if (port === 'element') {
    parent.style.cssText = 'height:400px;width:700px;overflow:auto;';
  }

  if (options.rtl) {
    parent.dir = 'rtl';
  }

  const top = document.createElement('div');
  top.style.cssText = `height:${above}px`;
  top.className = 'above';
  const bottom = document.createElement('div');
  bottom.style.cssText = `height:${below}px`;
  const grid = document.createElement('u-grid');

  if (by === 'attribute') {
    grid.setAttribute('scroll-container', port === 'element' ? 'outer-scroller' : 'window');
  } else {
    grid.scrollContainerElement = port === 'element' ? parent : window;
  }

  grid.rowHeight = ROW;
  grid.keyExpr = 'c0';
  const leaves: GridColumnDef[] = Array.from({ length: cols }, (_, i) => ({
    path: `c${i}`, label: `C${i}`, width: 150, fixed: i === 0 ? 'start' as const : undefined,
  }));
  grid.columns = options.bands ? [leaves[0], { label: 'Band', columns: leaves.slice(1, 3) }, ...leaves.slice(3)] : leaves;
  grid.items = Array.from({ length: rows }, (_, r) => ({ c0: `r${r}`, c1: r, c2: r % 7, c3: 'x', c4: 'y', c5: 'z' }));

  if (totals) {
    grid.summary = { total: [{ column: 'c1', type: 'count' }] };
  }

  options.configure?.(grid);
  parent.append(top, grid, bottom);
  document.body.append(parent);
  cleanups.push(() => parent.remove());
  await settle(grid);
  await settle(grid);

  const scroller = port === 'element' ? parent : document.scrollingElement as HTMLElement;

  const scrollTo = async (y: number, x?: number) => {
    if (port === 'element') {
      parent.scrollTop = y;

      if (x !== undefined) {
        parent.scrollLeft = x;
      }
    } else {
      window.scrollTo({ top: y, left: x, behavior: 'instant' });
    }

    await settle(grid);
    await settle(grid);
  };

  const rect = () => {
    if (port === 'window') {
      return { top: 0, left: 0, right: document.documentElement.clientWidth, bottom: document.documentElement.clientHeight };
    }

    const box = parent.getBoundingClientRect();
    return { top: box.top, left: box.left, right: box.left + parent.clientWidth, bottom: box.top + parent.clientHeight };
  };

  return { grid, parent, top, scroller, scrollTo, rect };
};

const sh = (grid: DataGrid) => grid.shadowRoot!;

/** Pontos da janela visível dentro do corpo que não caem numa linha renderizada. */
const gaps = (grid: DataGrid, port: { top: number; bottom: number; left: number; right: number }) => {
  const body = sh(grid).querySelector('tbody.body-rows')!.getBoundingClientRect();
  const thead = sh(grid).querySelector('thead')!.getBoundingClientRect();
  const tfoot = sh(grid).querySelector('tfoot')
    ?.getBoundingClientRect();
  const from = Math.max(port.top, body.top, thead.bottom) + 1;
  const to = Math.min(port.bottom, body.bottom, tfoot ? tfoot.top : Infinity) - 1;
  const x = Math.max(port.left, body.left) + 200;
  let missing = 0;

  for (let y = from; y < to; y += 10) {
    if (!sh(grid).elementFromPoint(x, y)
      ?.closest('tr[role=row]')) {
      missing++;
    }
  }

  return missing;
};

const firstVisibleRow = (grid: DataGrid, port: { top: number; left: number }) => {
  const thead = sh(grid).querySelector('thead')!.getBoundingClientRect();
  const hit = sh(grid).elementFromPoint(Math.max(port.left, thead.left) + 200, Math.max(port.top, thead.bottom) + 5);
  return hit?.closest('tr[role=row]')?.querySelector('td[aria-colindex="1"]')?.textContent?.trim();
};

const activeCell = (grid: DataGrid) =>
  sh(grid).querySelector<HTMLElement>('table > tbody > tr > [tabindex="0"]')!;

const press = async (grid: DataGrid, key: string, init: KeyboardEventInit = {}) => {
  const target = (sh(grid).activeElement ?? activeCell(grid)) as HTMLElement;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
  await settle(grid);
};

describe('parent scroll (spec 27)', () => {
  for (const port of ['element', 'window'] as const) {
    describe(port, () => {
      it('o que gruda gruda no contêiner externo e a porta não tem buracos', async () => {
        const { grid, scrollTo, rect } = await make(port, { bands: true });
        const root = sh(grid);

        expect(root.querySelector('.layout')!.classList.contains('external-scroll')).toBe(true);
        // O grid não rola sozinho: cresce com o conteúdo.
        expect(grid.getBoundingClientRect().height).toBeGreaterThan(1000 * ROW);

        for (const y of [1500, 30000]) {
          await scrollTo(y, 300);
          const p = rect();
          const toolbar = root.querySelector('.header')!.getBoundingClientRect();
          const thead = root.querySelector('thead')!.getBoundingClientRect();
          const tfoot = root.querySelector('tfoot')!.getBoundingClientRect();
          const fixed = root.querySelector<HTMLElement>('tbody.body-rows td.fixed')!.getBoundingClientRect();

          // Barra no topo da porta, cabeçalho logo abaixo dela, totais no pé, coluna fixa na borda.
          expect(Math.round(toolbar.top - p.top)).toBe(0);
          expect(Math.round(thead.top - toolbar.bottom)).toBe(0);
          expect(Math.round(toolbar.left - p.left)).toBe(0);
          expect(Math.round(p.bottom - tfoot.bottom)).toBe(0);
          expect(Math.round(fixed.left - p.left)).toBe(0);
          expect(gaps(grid, p)).toBe(0);
        }

        // Renderiza só o visível (+ sobra), não as mil linhas.
        expect(root.querySelectorAll('tbody.body-rows tr[role=row]').length).toBeLessThan(40);
      });

      it('mostra a linha certa em cada posição, inclusive o fim com conteúdo depois do grid', async () => {
        const { grid, scroller, scrollTo, rect } = await make(port);

        // A linha 100 logo abaixo do que gruda (barra + cabeçalho).
        await scrollTo(300 + 100 * ROW);
        expect(firstVisibleRow(grid, rect())).toBe('r100');

        await scrollTo(scroller.scrollHeight);
        const rows = [...sh(grid).querySelectorAll('tbody.body-rows tr[role=row]')];
        expect(rows.at(-1)!.querySelector('td')!.textContent.trim()).toBe('r999');
        expect(gaps(grid, rect())).toBe(0);
      });

      it('scroll-padding-top do contêiner desloca o cabeçalho grudado', async () => {
        const { grid, parent, scrollTo, rect } = await make(port);
        (port === 'element' ? parent : document.documentElement).style.scrollPaddingTop = '64px';
        // O grid relê o `scroll-padding` quando a porta muda.
        window.dispatchEvent(new Event('resize'));
        parent.style.width = port === 'element' ? '701px' : '';
        await settle(grid);
        await scrollTo(5000);

        expect(Math.round(sh(grid).querySelector('.header')!.getBoundingClientRect().top - rect().top)).toBe(64);
      });
    });
  }

  it('5 milhões de linhas: sem buracos no meio e a última linha alcançável', async () => {
    const { grid, scroller, scrollTo, rect } = await make('element', { rows: 5_000_000 });

    await scrollTo(scroller.scrollTop + 400);
    expect(gaps(grid, rect())).toBe(0);

    await scrollTo(scroller.scrollHeight / 2);
    expect(gaps(grid, rect())).toBe(0);

    // Fim do contêiner (depois do grid) e volta um pouco: o fim da lista está lá.
    await scrollTo(scroller.scrollHeight);
    await scrollTo(scroller.scrollTop - 700);
    const last = [...sh(grid).querySelectorAll('tbody.body-rows tr[role=row]')].at(-1)!;
    expect(last.querySelector('td')!.textContent.trim()).toBe('r4999999');
    expect(gaps(grid, rect())).toBe(0);
  });

  it('Ctrl+End e Ctrl+Home na escala chegam ao fim e ao começo', async () => {
    const { grid, rect } = await make('element', { rows: 5_000_000 });
    grid.focusCell('r0');
    await settle(grid);
    activeCell(grid).focus();
    await press(grid, 'End', { ctrlKey: true });
    // Ctrl+End vai até os totais (navegáveis); uma acima é a última linha.
    await press(grid, 'ArrowUp');

    const end = activeCell(grid).getBoundingClientRect();
    expect(activeCell(grid).closest('tr')!.querySelector('td')!.textContent.trim()).toBe('r4999999');
    expect(end.top).toBeGreaterThanOrEqual(rect().top);
    expect(end.bottom).toBeLessThanOrEqual(sh(grid).querySelector('tfoot')!.getBoundingClientRect().top + 1);

    await press(grid, 'Home', { ctrlKey: true });

    // Ctrl+Home pode parar no cabeçalho (navegável): uma abaixo é a 1ª linha.
    if (!activeCell(grid)) {
      await press(grid, 'ArrowDown');
    }

    const start = activeCell(grid).getBoundingClientRect();
    expect(activeCell(grid).closest('tr')!.querySelector('td')!.textContent.trim()).toBe('r0');
    expect(start.top).toBeGreaterThanOrEqual(sh(grid).querySelector('thead')!.getBoundingClientRect().bottom - 1);
  });

  for (const rtl of [false, true]) {
    it(`colunas virtualizadas pelo scrollLeft do contêiner${rtl ? ' (RTL)' : ''}`, async () => {
      const { grid, parent, scrollTo, rect } = await make('element', { rows: 100, cols: 300, rtl });

      for (const x of [0, 6000, 30000]) {
        await scrollTo(1000, rtl ? -x : x);
        const p = rect();
        const headers = sh(grid).querySelectorAll('th.header-column').length;
        const center = sh(grid).elementFromPoint((p.left + p.right) / 2, p.top + 200)
          ?.closest('td');

        expect(headers).toBeLessThan(20);
        // A célula no centro da porta está renderizada (não é espaço vazio).
        expect(center?.getAttribute('aria-colindex')).toBeTruthy();
        expect(Number(center!.getAttribute('aria-colindex'))).toBeGreaterThanOrEqual(Math.floor(x / 150));
        // Sombras: há colunas escondidas antes da borda inicial depois de rolar.
        expect(sh(grid).querySelector('.container')!.classList.contains('scroll-start')).toBe(x > 0);
      }

      expect(parent.scrollWidth).toBeGreaterThanOrEqual(300 * 150);
    });
  }

  for (const rtl of [false, true]) {
    it(`teclado: a célula ativa para abaixo do cabeçalho, acima dos totais e fora da coluna fixa${rtl ? ' (RTL)' : ''}`, async () => {
      const { grid, parent, rect } = await make('element', { cols: 12, rtl });
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
      const back = rtl ? 'ArrowRight' : 'ArrowLeft';
      parent.style.scrollPaddingTop = '40px';
      parent.style.width = '702px';
      await settle(grid);
      grid.focusCell('r0', 'c1');
      await settle(grid);
      activeCell(grid).focus();

      for (let i = 0; i < 20; i++) {
        await press(grid, 'ArrowDown');
      }

      const cell = activeCell(grid).getBoundingClientRect();
      const tfoot = sh(grid).querySelector('tfoot')!.getBoundingClientRect();
      expect(cell.bottom).toBeLessThanOrEqual(tfoot.top + 1);
      expect(cell.bottom).toBeLessThanOrEqual(rect().bottom);

      await press(grid, 'PageDown');
      await press(grid, 'PageUp');
      await press(grid, 'PageUp');
      const up = activeCell(grid).getBoundingClientRect();
      const thead = sh(grid).querySelector('thead')!.getBoundingClientRect();
      expect(up.top).toBeGreaterThanOrEqual(thead.bottom - 1);
      expect(thead.top - rect().top).toBeGreaterThanOrEqual(39);

      // Para a direita até sair da porta e de volta: nunca sob a coluna fixa.
      for (let i = 0; i < 10; i++) {
        await press(grid, forward);
      }

      const far = activeCell(grid).getBoundingClientRect();
      expect(far.left).toBeGreaterThanOrEqual(rect().left - 1);
      expect(far.right).toBeLessThanOrEqual(rect().right + 1);

      for (let i = 0; i < 9; i++) {
        await press(grid, back);
      }

      const fixed = sh(grid).querySelector('tbody.body-rows td.fixed')!.getBoundingClientRect();
      const returned = activeCell(grid).getBoundingClientRect();

      if (rtl) {
        expect(returned.right).toBeLessThanOrEqual(fixed.left + 1);
      } else {
        expect(returned.left).toBeGreaterThanOrEqual(fixed.right - 1);
      }
    });
  }

  it('PageDown com o grid quase todo abaixo da dobra anda uma página da porta', async () => {
    const { grid, parent } = await make('element', { above: 330 });
    grid.focusCell('r0');
    await settle(grid);
    activeCell(grid).focus();
    parent.scrollTop = 0;
    await settle(grid);
    await press(grid, 'PageDown');

    const row = Number(activeCell(grid).closest('tr')!.getAttribute('data-index'));
    // Porta de 400px − cabeçalho − totais: bem mais que uma linha.
    expect(row).toBeGreaterThanOrEqual(4);
  });

  it('focusCell com scroll-behavior smooth: a linha fora da janela recebe o foco no scrollend', async () => {
    const { grid, parent, top, rect } = await make('element');
    const button = document.createElement('button');
    top.append(button);
    button.focus();
    parent.style.scrollBehavior = 'smooth';
    const ok = grid.focusCell('r700');
    expect(ok).toBe(true);
    await settle(grid);
    // Ainda rolando: o foco não foi para a linha invisível (`.pinned`).
    expect(document.activeElement).toBe(button);

    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 3000);
      parent.addEventListener('scrollend', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
    await settle(grid);
    await settle(grid);

    const cell = activeCell(grid);
    expect(cell.closest('tr')!.querySelector('td')!.textContent.trim()).toBe('r700');
    expect(cell.closest('tr')!.classList.contains('pinned')).toBe(false);
    const box = cell.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(sh(grid).querySelector('thead')!.getBoundingClientRect().bottom - 1);
    expect(box.bottom).toBeLessThanOrEqual(rect().bottom);
    expect(sh(grid).activeElement).toBe(cell);
  });

  it('o usuário rola no meio da rolagem suave da API: ela não é refeita e o foco não é roubado', async () => {
    const { grid, parent, top } = await make('element');
    const button = document.createElement('button');
    top.append(button);
    button.focus();
    parent.style.scrollBehavior = 'smooth';
    grid.focusCell('r700');
    await settle(grid);

    parent.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -100 }));
    parent.style.scrollBehavior = '';
    parent.scrollTop = 1000;
    await new Promise(resolve => setTimeout(resolve, 2500));
    await settle(grid);

    expect(Math.abs(parent.scrollTop - 1000)).toBeLessThan(2);
    expect(document.activeElement).toBe(button);
  });

  it('altura dada ao grid no modo externo: aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { grid } = await make('element', { configure: g => g.style.height = '300px' });
    await settle(grid);

    expect(warn.mock.calls.flat().join()).toContain('do not give it a height');
  });

  it('prefers-reduced-motion: a API rola na hora', async () => {
    const { grid, parent } = await make('element');
    parent.style.scrollBehavior = 'smooth';
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, 'matchMedia').mockImplementation(query => query.includes('reduced-motion')
      ? { matches: true, media: query } as MediaQueryList
      : real(query));
    grid.focusCell('r600');
    await settle(grid);
    await settle(grid);

    expect(parent.scrollTop).toBeGreaterThan(600 * ROW);
  });

  for (const port of ['element', 'window'] as const) {
    it(`Tab de fora com a célula ativa fora da porta e da janela virtual traz a linha (${port})`, async () => {
      const { grid, top, scrollTo, rect } = await make(port);
      grid.focusCell('r500');
      await settle(grid);
      const button = document.createElement('button');
      top.append(button);
      button.focus();
      await scrollTo(0);

      // Tab real (Playwright) do botão acima até a célula ativa (passa pela barra, se houver focáveis).
      for (let i = 0; i < 10 && sh(grid).activeElement?.tagName !== 'TD'; i++) {
        await userEvent.tab();
      }

      await settle(grid);
      await settle(grid);
      expect(sh(grid).activeElement).toBe(activeCell(grid));

      const cell = activeCell(grid);
      expect(cell.closest('tr')!.classList.contains('pinned')).toBe(false);
      const box = cell.getBoundingClientRect();
      expect(box.top).toBeGreaterThanOrEqual(rect().top);
      expect(box.bottom).toBeLessThanOrEqual(rect().bottom);
    });
  }

  it('conteúdo acima que encolhe sem rolagem: o corpo é redesenhado', async () => {
    const { grid, parent, top, scrollTo, rect } = await make('element', { above: 3000 });
    parent.style.overflowAnchor = 'none';
    await scrollTo(20000);
    expect(gaps(grid, rect())).toBe(0);

    top.style.height = '0px';

    for (let i = 0; i < 4; i++) {
      await settle(grid);
    }

    expect(gaps(grid, rect())).toBe(0);
  });

  it('porta baixa (zoom 400%): linhas fixas deixam de grudar', async () => {
    const { grid, parent } = await make('element', {
      configure: g => {
        g.fixedTopItems = [g.items[0], g.items[1]];
        g.fixedBottomItems = [g.items[2]];
      },
    });
    parent.style.height = '256px';
    await settle(grid);
    await settle(grid);

    expect(sh(grid).querySelector('.container')!.classList.contains('fixed-rows-scroll')).toBe(true);
  });

  it('pela propriedade: modo externo sem o atributo; null volta à rolagem interna', async () => {
    const { grid, parent } = await make('element', { by: 'property' });

    expect(grid.hasAttribute('scroll-container')).toBe(false);
    expect(grid.getBoundingClientRect().height).toBeGreaterThan(1000 * ROW);
    expect(parent.scrollHeight).toBeGreaterThan(1000 * ROW);

    grid.scrollContainerElement = null;
    grid.style.height = '300px';
    await settle(grid);
    await settle(grid);

    const inner = grid._scrollContainerRef.value!;
    expect(sh(grid).querySelector('.layout')!.classList.contains('external-scroll')).toBe(false);
    expect(getComputedStyle(inner).overflowY).toBe('auto');
    expect(inner.scrollHeight).toBeGreaterThan(1000 * ROW);
  });

  it('id inexistente ou não ancestral: aviso e rolagem interna', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const holder = document.createElement('div');
    holder.style.height = '300px';
    const grid = document.createElement('u-grid');
    grid.setAttribute('scroll-container', 'missing');
    grid.columns = [{ path: 'a' }];
    grid.items = Array.from({ length: 500 }, (_, a) => ({ a }));
    holder.append(grid);
    document.body.append(holder);
    cleanups.push(() => holder.remove());
    await settle(grid);
    await settle(grid);

    expect(warn.mock.calls.flat().join()).toContain('scroll-container="missing"');
    expect(grid.getBoundingClientRect().height).toBe(300);
    expect(getComputedStyle(grid._scrollContainerRef.value!).overflowY).toBe('auto');

    const other = document.createElement('div');
    document.body.append(other);
    cleanups.push(() => other.remove());
    grid.scrollContainerElement = other;
    await settle(grid);
    expect(warn.mock.calls.flat().join()).toContain('must be an ancestor');
  });

  it('ancestral intermediário com overflow: aviso, segue no modo externo', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { grid } = await make('element');
    const wrapper = document.createElement('div');
    wrapper.style.overflow = 'hidden';
    grid.replaceWith(wrapper);
    wrapper.append(grid);
    await settle(grid);

    expect(warn.mock.calls.flat().join()).toContain('overflow');
    expect(sh(grid).querySelector('.layout')!.classList.contains('external-scroll')).toBe(true);
  });

  it('trocar de contêiner: o novo passa a virtualizar', async () => {
    const { grid, parent } = await make('element', { above: 0 });
    const inner = document.createElement('div');
    inner.id = 'inner-scroller';
    inner.style.cssText = 'height:300px;overflow:auto';
    grid.replaceWith(inner);
    inner.append(grid);
    grid.setAttribute('scroll-container', 'inner-scroller');
    await settle(grid);
    await settle(grid);

    inner.scrollTop = 200 * ROW + 56 + 56;
    await settle(grid);
    await settle(grid);
    const box = inner.getBoundingClientRect();
    expect(gaps(grid, { top: box.top, bottom: box.top + inner.clientHeight, left: box.left, right: box.left + inner.clientWidth })).toBe(0);
    expect(parent.contains(grid)).toBe(true);
  });

  it('intervalo de células: arrastar perto da borda da porta rola o contêiner', async () => {
    const { grid, parent, rect } = await make('element', { configure: g => g.cellSelectionMode = 'multiple' });
    parent.scrollTop = 300;
    await settle(grid);
    const from = sh(grid).querySelector<HTMLElement>('tbody.body-rows tr[role=row] td[aria-colindex="2"]')!;
    const table = sh(grid).querySelector('table')!;
    const at = (y: number) => ({ clientX: from.getBoundingClientRect().left + 20, clientY: y });
    const init = { bubbles: true, composed: true, cancelable: true, pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1 };
    from.dispatchEvent(new PointerEvent('pointerdown', { ...init, ...at(from.getBoundingClientRect().top + 10) }));
    from.focus();
    table.dispatchEvent(new PointerEvent('pointermove', { ...init, button: -1, ...at(rect().bottom - 2) }));
    const before = parent.scrollTop;

    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }

    table.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0, ...at(rect().bottom - 2) }));
    await settle(grid);
    expect(parent.scrollTop).toBeGreaterThan(before);
  });

  for (const rtl of [false, true]) {
    it(`axe sem violações no modo externo${rtl ? ' (RTL)' : ''}`, async () => {
      const { grid, parent, scrollTo } = await make('element', { rtl, bands: true });
      parent.tabIndex = 0;
      parent.setAttribute('role', 'region');
      parent.setAttribute('aria-label', 'Report');
      await scrollTo(3000, 100);

      const result = await axe.run(parent, { resultTypes: ['violations'] });
      expect(result.violations.map(v => v.id)).toEqual([]);

      // Sem linhas: o contêiner do hospedeiro segue com algo focável.
      grid.items = [];
      await settle(grid);
      const empty = await axe.run(parent, { resultTypes: ['violations'] });
      expect(empty.violations.map(v => v.id)).toEqual([]);
    });

    it(`RTL${rtl ? '' : ' desligado'}: coluna fixa e barra presas à borda inicial da porta`, async () => {
      const { grid, parent, scrollTo, rect } = await make('element', { rtl, cols: 12 });
      await scrollTo(2000, rtl ? -400 : 400);
      const p = rect();
      const fixed = sh(grid).querySelector('tbody.body-rows td.fixed')!.getBoundingClientRect();
      const toolbar = sh(grid).querySelector('.header')!.getBoundingClientRect();

      if (rtl) {
        expect(Math.round(p.right - fixed.right)).toBe(0);
        expect(Math.round(p.right - toolbar.right)).toBe(0);
      } else {
        expect(Math.round(fixed.left - p.left)).toBe(0);
        expect(Math.round(toolbar.left - p.left)).toBe(0);
      }

      // A barra ocupa a parte visível do grid, não a tabela inteira.
      expect(Math.round(toolbar.width)).toBe(parent.clientWidth);
    });
  }
});

// Regressão: a região `aria-live` (absoluta, no fim do grid) tinha como bloco de contenção um
// ancestral posicionado FORA do contêiner externo e esticava a página até a altura do grid
// (15 milhões de px com 1 milhão de linhas no exemplo do site).
describe('nada do grid escapa do contêiner externo', () => {
  it('ancestral posicionado em volta do contêiner: a página não cresce com o grid', async () => {
    const card = document.createElement('div');
    card.style.position = 'relative';
    const parent = document.createElement('div');
    parent.id = 'escape-scroller';
    parent.style.cssText = 'height:300px;overflow:auto';
    const grid = document.createElement('u-grid');
    grid.setAttribute('scroll-container', 'escape-scroller');
    grid.columns = [{ path: 'a', label: 'A' }];
    grid.items = Array.from({ length: 100_000 }, (_, a) => ({ a }));
    parent.append(grid);
    card.append(parent);
    document.body.append(card);
    cleanups.push(() => card.remove());
    await settle(grid);
    await settle(grid);

    expect(parent.scrollHeight).toBeGreaterThan(1_000_000);
    expect(card.scrollHeight).toBeLessThanOrEqual(card.clientHeight + 1);
    expect(document.documentElement.scrollHeight).toBeLessThan(5_000);
  });
});

// Relato de uso (0.3.0): contêiner com overflow-x: hidden escondia as colunas que transbordam, sem nenhum aviso.
describe('aviso: contêiner que corta a rolagem horizontal', () => {
  const warnings = (spy: { mock: { calls: unknown[][] } }): string[] =>
    spy.mock.calls.map(call => String(call[0])).filter(text => text.includes('overflow-x: hidden/clip'));

  it('contêiner com overflow-x: hidden e tabela mais larga que o grid avisa uma vez; sem transbordo, não', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { parent, grid } = await make('element', { cols: 6, configure: g => g.style.width = '500px' });

    expect(warnings(warn)).toEqual([]);

    parent.style.overflowX = 'hidden';
    grid.style.width = '480px';
    await settle(grid);
    await settle(grid);
    expect(warnings(warn)).toHaveLength(1);

    // Os mesmos avisos não se repetem a cada medida.
    grid.style.width = '470px';
    await settle(grid);
    await settle(grid);
    expect(warnings(warn)).toHaveLength(1);
  });

  it('janela: <body> com overflow-x: hidden avisa', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    document.body.style.overflowX = 'hidden';
    cleanups.push(() => document.body.style.removeProperty('overflow-x'));
    await make('window', { cols: 12 });

    expect(warnings(warn)).toHaveLength(1);
    expect(warnings(warn)[0]).toContain('<body>');
  });
});
