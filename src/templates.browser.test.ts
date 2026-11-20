/**
 * Frente 10: renderers (célula, cabeçalho, grupo, vazio, detalhe) e
 * master-detail (coluna de expansão, linha de detalhe de altura variável,
 * teclado, grid aninhado).
 */
import { html } from 'lit';

import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridColumnDef, GridDetailRenderer, GridRowExpansionChangeEventDetail } from './grid.js';
import type { DataGrid } from './grid.js';
import { bodyRows, cleanup, createGrid, settle } from './test/fixture.js';

afterEach(cleanup);

interface Person {
  id: number;
  name: string;
  team: string;
  age: number;
}

const people = (count: number): Person[] =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Name ${id}`, team: `T${id % 3}`, age: 20 + (id % 40) }));

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;

const scrollBodyTo = async (grid: DataGrid, top: number): Promise<void> => {
  grid._scrollContainerRef.value!.scrollTop = top;
  grid._scrollContainerRef.value!.dispatchEvent(new Event('scroll'));
  await settle(grid);
};

const key = async (grid: DataGrid, name: string, init: KeyboardEventInit = {}): Promise<void> => {
  const target = root(grid).activeElement as HTMLElement;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const detailRows = (grid: DataGrid): HTMLTableRowElement[] =>
  [...root(grid).querySelectorAll<HTMLTableRowElement>('tbody tr.detail-row:not(.pinned)')];

const toggleOf = (row: HTMLTableRowElement): HTMLButtonElement => row.querySelector('button.detail-toggle')!;

/** Texto da coluna `name` (índice da célula entre as `part=cell`) por linha de dados. */
const nameCells = (grid: DataGrid): string[] =>
  bodyRows(grid)
    .filter(tr => !tr.classList.contains('detail-row') && !tr.classList.contains('group-row'))
    .map(tr => tr.querySelector('[part~=cell] .name')?.textContent ?? '');

describe('renderer de célula', () => {
  it('TemplateResult vai direto na célula (shadow DOM), com o ctx', async () => {
    const calls: unknown[] = [];
    const grid = await createGrid({
      columns: [
        {
          path: 'name',
          label: 'Name',
          renderer: (item: Person, ctx) => {
            calls.push(ctx.text);
            return html`<span class="name" part="name">${item.name}/${ctx.value}/${ctx.rowKey === item}</span>`;
          },
        },
      ],
      items: people(3),
    });

    const cell = root(grid).querySelector('tbody [part~=cell] .name')!;
    expect(cell.textContent).toBe('Name 0/Name 0/true');
    expect(cell.getAttribute('part')).toBe('name');
    expect(grid.querySelectorAll('[slot]')).toHaveLength(0);
    expect(calls).toContain('Name 0');
  });

  it('string é texto (nunca HTML)', async () => {
    const grid = await createGrid({
      columns: [{ path: 'name', label: 'Name', renderer: () => '<b>x</b>' }],
      items: people(1),
    });

    const cell = root(grid).querySelector('tbody [part~=cell]')!;
    expect(cell.textContent.trim()).toBe('<b>x</b>');
    expect(cell.querySelector('b')).toBeNull();
  });

  it('HTMLElement segue no light DOM com slot (compatível)', async () => {
    const grid = await createGrid({
      columns: [
        {
          path: 'name',
          label: 'Name',
          renderer: (item: Person) => {
            const element = document.createElement('i');
            element.textContent = item.name;
            return element;
          },
        },
      ],
      items: people(2),
    });

    const slotted = [...grid.querySelectorAll<HTMLElement>('[slot^="u-grid-internal:cell:"]')];
    expect(slotted.map(div => div.textContent)).toEqual(['Name 0', 'Name 1']);
    const slot = root(grid).querySelector<HTMLSlotElement>('tbody slot')!;
    expect(slot.assignedElements()[0].textContent).toBe('Name 0');
  });

  it('renderer certo após ordenar e rolar; não roda de novo ao selecionar/focar', async () => {
    const renderer = vi.fn((item: Person) => html`<span class="name">${item.name}</span>`);
    const columns: GridColumnDef[] = [{ path: 'id', label: 'Id', dataType: 'number' }, { path: 'name', label: 'Name', renderer }];
    const grid = await createGrid({ columns, items: people(500), configure: g => {
      g.selectionMode = 'multiple';
    } });

    const ids = () => bodyRows(grid).map(tr => tr.querySelector('[part~=cell]')!.textContent.trim());
    expect(nameCells(grid).slice(0, 3)).toEqual(['Name 0', 'Name 1', 'Name 2']);

    grid.sortColumn(columns[0], 'desc');
    await settle(grid);
    expect(nameCells(grid).slice(0, 2)).toEqual(['Name 499', 'Name 498']);
    expect(ids().slice(0, 2)).toEqual(['499', '498']);

    await scrollBodyTo(grid, 48 * 200);
    const rows = bodyRows(grid);
    rows.forEach(tr => {
      const id = tr.querySelector('[part~=cell]')!.textContent.trim();
      expect(tr.querySelector('.name')!.textContent).toBe(`Name ${id}`);
    });

    const before = renderer.mock.calls.length;
    const visibleItem = grid.items[Number(rows[5].querySelector('[part~=cell]')!.textContent.trim())];
    grid.selectRows([visibleItem]);
    grid.focusCell(visibleItem, columns[0]);
    await settle(grid);
    // (focar pode rolar uma linha nova para a janela; as que já estavam não rodam de novo)
    expect(renderer.mock.calls.slice(before).map(([item]) => item)).not.toContain(visibleItem);
  });

  it('renderer correto após expandir grupo', async () => {
    const columns: GridColumnDef[] = [
      { path: 'team', label: 'Team', groupIndex: 0 },
      { path: 'name', label: 'Name', renderer: (item: Person) => html`<span class="name">${item.name}:${item.team}</span>` },
    ];
    const grid = await createGrid({ columns, items: people(9) });

    grid.expandGroup(['T1']);
    await settle(grid);
    expect(nameCells(grid)).toEqual(['Name 1:T1', 'Name 4:T1', 'Name 7:T1']);

    grid.expandGroup(['T0']);
    await settle(grid);
    expect(nameCells(grid)).toEqual(['Name 0:T0', 'Name 3:T0', 'Name 6:T0', 'Name 1:T1', 'Name 4:T1', 'Name 7:T1']);
  });

  it('roda de novo ao trocar o idioma e ao trocar a coluna', async () => {
    const renderer = vi.fn((item: Person) => item.name);
    const grid = await createGrid({ columns: [{ path: 'name', label: 'Name', renderer }], items: people(1) });
    const before = renderer.mock.calls.length;

    grid.language = 'pt';
    await settle(grid);
    expect(renderer.mock.calls.length).toBe(before + 1);

    grid.columns = [{ path: 'name', label: 'Name', renderer }];
    await settle(grid);
    expect(renderer.mock.calls.length).toBe(before + 2);
  });

  it('o signal aborta quando a linha sai da janela e quando o grid sai do DOM', async () => {
    const signals = new Map<number, AbortSignal>();
    const grid = await createGrid({
      columns: [
        { path: 'name', label: 'Name', renderer: (item: Person, ctx) => {
          signals.set(item.id, ctx.signal);
          return item.name;
        } },
      ],
      items: people(1000),
    });

    expect(signals.get(0)!.aborted).toBe(false);
    await scrollBodyTo(grid, 48 * 600);
    expect(signals.get(0)!.aborted).toBe(true);
    const visible = signals.get(600)!;
    expect(visible.aborted).toBe(false);

    grid.remove();
    expect(visible.aborted).toBe(true);
  });

  it('renderer que lança: célula vazia e um console.error por função', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const grid = await createGrid({
      columns: [
        { path: 'id', label: 'Id' }, { path: 'name', label: 'Name', renderer: () => {
          throw new Error('boom');
        } },
      ],
      items: people(5),
    });

    expect(bodyRows(grid)).toHaveLength(5);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

describe('headerRenderer, groupRenderer e noDataRenderer', () => {
  it('cabeçalho: conteúdo próprio; botão dentro não ordena; a seta continua', async () => {
    const clicked = vi.fn();
    const columns: GridColumnDef[] = [
      {
        path: 'name',
        label: 'Name',
        headerRenderer: ({ column }) => html`<em class="h">${column.label}!</em><button class="hb" @click=${() => clicked()}>i</button>`,
      },
    ];
    const grid = await createGrid({ columns, items: people(3) });

    const th = root(grid).querySelector('th.header-column')!;
    expect(th.querySelector('.h')!.textContent).toBe('Name!');

    th.querySelector<HTMLButtonElement>('.hb')!.click();
    await settle(grid);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(grid.getSorting()).toEqual([]);

    (th as HTMLElement).click();
    await settle(grid);
    expect(grid.getSorting()).toHaveLength(1);
    expect(th.querySelector('.sort-indicator')).not.toBeNull();
  });

  it('linha de grupo: rótulo próprio com o ctx; botão de expandir continua', async () => {
    const columns: GridColumnDef[] = [
      {
        path: 'team',
        label: 'Team',
        groupIndex: 0,
        groupRenderer: ctx => html`<span class="g">${ctx.text}|${ctx.itemCount}|${ctx.groupIndex}|${ctx.expanded}|${ctx.defaultText}</span>`,
      },
      { path: 'name', label: 'Name' },
    ];
    const grid = await createGrid({ columns, items: people(6), configure: g => {
      g.autoExpandGroups = true;
    } });

    const labels = [...root(grid).querySelectorAll('.grouping-cell .g')].map(span => span.textContent);
    expect(labels[0]).toBe('T0|2|0|true|Team: T0 (2)');
    expect(root(grid).querySelectorAll('button.group-toggle')).toHaveLength(3);

    grid.collapseGroup(['T0']);
    await settle(grid);
    expect(root(grid).querySelector('.grouping-cell .g')!.textContent).toBe('T0|2|0|false|Team: T0 (2)');
  });

  it('linha de grupo: ctx.firstItem é o 1º item do grupo na ordem atual', async () => {
    const columns: GridColumnDef<Person>[] = [
      { path: 'team', label: 'Team', groupIndex: 0, groupRenderer: ctx => html`<span class="g">${ctx.text}:${ctx.firstItem?.name}</span>` },
      { path: 'name', label: 'Name' },
    ];
    const grid = await createGrid({ columns, items: people(6) });
    const labels = () => [...root(grid).querySelectorAll('.grouping-cell .g')].map(span => span.textContent);

    expect(labels()).toEqual(['T0:Name 0', 'T1:Name 1', 'T2:Name 2']);

    // A ordem dentro do grupo muda o 1º item (e o renderer roda de novo).
    grid.sortColumn(columns[1], 'desc');
    await settle(grid);
    expect(labels()).toEqual(['T0:Name 3', 'T1:Name 4', 'T2:Name 5']);
  });

  it('vazio: conteúdo próprio e `filtered`', async () => {
    const grid = await createGrid({
      columns: [{ path: 'name', label: 'Name' }],
      items: [],
      configure: g => {
        g.noDataRenderer = ({ filtered }) => html`<p class="empty">${filtered ? 'no match' : 'nothing yet'}</p>`;
      },
    });

    expect(root(grid).querySelector('[part=no-data] .empty')!.textContent).toBe('nothing yet');

    grid.items = people(3);
    grid.searchText = 'zzz';
    await settle(grid);
    expect(root(grid).querySelector('[part=no-data] .empty')!.textContent).toBe('no match');
  });
});

describe('master-detail', () => {
  const detail: GridDetailRenderer<Person> = item => html`<div class="detail" style="height: ${100 + item.id}px">Detail ${item.name}</div>`;

  const createDetailGrid = (items = people(200), configure?: (grid: DataGrid) => void) => createGrid({
    columns: [{ path: 'id', label: 'Id', dataType: 'number' }, { path: 'name', label: 'Name' }],
    items,
    configure: grid => {
      grid.detailRenderer = detail;
      configure?.(grid);
    },
  });

  it('coluna de expansão com <button aria-expanded>; clique expande e dispara o evento', async () => {
    const grid = await createDetailGrid();
    const events: GridRowExpansionChangeEventDetail[] = [];
    grid.addEventListener('u-grid-row-expansion-change', event => events.push(event.detail));

    const first = bodyRows(grid)[0];
    const button = toggleOf(first);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Row details');
    expect(root(grid).querySelector('th.detail-toggle-cell')).not.toBeNull();

    button.click();
    await settle(grid);

    expect(events).toEqual([{ rowKey: grid.items[0], expanded: true, source: 'user' }]);
    expect(toggleOf(bodyRows(grid)[0]).getAttribute('aria-expanded')).toBe('true');
    const [detailRow] = detailRows(grid);
    expect(detailRow.textContent.trim()).toBe('Detail Name 0');
    expect(detailRow.getAttribute('aria-labelledby')).toBe(bodyRows(grid)[0].id);
    expect(detailRow.getAttribute('part')).toBe('row detail-row');
    expect(bodyRows(grid)[0].getAttribute('part')).toContain('expanded');
    expect(grid.isRowExpanded(grid.items[0])).toBe(true);
  });

  it('expandRow/collapseRow por API; sem detailRenderer não fazem nada', async () => {
    const grid = await createDetailGrid();
    const listener = vi.fn();
    grid.addEventListener('u-grid-row-expansion-change', listener);

    grid.expandRow(grid.items[2]);
    grid.expandRow(grid.items[2]);
    await settle(grid);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.source).toBe('api');
    expect(detailRows(grid)).toHaveLength(1);

    grid.collapseRow(grid.items[2]);
    await settle(grid);
    expect(detailRows(grid)).toHaveLength(0);

    grid.detailRenderer = null;
    grid.expandRow(grid.items[3]);
    await settle(grid);
    expect(grid.isRowExpanded(grid.items[3])).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(root(grid).querySelector('.detail-toggle-cell')).toBeNull();
  });

  it('auto-expand-rows: tudo expandido; recolher vira exceção', async () => {
    const grid = await createDetailGrid(people(20), g => {
      g.autoExpandRows = true;
    });

    expect(detailRows(grid).length).toBeGreaterThan(0);
    expect(grid.isRowExpanded(grid.items[0])).toBe(true);

    grid.collapseRow(grid.items[0]);
    await settle(grid);
    expect(bodyRows(grid)[1].classList.contains('detail-row')).toBe(false);
    expect(bodyRows(grid)[2].classList.contains('detail-row')).toBe(true);
  });

  it('altura variável: detalhe medido, lista e rolagem estáveis', async () => {
    const grid = await createDetailGrid(people(2000));
    const virtualizer = grid._virtualizer;
    const base = virtualizer.virtualSize;

    grid.expandRow(grid.items[1]);
    await settle(grid);

    const [row] = detailRows(grid);
    const height = row.getBoundingClientRect().height;
    expect(height).toBeGreaterThanOrEqual(101);
    expect(virtualizer.virtualSize).toBeCloseTo(base + height, 0);
    expect(virtualizer.variableRows).toBe(1);

    // Rola para longe e volta: a linha 0 continua no topo, o detalhe com a mesma altura.
    await scrollBodyTo(grid, 48 * 1000);
    await scrollBodyTo(grid, 0);
    expect(bodyRows(grid)[0].querySelector('[part~=cell]')!.textContent.trim()).toBe('0');
    expect(detailRows(grid)[0].getBoundingClientRect().height).toBeCloseTo(height, 0);

    // Janela abaixo do detalhe: as linhas certas na posição certa.
    await scrollBodyTo(grid, height + 48 * 500);
    const scroller = grid._scrollContainerRef.value!;
    const visible = bodyRows(grid).find(tr => tr.getBoundingClientRect().top >= scroller.getBoundingClientRect().top + 46);
    const id = Number(visible!.querySelector('[part~=cell]')!.textContent.trim());
    expect(Math.abs(id - 499)).toBeLessThanOrEqual(2);
  });

  it('detalhe que cresce depois é medido de novo (ResizeObserver)', async () => {
    const grid = await createDetailGrid();
    grid.detailRenderer = item => html`<div class="detail" id="grow-${item.id}" style="height: 60px">x</div>`;
    grid.expandRow(grid.items[0]);
    await settle(grid);

    const before = grid._virtualizer.virtualSize;
    root(grid).querySelector<HTMLElement>('#grow-0')!.style.height = '260px';
    await new Promise(resolve => setTimeout(resolve, 50));
    await settle(grid);
    expect(grid._virtualizer.virtualSize).toBeCloseTo(before + 200, 0);
  });

  it('teclado: Enter/Espaço na célula de expansão; ↓ entra no detalhe; Enter foca o conteúdo; Esc volta', async () => {
    const grid = await createGrid({
      columns: [{ path: 'id', label: 'Id' }, { path: 'name', label: 'Name' }],
      items: people(10),
      configure: g => {
        g.detailRenderer = (item: Person) => html`<button class="inside">${item.name}</button>`;
      },
    });
    const focus: string[] = [];
    grid.addEventListener('u-grid-focus-change', event => focus.push(event.detail.cellType));

    grid.focusCell(grid.items[0]);
    await settle(grid);
    await key(grid, 'Home');
    expect(focus.at(-1)).toBe('detail-toggle');

    await key(grid, 'Enter');
    expect(grid.isRowExpanded(grid.items[0])).toBe(true);

    await key(grid, 'ArrowDown');
    expect(focus.at(-1)).toBe('detail');
    expect((root(grid).activeElement as HTMLElement).classList.contains('detail-cell')).toBe(true);

    await key(grid, 'Enter');
    expect((root(grid).activeElement as HTMLElement).classList.contains('inside')).toBe(true);

    await key(grid, 'Escape');
    expect((root(grid).activeElement as HTMLElement).classList.contains('detail-cell')).toBe(true);

    // Sai do detalhe na coluna em que entrou (a de expansão).
    await key(grid, 'ArrowDown');
    expect(focus.at(-1)).toBe('detail-toggle');
    expect(grid.focusedRowKey).toBe(grid.items[1]);

    // Recolher com o foco no detalhe: o foco volta à linha mestre.
    await key(grid, 'ArrowUp');
    grid.collapseRow(grid.items[0]);
    await settle(grid);
    expect(grid.focusedRowKey).toBe(grid.items[0]);

    // Espaço na célula de expansão alterna (não seleciona).
    grid.selectionMode = 'multiple';
    grid.focusCell(grid.items[0]);
    await settle(grid);
    await key(grid, 'Home');
    await key(grid, ' ');
    expect(grid.isRowExpanded(grid.items[0])).toBe(true);
    expect(grid.selectedKeys).toEqual([]);
  });

  it('grid aninhado no detalhe: teclado e clique isolados', async () => {
    const inner = people(5);
    const grid = await createGrid({
      columns: [{ path: 'id', label: 'Id' }, { path: 'name', label: 'Name' }],
      items: people(10),
      configure: g => {
        g.selectionMode = 'single';
        g.detailRenderer = () => html`<u-grid class="inner" style="display: block; height: 200px" .columns=${[{ path: 'name', label: 'Inner' }]} .items=${inner}></u-grid>`;
      },
    });

    grid.expandRow(grid.items[0]);
    await settle(grid);
    const nested = root(grid).querySelector<DataGrid>('u-grid.inner')!;
    await settle(nested);
    expect(nested.shadowRoot!.querySelectorAll('tbody tr[role=row]')).toHaveLength(5);

    // Enter no detalhe foca o grid interno; setas andam no interno, não no externo.
    grid.focusCell(grid.items[0]);
    await settle(grid);
    await key(grid, 'ArrowDown');
    await key(grid, 'Enter');
    expect(root(grid).activeElement).toBe(nested);

    const outerFocus = grid.focusedRowKey;
    const innerCell = nested.shadowRoot!.activeElement as HTMLElement;
    expect(innerCell).not.toBeNull();
    innerCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true }));
    await settle(nested);
    await settle(grid);
    expect(nested.focusedRowKey).toBe(inner[0]);
    expect(grid.focusedRowKey).toBe(outerFocus);

    // Clique numa linha do interno não seleciona no externo.
    (nested.shadowRoot!.querySelectorAll('tbody td[part~=cell]')[2] as HTMLElement).click();
    await settle(grid);
    expect(grid.selectedKeys).toEqual([]);
  });

  it('os estilos internos do grid não pegam numa tabela do template', async () => {
    const grid = await createDetailGrid(people(3), g => {
      g.detailRenderer = () => html`<table class="user"><thead><tr><th>H</th></tr></thead><tbody><tr><td class="u">text</td></tr></tbody></table>`;
    });
    grid.expandRow(grid.items[0]);
    await settle(grid);

    const userCell = root(grid).querySelector<HTMLElement>('table.user td.u')!;
    const userHead = root(grid).querySelector<HTMLElement>('table.user thead')!;
    expect(getComputedStyle(userCell).maxWidth).toBe('none');
    expect(getComputedStyle(userCell).whiteSpace).toBe('normal');
    expect(getComputedStyle(userHead).position).toBe('static');
    // As células do próprio grid continuam com o estilo dele.
    expect(getComputedStyle(root(grid).querySelector<HTMLElement>('td[part~=cell]')!).whiteSpace).toBe('nowrap');
  });

  it('renderer antigo: `this` é a coluna', async () => {
    const seen: unknown[] = [];
    const column: GridColumnDef = {
      path: 'name',
      label: 'Name',
      renderer(this: GridColumnDef, item: Person) {
        seen.push(this);
        return item.name;
      },
    };
    await createGrid({ columns: [column], items: people(1) });
    expect(seen[0]).toBe(column);
  });

  it('com seleção e grupos: colunas na ordem grupo → expansão → caixa → dados', async () => {
    const grid = await createGrid({
      columns: [{ path: 'team', label: 'Team', groupIndex: 0 }, { path: 'name', label: 'Name' }],
      items: people(6),
      configure: g => {
        g.autoExpandGroups = true;
        g.selectionMode = 'multiple';
        g.showCheckboxes = true;
        g.detailRenderer = detail as GridDetailRenderer;
      },
    });

    const header = root(grid).querySelector('#header-columns-row')!;
    expect([...header.children].map(th => th.className.split(' ')[0])).toEqual(['group-column', 'detail-toggle-cell', 'selection-cell', 'header-column']);
    const data = bodyRows(grid).find(tr => !tr.classList.contains('group-row'))!;
    expect([...data.querySelectorAll('[aria-colindex]')].map(td => td.getAttribute('aria-colindex'))).toEqual(['1', '2', '3']);
    expect(root(grid).querySelector('table')!.getAttribute('aria-colcount')).toBe('3');
  });
});

describe('acessibilidade dos templates e do master-detail (spec 17)', () => {
  it('axe sem violações com detalhe aberto, grupos e todos os renderers', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'team', label: 'Team', groupIndex: 0, groupRenderer: ctx => html`<b>${ctx.text}</b> (${ctx.itemCount})` },
        { path: 'id', label: 'Id', headerRenderer: ({ column }) => html`<span>${column.label}</span>` },
        { path: 'name', label: 'Name', renderer: (item: Person) => html`<a href="#p${item.id}">${item.name}</a>` },
      ],
      items: people(6),
      configure: g => {
        g.autoExpandGroups = true;
        g.selectionMode = 'multiple';
        g.showCheckboxes = true;
        g.detailRenderer = (item: Person) => html`<p>About ${item.name}</p><button>Edit</button>`;
      },
    });

    grid.expandRow(grid.items[0]);
    await settle(grid);

    const detailRow = detailRows(grid)[0];
    expect(detailRow.getAttribute('aria-level')).toBe('2');
    expect(root(grid).getElementById(detailRow.getAttribute('aria-labelledby')!)).not.toBeNull();
    expect(detailRow.querySelector('td')!.getAttribute('aria-colspan')).toBe('4');

    const result = await axe.run(grid, { resultTypes: ['violations'] });
    expect(result.violations.map(v => v.id)).toEqual([]);
  });

  it('célula de expansão: estado na célula; o clique deixa o foco nela e as setas seguem', async () => {
    const grid = await createGrid({
      columns: [{ path: 'id', label: 'Id' }, { path: 'name', label: 'Name' }],
      items: people(5),
      configure: g => {
        g.detailRenderer = (item: Person) => html`<div>${item.name}</div>`;
      },
    });

    const cell = bodyRows(grid)[0].querySelector<HTMLElement>('td.detail-toggle-cell')!;
    expect(cell.getAttribute('aria-expanded')).toBe('false');

    toggleOf(bodyRows(grid)[0]).click();
    await settle(grid);
    const active = root(grid).activeElement as HTMLElement;
    expect(active.classList.contains('detail-toggle-cell')).toBe(true);
    expect(active.getAttribute('aria-expanded')).toBe('true');

    await key(grid, 'ArrowDown');
    expect((root(grid).activeElement as HTMLElement).classList.contains('detail-cell')).toBe(true);

    // Recolher com o foco no detalhe: o foco do DOM volta à linha mestre.
    grid.collapseRow(grid.items[0]);
    await settle(grid);
    expect((root(grid).activeElement as HTMLElement).closest('tr')!.getAttribute('data-index')).toBe('0');
  });

  it('F2 chega ao conteúdo interativo do cabeçalho e da linha de grupo; o do vazio fica na ordem de Tab', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'team', label: 'Team', groupIndex: 0, groupRenderer: ctx => html`${ctx.text} <button class="gb">i</button>` },
        { path: 'name', label: 'Name', headerRenderer: () => html`Name <button class="hb">?</button>` },
      ],
      items: people(3),
    });

    root(grid).querySelector<HTMLElement>('th.header-column')!.focus();
    await key(grid, 'F2');
    expect((root(grid).activeElement as HTMLElement).classList.contains('hb')).toBe(true);
    await key(grid, 'Escape');

    const groupCell = root(grid).querySelector<HTMLElement>('.grouping-cell')!;
    groupCell.focus();
    await key(grid, 'F2');
    expect((root(grid).activeElement as HTMLElement).classList.contains('gb')).toBe(true);

    grid.items = [];
    grid.noDataRenderer = () => html`<button class="nb">Add</button>`;
    await settle(grid);
    expect(root(grid).querySelector('.nb')!.getAttribute('tabindex')).toBeNull();
    expect(root(grid).querySelector('[part=no-data]')!.hasAttribute('lang')).toBe(false);
  });

  it('linha de grupo com groupRenderer e resumo alinhado: nome = conteúdo + resumos', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'team', label: 'Team', groupIndex: 0, groupRenderer: ctx => html`<b>${ctx.text}</b>` },
        { path: 'name', label: 'Name' },
        { path: 'age', label: 'Age', dataType: 'number' },
      ],
      items: people(6),
      configure: g => {
        g.summary = { group: [{ column: 'age', type: 'sum', display: 'column' }] };
      },
    });

    const cell = root(grid).querySelector<HTMLElement>('.grouping-cell')!;
    const ids = cell.getAttribute('aria-labelledby')!.split(' ');
    expect(ids).toHaveLength(2);
    expect(root(grid).getElementById(ids[0])!.textContent).toContain('T0');
    expect(root(grid).getElementById(ids[1])!.textContent).toMatch(/Age/);
  });
});

// Regressão: coluna com `headerRenderer` e sem `label` deixava os botões do cabeçalho ("Options for "), o chip e o seletor sem nome.
describe('coluna sem label', () => {
  /** Nome acessível simplificado: `aria-labelledby` (ids no shadow root), senão `aria-label`, senão o texto. */
  const accName = (grid: DataGrid, element: Element): string => {
    const ids = element.getAttribute('aria-labelledby');

    if (ids) {
      return ids.split(/\s+/).map(id => root(grid).getElementById(id)?.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return (element.getAttribute('aria-label') ?? element.textContent).replace(/\s+/g, ' ').trim();
  };

  it('nomeia pelo texto renderizado no cabeçalho e pelo path no resto; avisa uma vez', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cols: GridColumnDef<Person>[] = [
      { path: 'name', label: 'Name', width: 150 },
      { path: 'team', width: 120 },
      { path: 'age', width: 120, headerRenderer: () => html`<b>Years</b>` },
      { name: 'actions', width: 80, renderer: () => html`<button>Edit</button>` },
    ];
    const grid = await createGrid({
      columns: cols,
      items: people(4),
      configure: g => {
        g.language = 'en';
        g.headerFilter = true;
        g.columnResizing = true;
      },
    });

    try {
      const th = (label: number) => root(grid).querySelectorAll('th.header-column')[label];

      // Sem headerRenderer: o cabeçalho mostra o path (antes ficava vazio).
      expect(th(1).querySelector('.header-text')!.textContent.trim()).toBe('team');
      // Coluna só de `renderer` (sem path): cabeçalho continua vazio.
      expect(th(3).querySelector('.header-text')!.textContent.trim()).toBe('');

      // Com headerRenderer: os controles do cabeçalho seguem o texto renderizado.
      expect(accName(grid, th(2).querySelector('.column-header-menu-button')!)).toBe('Options for Years');
      expect(accName(grid, th(2).querySelector('.header-filter-button')!)).toBe('Filter options for Years');
      expect(accName(grid, th(2).querySelector('.resize-handle')!)).toBe('Resize Years');
      expect(accName(grid, th(1).querySelector('.column-header-menu-button')!)).toBe('Options for team');
      // Sem `label`, o `title` (descrição) não repete outro nome da coluna; a interface fala no idioma da i18n.
      expect(th(2).querySelector('.column-header-menu-button')!.hasAttribute('title')).toBe(false);
      expect(th(2).querySelector('.header-filter-button')!.hasAttribute('title')).toBe(false);
      expect(th(1).querySelector('.header-filter-button')!.getAttribute('title')).toBe('Filter options for team');
      expect(th(2).querySelector('.header-filter-button')!.getAttribute('lang')).toBe('en');
      expect(th(2).querySelector('.resize-handle')!.getAttribute('lang')).toBe('en');

      const gridWarnings = () => warn.mock.calls.map(call => String(call[0])).filter(text => text.startsWith('<u-grid>'));
      expect(gridWarnings()).toHaveLength(1);
      expect(gridWarnings()[0]).toContain('"age"');

      // Fora do cabeçalho: path cru (chip do painel de grupo e seletor de colunas).
      grid.openColumnChooser();
      await settle(grid);
      const chooser = [...root(grid).querySelectorAll('[id^="column-chooser-label-"]')].map(label => label.textContent.trim());
      expect(chooser).toEqual(['Name', 'team', 'age', 'actions']);

      grid.groupColumn(cols[2]);
      await settle(grid);
      expect(root(grid).querySelector('[part~="group-chip"] .group-label')!.textContent.trim()).toBe('age');

      // A mesma coluna não avisa de novo, nem com objetos recriados (React/Vue a cada render).
      grid.columns = cols.map(column => ({ ...column }));
      await settle(grid);
      expect(gridWarnings()).toHaveLength(1);

      grid.ungroupColumn(grid.columns[2]);
      await settle(grid);
      const result = await axe.run(grid as unknown as Element);
      expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.html).join(' | ')}`)).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});
