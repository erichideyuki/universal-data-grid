/**
 * Vazamento de memória (spec 14). Cada cenário cria e usa o grid dentro de
 * uma função e devolve só `WeakRef`s — variável local no teste seguraria o
 * objeto. Ver `src/test/leak.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import { _pendingLanguageRequests, setGridLanguage } from './grid-i18n.js';
import type { DataGrid } from './grid.js';
import { _formatterCacheSize, FORMATTER_CACHE_LIMIT } from './row-model/format.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { aliveAfterGc, expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

interface Item {
  id: number;
  region: string;
  city: string;
  name: string;
  amount: number;
  note: string;
}

const makeItems = (count: number, seed = 0): Item[] =>
  Array.from({ length: count }, (_, n) => ({
    id: n + seed,
    region: `R${n % 3}`,
    city: `C${n % 7}`,
    name: `Name ${n + seed}`,
    amount: n * 1.5,
    note: `note ${n} `.repeat(4),
  }));

const makeColumns = (): GridColumnDef[] => [
  { path: 'region', label: 'Region', groupIndex: 0 },
  { path: 'city', label: 'City', groupIndex: 1 },
  { path: 'id', label: 'Id', dataType: 'number' },
  {
    path: 'name',
    label: 'Name',
    renderer: (item: Item) => {
      const element = document.createElement('b');
      element.textContent = item.name;
      return element;
    },
  },
  { path: 'amount', label: 'Amount', dataType: 'number', format: { style: 'currency', currency: 'USD' } },
  { path: 'note', label: 'Note', wrap: true },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;

const scrollBodyTo = async (grid: DataGrid, top: number): Promise<void> => {
  grid._scrollContainerRef.value!.scrollTop = top;
  grid._scrollContainerRef.value!.dispatchEvent(new Event('scroll'));
  await settle(grid);
};

/** Expande os grupos visíveis, nível a nível. */
/**
 * Comentários soltos no `<tbody>` além dos 2 marcadores de cada linha
 * renderizada (o `repeat` do Lit deixava um por linha que saía da janela).
 */
const extraBodyComments = (grid: DataGrid): number => {
  const tbody = root(grid).querySelector('tbody')!;
  const comments = [...tbody.childNodes].filter(node => node.nodeType === Node.COMMENT_NODE).length;

  return comments - 2 * tbody.querySelectorAll(':scope > tr[data-index]').length;
};

const expandAll = async (grid: DataGrid): Promise<void> => {
  for (let pass = 0; pass < 4; pass++) {
    const collapsed = root(grid).querySelectorAll<HTMLButtonElement>('button.group-toggle[aria-expanded=false]');

    if (!collapsed.length) {
      return;
    }

    collapsed.forEach(button => button.click());
    await settle(grid);
  }
};

// ------------------------------------------------------------ arrasto sintético

const pointer = (type: string, target: EventTarget, x: number, y: number): void => {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
  }));
};

/** Começa a arrastar `element` (interactjs) e deixa o arrasto em curso. */
const startDrag = async (element: HTMLElement): Promise<{ x: number; y: number }> => {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  pointer('pointerdown', element, x, y);
  pointer('pointermove', element, x + 5, y + 5);
  pointer('pointermove', document, x + 30, y + 10);
  await new Promise(resolve => requestAnimationFrame(resolve));

  return { x: x + 30, y: y + 10 };
};

const endDrag = (at: { x: number; y: number }): void => {
  pointer('pointermove', document, at.x + 10, at.y);
  pointer('pointerup', document, at.x + 10, at.y);
};

/** Arrasto completo de um cabeçalho para o painel de grupos (reagrupa). */
const dragHeaderToGroupPanel = async (grid: DataGrid, headerIndex: number): Promise<void> => {
  const header = root(grid).querySelectorAll<HTMLElement>('th.header-column')[headerIndex];
  const at = await startDrag(header);
  const panel = root(grid).querySelector<HTMLElement>('.group-end-dropzone, .drag-here')!;
  const target = panel.getBoundingClientRect();
  const drop = { x: target.left + target.width / 2, y: target.top + target.height / 2 };

  pointer('pointermove', document, at.x, at.y);
  pointer('pointermove', document, drop.x, drop.y);
  await new Promise(resolve => requestAnimationFrame(resolve));
  pointer('pointerup', document, drop.x, drop.y);
  await settle(grid);
};

// ------------------------------------------------------------------- cenários

/** Elemento da página com provedor de idioma (`setGridLanguage`) que sobrevive aos grids. */
let languageHostElement: HTMLElement | undefined;

const languageHost = (): HTMLElement => {
  if (!languageHostElement) {
    languageHostElement = document.createElement('div');
    document.body.append(languageHostElement);
  }

  return languageHostElement;
};

/** Grid usado de todos os jeitos e removido; devolve só `WeakRef`s. */
const fullLifecycle = async (): Promise<Tracked> => {
  const items = makeItems(300);
  const columns = makeColumns();

  const grid = await createGrid({ columns, items, height: '300px' });
  languageHost().append(grid);
  await settle(grid);

  await expandAll(grid);
  await scrollBodyTo(grid, 2000);
  await scrollBodyTo(grid, 0);

  // idioma: propriedade, contexto (provedor no host) e <html lang>
  grid.language = 'pt';
  await settle(grid);
  grid.language = '';
  setGridLanguage('de', languageHost());
  await settle(grid);
  expect(grid.language).toBe('de');
  const previousLang = document.documentElement.lang;
  document.documentElement.lang = 'ar';
  await settle(grid);
  document.documentElement.lang = previousLang;

  // reagrupar pela API e por arrasto de verdade (interactjs)
  grid.moveColumn(columns[1], 0);
  await settle(grid);
  grid.groupColumn(columns[1], 1);
  await settle(grid);
  const firstRow = root(grid).querySelector('tbody tr[data-index]')!;
  const customCell = grid.querySelector('[slot^="u-grid-internal:cell:"]')!;
  expect(customCell).not.toBeNull();

  await dragHeaderToGroupPanel(grid, 0);
  expect(grid._groupColumns.length).toBe(3);
  await expandAll(grid);
  expect(grid._dragAndDropRegistrations).toBeGreaterThan(0);

  // O provedor de idioma (no hospedeiro, que continua na página) não pode
  // segurar o grid removido.
  grid.remove();
  await settle(grid);

  return track({ grid, items, item: items[0], columns, column: columns[3], firstRow, customCell });
};

describe('memória: o grid some quando não há mais referências', () => {
  it('grid usado (grupos, arrasto, renderer, rolagem, idiomas, reagrupar) e removido é coletado', async () => {
    await expectCollected(await fullLifecycle());
  });

  it('grid nunca conectado é coletado', async () => {
    const scenario = (): Tracked => {
      const items = makeItems(50);
      const grid = document.createElement('u-grid');
      grid.columns = makeColumns();
      grid.items = items;
      grid.language = 'pt';

      return track({ grid, items });
    };

    await expectCollected(scenario());
  });

  it('trocar items libera os itens antigos', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(300), height: '300px' });

    const replace = async (): Promise<Tracked> => {
      const items = makeItems(300, 1000);
      grid.items = items;
      await settle(grid);
      await expandAll(grid);
      await scrollBodyTo(grid, 1500);
      grid.items = makeItems(300, 5000);
      await settle(grid);

      return track({ items, item: items[0] });
    };

    await expectCollected(await replace());
    expect(grid.isConnected).toBe(true);
  });

  it('remover o grid no meio de um arrasto libera o grid', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(20);
      const grid = await createGrid({ columns: makeColumns(), items });
      const header = root(grid).querySelector<HTMLElement>('th.header-column')!;
      const at = await startDrag(header);
      const moving = root(grid).querySelector('.move-container');
      expect(moving).not.toBeNull();

      grid.remove();
      await settle(grid);
      endDrag(at);
      expect(root(grid).querySelector('.move-container')).toBeNull();

      return track({ grid, items, header, moving: moving! });
    };

    await expectCollected(await scenario());

    // O interactjs continua funcionando para os grids seguintes.
    const next = await createGrid({ columns: makeColumns(), items: makeItems(20) });
    await dragHeaderToGroupPanel(next, 0);
    expect(next._groupColumns.length).toBe(3);
  });
});

describe('memória: registros globais', () => {
  it('pedidos de idioma sem provedor não se acumulam e o provedor tardio ainda chega', async () => {
    for (let i = 0; i < 100; i++) {
      const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: [] });
      grid.remove();
    }

    // Só os grids conectados esperam provedor (mais a folga até a próxima limpeza).
    expect(_pendingLanguageRequests()).toBeLessThan(20);

    const host = document.createElement('div');
    document.body.append(host);
    const grid = await createGrid({ columns: [{ path: 'n', label: 'N' }], items: [] });
    host.append(grid);
    await settle(grid);

    setGridLanguage('pt', host);
    await settle(grid);
    expect(root(grid).querySelector('[part~="no-data"]')?.textContent?.trim()).toBe('Sem dados');
    host.remove();
  });

  it('cache de formatadores Intl tem limite', async () => {
    const columns: GridColumnDef[] = Array.from({ length: 300 }, (_, n) => ({
      path: 'v',
      label: `V${n}`,
      dataType: 'number',
      format: { minimumFractionDigits: n % 20, minimumIntegerDigits: 1 + (n % 21) },
    }));
    // Todas no DOM (sem virtualização de colunas): cada célula formata.
    const grid = await createGrid({ columns, items: [{ v: 1 }], configure: g => g.columnRenderingMode = 'standard' });

    expect(grid.shadowRoot!.querySelectorAll('td').length).toBe(300);
    expect(_formatterCacheSize()).toBeLessThanOrEqual(FORMATTER_CACHE_LIMIT);
  });
});

describe('memória: heap e contadores', () => {
  /*
   * Tolerâncias (Chromium headless, medidas na spec 14). Depois de coletar:
   * - nós e listeners: < 30 — um único grid retido passa de 150 nós;
   * - heap: < 512 KiB. Medido: 50 ciclos ≈ 180–330 KiB, 150 ciclos ≈ 390 KiB
   *   (cresce bem menos que linear: aquecimento do V8 — código otimizado,
   *   feedback de IC — e o orquestrador do Vitest no mesmo isolate). Inclui
   *   ~0,6 KiB por grid que o Blink guarda no StyleEngine para cada `<thead>`
   *   em shadow root (fora do alcance do JS; ver spec 14). Vazamento de
   *   ≥ 10 KiB por ciclo estoura o limite.
   */
  const HEAP_TOLERANCE = 512 * 1024;
  const NODE_TOLERANCE = 30;

  it('50 ciclos de criar/destruir voltam à linha de base', async () => {
    const cycle = async (): Promise<void> => {
      await fullLifecycle();
      cleanup();
    };

    // aquecimento: compila código, preenche caches de tamanho fixo
    for (let i = 0; i < 3; i++) {
      await cycle();
    }

    const before = await measureHeap();

    for (let i = 0; i < 50; i++) {
      await cycle();
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;

    expect(delta.jsHeapUsed, report).toBeLessThan(HEAP_TOLERANCE);
    expect(delta.nodes, report).toBeLessThan(NODE_TOLERANCE);
    expect(delta.listeners, report).toBeLessThan(NODE_TOLERANCE);
  }, 120_000);

  it('grid de vida longa: heap e registros internos estáveis', async () => {
    const columns = makeColumns();
    const grid = await createGrid({ columns, items: makeItems(500), height: '300px' });

    let firstItems: Tracked | undefined;

    const round = async (n: number): Promise<void> => {
      const items = makeItems(500, n * 1000);
      firstItems ??= track({ items });
      grid.items = items;
      await settle(grid);
      await expandAll(grid);

      for (let top = 0; top <= 6000; top += 1500) {
        await scrollBodyTo(grid, top);
      }

      // reagrupa: tira um nível e põe de volta
      grid.moveColumn(columns[1], 0);
      await settle(grid);
      grid.groupColumn(columns[1], 1);
      await settle(grid);

      for (let i = 0; i < 20; i++) {
        grid.requestUpdate();
        await grid.updateComplete;
      }
    };

    for (let n = 0; n < 3; n++) {
      await round(n);
    }

    const statsBefore = grid._memoryStats;
    const commentsBefore = extraBodyComments(grid);
    const before = await measureHeap();

    for (let n = 3; n < 40; n++) {
      await round(n);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;
    const stats = grid._memoryStats;

    expect(extraBodyComments(grid)).toBe(commentsBefore);
    // Registros que não dependem de quais linhas foram vistas: iguais.
    expect(stats.dragAndDrop).toBe(statsBefore.dragAndDrop);
    expect(stats.expansion).toBe(statsBefore.expansion);
    // `<tr>` retidas pelo virtualizador: só as que estão no DOM.
    expect(stats.measuredElements).toBeLessThanOrEqual(root(grid).querySelectorAll('tbody tr[data-index]').length);
    // Alturas medidas: só das linhas vistas com os itens atuais (uma rodada).
    expect(stats.measuredSizes).toBeLessThanOrEqual(Math.max(statsBefore.measuredSizes, 1) * 2);
    expect(delta.jsHeapUsed, report).toBeLessThan(HEAP_TOLERANCE);
    expect(delta.nodes, report).toBeLessThan(NODE_TOLERANCE);
    expect(delta.listeners, report).toBeLessThan(NODE_TOLERANCE);
    expect(await aliveAfterGc(firstItems!)).toEqual([]);
  }, 120_000);
});
