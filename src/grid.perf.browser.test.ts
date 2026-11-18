/**
 * Desempenho no perfil de máquina fraca (spec 16): `npm run test:perf`.
 *
 * Cada cenário mede no grid real (Chromium sem GPU) o trabalho de cada
 * render, passo de rolagem e interação, convertido para a máquina fraca pelo
 * fator calibrado (`src/test/perf.ts`), e confere (1) os orçamentos da spec
 * e (2) a linha de base em `.specs/16-performance.baseline.json`, com
 * tolerância. Cada medida é a melhor de {@link REPEATS} (o ruído da máquina
 * só soma tempo). Os dados são gerados antes de medir (não são o grid).
 */
import { html } from 'lit';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup } from './test/fixture.js';
import { makeColumns, makeItems, makeLeanColumns, makeLeanItems } from './test/perf-data.js';
import {
  domNodes,
  heapMiB,
  jumpPositions,
  measureScroll,
  measureWork,
  painted,
  type PerfSession,
  startPerf,
  updatesDone,
  wheelPositions,
} from './test/perf.js';
import './grid.js';

/** Repetições de cada medida; vale a melhor. */
const REPEATS = 3;

let perf: PerfSession;

const byLabel = (grid: DataGrid, label: string): GridColumnDef =>
  grid.columns.find(column => column.label === label)!;

/** Cria o grid já com dados e mede o trabalho do 1º render (script, estilo e layout). */
const firstRender = async (items: object[], columns = makeColumns()) => {
  const grid = document.createElement('u-grid');

  grid.style.display = 'block';
  grid.style.height = '600px';
  grid.columns = columns;
  grid.items = items;

  perf.recalibrate();
  const start = performance.now();

  document.body.append(grid);
  await updatesDone(grid);
  // Estilo e layout do 1º render (o que bloqueia antes de pintar).
  grid.shadowRoot!.querySelector('tbody')!.getBoundingClientRect();

  const ms = perf.weak(performance.now() - start);

  await painted(grid);

  expect(grid.shadowRoot!.querySelectorAll('tbody tr[role=row]').length).toBeGreaterThan(5);
  return { grid, ms };
};

/** Aquece o JIT com todos os caminhos medidos, para o 1º cenário não pagar a compilação. */
const warmUp = async () => {
  const { grid } = await firstRender(makeItems(20_000));

  await measureScroll(grid, wheelPositions(grid, 20, 120));
  await measureScroll(grid, jumpPositions(grid, 10));

  for (const label of ['Country', 'Name', 'Amount', 'Date']) {
    await measureWork(grid, () => grid.sortColumn(byLabel(grid, label), 'asc'));
  }

  await measureWork(grid, () => grid.groupColumn(byLabel(grid, 'Country')));
  await measureWork(grid, () => grid.groupColumn(byLabel(grid, 'Category'), 1));
  await measureWork(grid, () => grid.autoExpandGroups = true);
  await measureScroll(grid, jumpPositions(grid, 10));
  grid.remove();
};

beforeAll(async () => {
  perf = await startPerf();
  await warmUp();
});

afterEach(async () => {
  await perf.unthrottle();
  cleanup();
});

afterAll(async () => {
  await perf.finish();
});

// -------------------------------------------------------------- orçamentos

/**
 * Orçamentos da spec 16 (máquina fraca). Interações escalam com o volume:
 * até 100 mil linhas valem os 200 ms de "resposta imediata"; acima, 1,5 ms
 * por mil linhas (1 milhão: 1,5 s) — tarefa longa é inevitável sem
 * trabalhador, mas limitada. O 1º render não depende do volume.
 */
const BUDGET = {
  /** Trabalho por passo de roda: 30 fps no p95. */
  scrollP95Ms: 33,
  scrollWorstMs: 67,
  /** Salto da barra (todas as linhas da janela novas): 10 fps no p95. */
  jumpP95Ms: 100,
  firstRenderMs: 500,
  interactionMs: (rows: number) => Math.max(200, rows * 1.5 / 1000),
  /** Pior caso, ordenar texto todo distinto: o dobro (ver pendências da spec). */
  uniqueSortMs: (rows: number) => Math.max(400, rows * 3 / 1000),
  domNodes: 2500,
  /** Heap do grid (fora os itens) por milhão de linhas. */
  gridHeapMiBPerMillion: 64,
  /**
   * Exportação em fatias (frente 12): nenhuma tarefa longa — a maior fatia
   * de trabalho entre duas cessões de vez cabe num quadro de 20 fps.
   */
  exportSliceMs: 50,
  /** Exportação inteira: 20 ms por mil linhas (1 milhão × 8 colunas: 20 s na máquina fraca). */
  exportTotalMs: (rows: number) => Math.max(2000, rows * 20 / 1000),
};

const checkBudgets = (rows: number, metrics: Record<string, number>, regressions: string[]) => {
  const over: string[] = [];

  const check = (name: string, value: number | undefined, budget: number) => {
    if (value !== undefined && value > budget) {
      over.push(`${name}: ${value.toFixed(1)} > orçamento ${budget}`);
    }
  };

  check('firstRenderMs', metrics.firstRenderMs, BUDGET.firstRenderMs);
  check('gridHeapMiB', metrics.gridHeapMiB, Math.max(8, BUDGET.gridHeapMiBPerMillion * rows / 1_000_000));
  check('domNodes', metrics.domNodes, BUDGET.domNodes);

  for (const [name, value] of Object.entries(metrics)) {
    if (name.endsWith('scrollP95Ms')) {
      check(name, value, BUDGET.scrollP95Ms);
    } else if (name.endsWith('scrollWorstMs')) {
      check(name, value, BUDGET.scrollWorstMs);
    } else if (name.endsWith('jumpP95Ms')) {
      check(name, value, BUDGET.jumpP95Ms);
    } else if (name.endsWith('SliceMs')) {
      check(name, value, BUDGET.exportSliceMs);
    } else if (name.endsWith('TotalMs')) {
      check(name, value, BUDGET.exportTotalMs(rows));
    } else if (name === 'sortUniqueMs') {
      check(name, value, BUDGET.uniqueSortMs(rows));
    } else if (name.endsWith('Ms') && !(/(firstRender|jumpWorst)Ms$/).test(name)) {
      check(name, value, BUDGET.interactionMs(rows));
    }
  }

  expect.soft(over, 'orçamento estourado').toEqual([]);
  expect.soft(regressions, 'pior que a linha de base').toEqual([]);
};

// ------------------------------------------------------------------ medidas

/** Rola com a roda (passos de 120 px) e pela barra (saltos): melhor de {@link REPEATS}. */
const scrollMetrics = async (grid: DataGrid, prefix = '') => {
  const best = { wheelP95: Infinity, wheelWorst: Infinity, jumpP95: Infinity, jumpWorst: Infinity };

  for (let i = 0; i < REPEATS; i++) {
    perf.recalibrate();
    const wheel = await measureScroll(grid, wheelPositions(grid, 60, 120));
    const jump = await measureScroll(grid, jumpPositions(grid, 30));

    best.wheelP95 = Math.min(best.wheelP95, perf.weak(wheel.p95Ms));
    best.wheelWorst = Math.min(best.wheelWorst, perf.weak(wheel.worstMs));
    best.jumpP95 = Math.min(best.jumpP95, perf.weak(jump.p95Ms));
    best.jumpWorst = Math.min(best.jumpWorst, perf.weak(jump.worstMs));
  }

  return {
    [`${prefix}scrollP95Ms`]: best.wheelP95,
    [`${prefix}scrollWorstMs`]: best.wheelWorst,
    [`${prefix}jumpP95Ms`]: best.jumpP95,
    [`${prefix}jumpWorstMs`]: best.jumpWorst,
  };
};

/**
 * Interação → `{nome}Ms`: trabalho que bloqueia a página, na máquina fraca,
 * melhor de {@link REPEATS}. `undo` (fora da medida) volta ao estado de antes
 * da ação para repeti-la.
 */
const interaction = async (name: string, grid: DataGrid, action: () => void, undo: () => void) => {
  let best = Infinity;

  for (let i = 0; i < REPEATS; i++) {
    if (i) {
      undo();
      await painted(grid);
    }

    perf.recalibrate();
    best = Math.min(best, perf.weak(await measureWork(grid, action)));
  }

  return { [`${name}Ms`]: best };
};

/** 1º render: melhor de {@link REPEATS} grids novos (fica o último). */
const bestFirstRender = async (items: object[], columns?: GridColumnDef[]) => {
  let best = Infinity;
  let grid: DataGrid | undefined;

  for (let i = 0; i < REPEATS; i++) {
    grid?.remove();
    const result = await firstRender(items, columns);

    grid = result.grid;
    best = Math.min(best, result.ms);
  }

  return { grid: grid!, firstRenderMs: best };
};

/** Índice da última linha visível depois de rolar até o fim (altura máxima de elemento do navegador). */
const lastReachableRow = async (grid: DataGrid): Promise<number> => {
  const scroller = grid.shadowRoot!.querySelector<HTMLElement>('.scroll-container')!;

  scroller.scrollTop = scroller.scrollHeight;
  await painted(grid);
  await painted(grid);

  const indexes = [...grid.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[data-index]')]
    .map(row => Number(row.getAttribute('data-index')));

  return Math.max(...indexes);
};

/** Ações de ordenação e "voltar" (sem postos em cache — `items` de novo — e a ordenação de antes). */
const sorting = (grid: DataGrid, items: () => object[]) => {
  const sortBy = (label: string, order: 'asc' | 'desc') => () => grid.sortColumn(byLabel(grid, label), order);

  const resetTo = (before?: () => void) => () => {
    grid.clearSorting();
    grid.items = items();
    before?.();
  };

  return { sortBy, resetTo };
};

// ---------------------------------------------------------------- cenários

const flatScenario = (rows: number, label: string) => {
  it(`${label} linhas × 24 colunas: render, rolagem, ordenação, troca de items`, async () => {
    let items: object[] | undefined = makeItems(rows);
    const heapBefore = await heapMiB();

    await perf.throttle();
    const { grid, firstRenderMs } = await bestFirstRender(items);
    const scroll = await scrollMetrics(grid);
    const nodes = domNodes(grid);
    const { sortBy, resetTo } = sorting(grid, () => items!);

    const sortText = await interaction('sortText', grid, sortBy('Country', 'asc'), resetTo());
    const sortUnique = await interaction('sortUnique', grid, sortBy('Name', 'asc'), resetTo(sortBy('Country', 'asc')));
    const sortReverse = await interaction('sortReverse', grid, sortBy('Name', 'desc'), sortBy('Name', 'asc'));
    const sortNumber = await interaction('sortNumber', grid, sortBy('Amount', 'desc'), resetTo(sortBy('Name', 'desc')));
    const sortDate = await interaction('sortDate', grid, sortBy('Date', 'asc'), resetTo(sortBy('Amount', 'desc')));
    const sortedScroll = await scrollMetrics(grid, 'sorted.');
    const replace = await interaction('replaceItems', grid, () => grid.items = [...items!], () => undefined);

    await perf.unthrottle();

    const heap = await heapMiB();
    const lastRow = await lastReachableRow(grid);

    grid.remove();
    items = undefined;

    const metrics = {
      firstRenderMs,
      ...scroll,
      ...sortText,
      ...sortUnique,
      ...sortReverse,
      ...sortNumber,
      ...sortDate,
      ...sortedScroll,
      ...replace,
      domNodes: nodes,
      gridHeapMiB: heap - heapBefore,
    };

    checkBudgets(rows, metrics, perf.report(`flat-${label}`, metrics));
    expect(lastRow, 'última linha visível no fim da rolagem').toBe(rows - 1);
  });
};

const groupedScenario = (rows: number, label: string) => {
  it(`${label} linhas agrupadas em 2 níveis e ordenadas: agrupar, expandir tudo, rolar, reagrupar`, async () => {
    let items: object[] | undefined = makeItems(rows);
    const heapBefore = await heapMiB();

    await perf.throttle();
    const { grid, firstRenderMs } = await bestFirstRender(items);
    const column = (name: string) => byLabel(grid, name);

    const group1 = await interaction('group', grid, () => grid.groupColumn(column('Country')), () => grid.ungroupColumn(column('Country')));
    const group2 = await interaction(
      'groupLevel2',
      grid,
      () => grid.groupColumn(column('Category'), 1),
      () => grid.ungroupColumn(column('Category')),
    );
    const sort = await interaction('sortGrouped', grid, () => grid.sortColumn(column('Amount'), 'desc'), () => {
      grid.clearSorting();
      grid.items = items!;
    });
    const expand = await interaction('expandAll', grid, () => grid.autoExpandGroups = true, () => grid.autoExpandGroups = false);
    const scroll = await scrollMetrics(grid);
    const nodes = domNodes(grid);
    const regroup = await interaction('regroup', grid, () => {
      grid.ungroupColumn(column('Category'));
      grid.groupColumn(column('Status'), 1);
    }, () => {
      grid.ungroupColumn(column('Status'));
      grid.groupColumn(column('Category'), 1);
    });
    const collapse = await interaction('collapseAll', grid, () => grid.autoExpandGroups = false, () => grid.autoExpandGroups = true);
    const replace = await interaction('replaceItems', grid, () => grid.items = [...items!], () => undefined);

    await perf.unthrottle();

    const heap = await heapMiB();

    expect(grid.getGrouping().map(c => c.label)).toEqual(['Country', 'Status']);

    grid.remove();
    items = undefined;

    const metrics = {
      firstRenderMs,
      ...group1,
      ...group2,
      ...sort,
      ...expand,
      ...scroll,
      ...regroup,
      ...collapse,
      ...replace,
      domNodes: nodes,
      gridHeapMiB: heap - heapBefore,
    };

    checkBudgets(rows, metrics, perf.report(`grouped-${label}`, metrics));
  });
};

const hugeScenario = (rows: number, label: string) => {
  it(`${label} linhas × 8 colunas: render, rolagem até o fim, ordenar, agrupar, expandir`, async () => {
    let items: object[] | undefined = makeLeanItems(rows);
    const heapBefore = await heapMiB();

    await perf.throttle();
    const { grid, firstRenderMs } = await bestFirstRender(items, makeLeanColumns());
    const scroll = await scrollMetrics(grid);
    const { sortBy, resetTo } = sorting(grid, () => items!);

    const sortNumber = await interaction('sortNumber', grid, sortBy('Quantity', 'desc'), resetTo());
    const sortText = await interaction('sortText', grid, sortBy('Country', 'asc'), resetTo(sortBy('Quantity', 'desc')));
    const sortUnique = await interaction('sortUnique', grid, sortBy('Name', 'asc'), resetTo(sortBy('Country', 'asc')));
    const group = await interaction(
      'group',
      grid,
      () => grid.groupColumn(byLabel(grid, 'Category')),
      () => grid.ungroupColumn(byLabel(grid, 'Category')),
    );
    const expand = await interaction('expandAll', grid, () => grid.autoExpandGroups = true, () => grid.autoExpandGroups = false);
    const groupedScroll = await scrollMetrics(grid, 'grouped.');
    const nodes = domNodes(grid);

    await perf.unthrottle();

    const heap = await heapMiB();
    const lastRow = await lastReachableRow(grid);

    grid.remove();
    items = undefined;

    const metrics = {
      firstRenderMs,
      ...scroll,
      ...sortNumber,
      ...sortText,
      ...sortUnique,
      ...group,
      ...expand,
      ...groupedScroll,
      domNodes: nodes,
      gridHeapMiB: heap - heapBefore,
    };

    checkBudgets(rows, metrics, perf.report(`lean-${label}`, metrics));
    // Agrupado e expandido: 12 linhas de grupo a mais.
    expect(lastRow, 'última linha visível no fim da rolagem').toBe(rows + 12 - 1);
  });
};

/**
 * Frente 07: resumos (totais + 3 de grupo, um por posição) e agrupar por
 * faixa (`groupValueGetter`); expandir/recolher tudo pela API nova.
 */
const summaryScenario = (rows: number, label: string) => {
  it(`${label} linhas com resumos e faixa: resumir, agrupar, expandir/recolher tudo, rolar`, async () => {
    let items: object[] | undefined = makeItems(rows);
    const heapBefore = await heapMiB();
    const columns = makeColumns().map(column => column.path === 'amount'
      ? { ...column, groupValueGetter: (item: { amount: number }) => Math.floor(item.amount / 1000) * 1000 }
      : column);
    const summary = {
      total: [
        { column: 'amount', type: 'sum' as const },
        { column: 'amount', type: 'avg' as const },
        { column: 'id', type: 'count' as const },
        { column: 'date', type: 'max' as const },
      ],
      group: [
        { column: 'amount', type: 'sum' as const },
        { column: 'quantity', type: 'max' as const, display: 'column' as const },
        { column: 'price', type: 'avg' as const, display: 'footer' as const },
      ],
    };

    await perf.throttle();
    const { grid, firstRenderMs } = await bestFirstRender(items, columns);
    const column = (name: string) => byLabel(grid, name);

    const summarize = await interaction('summary', grid, () => grid.summary = { ...summary }, () => grid.summary = null);
    const group = await interaction('groupSummary', grid, () => grid.groupColumn(column('Country')), () => grid.ungroupColumn(column('Country')));
    const range = await interaction(
      'groupRange',
      grid,
      () => grid.groupColumn(column('Amount'), 1),
      () => grid.ungroupColumn(column('Amount')),
    );
    const expand = await interaction('expandAllGroups', grid, () => grid.expandAllGroups(), () => grid.collapseAllGroups());
    const scroll = await scrollMetrics(grid);
    const nodes = domNodes(grid);
    const collapse = await interaction('collapseAllGroups', grid, () => grid.collapseAllGroups(), () => grid.expandAllGroups());
    const replace = await interaction('replaceItems', grid, () => grid.items = [...items!], () => undefined);

    await perf.unthrottle();

    const heap = await heapMiB();
    const [sum, , count] = grid.getSummaryValues();

    expect(count.value).toBe(rows);
    expect(sum.value).toBeGreaterThan(0);
    expect(grid.shadowRoot!.querySelector('tfoot .total-row')).not.toBeNull();

    grid.remove();
    items = undefined;

    const metrics = {
      firstRenderMs,
      ...summarize,
      ...group,
      ...range,
      ...expand,
      ...scroll,
      ...collapse,
      ...replace,
      domNodes: nodes,
      gridHeapMiB: heap - heapBefore,
    };

    checkBudgets(rows, metrics, perf.report(`summaries-${label}`, metrics));
  });
};

/** Tecla no elemento com o foco dentro do grid (ou na célula ativa). */
const press = (grid: DataGrid, key: string, init: KeyboardEventInit = {}): void => {
  const target = grid.shadowRoot!.activeElement ?? grid.shadowRoot!.querySelector('table [tabindex="0"]')!;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));
};

/** Frente 05: selecionar tudo e navegação rápida pelo teclado (o foco acompanha o virtualizador). */
const selectionScenario = (rows: number, label: string) => {
  it(`${label} linhas com caixas de seleção: selecionar tudo, limpar, setas, PageDown, Ctrl+End`, async () => {
    let items: object[] | undefined = makeLeanItems(rows);

    await perf.throttle();
    const { grid } = await bestFirstRender(items, makeLeanColumns());

    grid.selectionMode = 'multiple';
    grid.showCheckboxes = true;
    await painted(grid);
    grid.focusCell(items[0]);
    await painted(grid);

    const selectAll = await interaction('selectAll', grid, () => press(grid, 'a', { ctrlKey: true }), () => grid.clearSelection());
    const allChecked = grid.shadowRoot!.querySelector('th.selection-cell [role=checkbox]')!.getAttribute('aria-checked');
    const selected = grid.selectedKeys.length;
    const clear = await interaction('clearSelection', grid, () => grid.clearSelection(), () => grid.selectAll());
    const arrowDown = await interaction('arrowDown', grid, () => press(grid, 'ArrowDown'), () => press(grid, 'ArrowUp'));
    const pageDown = await interaction('pageDown', grid, () => press(grid, 'PageDown'), () => press(grid, 'PageUp'));
    const gridEnd = await interaction('gridEnd', grid, () => press(grid, 'End', { ctrlKey: true }), () => press(grid, 'Home', { ctrlKey: true }));

    await perf.unthrottle();
    await painted(grid);

    const focused = grid.shadowRoot!.activeElement as HTMLElement;
    const focusedRow = focused.closest('tr')!;
    const nodes = domNodes(grid);

    grid.remove();
    items = undefined;

    const metrics = { ...selectAll, ...clear, ...arrowDown, ...pageDown, ...gridEnd, domNodes: nodes };

    checkBudgets(rows, metrics, perf.report(`selection-${label}`, metrics));
    expect(selected).toBe(rows);
    expect(allChecked).toBe('true');
    expect(focusedRow.getAttribute('aria-rowindex'), 'Ctrl+End chega à última linha').toBe(String(rows + 1));
    expect(focusedRow.classList.contains('pinned'), 'a última linha está na janela virtual').toBe(false);
  });
};

interface SliceResult {
  /** Maior trabalho síncrono entre duas cessões de vez (o 1º inclui o instantâneo). */
  sliceMs: number;
  totalMs: number;
  slices: number;
}

/**
 * Mede uma exportação em fatias: intercepta `scheduler.yield()` (o ponto em
 * que o exportador devolve a vez) e guarda a maior fatia de trabalho — o
 * tempo em que a página fica sem responder. Tempos na máquina fraca.
 */
const measureSlices = async (work: () => Promise<unknown>): Promise<SliceResult> => {
  const scheduler = (window as unknown as { scheduler: { yield: () => Promise<void> } }).scheduler;
  const original = scheduler.yield;
  let sliceStart = 0;
  let worst = 0;
  let slices = 0;

  scheduler.yield = () => {
    worst = Math.max(worst, performance.now() - sliceStart);
    slices++;
    return original.call(scheduler).then(() => {
      sliceStart = performance.now();
    });
  };

  perf.recalibrate();
  const start = performance.now();
  sliceStart = start;

  try {
    await work();
  } finally {
    scheduler.yield = original;
  }

  const end = performance.now();
  worst = Math.max(worst, end - sliceStart);

  return { sliceMs: perf.weak(worst), totalMs: perf.weak(end - start), slices: slices + 1 };
};

/** Melhor de {@link REPEATS} (só a maior fatia e o total; o resto é da última). */
const bestSlices = async (work: () => Promise<unknown>): Promise<SliceResult> => {
  let best: SliceResult | undefined;

  for (let i = 0; i < REPEATS; i++) {
    const result = await measureSlices(work);

    best = best
      ? { sliceMs: Math.min(best.sliceMs, result.sliceMs), totalMs: Math.min(best.totalMs, result.totalMs), slices: result.slices }
      : result;
  }

  return best!;
};

/** Frente 12: exportar CSV/dados de 1 milhão de linhas em fatias e copiar 10 mil selecionadas. */
const exportScenario = (rows: number, label: string) => {
  it(`${label} linhas × 8 colunas: exportar CSV (plano e agrupado com totais), getExportData, Ctrl+C de 10 mil`, async () => {
    let items: object[] | undefined = makeLeanItems(rows);

    await perf.throttle();
    const { grid } = await bestFirstRender(items, makeLeanColumns());
    grid.language = 'en';
    await painted(grid);

    let size = 0;
    const flat = await bestSlices(async () => {
      size = (await grid.exportCsv()).size;
    });

    let dataRows = 0;
    const data = await bestSlices(async () => {
      dataRows = (await grid.getExportData()).rows.length;
    });

    grid.summary = { total: [{ column: 'quantity', type: 'sum' }], group: [{ column: 'quantity', type: 'max', display: 'column' }] };
    grid.groupColumn(byLabel(grid, 'Country'));
    await painted(grid);

    let groupedSize = 0;
    const grouped = await bestSlices(async () => {
      groupedSize = (await grid.exportCsv()).size;
    });

    grid.ungroupColumn(byLabel(grid, 'Country'));
    grid.selectionMode = 'multiple';
    grid.selectRows(items.slice(0, 10_000));
    await painted(grid);

    let copied = '';
    const copy = await interaction('copy10k', grid, () => {
      const clipboardData = new DataTransfer();
      const cell = grid.shadowRoot!.querySelector<HTMLElement>('tbody tr[data-index] td[role=gridcell]')!;
      cell.dispatchEvent(new ClipboardEvent('copy', { clipboardData, bubbles: true, composed: true, cancelable: true }));
      copied = clipboardData.getData('text/plain');
    }, () => undefined);

    await perf.unthrottle();
    grid.remove();
    items = undefined;

    const metrics = {
      exportCsvSliceMs: flat.sliceMs,
      exportCsvTotalMs: flat.totalMs,
      exportDataSliceMs: data.sliceMs,
      exportDataTotalMs: data.totalMs,
      exportGroupedCsvSliceMs: grouped.sliceMs,
      exportGroupedCsvTotalMs: grouped.totalMs,
      ...copy,
    };

    checkBudgets(rows, metrics, perf.report(`export-${label}`, metrics));
    expect(flat.slices, 'a exportação cede a vez').toBeGreaterThan(10);
    expect(size).toBeGreaterThan(rows * 30);
    expect(dataRows).toBe(rows);
    // Sem a coluna agrupada (vira linha de grupo), com as linhas de grupo e os totais.
    expect(groupedSize).toBeGreaterThan(rows * 25);
    expect(copied.split('\r\n')).toHaveLength(10_000);
  });
};

/**
 * Frente 10: master-detail com 1 milhão de linhas — ligar o detalhe,
 * expandir alguns (altura variável esparsa no virtualizador), rolar com eles
 * abertos, recolher. Sem detalhe aberto o virtualizador segue aritmético.
 */
const detailScenario = (rows: number, label: string) => {
  it(`${label} linhas com master-detail: ligar, expandir alguns, rolar, recolher`, async () => {
    let items: object[] | undefined = makeLeanItems(rows);

    await perf.throttle();
    const { grid, firstRenderMs } = await bestFirstRender(items, makeLeanColumns());
    const detail = (item: { id?: unknown }) => html`<div style="height: 120px; padding: 8px">Detail ${String(item.id)}</div>`;
    const enable = await interaction('enableDetail', grid, () => grid.detailRenderer = detail, () => grid.detailRenderer = null);
    const opened = [0, 2, 5, Math.floor(rows / 2), rows - 1].map(index => items![index]);
    const expand = await interaction(
      'expandRows',
      grid,
      () => opened.forEach(item => grid.expandRow(item)),
      () => opened.forEach(item => grid.collapseRow(item)),
    );
    const scroll = await scrollMetrics(grid, 'detail.');
    const nodes = domNodes(grid);
    const collapse = await interaction(
      'collapseRows',
      grid,
      () => opened.forEach(item => grid.collapseRow(item)),
      () => opened.forEach(item => grid.expandRow(item)),
    );

    await perf.unthrottle();
    const variable = grid._virtualizer.variableRows;

    grid.remove();
    items = undefined;

    const metrics = { firstRenderMs, ...enable, ...expand, ...scroll, ...collapse, domNodes: nodes };

    checkBudgets(rows, metrics, perf.report(`detail-${label}`, metrics));
    expect(variable, 'recolhidos: nenhuma linha de altura própria').toBe(0);
  });
};

describe('perfil de máquina fraca', () => {
  flatScenario(100_000, '100k');
  groupedScenario(100_000, '100k');
  flatScenario(1_000_000, '1m');
  groupedScenario(1_000_000, '1m');
  summaryScenario(1_000_000, '1m');
  hugeScenario(5_000_000, '5m');
  selectionScenario(1_000_000, '1m');
  exportScenario(1_000_000, '1m');
  detailScenario(1_000_000, '1m');
});
