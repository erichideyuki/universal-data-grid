/**
 * Vazamento de memória da frente 10 (regra da spec 14): conteúdo de
 * renderers (templates, `HTMLElement` no light DOM, `signal`), linhas de
 * detalhe (estado de expansão, alturas medidas, `ResizeObserver`) e grids
 * aninhados no detalhe não podem segurar o grid, os `items`, as colunas nem
 * os renderers. Cada cenário roda numa função e devolve só `WeakRef`s.
 */
import { html } from 'lit';

import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef, GridDetailRenderer } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';
import { aliveAfterGc, expectCollected, heapDelta, kib, measureHeap, track, type Tracked } from './test/leak.js';

afterEach(cleanup);

const makeItems = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, n) => ({ id: n + seed, team: `T${n % 4}`, name: `Name ${n + seed}` }));

type Item = ReturnType<typeof makeItems>[number];

const makeColumns = (): GridColumnDef<Item>[] => [
  { path: 'team', label: 'Team', groupIndex: 0, groupRenderer: ctx => html`<b>${ctx.text}</b>` },
  { path: 'id', label: 'Id', dataType: 'number', headerRenderer: ({ column }) => html`<i>${column.label}</i>` },
  { path: 'name', label: 'Name', renderer: item => html`<span part="name">${item.name}</span>` },
  {
    path: 'name',
    label: 'Element',
    renderer: (item, ctx) => {
      const element = document.createElement('b');
      element.textContent = item.name;
      ctx.signal.addEventListener('abort', () => element.remove());
      return element;
    },
  },
];

const innerColumns: GridColumnDef[] = [{ path: 'name', label: 'Inner', renderer: (item: Item) => html`<em>${item.name}</em>` }];

/** Detalhe com um grid aninhado (template) e um elemento do hospedeiro (light DOM). */
const makeDetail = (): GridDetailRenderer<Item> => item => html`
  <u-grid style="display: block; height: 160px" .columns=${innerColumns} .items=${makeItems(3, item.id)}></u-grid>`;

const scrollBodyTo = async (grid: DataGrid, top: number): Promise<void> => {
  grid._scrollContainerRef.value!.scrollTop = top;
  grid._scrollContainerRef.value!.dispatchEvent(new Event('scroll'));
  await settle(grid);
};

/** Expande e recolhe detalhes, rola (conteúdo sai e volta da janela), ordena. */
const exercise = async (grid: DataGrid): Promise<void> => {
  grid.expandAllGroups();
  await settle(grid);

  for (const item of grid.items.slice(0, 6)) {
    grid.expandRow(item);
  }

  await settle(grid);
  // Gesto: abre e fecha (o estado guarda só o que difere do padrão).
  // (o botão da mesma linha nas duas vezes: o clique foca a célula, que pode rolar)
  const toggleRow = grid.shadowRoot!.querySelector<HTMLElement>('tbody tr:not(.pinned) button.detail-toggle')!.closest('tr')!;
  const toggleOf = () => grid.shadowRoot!.querySelector<HTMLElement>(`tbody tr[id="${toggleRow.id}"] button.detail-toggle`)!;
  toggleOf().click();
  await settle(grid);
  toggleOf().click();
  await settle(grid);
  await scrollBodyTo(grid, 48 * 300);
  await scrollBodyTo(grid, 0);
  grid.sortColumn(grid.columns[1], 'desc');
  await settle(grid);

  for (const item of grid.items.slice(0, 6)) {
    grid.collapseRow(item);
  }

  await settle(grid);
};

describe('memória dos templates e do master-detail', () => {
  it('grid com templates, detalhes abertos e grid aninhado é coletado com items, colunas e renderers', async () => {
    const scenario = async (): Promise<Tracked> => {
      const items = makeItems(600);
      const columns = makeColumns();
      const detail = makeDetail();
      const noData = () => html`<p>none</p>`;
      const grid = await createGrid({
        columns,
        items,
        height: '300px',
        configure: g => {
          g.detailRenderer = detail as GridDetailRenderer;
          g.noDataRenderer = noData;
        },
      });

      await exercise(grid);
      // Detalhes abertos (com grid aninhado) na remoção: ids 0 e 4 abrem o grupo T0.
      grid.clearSorting();
      grid.expandRow(items[0]);
      grid.expandRow(items[4]);
      await settle(grid);
      const nested = grid.shadowRoot!.querySelector('tr.detail-row u-grid')!;
      expect(nested).not.toBeNull();
      expect(grid.querySelectorAll('[slot]').length).toBeGreaterThan(0);
      grid.remove();
      expect(grid.querySelectorAll('[slot]')).toHaveLength(0);

      return track({ grid, nested, items, item: items[0], columns, renderer: columns[2].renderer!, detail, noData });
    };

    await expectCollected(await scenario());
  });

  it('grid de vida longa: items, colunas e renderers trocados são soltos', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(300), height: '300px', configure: g => {
      g.detailRenderer = makeDetail() as GridDetailRenderer;
    } });

    const replace = async (): Promise<Tracked> => {
      const items = makeItems(300, 5);
      const columns = makeColumns();
      const detail = makeDetail();
      grid.items = items;
      grid.columns = columns;
      grid.detailRenderer = detail as GridDetailRenderer;
      await settle(grid);
      await exercise(grid);

      grid.items = makeItems(300, 9);
      grid.columns = makeColumns();
      grid.detailRenderer = makeDetail() as GridDetailRenderer;
      await settle(grid);

      return track({ items, item: items[0], columns, renderer: columns[2].renderer!, detail });
    };

    await expectCollected(await replace());
    expect(grid.isConnected).toBe(true);
  });

  it('usar repetidamente não cresce heap, nós do light DOM nem o estado de expansão', async () => {
    const grid = await createGrid({ columns: makeColumns(), items: makeItems(2000), height: '300px', configure: g => {
      g.detailRenderer = makeDetail() as GridDetailRenderer;
    } });
    let firstItems: Tracked | undefined;

    const round = async (n: number): Promise<void> => {
      const items = makeItems(2000, n);
      firstItems ??= track({ items });
      grid.items = items;
      await settle(grid);
      await exercise(grid);
    };

    for (let n = 0; n < 3; n++) {
      await round(n);
    }

    const statsBefore = grid._memoryStats;
    const lightBefore = grid.childElementCount;
    const before = await measureHeap();

    for (let n = 3; n < 20; n++) {
      await round(n);
    }

    const delta = heapDelta(before, await measureHeap());
    const report = `heap ${kib(delta.jsHeapUsed)}, nós ${delta.nodes}, listeners ${delta.listeners}`;
    const stats = grid._memoryStats;

    expect(stats.rowExpansion).toBe(0);
    expect(stats.observedDetails).toBeLessThanOrEqual(statsBefore.observedDetails);
    expect(stats.primitiveDetailSizes).toBe(0);
    expect(grid.childElementCount).toBe(lightBefore);
    expect(delta.jsHeapUsed, report).toBeLessThan(768 * 1024);
    expect(delta.nodes, report).toBeLessThan(60);
    expect(delta.listeners, report).toBeLessThan(30);
    expect(await aliveAfterGc(firstItems!)).toEqual([]);
  }, 180_000);
});
