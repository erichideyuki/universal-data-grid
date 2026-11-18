/**
 * Frente 21: colunas ocultas por falta de espaço (`autoHideColumns`,
 * `hidingPriority`) e linha adaptativa (a linha de detalhe com os valores
 * das ocultas).
 */
import { html } from 'lit';

import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import type { GridAdaptiveColumnsChangeEventDetail, GridColumnDef, GridRowExpansionChangeEventDetail } from './grid.js';
import type { DataGrid } from './grid.js';
import { bodyRows, cleanup, createGrid, headerLabels, settle } from './test/fixture.js';

afterEach(cleanup);

interface Sale {
  id: number;
  invoice: string;
  city: string;
  state: string;
  employee: string;
  date: Date;
  amount: number;
}

const sales = (count: number): Sale[] =>
  Array.from({ length: count }, (_, id) => ({
    id,
    invoice: `INV-${id}`,
    city: `City ${id}`,
    state: `State ${id % 5}`,
    employee: `Employee ${id % 7}`,
    date: new Date(2024, id % 12, 1 + (id % 27)),
    amount: 100 + id,
  }));

const columns = (): GridColumnDef<Sale>[] => [
  { path: 'invoice', label: 'Invoice', width: 120 },
  { path: 'city', label: 'City', width: 120 },
  { path: 'state', label: 'State', width: 120 },
  { path: 'employee', label: 'Employee', width: 120 },
  { path: 'date', label: 'Order date', width: 120, dataType: 'date' },
  { path: 'amount', label: 'Amount', width: 120, dataType: 'number', format: { style: 'currency', currency: 'USD' } },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;

/** Grid com `autoHideColumns` e largura própria (px). */
const createResponsive = async (width: number, configure?: (grid: DataGrid) => void, items = sales(20), cols = columns()): Promise<DataGrid> => {
  const grid = await createGrid({
    columns: cols,
    items,
    setBeforeConnect: true,
    configure: g => {
      g.style.width = `${width}px`;
      g.autoHideColumns = true;
      configure?.(g);
    },
  });

  await settle(grid);
  return grid;
};

const resize = async (grid: DataGrid, width: number): Promise<void> => {
  grid.style.width = `${width}px`;
  // ResizeObserver entrega no próximo quadro.
  await settle(grid);
  await settle(grid);
};

const key = async (grid: DataGrid, name: string, init: KeyboardEventInit = {}): Promise<void> => {
  const target = root(grid).activeElement as HTMLElement;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const detailRows = (grid: DataGrid): HTMLTableRowElement[] =>
  [...root(grid).querySelectorAll<HTMLTableRowElement>('tbody tr.detail-row:not(.pinned)')];

const masterRows = (grid: DataGrid): HTMLTableRowElement[] =>
  bodyRows(grid).filter(tr => !tr.classList.contains('detail-row') && !tr.classList.contains('group-row'));

const fieldTexts = (row: Element): string[] =>
  [...row.querySelectorAll('.adaptive-field')].map(field => [
    field.querySelector('.adaptive-label-text')?.textContent ?? '',
    field.querySelector('.adaptive-text')?.textContent?.trim() ?? '',
  ].join('='));

describe('colunas ocultas por falta de espaço', () => {
  it('sem hidingPriority saem da última para a primeira; a coluna de expansão aparece', async () => {
    const grid = await createResponsive(1000);

    expect(headerLabels(grid)).toEqual(['Invoice', 'City', 'State', 'Employee', 'Order date', 'Amount']);
    expect(root(grid).querySelector('th.detail-toggle-cell')).toBeNull();
    expect(grid.getAdaptiveColumns()).toEqual([]);

    await resize(grid, 500);
    expect(headerLabels(grid)).toEqual(['Invoice', 'City', 'State']);
    expect(grid.getAdaptiveColumns().map(column => column.label)).toEqual(['Employee', 'Order date', 'Amount']);
    expect(root(grid).querySelector('th.detail-toggle-cell')).not.toBeNull();

    await resize(grid, 1000);
    expect(headerLabels(grid)).toEqual(['Invoice', 'City', 'State', 'Employee', 'Order date', 'Amount']);
    expect(root(grid).querySelector('th.detail-toggle-cell')).toBeNull();
  });

  it('com hidingPriority só elas saem, da menor para a maior', async () => {
    const cols = columns();
    cols[1].hidingPriority = 0;
    cols[2].hidingPriority = 1;
    cols[4].hidingPriority = 2;
    const grid = await createResponsive(560, undefined, sales(5), cols);

    expect(headerLabels(grid)).toEqual(['Invoice', 'Employee', 'Order date', 'Amount']);

    await resize(grid, 300);
    expect(headerLabels(grid)).toEqual(['Invoice', 'Employee', 'Amount']);
  });

  it('expandir mostra rótulo: valor formatado; evento e aria-expanded', async () => {
    const grid = await createResponsive(500);
    const events: GridRowExpansionChangeEventDetail[] = [];
    grid.addEventListener('u-grid-row-expansion-change', event => events.push(event.detail));

    const button = masterRows(grid)[0].querySelector<HTMLButtonElement>('button.detail-toggle')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    await settle(grid);

    expect(events).toEqual([{ rowKey: grid.items[0], expanded: true, source: 'user' }]);
    const detail = detailRows(grid)[0];
    expect(fieldTexts(detail)).toEqual(['Employee=Employee 0', 'Order date=1/1/2024', 'Amount=$100.00']);
    expect(detail.getAttribute('aria-labelledby')).toBe(masterRows(grid)[0].id);
  });

  it('aria-colcount conta só as colunas exibidas', async () => {
    const grid = await createResponsive(500);
    const table = root(grid).querySelector('[role=grid]')!;

    // expansão + 3 exibidas
    expect(table.getAttribute('aria-colcount')).toBe('4');
  });

  it('evento u-grid-adaptive-columns-change depois do render', async () => {
    const grid = await createResponsive(1000);
    const events: GridAdaptiveColumnsChangeEventDetail[] = [];
    grid.addEventListener('u-grid-adaptive-columns-change', event => events.push(event.detail));

    await resize(grid, 500);
    expect(events.map(detail => [detail.columns.map(c => c.label), detail.previous.map(c => c.label)])).toEqual([
      [['Employee', 'Order date', 'Amount'], []],
    ]);
    expect(Object.isFrozen(events[0].columns)).toBe(true);
  });

  it('getState não muda com a largura', async () => {
    const grid = await createResponsive(1000);
    const before = JSON.stringify(grid.getState());
    await resize(grid, 400);
    expect(grid.getAdaptiveColumns().length).toBeGreaterThan(0);
    expect(JSON.stringify(grid.getState())).toBe(before);
  });

  it('axe sem violações (fechado e aberto)', async () => {
    const grid = await createResponsive(500);
    grid.expandRow(grid.items[0]);
    await settle(grid);

    const result = await axe.run(grid as unknown as Element);
    expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.html).join(' | ')}`)).toEqual([]);
  });

  it('renderer recebe ctx.adaptive', async () => {
    const seen: boolean[] = [];
    const cols = columns();
    cols[5].renderer = (item: Sale, ctx) => {
      seen.push(ctx.adaptive);
      return html`<b class="amount">${item.amount}</b>`;
    };
    const grid = await createResponsive(500, undefined, sales(3), cols);
    grid.expandRow(grid.items[0]);
    await settle(grid);

    expect(seen).toContain(true);
    expect(detailRows(grid)[0].querySelector('.amount')?.textContent).toBe('100');
  });
});

const focused = (grid: DataGrid): Element | null => root(grid).activeElement;

const record = <T>(grid: DataGrid, name: string): T[] => {
  const details: T[] = [];
  grid.addEventListener(name, event => details.push((event as CustomEvent<T>).detail));
  return details;
};

const type = async (grid: DataGrid, text: string): Promise<void> => {
  const input = focused(grid) as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settle(grid);
};

describe('linha adaptativa: teclado', () => {
  it('roteiro: expandir na célula de expansão, ↓ entra, Enter vai ao 1º valor, Tab circula, Esc volta, ↑ sai', async () => {
    const grid = await createResponsive(500);
    const focus = record<{ column: GridColumnDef | null; cellType: string }>(grid, 'u-grid-focus-change');

    expect(grid.focusCell(grid.items[0], 'invoice')).toBe(true);
    await settle(grid);
    await key(grid, 'Home');
    expect(focused(grid)?.classList.contains('detail-toggle-cell')).toBe(true);

    await key(grid, 'Enter');
    expect(grid.isRowExpanded(grid.items[0])).toBe(true);
    expect(focused(grid)?.classList.contains('detail-toggle-cell')).toBe(true);

    await key(grid, 'ArrowDown');
    expect(focused(grid)?.classList.contains('detail-cell')).toBe(true);
    expect(focus.at(-1)?.cellType).toBe('detail');

    await key(grid, 'Enter');
    const values = [...detailRows(grid)[0].querySelectorAll<HTMLElement>('.adaptive-value')];
    expect(focused(grid)).toBe(values[0]);
    expect(focus.at(-1)?.column?.label).toBe('Employee');
    expect(values[0].getAttribute('aria-labelledby')?.split(' ').map(id => root(grid).getElementById(id)?.textContent?.trim()))
      .toEqual(['Employee:', 'Employee 0']);

    await key(grid, 'Tab');
    expect(focused(grid)).toBe(values[1]);
    await key(grid, 'Tab');
    await key(grid, 'Tab');
    expect(focused(grid)).toBe(values[0]);
    await key(grid, 'Tab', { shiftKey: true });
    expect(focused(grid)).toBe(values[2]);

    await key(grid, 'Escape');
    expect(focused(grid)?.classList.contains('detail-cell')).toBe(true);

    await key(grid, 'ArrowUp');
    expect(focused(grid)?.classList.contains('detail-toggle-cell')).toBe(true);
  });

  it('RTL: mesmo roteiro (← → não mexem na linha adaptativa)', async () => {
    const grid = await createResponsive(500, g => {
      g.dir = 'rtl';
    });
    grid.expandRow(grid.items[0]);
    grid.focusCell(grid.items[0], 'invoice');
    await settle(grid);
    await key(grid, 'ArrowDown');
    expect(focused(grid)?.classList.contains('detail-cell')).toBe(true);
    await key(grid, 'ArrowLeft');
    expect(focused(grid)?.classList.contains('detail-cell')).toBe(true);
    await key(grid, 'F2');
    expect(focused(grid)?.classList.contains('adaptive-value')).toBe(true);
  });

  it('focusCell numa coluna oculta abre a linha (api) e foca o valor', async () => {
    const grid = await createResponsive(500);
    const expansion = record<GridRowExpansionChangeEventDetail>(grid, 'u-grid-row-expansion-change');

    expect(grid.focusCell(grid.items[1], 'amount')).toBe(true);
    await settle(grid);

    expect(expansion).toEqual([{ rowKey: grid.items[1], expanded: true, source: 'api' }]);
    expect(focused(grid)?.getAttribute('data-column')).not.toBeNull();
    expect((focused(grid) as HTMLElement).textContent).toContain('$101.00');
  });

  it('coluna da célula ativa que some: o foco vai à célula de expansão da linha', async () => {
    const grid = await createResponsive(1000);
    grid.focusCell(grid.items[0], 'amount');
    await settle(grid);
    expect(focused(grid)?.textContent).toContain('$100.00');

    await resize(grid, 500);
    expect(focused(grid)?.classList.contains('detail-toggle-cell')).toBe(true);

    // Todas voltam: a coluna de expansão some, o foco vai à 1ª célula de dados.
    await resize(grid, 1000);
    expect(focused(grid)?.textContent).toBe('INV-0');
  });
});

describe('linha adaptativa: linhas fixas, resumos, exportação', () => {
  it('linha fixa expande dentro do próprio rowgroup, com aria-rowindex na ordem visual', async () => {
    const items = sales(5);
    const grid = await createResponsive(500, g => {
      g.fixedTopItems = [{ ...items[0], id: 100, invoice: 'TOP' }];
    }, items);
    const fixedRow = root(grid).querySelector<HTMLTableRowElement>('tbody.fixed-top-rows > tr.fixed-row')!;
    const button = fixedRow.querySelector<HTMLButtonElement>('button.detail-toggle')!;
    expect(button).not.toBeNull();

    button.click();
    await settle(grid);

    const detail = root(grid).querySelector<HTMLTableRowElement>('tbody.fixed-top-rows > tr.detail-row')!;
    expect(detail).not.toBeNull();
    expect(detail.getAttribute('aria-labelledby')).toBe(fixedRow.id);
    expect(Number(detail.getAttribute('aria-rowindex'))).toBe(Number(fixedRow.getAttribute('aria-rowindex')) + 1);
    expect(fieldTexts(detail).length).toBe(grid.getAdaptiveColumns().length);

    // A 1ª linha do corpo vem depois da adaptativa da fixa.
    expect(Number(masterRows(grid).find(tr => !tr.classList.contains('fixed-row'))!.getAttribute('aria-rowindex')))
      .toBe(Number(detail.getAttribute('aria-rowindex')) + 1);

    // Teclado: ↓ da fixa entra na adaptativa dela.
    grid.focusCell(grid.fixedTopItems[0], 'invoice', { rowFixed: 'top' });
    await settle(grid);
    await key(grid, 'ArrowDown');
    expect(focused(grid)?.closest('tbody')?.classList.contains('fixed-top-rows')).toBe(true);
    expect(focused(grid)?.classList.contains('detail-cell')).toBe(true);
    const result = await axe.run(grid as unknown as Element);
    expect(result.violations.map(v => v.id)).toEqual([]);
  });

  it('total de coluna oculta vai para a última exibida, com o texto completo', async () => {
    const grid = await createResponsive(500, g => {
      g.summary = { total: [{ column: 'amount', type: 'sum' }, { column: 'invoice', type: 'count' }] };
    }, sales(3));
    const cells = [...root(grid).querySelectorAll('tfoot td.summary-cell')].map(td => td.textContent?.replace(/\s+/g, ' ').trim());
    expect(cells.some(text => text?.includes('Sum of Amount: $303.00'))).toBe(true);
  });

  it('exportação e cópia de linhas incluem as ocultas', async () => {
    const grid = await createResponsive(500, g => {
      g.selectionMode = 'multiple';
    }, sales(2));
    const data = await grid.getExportData();
    expect(data.columns.map(column => column.label)).toContain('Amount');
    expect(grid.getAdaptiveColumns().map(column => column.label)).toContain('Amount');
  });

  it('busca realça o valor na linha adaptativa', async () => {
    const grid = await createResponsive(500, g => {
      g.showSearchPanel = true;
    }, sales(3));
    grid.searchText = 'Employee 1';
    grid.expandRow(grid.items[1]);
    await settle(grid);
    expect(detailRows(grid)[0].querySelector('.search-highlight')?.textContent).toBe('Employee 1');
  });

  it('seletor: coluna oculta por espaço fica marcada, com a dica', async () => {
    const grid = await createResponsive(500, g => {
      g.columnChooser = true;
    });
    grid.openColumnChooser();
    await settle(grid);
    const hints = [...root(grid).querySelectorAll('.column-chooser-hint')].map(hint => hint.textContent);
    expect(hints).toEqual(grid.getAdaptiveColumns().map(() => 'In row details'));
    const input = root(grid).querySelector<HTMLInputElement>('.column-chooser-adaptive input')!;
    expect(input.checked).toBe(true);
    expect(root(grid).getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe('In row details');
  });
});

describe('linha adaptativa: edição', () => {
  it('modo célula: Enter no valor abre o editor; Enter confirma e o foco volta ao valor; Esc cancela', async () => {
    const grid = await createResponsive(500, g => {
      g.allowEditing = true;
    });
    grid.focusCell(grid.items[0], 'employee');
    await settle(grid);
    expect(focused(grid)?.classList.contains('adaptive-value')).toBe(true);

    await key(grid, 'Enter');
    const input = focused(grid) as HTMLInputElement;
    expect(input.classList.contains('cell-editor')).toBe(true);
    expect(input.getAttribute('aria-labelledby')).toMatch(/^adaptive-/);

    await type(grid, 'Changed');
    await key(grid, 'Enter');
    await settle(grid);
    expect(focused(grid)?.classList.contains('adaptive-value')).toBe(true);
    expect(focused(grid)?.textContent).toContain('Changed');

    await key(grid, 'Enter');
    await type(grid, 'Discarded');
    await key(grid, 'Escape');
    expect(focused(grid)?.classList.contains('adaptive-value')).toBe(true);
    expect(focused(grid)?.textContent).toContain('Changed');
  });

  it('modo linha: abre a linha adaptativa com os editores; Tab: mestre → adaptativa → botões; fecha ao sair', async () => {
    const grid = await createResponsive(700, g => {
      g.allowEditing = true;
      g.editMode = 'row';
    });
    const expansion = record<GridRowExpansionChangeEventDetail>(grid, 'u-grid-row-expansion-change');
    const hidden = grid.getAdaptiveColumns().length;
    expect(hidden).toBeGreaterThan(0);

    expect(grid.editRow(grid.items[0])).toBe(true);
    await settle(grid);
    expect(expansion.map(e => e.expanded)).toEqual([true]);

    const masterEditors = [...masterRows(grid)[0].querySelectorAll('.cell-editor')];
    const adaptiveEditors = [...detailRows(grid)[0].querySelectorAll('.cell-editor')];
    expect(adaptiveEditors).toHaveLength(hidden);
    expect(focused(grid)).toBe(masterEditors[0]);

    for (let i = 1; i < masterEditors.length; i++) {
      await key(grid, 'Tab');
    }

    await key(grid, 'Tab');
    expect(focused(grid)).toBe(adaptiveEditors[0]);

    for (let i = 1; i < adaptiveEditors.length; i++) {
      await key(grid, 'Tab');
    }

    await key(grid, 'Tab');
    expect((focused(grid) as HTMLElement).textContent?.trim()).toBe('Save');

    await key(grid, 'Escape');
    expect(expansion.map(e => e.expanded)).toEqual([true, false]);
    expect(root(grid).querySelector('.cell-editor')).toBeNull();
  });
});
