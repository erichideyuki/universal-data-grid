import { afterEach, describe, expect, it } from 'vitest';

import { cleanup, createGrid, nextFrame, settle } from './test/fixture.js';

afterEach(cleanup);

const ROWS = 100_000;

const items = Array.from({ length: ROWS }, (_, i) => ({
  country: `Country ${i % 16}`,
  code: `C${i % 16}`,
  year: 1960 + i % 65,
  population: i * 7,
}));

describe('desempenho com 100 mil linhas', () => {
  it('agrupa, expande, rola e reagrupa dentro do orçamento', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'country', label: 'Country', groupIndex: 0 },
        { path: 'code', label: 'Code' },
        { path: 'year', label: 'Year' },
        { path: 'population', label: 'Population' },
      ],
      items,
      configure: g => g.autoExpandGroups = true,
      height: '600px',
    });

    const scroller = grid.shadowRoot!.querySelector('.scroll-container')!;
    const frameTimes: number[] = [];

    for (let i = 0; i < 40; i++) {
      const start = performance.now();
      scroller.scrollTop += 4800;
      await nextFrame();
      await grid.updateComplete;
      frameTimes.push(performance.now() - start);
    }

    let start = performance.now();
    grid.groupColumn(grid._regularColumns[1], 1);
    await settle(grid);
    const regroupMs = performance.now() - start;

    start = performance.now();
    grid.items = [...items];
    await settle(grid);
    const reloadMs = performance.now() - start;

    const worstFrame = Math.max(...frameTimes);
    console.log(`[perf] pior frame ${worstFrame.toFixed(1)} ms, reagrupar ${regroupMs.toFixed(0)} ms, trocar items ${reloadMs.toFixed(0)} ms`);

    expect(grid.shadowRoot!.querySelectorAll('tbody tr[role=row]').length).toBeLessThan(80);
    expect(worstFrame).toBeLessThan(100);
    expect(regroupMs).toBeLessThan(1000);
    expect(reloadMs).toBeLessThan(1000);
  });

  it('ordena 100 mil linhas do demo em < 200 ms', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'country', label: 'Country' },
        { path: 'code', label: 'Code' },
        { path: 'year', label: 'Year' },
        { path: 'population', label: 'Population' },
      ],
      items,
      configure: g => g.sortMode = 'multiple',
      height: '600px',
    });

    const timings = await measureSorts(grid, [
      ['Country', 'asc'],
      ['Country', 'desc'],
      ['Year', 'desc', true],
      ['Population', 'desc'],
    ]);

    expect(grid.getSorting().map(s => s.column.label)).toEqual(['Population']);

    for (const ms of Object.values(timings)) {
      expect(ms).toBeLessThan(200);
    }
  });

  it('pior caso: 100 mil textos únicos fora de ordem', async () => {
    const rows = items.map((item, i) => ({ ...item, name: `Item ${(i * 7919) % ROWS}` }));
    const grid = await createGrid({ columns: [{ path: 'name', label: 'Name' }], items: rows, height: '600px' });

    const timings = await measureSorts(grid, [['Name', 'asc'], ['Name', 'desc']]);

    expect(grid.shadowRoot!.querySelector('tbody tr[role=row] td')!.textContent.trim()).toBe('Item 99999');
    // 1ª ordenação calcula os postos (Intl.Collator); inverter reaproveita.
    expect(timings['Name asc']).toBeLessThan(400);
    expect(timings['Name desc']).toBeLessThan(200);
  });
});

const measureSorts = async (
  grid: Awaited<ReturnType<typeof createGrid>>,
  steps: [label: string, order: 'asc' | 'desc', append?: boolean][],
): Promise<Record<string, number>> => {
  const timings: Record<string, number> = {};

  for (const [label, order, append] of steps) {
    const column = grid.columns.find(c => c.label === label)!;
    const start = performance.now();
    grid.sortColumn(column, order, { append });
    await grid.updateComplete;
    timings[`${label} ${order}`] = performance.now() - start;
  }

  const summary = Object.entries(timings).map(([k, v]) => `${k} ${v.toFixed(0)} ms`);
  console.log(`[perf] ordenar 100 mil: ${summary.join(', ')}`);
  return timings;
};
