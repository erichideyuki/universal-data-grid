/**
 * Desempenho do filtro no perfil de máquina fraca (spec 04 + spec 16):
 * `npm run test:perf`.
 *
 * Tempos convertidos para a máquina fraca pelo fator calibrado
 * (`src/test/perf.ts`), conferidos contra os orçamentos da spec 16 e a linha
 * de base (`.specs/16-performance.baseline.json`, cenários `filter-*`).
 *
 * Até `SYNC_FILTER_LIMIT` (200 mil) o filtro roda de uma vez: cada mudança é
 * uma interação (≤ 200 ms até 100 mil). Acima, roda em fatias entre quadros
 * para não travar a digitação: o que importa é a MAIOR tarefa enquanto o
 * usuário digita (`typingWorstMs`, orçamento de resposta imediata) e o tempo
 * até o resultado (`filterMs`, ≤ 1,5 ms por mil linhas).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { DataGrid } from './grid.js';
import { cleanup } from './test/fixture.js';
import { makeColumns, makeItems } from './test/perf-data.js';
import { measureWork, nextFrame, painted, type PerfSession, startPerf, updatesDone } from './test/perf.js';
import './grid.js';

/** Repetições de cada medida; vale a melhor. */
const REPEATS = 3;

/** Orçamentos da spec 16 (máquina fraca). */
const BUDGET = {
  interactionMs: (rows: number) => Math.max(200, rows * 1.5 / 1000),
  /** Maior tarefa durante a digitação / filtragem em fatias: resposta imediata. */
  typingWorstMs: 200,
};

let perf: PerfSession;

const rowCount = (grid: DataGrid) =>
  Number(grid.shadowRoot!.querySelector('[role=grid]')!.getAttribute('aria-rowcount'))
  - (grid.showColumnHeaders ? 1 : 0) - (grid.showFilterRow ? 1 : 0);

const createGrid = async (items: object[], filterRow = false): Promise<DataGrid> => {
  const grid = document.createElement('u-grid');

  grid.style.display = 'block';
  grid.style.height = '600px';
  grid.showFilterRow = filterRow;
  grid.columns = makeColumns();
  grid.items = items;
  document.body.append(grid);
  await painted(grid);

  return grid;
};

/** Mudança de filtro → `{nome}Ms` na máquina fraca, melhor de {@link REPEATS}. */
const filterChange = async (name: string, grid: DataGrid, apply: () => void) => {
  let best = Infinity;

  for (let i = 0; i < REPEATS; i++) {
    grid.filterValue = null;
    grid.searchText = '';
    await painted(grid);
    perf.recalibrate();
    best = Math.min(best, perf.weak(await measureWork(grid, apply)));
  }

  return { [`${name}Ms`]: best };
};

/** Maior lacuna entre quadros (≈ a maior tarefa) enquanto `work` roda. */
const worstGapWhile = async (work: () => Promise<void>): Promise<number> => {
  let worst = 0;
  let running = true;
  let last = performance.now();

  const loop = () => {
    const now = performance.now();

    worst = Math.max(worst, now - last);
    last = now;

    if (running) {
      requestAnimationFrame(loop);
    }
  };

  requestAnimationFrame(loop);
  await nextFrame();
  last = performance.now();
  await work();
  running = false;
  await nextFrame();

  return worst;
};

/**
 * Mudança de filtro em fatias (1 milhão): `{nome}WorstMs` = maior tarefa
 * enquanto filtra (só orçamento) e `{nome}Ms` = até o resultado na tela,
 * melhor de {@link REPEATS}.
 */
const slicedChange = async (name: string, grid: DataGrid, apply: () => void) => {
  let worst = Infinity;
  let total = Infinity;

  for (let i = 0; i < REPEATS; i++) {
    grid.filterValue = null;
    grid.searchText = '';
    await painted(grid);
    perf.recalibrate();

    let elapsed = 0;
    const gap = await worstGapWhile(async () => {
      const start = performance.now();

      apply();
      await updatesDone(grid);
      grid.shadowRoot!.querySelector('tbody')!.getBoundingClientRect();
      elapsed = performance.now() - start;
    });

    worst = Math.min(worst, perf.weak(gap));
    total = Math.min(total, perf.weak(elapsed));
  }

  return { [`${name}WorstMs`]: worst, [`${name}Ms`]: total };
};

const check = (rows: number, metrics: Record<string, number>, regressions: string[]) => {
  const over = Object.entries(metrics)
    .filter(([name, value]) => name.endsWith('WorstMs')
      ? value > BUDGET.typingWorstMs
      : name.endsWith('Ms') && value > BUDGET.interactionMs(rows))
    .map(([name, value]) => `${name}: ${value.toFixed(1)} > orçamento`);

  expect.soft(over, 'orçamento estourado').toEqual([]);
  expect.soft(regressions, 'pior que a linha de base').toEqual([]);
};

beforeAll(async () => {
  perf = await startPerf();

  // Aquece o JIT com os caminhos medidos.
  const grid = await createGrid(makeItems(20_000));
  const warmUps = [
    () => grid.filterValue = ['name', 'contains', '12'],
    () => grid.filterValue = ['amount', 'between', [10, 500]],
    () => grid.filterValue = ['country', 'anyof', ['Country A']],
    () => grid.searchText = 'city 1',
  ];

  for (const apply of warmUps) {
    await measureWork(grid, apply);
  }

  grid.remove();
});

afterEach(async () => {
  await perf.unthrottle();
  cleanup();
});

afterAll(async () => {
  await perf.finish();
});

describe('desempenho do filtro (máquina fraca)', () => {
  it('filter-100k: cada mudança de filtro e a busca em 24 colunas', async () => {
    const rows = 100_000;
    const grid = await createGrid(makeItems(rows));

    await perf.throttle();

    const metrics = {
      ...await filterChange('filterText', grid, () => grid.filterValue = ['name', 'contains', '123']),
      ...await filterChange('filterNumber', grid, () => grid.filterValue = ['amount', 'between', [100, 500]]),
      ...await filterChange('filterDate', grid, () => grid.filterValue = ['date', '>=', '2024-07-01']),
      ...await filterChange('filterAnyOf', grid, () => grid.filterValue = ['country', 'anyof', ['Country A', 'Country B']]),
      ...await filterChange('search', grid, () => grid.searchText = 'city 12'),
    };

    expect(rowCount(grid)).toBeGreaterThan(0);
    check(rows, metrics, perf.report('filter-100k', metrics));
  });

  it('filter-1m: digitar na linha de filtro não trava (fatias) e o resultado chega', async () => {
    const rows = 1_000_000;
    const items = makeItems(rows) as { name: string }[];
    const grid = await createGrid(items, true);
    const input = grid.shadowRoot!.querySelector<HTMLInputElement>('tr.filter-row .filter-editor[aria-label="Filter Name"]')!;

    await perf.throttle();

    let typingWorst = Infinity;

    for (let i = 0; i < REPEATS; i++) {
      grid.filterValue = null;
      await painted(grid);
      perf.recalibrate();

      const gap = await worstGapWhile(async () => {
        // Teclas seguidas: cada uma reinicia o debounce; a última aplica.
        for (const text of ['1', '12', `12${i}`]) {
          input.value = text;
          input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        await new Promise(resolve => setTimeout(resolve, 320));
        await updatesDone(grid);
        await painted(grid);
      });

      typingWorst = Math.min(typingWorst, perf.weak(gap));
    }

    expect(rowCount(grid)).toBe(items.filter(item => item.name.includes(`12${REPEATS - 1}`)).length);

    const metrics = {
      typingWorstMs: typingWorst,
      ...await slicedChange('filter', grid, () => grid.filterValue = ['name', 'contains', '123']),
      ...await slicedChange('search', grid, () => grid.searchText = 'city 12'),
    };

    expect(grid._memoryStats.filterTimers).toBe(0);
    check(rows, metrics, perf.report('filter-1m', metrics));
  });
});
