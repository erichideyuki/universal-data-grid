import { afterEach, describe, expect, it } from 'vitest';

import { calcCursorRelativePosition, RelativePosition } from './features/drop-position.js';
import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, dataRows, headerLabels, settle } from './test/fixture.js';

afterEach(cleanup);

const root = (grid: DataGrid) => grid.shadowRoot!;
const headers = (grid: DataGrid) => [...root(grid).querySelectorAll<HTMLElement>('th.header-column')];
const handles = (grid: DataGrid) => [...root(grid).querySelectorAll<HTMLElement>('.resize-handle')];
const widths = (grid: DataGrid) => headers(grid).map(th => Math.round(th.getBoundingClientRect().width));

const columnsOf = (count: number, width = 100, extra: Partial<GridColumnDef> = {}): GridColumnDef[] =>
  Array.from({ length: count }, (_, i) => ({ path: `c${i}`, label: `C${i}`, width, ...extra }));

const rowOf = (count: number) =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`c${i}`, `v${i}`]));

/** Arrasta a alça `delta` px na horizontal (eventos de ponteiro sintéticos). */
const dragHandle = async (grid: DataGrid, handle: HTMLElement, delta: number): Promise<void> => {
  const rect = handle.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const init = { bubbles: true, composed: true, pointerId: 7, button: 0, isPrimary: true, clientY: y };

  handle.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x }));

  for (let step = 1; step <= 4; step++) {
    handle.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x + delta * step / 4 }));
    await grid.updateComplete;
  }

  handle.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: x + delta }));
  await settle(grid);
};

const key = (target: HTMLElement, keyName: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, composed: true, ...init }));

describe('redimensionar', () => {
  it('alça com ARIA de separador e aria-valuenow = largura', async () => {
    const grid = await createGrid({ columns: columnsOf(2, 120), items: [rowOf(2)], configure: g => g.columnResizing = true });

    const [handle] = handles(grid);
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-valuenow')).toBe('120');
    expect(handle.getAttribute('aria-label')).toBe('C0');
  });

  it('sem column-resizing não há alça; resizable: false tira só daquela coluna', async () => {
    const grid = await createGrid({ columns: columnsOf(2), items: [rowOf(2)] });
    expect(handles(grid)).toHaveLength(0);

    grid.columnResizing = true;
    grid.columns = [{ ...grid.columns[0], resizable: false }, grid.columns[1]];
    await settle(grid);
    expect(handles(grid).map(h => h.getAttribute('aria-label'))).toEqual(['C1']);
  });

  it('arrastar respeita a largura mínima e avisa ao soltar', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A', width: 150, minWidth: 70 }, { path: 'b', label: 'B', width: 150 }],
      items: [{ a: 1, b: 2 }],
      configure: g => g.columnResizing = true,
    });
    const events: number[] = [];
    grid.addEventListener('u-grid-column-resize', e => events.push(e.detail.width));

    await dragHandle(grid, handles(grid)[0], -400);

    expect(widths(grid)[0]).toBe(70);
    expect(events).toEqual([70]);
  });

  it('modo widget: só a coluna muda e a tabela acompanha', async () => {
    const grid = await createGrid({ columns: columnsOf(3), items: [rowOf(3)], configure: g => g.columnResizing = true });
    const table = root(grid).querySelector('table')!;
    const before = table.getBoundingClientRect().width;

    await dragHandle(grid, handles(grid)[0], 40);

    expect(widths(grid)).toEqual([140, 100, 100]);
    expect(Math.round(table.getBoundingClientRect().width - before)).toBe(40);
  });

  it('modo next-column conserva a soma (e para no mínimo da vizinha)', async () => {
    const grid = await createGrid({
      columns: columnsOf(3),
      items: [rowOf(3)],
      configure: g => {
        g.columnResizing = true;
        g.resizeMode = 'next-column';
      },
    });
    const events: unknown[] = [];
    grid.addEventListener('u-grid-column-resize', e => events.push(e.detail));

    await dragHandle(grid, handles(grid)[0], 30);
    expect(widths(grid)).toEqual([130, 70, 100]);

    await dragHandle(grid, handles(grid)[0], 200);
    expect(widths(grid)).toEqual([160, 40, 100]);
    expect(events.at(-1)).toMatchObject({ width: 160, previousWidth: 130, nextColumnWidth: 40 });

    // A última coluna não tem vizinha: sem alça neste modo.
    expect(handles(grid)).toHaveLength(2);
  });

  it('teclado: Alt+→ no cabeçalho e setas na alça, de 16 em 16 px', async () => {
    const grid = await createGrid({ columns: columnsOf(2), items: [rowOf(2)], configure: g => g.columnResizing = true });

    key(headers(grid)[0], 'ArrowRight', { altKey: true });
    await settle(grid);
    expect(widths(grid)[0]).toBe(116);

    key(headers(grid)[0], 'ArrowRight');
    await settle(grid);
    expect(widths(grid)[0]).toBe(116);

    key(handles(grid)[0], 'ArrowLeft');
    await settle(grid);
    expect(widths(grid)[0]).toBe(100);
    expect(handles(grid)[0].getAttribute('aria-valuenow')).toBe('100');
  });

  it('RTL: Alt+← alarga (a borda final fica à esquerda)', async () => {
    const grid = await createGrid({
      columns: columnsOf(2),
      items: [rowOf(2)],
      configure: g => {
        g.columnResizing = true;
        g.dir = 'rtl';
      },
    });

    key(headers(grid)[0], 'ArrowLeft', { altKey: true });
    await settle(grid);
    expect(widths(grid)[0]).toBe(116);
  });

  it('duplo clique e Enter na alça ajustam ao conteúdo', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A', width: 60 }, { path: 'b', label: 'B', width: 100 }],
      items: [{ a: 'a fairly long value that does not fit', b: 1 }, { a: 'short', b: 2 }],
      configure: g => g.columnResizing = true,
    });
    const events: number[] = [];
    grid.addEventListener('u-grid-column-resize', e => events.push(e.detail.width));

    handles(grid)[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await settle(grid);

    const fitted = widths(grid)[0];
    const cell = dataRows(grid)[0].cells[0];
    expect(fitted).toBeGreaterThan(200);
    expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth + 1);
    expect(events).toEqual([fitted]);

    grid.setColumnWidth(grid.columns[0], 60);
    await settle(grid);
    key(handles(grid)[0], 'Enter');
    await settle(grid);
    expect(widths(grid)[0]).toBe(fitted);
  });

  it('setColumnWidth respeita minWidth/maxWidth', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A', width: 100, minWidth: 50, maxWidth: 300 }, { path: 'b', label: 'B', width: 100 }],
      items: [{ a: 1, b: 2 }],
    });

    grid.setColumnWidth(grid.columns[0], 10);
    await settle(grid);
    expect(widths(grid)[0]).toBe(50);

    grid.setColumnWidth(grid.columns[0], 900);
    await settle(grid);
    expect(widths(grid)[0]).toBe(300);
  });

  it('largura nova do hospedeiro vence a do usuário', async () => {
    const columns = columnsOf(2);
    const grid = await createGrid({ columns, items: [rowOf(2)] });

    grid.setColumnWidth(columns[0], 200);
    await settle(grid);
    expect(widths(grid)[0]).toBe(200);

    // Mesma definição de novo: o usuário continua valendo.
    grid.columns = [...columns];
    await settle(grid);
    expect(widths(grid)[0]).toBe(200);

    grid.columns = [{ ...columns[0], width: 150 }, columns[1]];
    await settle(grid);
    expect(widths(grid)[0]).toBe(150);
  });

  it('column-auto-width mede o conteúdo das colunas sem width', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A' }, { path: 'b', label: 'B' }, { path: 'c', label: 'C', width: 400 }],
      items: [{ a: 'x', b: 'a much longer piece of text in this column', c: 1 }],
      configure: g => g.columnAutoWidth = true,
    });

    const [a, b] = widths(grid);
    expect(b).toBeGreaterThan(a * 3);
  });
});

describe('colunas fixas', () => {
  const wide = (): GridColumnDef[] => columnsOf(20, 120).map((column, i) =>
    i === 0 || i === 1 ? { ...column, fixed: 'start' } : i === 19 ? { ...column, fixed: 'end' } : column);

  it('ficam no lugar com rolagem horizontal; sombra só quando há conteúdo por baixo', async () => {
    const grid = await createGrid({ columns: wide(), items: [rowOf(20)] });
    grid.style.width = '700px';
    await settle(grid);

    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;
    const container = root(grid).querySelector('.container')!;
    const box = scroller.getBoundingClientRect();
    expect(container.classList.contains('scroll-start')).toBe(false);
    expect(container.classList.contains('scroll-end')).toBe(true);

    scroller.scrollLeft = 600;
    await settle(grid);

    const [first, second] = headers(grid);
    const last = headers(grid).at(-1)!;
    const firstCell = dataRows(grid)[0].cells[0];
    const lastCell = dataRows(grid)[0].cells[19];

    expect(Math.round(first.getBoundingClientRect().left)).toBe(Math.round(box.left));
    expect(Math.round(second.getBoundingClientRect().left)).toBe(Math.round(box.left + 120));
    expect(Math.round(firstCell.getBoundingClientRect().left)).toBe(Math.round(box.left));
    expect(Math.round(last.getBoundingClientRect().right)).toBe(Math.round(box.left + scroller.clientWidth));
    expect(Math.round(lastCell.getBoundingClientRect().right)).toBe(Math.round(box.left + scroller.clientWidth));
    expect(container.classList.contains('scroll-start')).toBe(true);
    expect(second.classList.contains('fixed-start-edge')).toBe(true);
    expect(last.classList.contains('fixed-end-edge')).toBe(true);
  });

  it('fixas vão para as pontas e reordenar fica dentro do bloco', async () => {
    const columns: GridColumnDef[] = [
      { path: 'a', label: 'A' },
      { path: 'b', label: 'B', fixed: 'end' },
      { path: 'c', label: 'C' },
      { path: 'd', label: 'D', fixed: 'start' },
    ];
    const grid = await createGrid({ columns, items: [{}] });
    expect(headerLabels(grid)).toEqual(['D', 'A', 'C', 'B']);

    grid.moveColumn(columns[2], 0);
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['D', 'C', 'A', 'B']);

    grid.moveColumn(columns[3], 3);
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['D', 'C', 'A', 'B']);

    expect(grid._sameBlock(columns[0], columns[2])).toBe(true);
    expect(grid._sameBlock(columns[0], columns[3])).toBe(false);
  });

  it('linha de grupo: recuo e rótulo ficam visíveis ao rolar', async () => {
    const grid = await createGrid({
      columns: [{ path: 'g', label: 'G', groupIndex: 0 }, ...columnsOf(12, 120)],
      items: [{ g: 'x', ...rowOf(12) }],
    });
    grid.style.width = '600px';
    await settle(grid);

    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;
    scroller.scrollLeft = 500;
    await settle(grid);

    const label = root(grid).querySelector('.grouping-label')!;
    const box = scroller.getBoundingClientRect();
    expect(label.getBoundingClientRect().left).toBeGreaterThanOrEqual(box.left + 32);
    expect(label.getBoundingClientRect().left).toBeLessThan(box.left + 80);
  });

  it('RTL: fixa no início gruda à direita', async () => {
    const grid = await createGrid({ columns: wide(), items: [rowOf(20)], configure: g => g.dir = 'rtl' });
    grid.style.width = '700px';
    await settle(grid);

    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;
    scroller.scrollLeft = -600;
    await settle(grid);

    const box = scroller.getBoundingClientRect();
    const [first] = headers(grid);
    const last = headers(grid).at(-1)!;

    expect(Math.round(first.getBoundingClientRect().right)).toBe(Math.round(box.right));
    expect(Math.round(last.getBoundingClientRect().left)).toBe(Math.round(box.right - scroller.clientWidth));
    expect(root(grid).querySelector('.container')!.classList.contains('scroll-start')).toBe(true);
  });

  it('RTL: soltar na metade esquerda do alvo é "depois" na ordem', () => {
    const host = document.createElement('div');
    host.dir = 'rtl';
    host.style.cssText = 'display:flex;width:200px';
    const target = document.createElement('div');
    target.style.cssText = 'width:200px;height:20px';
    host.append(target);
    document.body.append(host);

    const rect = target.getBoundingClientRect();
    const at = (clientX: number) => calcCursorRelativePosition({ target, dragEvent: { clientX } } as never);

    expect(at(rect.left + 20)).toBe(RelativePosition.After);
    expect(at(rect.right - 20)).toBe(RelativePosition.Before);
    host.remove();
  });
});

describe('visibilidade e seletor', () => {
  const chooser = (grid: DataGrid) => root(grid).querySelector<HTMLElement>('.column-chooser');
  const checkboxes = (grid: DataGrid) => [...chooser(grid)!.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];

  it('visible: false oculta e o aria-colcount conta só as visíveis', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'A' }, { path: 'b', label: 'B', visible: false }, { path: 'c', label: 'C' }],
      items: [{ a: 1, b: 2, c: 3 }],
    });

    expect(headerLabels(grid)).toEqual(['A', 'C']);
    expect(dataRows(grid)[0].cells).toHaveLength(2);
    expect(root(grid).querySelector('[role=grid]')!.getAttribute('aria-colcount')).toBe('2');
  });

  it('o botão abre o seletor; caixas rotuladas ocultam e mostram, com evento', async () => {
    const columns: GridColumnDef[] = [
      { path: 'a', label: 'A' },
      { path: 'b', label: 'B' },
      { path: 'h', label: 'Hidden', showInChooser: false },
    ];
    const grid = await createGrid({ columns, items: [{ a: 1, b: 2 }], configure: g => g.columnChooser = true });
    const events: [string | undefined, boolean][] = [];
    grid.addEventListener('u-grid-column-visibility-change', e => events.push([e.detail.column.label, e.detail.visible]));

    const button = root(grid).querySelector<HTMLButtonElement>('.column-chooser-button')!;
    expect(button.getAttribute('aria-label')).toBe('Column chooser');
    button.click();
    await settle(grid);

    const panel = chooser(grid)!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.matches(':popover-open')).toBe(true);
    expect(checkboxes(grid).map(c => c.closest('label')!.textContent.trim())).toEqual(['A', 'B']);
    expect(root(grid).activeElement).toBe(checkboxes(grid)[0]);

    checkboxes(grid)[0].click();
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['B', 'Hidden']);
    expect(events).toEqual([['A', false]]);

    checkboxes(grid)[0].click();
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['A', 'B', 'Hidden']);
    expect(events).toEqual([['A', false], ['A', true]]);

    // Esc fecha e devolve o foco ao botão.
    key(chooser(grid)!, 'Escape');
    await settle(grid);
    expect(chooser(grid)).toBeNull();
    expect(root(grid).activeElement).toBe(button);
  });

  it('não deixa ocultar a última coluna visível', async () => {
    const grid = await createGrid({ columns: [{ path: 'a', label: 'A' }, { path: 'b', label: 'B' }], items: [{}] });
    grid.showColumnChooser();
    await settle(grid);

    checkboxes(grid)[0].click();
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['B']);

    const [, last] = checkboxes(grid);
    expect(last.disabled).toBe(true);

    expect(grid._userSetVisible(grid.columns[1], false)).toBe(false);
    last.click();
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['B']);
    expect(last.checked).toBe(true);
  });

  it('fixar pelo seletor move a coluna para o bloco e não altera o hospedeiro', async () => {
    const columns: GridColumnDef[] = [{ path: 'a', label: 'A' }, { path: 'b', label: 'B' }, { path: 'c', label: 'C' }];
    const grid = await createGrid({ columns, items: [{}] });
    grid.showColumnChooser();
    await settle(grid);

    const pinEnd = chooser(grid)!.querySelectorAll<HTMLButtonElement>('.pin-end')[0];
    expect(pinEnd.getAttribute('aria-pressed')).toBe('false');
    pinEnd.click();
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['B', 'C', 'A']);
    expect(headers(grid)[2].classList.contains('fixed-end')).toBe(true);

    const pinned = [...chooser(grid)!.querySelectorAll<HTMLButtonElement>('.pin-end')].find(b => b.getAttribute('aria-pressed') === 'true')!;
    expect(pinned.title).toBe('Unpin');
    pinned.click();
    await settle(grid);
    expect(headers(grid).some(th => th.classList.contains('fixed'))).toBe(false);

    for (const column of columns) {
      expect(Object.keys(column).sort()).toEqual(['label', 'path']);
    }
  });

  it('clique fora fecha o seletor', async () => {
    const grid = await createGrid({ columns: [{ path: 'a', label: 'A' }], items: [{}], configure: g => g.columnChooser = true });
    grid.showColumnChooser();
    await settle(grid);
    expect(chooser(grid)).not.toBeNull();

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await settle(grid);
    expect(chooser(grid)).toBeNull();
  });
});

describe('reordenar', () => {
  it('reordenação do usuário dispara u-grid-column-reorder', async () => {
    const columns: GridColumnDef[] = [{ path: 'a', label: 'A' }, { path: 'b', label: 'B' }, { path: 'c', label: 'C' }];
    const grid = await createGrid({ columns, items: [{}] });
    const events: unknown[] = [];
    grid.addEventListener('u-grid-column-reorder', e => events.push(e.detail));

    grid._userMoveColumn(columns[2], 0);
    await settle(grid);

    expect(headerLabels(grid)).toEqual(['C', 'A', 'B']);
    expect(events).toEqual([{ column: columns[2], fromIndex: 2, toIndex: 0 }]);
  });
});

describe('<u-grid-column> declarativo', () => {
  it('lê fixed, visible, min-width e resizable dos atributos', async () => {
    const grid = document.createElement('u-grid');
    grid.style.cssText = 'display:block;height:300px';
    grid.columnResizing = true;
    grid.innerHTML = `
      <u-grid-column path="a" width="100">A</u-grid-column>
      <u-grid-column path="b" width="100" fixed="start" min-width="80">B</u-grid-column>
      <u-grid-column path="c" visible="false">C</u-grid-column>
      <u-grid-column path="d" width="100" resizable="false">D</u-grid-column>`;
    grid.items = [{ a: 1, b: 2, c: 3, d: 4 }];
    document.body.append(grid);
    await settle(grid);

    expect(headerLabels(grid)).toEqual(['B', 'A', 'D']);
    expect(handles(grid).map(h => [h.getAttribute('aria-label'), h.getAttribute('aria-valuemin')])).toEqual([['B', '80'], ['A', '40']]);

    const c = grid.querySelector<HTMLElement & GridColumnDef>('u-grid-column[path=c]')!;
    c.visible = true;
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['B', 'A', 'C', 'D']);
  });
});
