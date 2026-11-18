/**
 * Frente 20: linha inteira (`rowRenderer`; `false` = linha normal): uma
 * célula de largura total depois das células iniciais, seleção, detalhe,
 * teclado (Enter/F2/Esc), altura medida, `signal`, erros, exportação.
 */
import { html, nothing } from 'lit';

import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DataGrid, GridColumnDef, GridContextMenuOpeningEventDetail, GridFocusChangeEventDetail, GridRowRenderer } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';

afterEach(cleanup);

interface Row {
  id: number;
  name: string;
  team: string;
  banner: boolean;
}

const rows = (count: number, every = 3): Row[] =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Name ${id}`, team: `T${id % 2}`, banner: id % every === 1 }));

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'team', label: 'Team' },
];

const banner: GridRowRenderer<Row> = item => item.banner
  && html`<div class="banner" part="banner">Banner ${item.name} <button class="act">Act</button> <a href="#x" class="link">Link</a></div>`;

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const active = (grid: DataGrid): HTMLElement => root(grid).activeElement as HTMLElement;

const key = async (grid: DataGrid, name: string, init: KeyboardEventInit = {}): Promise<void> => {
  active(grid).dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const create = (count = 6, configure?: (grid: DataGrid) => void, height = '500px'): Promise<DataGrid> => createGrid({
  columns: columns(),
  items: rows(count),
  height,
  configure: grid => {
    grid.keyExpr = 'id';
    grid.rowRenderer = banner;
    configure?.(grid);
  },
});

const rowOf = (grid: DataGrid, index: number): HTMLTableRowElement =>
  root(grid).querySelector<HTMLTableRowElement>(`tbody.body-rows > tr[data-index="${index}"]:not(.pinned)`)!;

describe('linha inteira: render', () => {
  it('false mantém as colunas; o resto vira uma célula de largura total', async () => {
    const grid = await create();
    const full = rowOf(grid, 1);
    const normal = rowOf(grid, 0);

    expect(normal.classList.contains('full-width-row')).toBe(false);
    expect(normal.querySelectorAll('td[part~=cell]')).toHaveLength(2);

    expect(full.getAttribute('part')).toContain('full-width-row');
    const cell = full.querySelector<HTMLTableCellElement>('td.full-width-cell')!;
    expect(cell.getAttribute('role')).toBe('gridcell');
    expect(cell.getAttribute('part')).toBe('full-width-cell');
    expect(cell.getAttribute('aria-colindex')).toBe('1');
    expect(cell.getAttribute('aria-colspan')).toBe('2');
    expect(cell.colSpan).toBe(2);
    expect(cell.querySelector('.banner')!.textContent).toContain('Banner Name 1');
    // Conteúdo rebaixado da ordem de Tab (A12).
    await settle(grid);
    expect(cell.querySelector('button')!.tabIndex).toBe(-1);
  });

  it('células iniciais reais (expansão e caixa) antes da célula de largura total', async () => {
    const grid = await create(6, g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
      g.detailRenderer = item => `Detail ${item.name}`;
      g.editMode = 'batch';
      g.allowRemoving = true;
    });
    const full = rowOf(grid, 1);
    const cells = [...full.querySelectorAll('td')];

    expect(cells[0].classList.contains('detail-toggle-cell')).toBe(true);
    expect(cells[0].getAttribute('aria-expanded')).toBe('false');
    expect(cells[1].classList.contains('selection-cell')).toBe(true);
    expect(cells[2].classList.contains('full-width-cell')).toBe(true);
    expect(cells[2].getAttribute('aria-colindex')).toBe('3');
    // Colunas comuns + botões.
    expect(cells[2].getAttribute('aria-colspan')).toBe('3');
    expect(full.id).toMatch(/^row-\d+$/);

    // Caixa seleciona; detalhe expande.
    cells[1].click();
    await settle(grid);
    expect(grid.selectedKeys).toEqual([1]);
    expect(full.getAttribute('aria-selected')).toBe('true');

    full.querySelector<HTMLButtonElement>('button.detail-toggle')!.click();
    await settle(grid);
    expect(grid.isRowExpanded(1)).toBe(true);
    const detail = root(grid).querySelector('tr.detail-row')!;
    expect(detail.textContent).toContain('Detail Name 1');
    expect(detail.getAttribute('aria-labelledby')).toBe(full.id);
  });

  it('chama o renderer só para as linhas renderizadas', async () => {
    const calls = vi.fn(banner);
    await create(100_000, g => g.rowRenderer = calls);
    expect(calls.mock.calls.length).toBeGreaterThan(0);
    expect(calls.mock.calls.length).toBeLessThan(200);
  });

  it('nothing/null dão linha inteira vazia; exceção mantém as colunas (um console.error)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const throwing: GridRowRenderer<Row> = item => {
      if (item.banner) {
        throw new Error('boom');
      }

      return false;
    };

    const grid = await create(6, g => g.rowRenderer = item => item.banner ? nothing : false);
    expect(rowOf(grid, 1).querySelector('td.full-width-cell')!.textContent.trim()).toBe('');

    grid.rowRenderer = throwing;
    await settle(grid);
    expect(root(grid).querySelectorAll('tr.full-width-row')).toHaveLength(0);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('não edita a linha inteira', async () => {
    const grid = await create(6, g => {
      g.editMode = 'cell';
      g.allowEditing = true;
    });

    expect(grid.editCell(1, grid.columns[0])).toBe(false);
    expect(grid.editCell(0, grid.columns[0])).toBe(true);
  });

  it('com colunas fixas e virtualização de colunas: colspan = colunas do DOM; conteúdo sticky', async () => {
    const many: GridColumnDef[] = Array.from({ length: 60 }, (_, index) => ({ path: index ? `c${index}` : 'name', label: `C${index}`, width: 120, fixed: index === 0 ? 'start' : null }));
    const grid = await createGrid({
      columns: many,
      items: rows(20),
      configure: g => {
        g.rowRenderer = banner;
        g.columnRenderingMode = 'virtual';
      },
    });
    const full = rowOf(grid, 1);
    const normal = rowOf(grid, 0);
    const cell = full.querySelector<HTMLTableCellElement>('td.full-width-cell')!;
    const domColumns = [...normal.children].reduce((sum, td) => sum + (td as HTMLTableCellElement).colSpan, 0);

    expect(cell.colSpan).toBe(domColumns);
    expect(cell.getAttribute('aria-colspan')).toBe('60');

    const content = cell.querySelector<HTMLElement>('.full-width-content')!;
    const before = content.getBoundingClientRect().left;
    grid._scrollContainerRef.value!.scrollLeft = 2000;
    await settle(grid);
    expect(Math.abs(content.getBoundingClientRect().left - before)).toBeLessThan(1);
  });

  it('conteúdo do detalhe também fica preso na rolagem horizontal (a largura visível sobrevive ao render)', async () => {
    const wide: GridColumnDef[] = Array.from({ length: 30 }, (_, index) => ({ path: index ? `c${index}` : 'name', label: `C${index}`, width: 150 }));
    const grid = await createGrid({
      columns: wide,
      items: rows(5),
      configure: g => {
        g.detailRenderer = () => html`<p class="d">Detail</p>`;
        g.autoExpandRows = true;
      },
    });
    const content = root(grid).querySelector<HTMLElement>('tr.detail-row .detail-content')!;
    const before = content.getBoundingClientRect().left;

    // Um render que troca o \`style\` do contêiner rolável (é do template) depois de medir.
    grid.selectionMode = 'multiple';
    grid.showCheckboxes = true;
    await settle(grid);
    const start = content.getBoundingClientRect().left;
    expect(start).toBeGreaterThanOrEqual(before);
    grid._scrollContainerRef.value!.scrollLeft = 1500;
    await settle(grid);
    expect(Math.abs(content.getBoundingClientRect().left - start)).toBeLessThan(1);
  });

  it('altura do conteúdo medida; rolagem estável', async () => {
    const tall: GridRowRenderer<Row> = item => item.banner && html`<div style="height: 150px">Tall ${item.name}</div>`;
    const grid = await create(3000, g => g.rowRenderer = tall);
    const full = rowOf(grid, 1);

    expect(full.getBoundingClientRect().height).toBeGreaterThan(140);
    expect(grid._virtualizer.sizeOf(1)).toBeGreaterThan(140);

    // Rolar para baixo e voltar: a 1ª linha volta ao topo do corpo.
    const scroller = grid._scrollContainerRef.value!;
    scroller.scrollTop = 20_000;
    await settle(grid);
    scroller.scrollTop = 0;
    await settle(grid);
    expect(rowOf(grid, 0)).toBeDefined();
    expect(scroller.scrollTop).toBe(0);
  });
});

describe('linha inteira: teclado e foco', () => {
  it('↑/↓ passam pela célula única e devolvem a coluna lembrada; foco com cellType full-width', async () => {
    const grid = await create();
    const events: GridFocusChangeEventDetail[] = [];
    grid.addEventListener('u-grid-focus-change', event => events.push(event.detail));

    expect(grid.focusCell(0, grid.columns[1])).toBe(true);
    await settle(grid);
    await key(grid, 'ArrowDown');
    expect(active(grid).classList.contains('full-width-cell')).toBe(true);
    expect(events.at(-1)).toMatchObject({ rowKey: 1, column: null, cellType: 'full-width', rowFixed: null });

    // ←/→ não saem da célula única (sem células iniciais).
    await key(grid, 'ArrowRight');
    await key(grid, 'ArrowLeft');
    expect(active(grid).classList.contains('full-width-cell')).toBe(true);

    await key(grid, 'ArrowDown');
    expect(active(grid).textContent).toBe('T0');
    expect(events.at(-1)).toMatchObject({ rowKey: 2, column: grid.columns[1], cellType: 'data' });
  });

  it('Enter/F2 entram no conteúdo, Tab circula nele, Esc volta à célula', async () => {
    const grid = await create();
    expect(grid.focusCell(1)).toBe(true);
    await settle(grid);
    const cell = active(grid);
    expect(cell.classList.contains('full-width-cell')).toBe(true);

    await key(grid, 'Enter');
    expect(active(grid).classList.contains('act')).toBe(true);
    await key(grid, 'Tab');
    expect(active(grid).classList.contains('link')).toBe(true);
    await key(grid, 'Tab');
    expect(active(grid).classList.contains('act')).toBe(true);
    await key(grid, 'Escape');
    expect(active(grid)).toBe(cell);

    await key(grid, 'F2');
    expect(active(grid).classList.contains('act')).toBe(true);
  });

  it('Espaço seleciona com anúncio; ←/→ entre a caixa e a célula única', async () => {
    const grid = await create(6, g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
    });
    expect(grid.focusCell(1)).toBe(true);
    await settle(grid);
    expect(active(grid).classList.contains('full-width-cell')).toBe(true);

    await key(grid, ' ');
    expect(grid.selectedKeys).toEqual([1]);
    expect(root(grid).querySelector('[role=status]')!.textContent).toContain('1');

    await key(grid, 'ArrowLeft');
    expect(active(grid).classList.contains('selection-cell')).toBe(true);
    await key(grid, 'ArrowRight');
    expect(active(grid).classList.contains('full-width-cell')).toBe(true);
    await key(grid, 'Home');
    expect(active(grid).classList.contains('selection-cell')).toBe(true);
    await key(grid, 'End');
    expect(active(grid).classList.contains('full-width-cell')).toBe(true);
  });

  it('a célula ativa numa linha que vira inteira vai à célula única', async () => {
    const grid = await create(6, g => g.rowRenderer = null);
    expect(grid.focusCell(1, grid.columns[1])).toBe(true);
    await settle(grid);

    grid.rowRenderer = banner;
    await settle(grid);
    expect(active(grid).classList.contains('full-width-cell')).toBe(true);

    grid.rowRenderer = null;
    await settle(grid);
    expect(active(grid).textContent).toBe('T1');
  });
});

describe('linha inteira: signal, linhas fixas e exportação', () => {
  it('signal abortado no false, ao sair da janela, ao trocar o renderer e ao desconectar', async () => {
    const signals = new Map<number, AbortSignal>();

    const renderer: GridRowRenderer<Row> = (item, ctx) => {
      signals.set(item.id, ctx.signal);
      return item.banner && html`<b>${item.name}</b>`;
    };

    const grid = await create(2000, g => g.rowRenderer = renderer);

    expect(signals.get(0)!.aborted).toBe(true);
    expect(signals.get(1)!.aborted).toBe(false);

    grid._scrollContainerRef.value!.scrollTop = 50_000;
    await settle(grid);
    expect(signals.get(1)!.aborted).toBe(true);

    const visible = [...signals.entries()].filter(([id, signal]) => id % 3 === 1 && !signal.aborted);
    expect(visible.length).toBeGreaterThan(0);

    grid.remove();
    expect(visible.every(([, signal]) => signal.aborted)).toBe(true);
  });

  it('vale nas linhas fixas, com ctx.fixed', async () => {
    const fixedSeen: unknown[] = [];
    const grid = await create(4, g => {
      g.fixedTopItems = [{ id: -1, name: 'Fixed', team: 'X', banner: true }];

      g.rowRenderer = (item: Row, ctx) => {
        fixedSeen.push(ctx.fixed);
        return item.banner && html`<span class="fixed-banner">${item.name}</span>`;
      };
    });

    expect(root(grid).querySelector('tbody.fixed-top-rows td.full-width-cell .fixed-banner')!.textContent).toBe('Fixed');
    expect(fixedSeen).toContain('top');
    expect(fixedSeen).toContain(null);
  });

  it('exporta os valores das colunas (o template é só visual)', async () => {
    const grid = await create(3);
    const data = await grid.getExportData();
    expect(data.rows.map(row => row.rowType === 'data' ? row.texts.join('|') : '')).toEqual(['Name 0|T0', 'Name 1|T1', 'Name 2|T0']);
  });
});

describe('linha inteira: axe', () => {
  for (const [label, configure] of [
    ['simples', () => undefined],
    [
      'com caixas e detalhe', (grid: DataGrid) => {
        grid.selectionMode = 'multiple';
        grid.showCheckboxes = true;
        grid.detailRenderer = () => 'Detail';
      },
    ],
    [
      'agrupado (treegrid)', (grid: DataGrid) => {
        grid.columns = [columns()[0], { ...columns()[1], groupIndex: 0 }];
        grid.autoExpandGroups = true;
      },
    ],
    ['RTL', (grid: DataGrid) => grid.setAttribute('dir', 'rtl')],
  ] as const) {
    it(`sem violações: ${label}`, async () => {
      const grid = await create(6, configure);
      const result = await axe.run(grid, { resultTypes: ['violations'] });
      expect(result.violations.map(violation => violation.id)).toEqual([]);
    });
  }
});

describe('linha inteira: roteiros extras', () => {
  it('Tab numa linha inteira mais alta que a área (com 3+3 fixas) não para sob o que gruda', async () => {
    const tall: GridRowRenderer<Row> = item => item.id === 4 && html`<div>
      <button class="first">First</button><div style="height: 900px"></div><button class="last">Last</button></div>`;
    const grid = await create(40, g => {
      g.rowRenderer = tall;
      g.fixedTopItems = rows(3).map(row => ({ ...row, id: -10 - row.id, banner: false }));
      g.fixedBottomItems = rows(3).map(row => ({ ...row, id: -20 - row.id, banner: false }));
    }, '1000px');

    const visible = (): boolean => {
      const element = active(grid);
      const rect = element.getBoundingClientRect();
      const hit = root(grid).elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || element.contains(hit);
    };

    expect(grid.focusCell(4)).toBe(true);
    await settle(grid);
    await key(grid, 'Enter');
    expect(active(grid).classList.contains('first')).toBe(true);
    expect(visible()).toBe(true);
    await key(grid, 'Tab');
    await settle(grid);
    expect(active(grid).classList.contains('last')).toBe(true);
    expect(visible()).toBe(true);
    await key(grid, 'Tab');
    await settle(grid);
    expect(active(grid).classList.contains('first')).toBe(true);
    expect(visible()).toBe(true);
  });

  it('RTL: ←/→ espelhados entre a caixa e a célula única', async () => {
    const grid = await create(6, g => {
      g.setAttribute('dir', 'rtl');
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
    });
    expect(grid.focusCell(1)).toBe(true);
    await settle(grid);
    await key(grid, 'ArrowRight');
    expect(active(grid).classList.contains('selection-cell')).toBe(true);
    await key(grid, 'ArrowLeft');
    expect(active(grid).classList.contains('full-width-cell')).toBe(true);
  });

  it('foco dentro do conteúdo quando a linha deixa de ser inteira: vai à célula, não ao body', async () => {
    const grid = await create();
    expect(grid.focusCell(1)).toBe(true);
    await settle(grid);
    await key(grid, 'Enter');
    expect(active(grid).classList.contains('act')).toBe(true);

    grid.rowRenderer = () => false;
    await settle(grid);
    expect(root(grid).activeElement).not.toBeNull();
    expect(active(grid).closest('tr')!.getAttribute('data-index')).toBe('1');
  });

  it('removida no lote: a célula única diz que a linha foi removida; aria-readonly com edição', async () => {
    const grid = await create(6, g => {
      g.editMode = 'batch';
      g.allowEditing = true;
      g.allowRemoving = true;
    });
    const cell = (): HTMLElement => rowOf(grid, 1).querySelector<HTMLElement>('td.full-width-cell')!;
    expect(cell().getAttribute('aria-readonly')).toBe('true');

    await grid.removeRow(1);
    await settle(grid);
    expect(cell().getAttribute('aria-describedby')).toContain('edit-desc-removed');
  });
});

describe('linha inteira: menu de contexto (frente 18)', () => {
  const contextMenu = async (grid: DataGrid, target: HTMLElement): Promise<MouseEvent> => {
    const event = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 40, clientY: 40 });
    target.dispatchEvent(event);
    await settle(grid);
    return event;
  };

  const menuTexts = (grid: DataGrid): string[] =>
    [...root(grid).querySelectorAll('[role=menu] [role=menuitem] .menu-item-text')].map(item => item.textContent.trim());

  it('cellType full-width sem coluna: sem Copiar célula nem Editar; Excluir/Restaurar e detalhe ficam', async () => {
    const grid = await create(6, g => {
      g.rowMenu = true;
      g.editMode = 'batch';
      g.allowEditing = true;
      g.allowRemoving = true;
      g.detailRenderer = () => 'Detail';
    });
    let detail: GridContextMenuOpeningEventDetail | undefined;
    grid.addEventListener('u-grid-context-menu-opening', event => {
      detail = event.detail;
    });
    const cell = (): HTMLElement => rowOf(grid, 1).querySelector<HTMLElement>('td.full-width-cell')!;

    await contextMenu(grid, cell());
    expect(detail).toMatchObject({ target: 'row', cellType: 'full-width', column: null, rowKey: 1 });
    expect(menuTexts(grid)).toEqual(['Copy', 'Delete', 'Show details']);

    [...root(grid).querySelectorAll<HTMLElement>('[role=menuitem]')].find(item => item.textContent.includes('Delete'))!.click();
    await settle(grid);
    expect(cell().getAttribute('aria-describedby')).toContain('edit-desc-removed');

    await contextMenu(grid, cell());
    expect(menuTexts(grid)).toContain('Restore');
    [...root(grid).querySelectorAll<HTMLElement>('[role=menuitem]')].find(item => item.textContent.includes('Restore'))!.click();
    await settle(grid);
    expect(grid.hasChanges()).toBe(false);
  });

  it('modo linha: sem Editar na linha inteira', async () => {
    const grid = await create(6, g => {
      g.rowMenu = true;
      g.editMode = 'row';
      g.allowEditing = true;
    });
    await contextMenu(grid, rowOf(grid, 1).querySelector<HTMLElement>('td.full-width-cell')!);
    expect(menuTexts(grid)).not.toContain('Edit');
    await contextMenu(grid, rowOf(grid, 0).querySelector<HTMLElement>('td[part~=cell]')!);
    expect(menuTexts(grid)).toContain('Edit');
  });

  it('teclado: Shift+F10 abre no 1º item, Esc volta à célula; Excluir/Restaurar pelo teclado mantêm o foco; axe com o menu', async () => {
    const grid = await create(6, g => {
      g.rowMenu = true;
      g.editMode = 'batch';
      g.allowEditing = true;
      g.allowRemoving = true;
    });
    const cell = (): HTMLElement => rowOf(grid, 1).querySelector<HTMLElement>('td.full-width-cell')!;

    const pick = async (text: string): Promise<void> => {
      for (let i = 0; i < 5 && !active(grid).textContent.includes(text); i++) {
        await key(grid, 'ArrowDown');
      }

      expect(active(grid).textContent).toContain(text);
      // Item é um <button>: Enter dele vira clique (evento sintético não ativa).
      active(grid).click();
      await settle(grid);
    };

    expect(grid.focusCell(1)).toBe(true);
    await settle(grid);
    await key(grid, 'F10', { shiftKey: true });
    expect(active(grid).getAttribute('role')).toBe('menuitem');
    expect((await axe.run(grid, { resultTypes: ['violations'] })).violations.map(violation => violation.id)).toEqual([]);
    await key(grid, 'Escape');
    expect(active(grid)).toBe(cell());

    await key(grid, 'F10', { shiftKey: true });
    await pick('Delete');
    expect(active(grid)).toBe(cell());
    expect(cell().getAttribute('aria-describedby')).toContain('edit-desc-removed');

    await key(grid, 'F10', { shiftKey: true });
    await pick('Restore');
    expect(active(grid)).toBe(cell());
    expect(grid.hasChanges()).toBe(false);
  });
});

describe('linha inteira: intervalo de células (frente 19)', () => {
  const copyFrom = (target: HTMLElement): string => {
    const clipboardData = new DataTransfer();
    target.dispatchEvent(new ClipboardEvent('copy', { clipboardData, bubbles: true, composed: true, cancelable: true }));
    return clipboardData.getData('text/plain');
  };

  const createRange = (configure?: (grid: DataGrid) => void): Promise<DataGrid> => create(6, g => {
    g.cellSelectionMode = 'multiple';
    configure?.(g);
  });

  it('Shift+↓ passa por cima da linha inteira (não é canto); sem realce nela', async () => {
    const grid = await createRange();
    expect(grid.focusCell(0, grid.columns[0])).toBe(true);
    await settle(grid);

    await key(grid, 'ArrowDown', { shiftKey: true });
    expect(grid.getCellRanges()[0]).toMatchObject({ startRowIndex: 0, endRowIndex: 2 });
    expect(rowOf(grid, 1).querySelector('[aria-selected=true], .range-cell')).toBeNull();
    expect(rowOf(grid, 2).querySelector('td[part~=cell]')!.getAttribute('aria-selected')).toBe('true');
  });

  it('selectCellRange recusa canto numa linha inteira; o intervalo que a cobre copia só as linhas com células', async () => {
    const grid = await createRange();
    expect(grid.selectCellRange({ startRowIndex: 1, endRowIndex: 2, startColumn: 'name', endColumn: 'team' })).toBe(false);
    expect(grid.selectCellRange({ startRowIndex: 0, endRowIndex: 2, startColumn: 'name', endColumn: 'team' })).toBe(true);
    await settle(grid);

    expect(copyFrom(rowOf(grid, 0).querySelector<HTMLElement>('td[part~=cell]')!)).toBe(['Name 0\tT0', 'Name 2\tT0'].join('\r\n'));
  });

  it('colar num intervalo que cobre uma linha inteira pula a linha inteira', async () => {
    const grid = await createRange(g => {
      g.allowEditing = true;
      g.editMode = 'batch';
      g.clipboardMode = 'copy-paste';
    });
    expect(grid.selectCellRange({ startRowIndex: 0, endRowIndex: 3, startColumn: 'team', endColumn: 'team' })).toBe(true);
    await settle(grid);

    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'X');
    rowOf(grid, 0).querySelectorAll<HTMLElement>('td[part~=cell]')[1].dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, composed: true, cancelable: true }));
    await settle(grid);

    expect(grid.getChanges().map(change => change.rowKey)
      .sort()).toEqual([0, 2, 3]);
  });

  it('menu da célula: nada de intervalo/colar na linha inteira; nas fixas, nenhum menu', async () => {
    const grid = await createRange(g => {
      g.allowEditing = true;
      g.editMode = 'batch';
      g.clipboardMode = 'copy-paste';
      g.fixedTopItems = [{ id: -1, name: 'Fixed', team: 'X', banner: false }];
    });
    const names: string[][] = [];
    grid.addEventListener('u-grid-context-menu-opening', event => names.push(event.detail.menuItems.map(item => String(item.name))));
    grid.selectCellRange({ startRowIndex: 0, endRowIndex: 2, startColumn: 'name', endColumn: 'team' });
    await settle(grid);

    const fire = (target: HTMLElement): void => {
      target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 40, clientY: 40 }));
    };

    fire(rowOf(grid, 0).querySelector<HTMLElement>('td[part~=cell]')!);
    await settle(grid);
    expect(names.at(-1)).toContain('copySelectedCells');
    await key(grid, 'Escape');

    fire(rowOf(grid, 1).querySelector<HTMLElement>('td.full-width-cell')!);
    await settle(grid);
    const fullWidth = names.at(-1) ?? [];
    expect(fullWidth.filter(name => ['copySelectedCells', 'paste', 'extendSelectionToCell', 'addCellToSelection'].includes(name))).toEqual([]);
    await key(grid, 'Escape');

    const count = names.length;
    fire(root(grid).querySelector<HTMLElement>('tbody.fixed-top-rows td[part~=cell]')!);
    await settle(grid);
    expect(names).toHaveLength(count);
  });
});
