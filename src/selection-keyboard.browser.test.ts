/**
 * Frente 05: foco de célula (roving tabindex), teclado da APG, seleção por
 * chave, alternativas de teclado ao arrasto e ARIA (com axe-core).
 */
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid, GridFocusChangeEventDetail, GridSelectionChangeEventDetail } from './grid.js';
import { cleanup, createGrid, dataRows, headerLabels, settle } from './test/fixture.js';

afterEach(cleanup);

interface Person {
  name: string;
  city: string;
  age: number;
}

const people = (): Person[] => [
  { name: 'Ana', city: 'Rio', age: 30 },
  { name: 'Bia', city: 'SP', age: 25 },
  { name: 'Caio', city: 'Rio', age: 41 },
  { name: 'Duda', city: 'BH', age: 19 },
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'city', label: 'City' },
  { path: 'age', label: 'Age' },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const table = (grid: DataGrid): HTMLTableElement => root(grid).querySelector('table')!;

/** Elemento com o foco dentro do grid (ou `null`). */
const focused = (grid: DataGrid): Element | null => root(grid).activeElement;

/** Todas as células com `tabindex="0"` no grid (roving: só uma). */
const tabStops = (grid: DataGrid): HTMLElement[] =>
  [...table(grid).querySelectorAll<HTMLElement>('[tabindex="0"]')];

const press = async (grid: DataGrid, key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> => {
  const target = (focused(grid) ?? tabStops(grid)[0]) as HTMLElement;
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  await settle(grid);
  return event;
};

/** Texto da célula focada (ou do cabeçalho). */
const focusedText = (grid: DataGrid): string => focused(grid)?.textContent.trim() ?? '';

/** Primeira célula de dados das linhas com `aria-selected="true"`. */
const rowKeys = (grid: DataGrid): string[] =>
  dataRows(grid)
    .filter(tr => tr.getAttribute('aria-selected') === 'true')
    .map(tr => tr.querySelector('td[aria-colindex]:not(.selection-cell)')!.textContent.trim());

const selectionEvents = (grid: DataGrid): GridSelectionChangeEventDetail[] => {
  const events: GridSelectionChangeEventDetail[] = [];
  grid.addEventListener('u-grid-selection-change', event => events.push(event.detail));
  return events;
};

const cellOf = (grid: DataGrid, text: string): HTMLElement =>
  [...table(grid).querySelectorAll<HTMLElement>('td[role=gridcell]')].find(td => td.textContent.trim() === text)!;

const runAxe = async (grid: DataGrid): Promise<axe.Result[]> => {
  const result = await axe.run(grid, { resultTypes: ['violations'] });
  return result.violations;
};

const describeViolations = (violations: axe.Result[]): string =>
  violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`).join('\n');

describe('roving tabindex e navegação', () => {
  it('um só ponto de Tab; setas, Home/End e Ctrl+Home/End andam pela APG', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });

    expect(tabStops(grid)).toHaveLength(1);
    expect(tabStops(grid)[0].textContent.trim()).toBe('Name');
    expect(table(grid).getAttribute('role')).toBe('grid');

    grid.focus();
    await settle(grid);
    expect(focusedText(grid)).toBe('Name');

    await press(grid, 'ArrowDown');
    expect(focusedText(grid)).toBe('Ana');
    await press(grid, 'ArrowRight');
    expect(focusedText(grid)).toBe('Rio');
    await press(grid, 'End');
    expect(focusedText(grid)).toBe('30');
    await press(grid, 'Home');
    expect(focusedText(grid)).toBe('Ana');
    await press(grid, 'End', { ctrlKey: true });
    expect(focusedText(grid)).toBe('19');
    await press(grid, 'Home', { ctrlKey: true });
    expect(focusedText(grid)).toBe('Name');
    expect(tabStops(grid)).toHaveLength(1);
  });

  it('RTL: ← vai para a próxima coluna', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.setAttribute('dir', 'rtl') });

    grid.focus();
    await press(grid, 'ArrowDown');
    await press(grid, 'ArrowLeft');
    expect(focusedText(grid)).toBe('Rio');
    await press(grid, 'ArrowRight');
    expect(focusedText(grid)).toBe('Ana');
  });

  it('virtualização: o foco sobrevive à linha sair e voltar da tela; PageDown rola junto', async () => {
    const items = Array.from({ length: 2000 }, (_, i) => ({ name: `N${i}`, city: `C${i % 7}`, age: i }));
    const grid = await createGrid({ columns: columns(), items, height: '300px' });
    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;

    grid.focus();
    await press(grid, 'ArrowDown');
    const cell = focused(grid) as HTMLElement;
    expect(cell.textContent.trim()).toBe('N0');

    scroller.scrollTop = 30_000;
    await settle(grid);
    await settle(grid);
    expect(focused(grid)).toBe(cell);
    expect(cell.closest('tr')!.classList.contains('pinned')).toBe(true);
    expect(tabStops(grid)).toEqual([cell]);

    scroller.scrollTop = 0;
    await settle(grid);
    await settle(grid);
    expect(focused(grid)).toBe(cell);
    expect(cell.closest('tr')!.classList.contains('pinned')).toBe(false);

    await press(grid, 'PageDown');
    await settle(grid);
    const after = focused(grid) as HTMLElement;
    const index = Number(after.closest('tr')!.getAttribute('data-index'));
    expect(index).toBeGreaterThan(2);
    expect(after.closest('tr')!.classList.contains('pinned')).toBe(false);

    await press(grid, 'End', { ctrlKey: true });
    await settle(grid);
    await settle(grid);
    expect(focusedText(grid)).toBe('1999');
    expect((focused(grid) as HTMLElement).closest('tr')!.classList.contains('pinned')).toBe(false);
    const rect = (focused(grid) as HTMLElement).getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    expect(rect.bottom).toBeLessThanOrEqual(box.bottom + 1);
    expect(rect.top).toBeGreaterThanOrEqual(box.top);
  });

  it('a célula ativa segue a linha ao ordenar e avisa u-grid-focus-change', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    const events: GridFocusChangeEventDetail[] = [];
    grid.addEventListener('u-grid-focus-change', event => events.push(event.detail));

    grid.focus();
    await press(grid, 'ArrowDown');
    expect(events.at(-1)).toMatchObject({
      cellType: 'data',
      column: grid.columns[0],
      previousColumn: grid.columns[0],
      previousRowKey: null,
      source: 'user',
    });
    expect(events.at(-1)!.rowKey).toBe(grid.items[0]);

    grid.sortColumn(grid.columns[0], 'desc');
    await settle(grid);
    expect(grid.focusedRowKey).toBe(grid.items[0]);
    expect(tabStops(grid)[0].textContent.trim()).toBe('Ana');
    expect(tabStops(grid)[0].closest('tr')!.getAttribute('aria-rowindex')).toBe('5');
  });

  it('focusCell, focusedRowKey e focus()', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    const events: GridFocusChangeEventDetail[] = [];
    grid.addEventListener('u-grid-focus-change', event => events.push(event.detail));

    grid.focusedRowKey = grid.items[2];
    await settle(grid);
    expect(events).toHaveLength(0);
    expect(tabStops(grid)[0].textContent.trim()).toBe('Caio');
    expect(focused(grid)).toBeNull();

    expect(grid.focusCell(grid.items[1], grid.columns[2])).toBe(true);
    await settle(grid);
    expect(focusedText(grid)).toBe('25');
    expect(events.at(-1)).toMatchObject({ source: 'api', column: grid.columns[2] });
    expect(grid.focusCell({}, grid.columns[0])).toBe(false);

    grid.focusedRowKey = { missing: true };
    expect(grid.focusedRowKey).toBe(grid.items[1]);
    grid.focusedRowKey = null;
    await settle(grid);
    expect(tabStops(grid)[0].tagName).toBe('TH');
  });

  it('focusedRowKey no mesmo tick da troca de items; realocação não dispara evento', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    const events: GridFocusChangeEventDetail[] = [];
    grid.addEventListener('u-grid-focus-change', event => events.push(event.detail));

    const next = people();
    grid.items = next;
    grid.focusedRowKey = next[3];
    expect(grid.focusedRowKey).toBe(next[3]);
    await settle(grid);
    expect(tabStops(grid)[0].textContent.trim()).toBe('Duda');

    grid.items = next.slice(0, 2);
    await settle(grid);
    expect(grid.focusedRowKey).toBe(next[1]);
    expect(events).toHaveLength(0);
  });

  it('Enter/F2 entram no conteúdo da célula e Esc volta à célula', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'name', label: 'Name' },
        {
          label: 'Action',
          renderer: () => {
            const button = document.createElement('button');
            button.textContent = 'Go';
            return button;
          },
        },
      ],
      items: people(),
    });

    grid.focusCell(grid.items[0], grid.columns[1]);
    await settle(grid);
    const cell = focused(grid) as HTMLElement;

    await press(grid, 'Enter');
    expect(document.activeElement?.tagName).toBe('BUTTON');

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true });
    document.activeElement!.dispatchEvent(escape);
    await settle(grid);
    expect(focused(grid)).toBe(cell);
  });
});

describe('teclado já existente continua', () => {
  it('Enter ordena no cabeçalho, Alt+→ redimensiona e F2 leva à alça', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.columnResizing = true });

    grid.focus();
    await press(grid, 'Enter');
    expect(grid.getSorting()).toEqual([{ column: grid.columns[0], order: 'asc' }]);

    const before = root(grid).querySelector('th')!.getBoundingClientRect().width;
    await press(grid, 'ArrowRight', { altKey: true });
    expect(root(grid).querySelector('th')!.getBoundingClientRect().width).toBeGreaterThan(before);
    expect(focusedText(grid)).toBe('Name');

    // F2: menu do cabeçalho ("⋮", spec 17 A1), depois a alça.
    await press(grid, 'F2');
    expect(focused(grid)!.classList.contains('column-header-menu-button')).toBe(true);
    await press(grid, 'F2');
    expect(focused(grid)!.classList.contains('resize-handle')).toBe(true);
    expect(root(grid).querySelector('.resize-handle')!.getAttribute('tabindex')).toBe('-1');

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true });
    focused(grid)!.dispatchEvent(escape);
    await settle(grid);
    expect(focusedText(grid)).toBe('Name');
  });
});

describe('alternativas de teclado ao arrasto (WCAG 2.1.1/2.5.7)', () => {
  it('Alt+Shift+→ move a coluna, Ctrl+G agrupa e Delete no chip desagrupa', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    const reorders: number[] = [];
    const groups: string[] = [];
    grid.addEventListener('u-grid-column-reorder', event => reorders.push(event.detail.index));
    grid.addEventListener('u-grid-group-change', event => groups.push(`${event.detail.source}:${event.detail.grouping.map(c => c.label).join(',')}`));

    grid.focus();
    await press(grid, 'ArrowRight', { altKey: true, shiftKey: true });
    expect(headerLabels(grid)).toEqual(['City', 'Name', 'Age']);
    expect(reorders).toEqual([1]);
    expect(focusedText(grid)).toBe('Name');
    expect(root(grid).querySelector('[role=status]')!.textContent).toBe('Name moved to position 2 of 3');

    await press(grid, 'g', { ctrlKey: true });
    expect(headerLabels(grid)).toEqual(['City', 'Age']);
    expect(groups).toEqual(['user:Name']);
    expect(root(grid).querySelector('[role=status]')!.textContent).toBe('Grouped by Name');

    const chip = root(grid).querySelector<HTMLElement>('.group')!;
    expect(chip.getAttribute('tabindex')).toBe('0');
    chip.focus();
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true, cancelable: true }));
    await settle(grid);
    await settle(grid);
    expect(groups).toEqual(['user:Name', 'user:']);
    expect(headerLabels(grid)).toEqual(['City', 'Age', 'Name']);
    expect(focusedText(grid)).toBe('Name');
  });

  it('RTL: Alt+Shift+← move para a frente', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.setAttribute('dir', 'rtl') });

    grid.focus();
    await press(grid, 'ArrowLeft', { altKey: true, shiftKey: true });
    expect(headerLabels(grid)).toEqual(['City', 'Name', 'Age']);
  });

  it('chips: ←/→ andam, Alt+Shift+→ muda o nível', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, { path: 'age', label: 'Age', groupIndex: 1 }, { path: 'name', label: 'Name' }],
      items: people(),
    });
    const chips = () => [...root(grid).querySelectorAll<HTMLElement>('.group')];

    chips()[0].focus();
    chips()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
    await settle(grid);
    expect(root(grid).activeElement).toBe(chips()[1]);

    chips()[0].focus();
    chips()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, shiftKey: true, bubbles: true, composed: true, cancelable: true }));
    await settle(grid);
    expect(grid.getGrouping().map(c => c.label)).toEqual(['Age', 'City']);
    expect(root(grid).activeElement?.textContent.trim()).toBe('City');
  });
});

describe('linhas de grupo', () => {
  it('→ expande, ← recolhe; aria-expanded e aria-level na linha', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, { path: 'name', label: 'Name' }],
      items: people(),
    });

    grid.focus();
    await press(grid, 'ArrowDown');
    const row = () => (focused(grid) as HTMLElement).closest('tr')!;
    expect(row().getAttribute('aria-level')).toBe('1');
    expect(row().getAttribute('aria-expanded')).toBe('false');

    await press(grid, 'ArrowRight');
    expect(row().getAttribute('aria-expanded')).toBe('true');
    expect(table(grid).getAttribute('aria-rowcount')).toBe(String(1 + 3 + 1));

    await press(grid, 'ArrowDown');
    expect(focusedText(grid)).toBe('Duda');
    await press(grid, 'ArrowUp');
    await press(grid, 'ArrowLeft');
    expect(row().getAttribute('aria-expanded')).toBe('false');
    expect(row().querySelector('button')!.getAttribute('tabindex')).toBe('-1');
  });
});

describe('seleção', () => {
  it('multiple: clique, Ctrl+clique e Shift+clique; eventos com previous e source', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.selectionMode = 'multiple' });
    const events = selectionEvents(grid);

    expect(table(grid).getAttribute('aria-multiselectable')).toBe('true');

    await userEvent.click(cellOf(grid, 'Ana'));
    await settle(grid);
    expect(rowKeys(grid)).toEqual(['Ana']);

    await userEvent.click(cellOf(grid, 'Caio'), { modifiers: ['Shift'] });
    await settle(grid);
    expect(rowKeys(grid)).toEqual(['Ana', 'Bia', 'Caio']);

    await userEvent.click(cellOf(grid, 'Bia'), { modifiers: ['Control'] });
    await settle(grid);
    expect(rowKeys(grid)).toEqual(['Ana', 'Caio']);

    const last = events.at(-1)!;
    expect(last.removed).toEqual([grid.items[1]]);
    expect(last.previous).toHaveLength(3);
    expect(last.source).toBe('user');
    expect(last.selectedKeys).toBe(grid.selectedKeys);
    expect(Object.isFrozen(grid.selectedKeys)).toBe(true);
    expect(dataRows(grid)[0].getAttribute('part')).toContain('selected');
  });

  it('single: o clique substitui; Ctrl+clique desmarca', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.selectionMode = 'single' });

    await userEvent.click(cellOf(grid, 'Ana'));
    await userEvent.click(cellOf(grid, 'Bia'));
    await settle(grid);
    expect(rowKeys(grid)).toEqual(['Bia']);
    expect(table(grid).hasAttribute('aria-multiselectable')).toBe(false);

    await userEvent.click(cellOf(grid, 'Bia'), { modifiers: ['Control'] });
    await settle(grid);
    expect(rowKeys(grid)).toEqual([]);
  });

  it('teclado: Espaço, Shift+↓, Shift+Espaço e Ctrl+A', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.selectionMode = 'multiple' });

    grid.focus();
    await press(grid, 'ArrowDown');
    await press(grid, ' ');
    expect(rowKeys(grid)).toEqual(['Ana']);

    await press(grid, 'ArrowDown', { shiftKey: true });
    expect(rowKeys(grid)).toEqual(['Ana', 'Bia']);

    await press(grid, 'ArrowDown');
    await press(grid, 'ArrowDown');
    await press(grid, ' ', { shiftKey: true });
    expect(rowKeys(grid)).toEqual(['Ana', 'Bia', 'Caio', 'Duda']);

    await press(grid, ' ');
    expect(rowKeys(grid)).toEqual(['Ana', 'Bia', 'Caio']);

    const event = await press(grid, 'a', { ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(grid.selectedKeys).toHaveLength(4);
    expect(root(grid).querySelector('[role=status]')!.textContent).toBe('Selected rows: 4');
  });

  it('caixas: coluna fixa, "selecionar tudo" com estado misto, clique na linha só foca', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: people(),
      configure: g => {
        g.selectionMode = 'multiple';
        g.showCheckboxes = true;
      },
    });
    const selectAll = () => root(grid).querySelector<HTMLElement>('th.selection-cell [role=checkbox]')!;

    expect(table(grid).getAttribute('aria-colcount')).toBe('4');
    expect(root(grid).querySelector('th.header-column')!.getAttribute('aria-colindex')).toBe('2');
    expect(selectAll().getAttribute('aria-label')).toBe('Select all rows');

    await userEvent.click(cellOf(grid, 'Ana'));
    await settle(grid);
    expect(rowKeys(grid)).toEqual([]);

    await userEvent.click(dataRows(grid)[1].querySelector<HTMLElement>('.selection-cell')!);
    await settle(grid);
    expect(rowKeys(grid)).toEqual(['Bia']);
    expect(selectAll().getAttribute('aria-checked')).toBe('mixed');

    await userEvent.click(selectAll());
    await settle(grid);
    expect(selectAll().getAttribute('aria-checked')).toBe('true');
    expect(grid.selectedKeys).toHaveLength(4);

    await userEvent.click(selectAll());
    await settle(grid);
    expect(selectAll().getAttribute('aria-checked')).toBe('false');

    // Teclado: Espaço no "selecionar tudo".
    grid.focusedRowKey = null;
    grid.focus();
    await settle(grid);
    expect(focused(grid)!.classList.contains('selection-cell')).toBe(true);
    await press(grid, ' ');
    expect(grid.selectedKeys).toHaveLength(4);
  });

  it('a seleção sobrevive a ordenar, agrupar e trocar items (pela chave)', async () => {
    const list = people();
    const grid = await createGrid({ columns: columns(), items: list, configure: g => g.selectionMode = 'multiple' });

    grid.selectRows([list[1], list[3]]);
    grid.sortColumn(grid.columns[2], 'asc');
    await settle(grid);
    expect(rowKeys(grid)).toEqual(['Duda', 'Bia']);

    grid.groupColumn(grid.columns[1]);
    grid.autoExpandGroups = true;
    await settle(grid);
    expect(rowKeys(grid).sort()).toEqual(['Bia', 'Duda']);

    grid.items = [list[3], list[0]];
    await settle(grid);
    expect(rowKeys(grid)).toEqual(['Duda']);
    expect(grid.selectedKeys).toEqual([list[1], list[3]]);
    expect(grid.getSelectedItems()).toEqual([list[3]]);

    grid.items = list;
    await settle(grid);
    expect(rowKeys(grid).sort()).toEqual(['Bia', 'Duda']);
  });

  it('single na inicialização corta para a última chave sem evento', async () => {
    const list = people();
    const events: GridSelectionChangeEventDetail[] = [];
    const grid = await createGrid({
      columns: columns(),
      items: list,
      setBeforeConnect: true,
      configure: g => {
        g.addEventListener('u-grid-selection-change', event => events.push(event.detail));
        g.selectedKeys = [list[0], list[1]];
        g.selectionMode = 'single';
      },
    });

    expect(grid.selectedKeys).toEqual([list[1]]);
    expect(events).toHaveLength(0);
  });

  it('API: selectRows/append, deselectRows, selectAll/deselectAll, clearSelection; setter sem evento', async () => {
    const list = people();
    const grid = await createGrid({ columns: columns(), items: list, configure: g => g.selectionMode = 'multiple' });
    const events = selectionEvents(grid);
    const outside = { name: 'Zé' };

    grid.selectedKeys = [list[0], outside];
    expect(events).toHaveLength(0);
    expect(grid.isRowSelected(outside)).toBe(true);

    grid.selectRows([list[1]], { append: true });
    expect(events.at(-1)).toMatchObject({ added: [list[1]], removed: [], source: 'api' });

    grid.deselectAll();
    expect(grid.selectedKeys).toEqual([outside]);

    grid.selectAll();
    expect(grid.selectedKeys).toHaveLength(5);

    grid.deselectRows([outside]);
    grid.clearSelection();
    expect(grid.selectedKeys).toEqual([]);

    grid.selectRows([list[0], list[2]]);
    grid.selectionMode = 'single';
    await settle(grid);
    expect(grid.selectedKeys).toEqual([list[2]]);
    expect(events.at(-1)).toMatchObject({ removed: [list[0]], source: 'api' });

    grid.selectAll();
    expect(grid.selectedKeys).toEqual([list[2]]);

    grid.selectionMode = 'none';
    await settle(grid);
    grid.selectRows([list[0]]);
    expect(grid.selectedKeys).toEqual([list[2]]);
    expect(dataRows(grid)[0].hasAttribute('aria-selected')).toBe(false);
  });
});

describe('resumos (frente 07)', () => {
  const summarized = () => createGrid({
    columns: [{ path: 'city', label: 'City', groupIndex: 0 }, { path: 'name', label: 'Name' }, { path: 'age', label: 'Age' }],
    items: people(),
    configure: g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
      g.autoExpandGroups = true;
      g.summary = {
        total: [{ column: 'age', type: 'sum' }],
        group: [{ column: 'age', type: 'max', display: 'footer' }, { column: 'age', type: 'avg', display: 'column' }],
      };
    },
  });

  it('rodapé de grupo e de totais entram na navegação, com índices que contam a coluna de caixas', async () => {
    const grid = await summarized();
    const events: GridFocusChangeEventDetail[] = [];
    grid.addEventListener('u-grid-focus-change', event => events.push(event.detail));

    // 3 grupos × (grupo + rodapé) + 4 itens + cabeçalho + totais.
    expect(table(grid).getAttribute('aria-rowcount')).toBe(String(6 + 4 + 2));

    grid.focus();
    await press(grid, 'End', { ctrlKey: true });
    const total = focused(grid) as HTMLElement;
    expect(total.closest('tfoot')).not.toBeNull();
    expect(total.getAttribute('aria-colindex')).toBe('3');
    expect(events.at(-1)).toMatchObject({ cellType: 'summary', rowKey: null, column: grid.columns[2] });

    await press(grid, 'ArrowUp');
    const footer = focused(grid) as HTMLElement;
    expect(footer.closest('tr')!.classList.contains('group-footer-row')).toBe(true);
    expect(footer.getAttribute('aria-colindex')).toBe('3');
    expect(footer.querySelector('.visually-hidden')!.textContent).toContain('Max of Age');

    await press(grid, 'Home');
    expect(focused(grid)!.classList.contains('selection-cell')).toBe(true);
    await press(grid, ' ');
    expect(grid.selectedKeys).toEqual([]);

    // Linha de grupo com resumo em coluna: um ponto só, com o resumo no rótulo.
    await press(grid, 'Home', { ctrlKey: true });
    await press(grid, 'ArrowDown');
    const groupCell = focused(grid) as HTMLElement;
    expect(groupCell.classList.contains('grouping-cell')).toBe(true);
    expect(groupCell.getAttribute('aria-label')).toContain('Avg of Age');
    expect(tabStops(grid)).toHaveLength(1);
  });

  it('menu do painel de grupos pelo teclado (Shift+F10) e roving dos chips', async () => {
    const grid = await summarized();
    const chip = root(grid).querySelector<HTMLElement>('.group')!;

    chip.focus();
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, composed: true, cancelable: true }));
    await settle(grid);
    expect(root(grid).querySelector('[role=menu]')).not.toBeNull();

    const violations = await runAxe(grid);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('axe: zero violações com resumos, rodapés e seleção, foco nos totais', async () => {
    const grid = await summarized();

    grid.selectRows([grid.items[0]]);
    grid.focus();
    await press(grid, 'End', { ctrlKey: true });

    const violations = await runAxe(grid);
    expect(violations, describeViolations(violations)).toEqual([]);
  });
});

describe('filtro (frente 04)', () => {
  const filtered = () => createGrid({
    columns: columns(),
    items: people(),
    configure: g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
      g.showFilterRow = true;
      g.showSearchPanel = true;
      g.headerFilter = true;
    },
  });

  it('linha de filtro: editores na ordem de Tab, fora do roving; índices contam a coluna de caixas', async () => {
    const grid = await filtered();
    const editors = [...root(grid).querySelectorAll<HTMLElement>('thead .filter-editor')];
    const filterCells = [...root(grid).querySelectorAll<HTMLElement>('thead tr.filter-row td[aria-colindex]')];

    expect(editors.length).toBeGreaterThan(0);
    expect(editors.every(editor => editor.tabIndex === 0)).toBe(true);
    expect(filterCells.map(td => td.getAttribute('aria-colindex'))).toEqual(['1', '2', '3', '4']);
    expect(table(grid).getAttribute('aria-rowcount')).toBe(String(4 + 2));
    expect(dataRows(grid)[0].getAttribute('aria-rowindex')).toBe('3');

    // ↓ do cabeçalho pula a linha de filtro; as setas no editor são do editor.
    grid.focus();
    await press(grid, 'ArrowDown');
    expect(focused(grid)!.closest('tbody')).not.toBeNull();

    editors[0].focus();
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true });
    editors[0].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(root(grid).activeElement).toBe(editors[0]);
  });

  it('funil fora do Tab: Alt+↓ abre o filtro do cabeçalho, Esc devolve ao funil e Esc de novo à célula', async () => {
    const grid = await filtered();
    const funnels = [...root(grid).querySelectorAll<HTMLElement>('.header-filter-button')];

    expect(funnels.every(funnel => funnel.tabIndex === -1)).toBe(true);

    grid.focus();
    await press(grid, 'ArrowRight');
    const th = focused(grid) as HTMLElement;
    await press(grid, 'ArrowDown', { altKey: true });
    expect(root(grid).querySelector('.header-filter')).not.toBeNull();

    let violations = await runAxe(grid);
    expect(violations, describeViolations(violations)).toEqual([]);

    const active = root(grid).activeElement as HTMLElement;
    active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
    await settle(grid);
    expect(root(grid).querySelector('.header-filter')).toBeNull();
    expect(root(grid).activeElement!.classList.contains('header-filter-button')).toBe(true);

    await press(grid, 'Escape');
    expect(focused(grid)).toBe(th);

    await press(grid, 'F2');
    expect(root(grid).activeElement!.classList.contains('header-filter-button')).toBe(true);

    violations = await runAxe(grid);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('"selecionar tudo" marca só as linhas filtradas', async () => {
    const grid = await filtered();

    grid.filterValue = ['city', '=', 'Rio'];
    await settle(grid);
    grid.focus();
    await press(grid, ' ');
    expect(grid.selectedKeys).toEqual([grid.items[0], grid.items[2]]);
    expect(root(grid).querySelector('th.selection-cell [role=checkbox]')!.getAttribute('aria-checked')).toBe('true');

    grid.filterValue = null;
    await settle(grid);
    expect(root(grid).querySelector('th.selection-cell [role=checkbox]')!.getAttribute('aria-checked')).toBe('mixed');
  });
});

describe('axe-core', () => {
  it('zero violações: agrupado, com seleção e caixas, foco num grupo', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, ...columns().filter(c => c.path !== 'city')],
      items: people(),
      configure: g => {
        g.selectionMode = 'multiple';
        g.showCheckboxes = true;
        g.autoExpandGroups = true;
        g.columnResizing = true;
        g.columnChooser = true;
      },
    });

    grid.selectRows([grid.items[0]]);
    grid.focus();
    await press(grid, 'ArrowDown');
    await settle(grid);

    const violations = await runAxe(grid);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('zero violações: RTL em árabe, sem dados e sem cabeçalho de colunas', async () => {
    const rtl = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.setAttribute('dir', 'rtl');
      g.language = 'ar';
      g.selectionMode = 'single';
    } });
    let violations = await runAxe(rtl);
    expect(violations, describeViolations(violations)).toEqual([]);

    const empty = await createGrid({ columns: columns(), items: [], configure: g => g.showColumnHeaders = false });
    violations = await runAxe(empty);
    expect(violations, describeViolations(violations)).toEqual([]);
  });
});
