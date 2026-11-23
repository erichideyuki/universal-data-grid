/**
 * Frente 21: colunas ocultas por falta de espaço (`autoHideColumns`,
 * `hidingPriority`) e linha adaptativa (a linha de detalhe com os valores
 * das ocultas).
 */
import { html } from 'lit';

import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

import type { GridAdaptiveColumnsChangeEventDetail, GridColumnDef, GridRowExpansionChangeEventDetail } from './grid.js';
import type { DataGrid } from './grid.js';
import { bodyRows, cleanup, createGrid, headerLabels, settle } from './test/fixture.js';

declare module 'vitest/browser' {
  interface BrowserCommands {
    emulateMedia: (options: {
      forcedColors?: 'active' | 'none' | null;
      reducedMotion?: 'reduce' | 'no-preference' | null;
    }) => Promise<void>;
  }
}

afterEach(async () => {
  cleanup();
  await commands.emulateMedia({ forcedColors: null, reducedMotion: null });
});

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
  // Mockup do clickCompliance: alargar "Ativo" (hidingPriority 0) com o grid sobrando a fazia
  // sumir no 1º px — o arrasto congelava a largura esticada da última coluna (a sobra).
  it('redimensionar com sobra no grid não esconde a coluna arrastada (nem outra)', async () => {
    type Row = { name: string; active: number; done: number };
    const cols: GridColumnDef<Row>[] = [
      { path: 'name', label: 'Nome', fixed: 'start' },
      { path: 'active', label: 'Ativo', dataType: 'number', hidingPriority: 0 },
      { path: 'done', label: 'Concluído', dataType: 'number', hidingPriority: 1 },
    ];
    const rows = [{ name: 'Paulo Henrique', active: 1, done: 2 }];
    const grid = await createResponsive(900, g => {
      g.columnAutoWidth = true;
      g.columnResizing = true;
    }, rows as never, cols as never);
    await settle(grid);

    const header = () => [...root(grid).querySelectorAll<HTMLElement>('th.header-column')].find(th => th.textContent.trim().startsWith('Ativo'));
    const before = header()!.getBoundingClientRect().width;
    const handle = header()!.querySelector<HTMLElement>('.resize-handle')!;
    const rect = handle.getBoundingClientRect();
    const init = { bubbles: true, composed: true, pointerId: 11, button: 0, isPrimary: true, clientY: rect.top + 2 };
    const x = rect.left + rect.width / 2;

    handle.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x }));
    handle.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x + 40 }));
    await settle(grid);
    expect(grid.getAdaptiveColumns()).toEqual([]);
    expect(header()).toBeDefined();

    handle.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: x + 40 }));
    await settle(grid);
    await settle(grid);
    expect(grid.getAdaptiveColumns()).toEqual([]);
    expect(header()!.getBoundingClientRect().width).toBeCloseTo(before + 40, 0);
  });

  // Relato da 0.3.2 (click): "Nome" fixa sem width, com column-auto-width, ficava com a largura do
  // conteúdo; escondidas as outras, a tabela seguia mais larga que o grid (a capa pulava as fixas).
  it('column-auto-width: a fixa larga encolhe até caber (nunca abaixo do minWidth)', async () => {
    type Row = { id: number; name: string; a: number; b: number; c: number; d: number; e: number };
    const cols: GridColumnDef<Row>[] = [
      { path: 'name', label: 'Nome', minWidth: 140, fixed: 'start' },
      ...(['a', 'b', 'c', 'd', 'e'] as const).map((path, index) => ({ path, label: `Coluna ${path.toUpperCase()}`, dataType: 'number' as const, hidingPriority: index })),
      { name: 'actions', label: 'Ações', width: 56, fixed: 'end', valueGetter: () => '…', filterable: false, sortable: false },
    ];
    const rows = ['Alessandra Bittencourt Cavalcanti de Albuquerque', 'Paulo Henrique Duarte', 'Ana']
      .map((name, id) => ({ id, name, a: 1, b: 2, c: 3, d: 4, e: 5 }));
    const grid = await createResponsive(354, g => g.columnAutoWidth = true, rows as never, cols as never);
    await settle(grid);
    await settle(grid);

    const table = root(grid).querySelector('table')!;
    const nameCell = bodyRows(grid)[0].querySelector<HTMLElement>('td[part~=cell]')!;

    expect(grid.getAdaptiveColumns().length).toBeGreaterThan(0);
    expect(table.offsetWidth).toBeLessThanOrEqual(grid.clientWidth + 1);
    expect(nameCell.getBoundingClientRect().width).toBeGreaterThanOrEqual(140 - 0.5);
  });

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

  it('declarativo: auto-hide-columns e hiding-priority (vazio ou texto = sem prioridade)', async () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <u-grid auto-hide-columns style="display: block; height: 300px; width: 320px">
        <u-grid-column path="invoice" width="120">Invoice</u-grid-column>
        <u-grid-column path="city" width="120" hiding-priority="">City</u-grid-column>
        <u-grid-column path="state" width="120" hiding-priority="x">State</u-grid-column>
        <u-grid-column path="amount" width="120" hiding-priority="0">Amount</u-grid-column>
      </u-grid>`;
    document.body.append(host);
    const grid = host.querySelector('u-grid')!;
    grid.items = sales(3);
    await settle(grid);
    await settle(grid);

    const [, city, state, amount] = [...host.querySelectorAll('u-grid-column')];
    expect([city.hidingPriority, state.hidingPriority, amount.hidingPriority]).toEqual([null, null, 0]);
    expect(grid.autoHideColumns).toBe(true);
    // Só a com prioridade sai (as outras nunca, mesmo sem caber).
    expect(grid.getAdaptiveColumns().map(column => column.label)).toEqual(['Amount']);
    host.remove();
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
    expect(events.map(detail => [detail.columns.map(c => c.label), detail.previous.map(c => c.label)])).toEqual([[['Employee', 'Order date', 'Amount'], []]]);
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
    expect(values[0].getAttribute('aria-labelledby')?.split(' ')
      .map(id => root(grid).getElementById(id)?.textContent?.trim()))
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

  it('focusCell numa coluna oculta de uma linha fixa abre a linha fixa e foca o valor', async () => {
    const items = sales(5);
    const top = { ...items[0], id: 100, invoice: 'TOP', amount: 999 };
    const grid = await createResponsive(500, g => {
      g.fixedTopItems = [top];
    }, items);

    expect(grid.focusCell(top, 'amount', { rowFixed: 'top' })).toBe(true);
    await settle(grid);
    expect(focused(grid)?.closest('tbody')?.classList.contains('fixed-top-rows')).toBe(true);
    expect((focused(grid) as HTMLElement).textContent).toContain('$999.00');
  });

  // Regressão: os totais das ocultas iam todos para a última exibida, que crescia (214px com 5 colunas).
  it('total de coluna oculta sai do rodapé, como a célula (DevExtreme), e o rodapé fica com uma linha', async () => {
    const plain = columns().map(column => ({ ...column, format: undefined }));
    const grid = await createResponsive(390, g => {
      g.summary = { total: plain.map(column => ({ column: column.path!, type: 'count' as const })) };
    }, sales(3), plain.map((column, index) => ({ ...column, hidingPriority: index })));

    const hidden = grid.getAdaptiveColumns().map(column => column.label);
    expect(hidden.length).toBeGreaterThan(1);

    const footer = root(grid).querySelector<HTMLElement>('tfoot tr.total-row')!;
    const texts = [...footer.querySelectorAll('td.summary-cell')].map(td => td.textContent?.replace(/\s+/g, ' ').trim()).filter(Boolean);
    expect(texts).toHaveLength(plain.length - hidden.length);
    expect(texts.some(text => hidden.some(label => text.includes(`of ${label}`)))).toBe(false);

    const row = bodyRows(grid)[0];
    expect(footer.getBoundingClientRect().height).toBeLessThanOrEqual(row.getBoundingClientRect().height + 1);
    // O valor segue disponível pela API.
    expect(grid.getSummaryValues().map(value => value.value)).toEqual(plain.map(() => 3));
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

const violations = async (grid: DataGrid): Promise<string[]> =>
  (await axe.run(grid as unknown as Element)).violations.map(v => `${v.id}: ${v.nodes.map(n => n.html).join(' | ')}`);

const announcement = (grid: DataGrid): string =>
  root(grid).querySelector('[role=status][aria-live]')?.textContent?.replace(/\u200b|\u00a0/g, '').trim() ?? '';

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

describe('acessibilidade do responsivo (entrega)', () => {
  it('axe: editando, em RTL (ar) e a 320 px', async () => {
    const grid = await createResponsive(500, g => {
      g.allowEditing = true;
    });
    grid.editCell(grid.items[0], 'amount');
    await settle(grid);
    expect(root(grid).querySelector('.adaptive-value .cell-editor')).not.toBeNull();
    expect(await violations(grid)).toEqual([]);

    const rtl = await createResponsive(320, g => {
      g.language = 'ar';
      g.dir = 'rtl';
    });
    rtl.expandRow(rtl.items[0]);
    await settle(rtl);
    expect(await violations(rtl)).toEqual([]);
  });

  it('reflow a 320 px: sem rolagem horizontal; fixas que passariam de 50% deixam de grudar', async () => {
    const cols = columns();
    cols[0].fixed = 'start';
    cols[0].width = 140;
    const grid = await createResponsive(320, undefined, sales(10), cols);
    const scroller = grid._scrollContainerRef.value!;

    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth + 1);
    // 40 (expansão) + 140 (fixa) > 50% de ~305 px: a fixa não gruda.
    expect(root(grid).querySelector('th.header-column.fixed')).toBeNull();
    expect(scroller.getAttribute('style') ?? '').toContain('scroll-padding-inline: 40px 0px');
  });

  it('anúncio: uma vez por rajada, depois de 1 s, só com foco dentro; nada com líquido zero; descrição do cabeçalho', async () => {
    const grid = await createResponsive(1000);
    grid.focusCell(grid.items[0], 'invoice');
    await settle(grid);

    await resize(grid, 700);
    await resize(grid, 500);
    expect(announcement(grid)).toBe('');
    await wait(1100);
    expect(announcement(grid)).toBe('Columns in row details: Employee, Order date, Amount');
    const header = root(grid).querySelector('th.detail-toggle-cell')!;
    expect(root(grid).getElementById(header.getAttribute('aria-describedby')!)?.textContent).toBe('Columns in row details: Employee, Order date, Amount');

    // Líquido zero: estreita e volta na mesma rajada.
    await resize(grid, 400);
    await resize(grid, 500);
    await wait(1100);
    expect(announcement(grid)).toBe('Columns in row details: Employee, Order date, Amount');

    await resize(grid, 1000);
    await wait(1100);
    expect(announcement(grid)).toBe('All columns in the table');

    // Foco fora do grid: nada.
    (document.activeElement as HTMLElement | null)?.blur();
    await resize(grid, 500);
    await wait(1100);
    expect(announcement(grid)).toBe('All columns in the table');
  });

  it('valor focado cuja coluna volta: a célula dela na mestre; outra coluna que sai antes não troca o valor focado', async () => {
    const cols = columns();
    cols[1].hidingPriority = 1;
    cols[5].hidingPriority = 0;
    const grid = await createResponsive(700, undefined, sales(5), cols);
    expect(grid.getAdaptiveColumns().map(column => column.label)).toEqual(['Amount']);

    grid.focusCell(grid.items[0], 'amount');
    await settle(grid);
    expect(focused(grid)?.textContent).toContain('$100.00');

    // City sai ANTES de Amount na lista: o valor focado continua sendo Amount.
    await resize(grid, 600);
    expect(grid.getAdaptiveColumns().map(column => column.label)).toEqual(['City', 'Amount']);
    expect(focused(grid)?.textContent).toContain('$100.00');

    await resize(grid, 1100);
    expect(grid.getAdaptiveColumns()).toEqual([]);
    expect(focused(grid)?.tagName).toBe('TD');
    expect(focused(grid)?.textContent).toContain('$100.00');
  });

  it('Shift+F10 num valor abre o menu da célula; Esc volta ao valor; Ctrl+C copia aquela coluna', async () => {
    const grid = await createResponsive(500, g => {
      g.rowMenu = true;
    });
    grid.focusCell(grid.items[0], 'amount');
    await settle(grid);
    const value = focused(grid) as HTMLElement;

    await key(grid, 'F10', { shiftKey: true });
    expect(root(grid).querySelector('[role=menu]')).not.toBeNull();
    await key(grid, 'Escape');
    expect(root(grid).querySelector('[role=menu]')).toBeNull();
    expect(focused(grid)).toBe(value);

    const clipboardData = new DataTransfer();
    value.dispatchEvent(new ClipboardEvent('copy', { clipboardData, bubbles: true, composed: true, cancelable: true }));
    expect(clipboardData.getData('text/plain')).toBe('$100.00');
  });

  it('marcas na célula de expansão: alterada e inválida com a linha fechada; anel de foco visível (forced-colors também)', async () => {
    const cols = columns();
    cols[5].validationRules = [{ type: 'range', max: 50 }];
    const grid = await createResponsive(500, g => {
      g.allowEditing = true;
      g.editMode = 'batch';
    }, sales(3), cols);

    grid.editCell(grid.items[0], 'amount');
    await settle(grid);
    await type(grid, '70');
    await key(grid, 'Enter');
    grid.collapseRow(grid.items[0]);
    await settle(grid);

    const toggle = masterRows(grid)[0].querySelector<HTMLElement>('td.detail-toggle-cell')!;
    expect(toggle.getAttribute('aria-invalid')).toBe('true');
    expect(root(grid).getElementById(toggle.getAttribute('aria-describedby')!)?.textContent).toMatch(/^Amount: /);

    toggle.focus();
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true, composed: true }));
    expect(getComputedStyle(toggle).outlineStyle).not.toBe('none');
    expect(getComputedStyle(toggle).outlineColor).not.toBe(getComputedStyle(toggle).getPropertyValue('--u-color-error'));

    await commands.emulateMedia({ forcedColors: 'active' });
    expect(getComputedStyle(toggle).outlineStyle).toBe('solid');
    expect(await violations(grid)).toEqual([]);
  });

  it('modo linha: Esc fecha a linha adaptativa e o foco volta à célula da mestre onde a edição começou', async () => {
    const grid = await createResponsive(700, g => {
      g.allowEditing = true;
      g.editMode = 'row';
    });
    grid.focusCell(grid.items[0], 'city');
    await settle(grid);
    await key(grid, 'Enter');
    expect(detailRows(grid)).toHaveLength(1);

    await key(grid, 'Escape');
    expect(detailRows(grid)).toHaveLength(0);
    expect(focused(grid)?.textContent?.trim()).toBe('City 0');
  });

  it('seletor: o checkbox descreve a ação e a dica', async () => {
    const grid = await createResponsive(500, g => {
      g.columnChooser = true;
    });
    grid.openColumnChooser();
    await settle(grid);
    const input = root(grid).querySelector<HTMLInputElement>('.column-chooser-adaptive input')!;
    const texts = input.getAttribute('aria-describedby')!.split(' ').map(id => root(grid).getElementById(id)?.textContent);
    expect(texts).toEqual(['Hide column', 'In row details', 'Alt+Shift+Up or Down arrow moves the column']);
  });
});
