import { afterEach, describe, expect, it } from 'vitest';

import type { DataGrid } from '../grid.js';
import { cleanup, createGrid, settle } from '../test/fixture.js';
import { expectCollected, track, type Tracked } from '../test/leak.js';
import { MAX_SCROLL_HEIGHT } from './virtualizer.js';

afterEach(cleanup);

const scroller = (grid: DataGrid) => grid.shadowRoot!.querySelector<HTMLElement>('.scroll-container')!;

const renderedIndexes = (grid: DataGrid): number[] =>
  [...grid.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[data-index]')].map(row => Number(row.dataset.index));

const scrollBodyTo = async (grid: DataGrid, top: number) => {
  scroller(grid).scrollTop = top;
  await new Promise(resolve => scroller(grid).addEventListener('scroll', resolve, { once: true }));
  await settle(grid);
};

/** 1º índice cuja linha está visível no topo da área rolável. */
const topIndex = (grid: DataGrid): number => {
  const top = grid.shadowRoot!.querySelector('thead')!.getBoundingClientRect().bottom;
  const row = [...grid.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[data-index]')]
    .find(tr => tr.getBoundingClientRect().bottom > top + 1)!;

  return Number(row.dataset.index);
};

describe('virtualizador (spec 16)', () => {
  const items = Array.from({ length: 1_000_000 }, (_, n) => ({ n }));

  it('1 milhão de linhas: corpo dentro do limite do navegador e a última linha alcançável', async () => {
    const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items, height: '400px' });
    const tbody = grid.shadowRoot!.querySelector('tbody')!;

    expect(tbody.getBoundingClientRect().height).toBe(MAX_SCROLL_HEIGHT);

    await scrollBodyTo(grid, scroller(grid).scrollHeight);

    expect(Math.max(...renderedIndexes(grid))).toBe(999_999);
    expect(grid.shadowRoot!.querySelector('tbody tr.last')!.textContent.trim()).toBe('999999');

    await scrollBodyTo(grid, 0);

    expect(topIndex(grid)).toBe(0);
  });

  it('na escala, arrastar a barra é proporcional e a roda anda 1:1', async () => {
    const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items, height: '400px' });
    const max = scroller(grid).scrollHeight - scroller(grid).clientHeight;

    await scrollBodyTo(grid, max / 2);
    const middle = topIndex(grid);

    expect(Math.abs(middle - 500_000)).toBeLessThan(100);

    await scrollBodyTo(grid, scroller(grid).scrollTop + grid.rowHeight * 3);

    expect(topIndex(grid)).toBe(middle + 3);
  });

  it('sem escala, a posição é a física', async () => {
    const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: items.slice(0, 1000), height: '400px' });

    expect(grid.shadowRoot!.querySelector('tbody')!.style.height).toBe(`${1000 * grid.rowHeight}px`);

    await scrollBodyTo(grid, 500 * grid.rowHeight);

    expect(Math.abs(topIndex(grid) - 500)).toBeLessThanOrEqual(2);
  });
});

describe('scrollToIndex do virtualizador', () => {
  const items = Array.from({ length: 1_000_000 }, (_, n) => ({ n }));

  for (const [label, count] of [['sem escala', 5000], ['com escala', 1_000_000]] as const) {
    it(`${label}: alinha no topo, no fim e só rola se precisar`, async () => {
      const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: items.slice(0, count), height: '400px' });
      const virtualizer = grid._virtualizer;
      const target = Math.floor(count * 0.73);

      virtualizer.scrollToIndex(target, { align: 'start' });
      await settle(grid);
      expect(topIndex(grid)).toBe(target);

      virtualizer.scrollToIndex(target + 2);
      await settle(grid);
      expect(topIndex(grid)).toBe(target);

      virtualizer.scrollToIndex(count - 1);
      await settle(grid);
      expect(Math.max(...renderedIndexes(grid))).toBe(count - 1);

      virtualizer.scrollToIndex(0);
      await settle(grid);
      expect(topIndex(grid)).toBe(0);
    });
  }
});

describe('memória do virtualizador (spec 14)', () => {
  it('grid com 1 milhão de linhas rolado e removido é coletado (listener e observer soltos)', async () => {
    const scenario = async (): Promise<Tracked> => {
      const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: Array.from({ length: 1_000_000 }, (_, n) => ({ n })), height: '400px' });
      const container = scroller(grid);

      await scrollBodyTo(grid, container.scrollHeight / 3);
      grid._virtualizer.scrollToIndex(10);
      await settle(grid);
      grid.remove();
      await settle(grid);

      return track({ grid, container, virtualizer: grid._virtualizer });
    };

    await expectCollected(await scenario());
  });

  it('alturas medidas (wrap) não se acumulam ao trocar items num grid de vida longa', async () => {
    const text = Array(20).fill('word')
      .join(' ');
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A', width: 80, wrap: true }],
      items: Array.from({ length: 200 }, () => ({ a: text })),
      height: '400px',
      // Estreito: a última coluna leva a sobra da largura e o texto deixaria de quebrar.
      configure: g => g.style.width = '120px',
    });

    for (let round = 0; round < 5; round++) {
      await scrollBodyTo(grid, (round + 1) * 300);
      expect(grid._memoryStats.measuredSizes).toBeGreaterThan(renderedIndexes(grid).length);

      // Outros itens: as alturas são por índice e recomeçam — só a 1ª janela
      // (estimada com `rowHeight`; a âncora de rolagem pode pedir mais uma) fica medida.
      grid.items = Array.from({ length: 200 }, () => ({ a: text }));
      await settle(grid);
      expect(grid._memoryStats.measuredSizes).toBeLessThanOrEqual(2 * (Math.ceil(400 / grid.rowHeight) + 2 * 3 + 2));
    }
  });
});
