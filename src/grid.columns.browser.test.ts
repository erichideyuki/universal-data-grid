import { html } from 'lit';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

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
  it('cabeçalho alinhado ao fim termina no mesmo pixel do conteúdo (a alça não reserva espaço)', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'Amount', width: 160, dataType: 'number' }, { path: 'b', label: 'B', width: 120 }],
      items: [{ a: 1234, b: 'x' }],
      configure: g => g.columnResizing = true,
    });
    const range = document.createRange();

    const rightOf = (node: Node) => {
      range.selectNodeContents(node);
      return Math.round(range.getBoundingClientRect().right);
    };

    const th = headers(grid)[0];
    const td = dataRows(grid)[0].querySelector('td[aria-colindex="1"]')!;
    expect(rightOf(th.querySelector('.header-text')!)).toBe(rightOf(td));
  });

  for (const dir of ['ltr', 'rtl'] as const) {
    it(`arrastar mostra o separador na borda nova e some ao soltar (${dir})`, async () => {
      const grid = await createGrid({ columns: columnsOf(3, 120), items: [rowOf(3)], configure: g => g.columnResizing = true });
      grid.dir = dir;
      await settle(grid);

      const container = root(grid).querySelector<HTMLElement>('.container')!;
      const handle = handles(grid)[0];
      const rect = handle.getBoundingClientRect();
      const init = { bubbles: true, composed: true, pointerId: 9, button: 0, isPrimary: true, clientY: rect.top + 2 };
      const x = rect.left + rect.width / 2;
      const outward = dir === 'rtl' ? -1 : 1;

      handle.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x }));
      handle.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x + 30 * outward }));
      await settle(grid);

      expect(container.classList.contains('resizing')).toBe(true);
      const th = headers(grid)[0].getBoundingClientRect();
      const edge = (dir === 'rtl' ? th.left : th.right) - container.getBoundingClientRect().left;
      const line = getComputedStyle(container, '::after');
      expect(Math.abs(parseFloat(line.left) + 1 - edge)).toBeLessThanOrEqual(1.5);
      expect(line.width).toBe('3px');

      handle.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: x + 30 * outward }));
      await settle(grid);
      expect(container.classList.contains('resizing')).toBe(false);
      expect(container.style.getPropertyValue('--_resize-line-left')).toBe('');
      expect(widths(grid)[0]).toBe(150);
    });
  }

  it('alça com ARIA de separador e aria-valuenow = largura', async () => {
    const grid = await createGrid({ columns: columnsOf(2, 120), items: [rowOf(2)], configure: g => g.columnResizing = true });

    const [handle] = handles(grid);
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-valuenow')).toBe('120');
    expect(handle.getAttribute('aria-label')).toBe('Resize C0');
  });

  it('sem column-resizing não há alça; resizable: false tira só daquela coluna', async () => {
    const grid = await createGrid({ columns: columnsOf(2), items: [rowOf(2)] });
    expect(handles(grid)).toHaveLength(0);

    grid.columnResizing = true;
    grid.columns = [{ ...grid.columns[0], resizable: false }, grid.columns[1]];
    await settle(grid);
    expect(handles(grid).map(h => h.getAttribute('aria-label'))).toEqual(['Resize C1']);
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
    // Mais estreito que a soma: sem sobra para a última coluna (ela leva a sobra quando há).
    const grid = await createGrid({ columns: columnsOf(3), items: [rowOf(3)], configure: g => {
      g.columnResizing = true;
      g.style.width = '250px';
    } });
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
        g.style.width = '250px';
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
  const checkboxes = (grid: DataGrid) => [...chooser(grid)!.querySelectorAll<HTMLInputElement>('.column-chooser-list input[type=checkbox]')];

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
    // Foco inicial na busca (como o AG Grid).
    expect(root(grid).activeElement).toBe(chooser(grid)!.querySelector('.column-chooser-search'));

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
    grid.openColumnChooser();
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

  it('fixar pelo menu do cabeçalho move a coluna para o bloco e não altera o hospedeiro', async () => {
    const columns: GridColumnDef[] = [{ path: 'a', label: 'A' }, { path: 'b', label: 'B' }, { path: 'c', label: 'C' }];
    const grid = await createGrid({ columns, items: [{}] });

    const pin = async (column: GridColumnDef, side: string) => {
      grid.openContextMenu({ column });
      await settle(grid);
      root(grid).querySelector<HTMLElement>('.context-menu-panel [aria-haspopup=menu]')!.click();
      await settle(grid);
      const radios = [...root(grid).querySelectorAll<HTMLElement>('.context-menu-panel-submenu [role=menuitemradio]')];
      const radio = radios.find(item => item.textContent.trim() === side)!;
      const checked = radio.getAttribute('aria-checked');
      radio.click();
      await settle(grid);
      return checked;
    };

    expect(await pin(columns[0], 'Pin to end')).toBe('false');
    expect(headerLabels(grid)).toEqual(['B', 'C', 'A']);
    expect(headers(grid)[2].classList.contains('fixed-end')).toBe(true);

    expect(await pin(columns[0], 'Unpin')).toBe('false');
    expect(headers(grid).some(th => th.classList.contains('fixed'))).toBe(false);

    for (const column of columns) {
      expect(Object.keys(column).sort()).toEqual(['label', 'path']);
    }
  });

  it('clique fora fecha o seletor', async () => {
    const grid = await createGrid({ columns: [{ path: 'a', label: 'A' }], items: [{}], configure: g => g.columnChooser = true });
    grid.openColumnChooser();
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
    expect(events).toEqual([{ column: columns[2], band: null, index: 0, previousIndex: 2, fromIndex: 2, toIndex: 0 }]);
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
    expect(handles(grid).map(h => [h.getAttribute('aria-label'), h.getAttribute('aria-valuemin')])).toEqual([['Resize B', '80'], ['Resize A', '40']]);

    const c = grid.querySelector<HTMLElement & GridColumnDef>('u-grid-column[path=c]')!;
    c.visible = true;
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['B', 'A', 'C', 'D']);
  });
});

describe('desconectar solta o que foi registrado', () => {
  it('no meio de um arrasto: alça sem listeners e grid sem estado de redimensionar', async () => {
    const grid = await createGrid({ columns: columnsOf(2), items: [rowOf(2)], configure: g => g.columnResizing = true });
    const handle = handles(grid)[0];
    const rect = handle.getBoundingClientRect();
    const init = { bubbles: true, composed: true, pointerId: 9, button: 0, clientY: rect.top + 2 };

    handle.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: rect.left }));
    handle.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: rect.left + 30 }));
    await settle(grid);
    expect(root(grid).querySelector('.container')!.classList.contains('resizing')).toBe(true);

    grid.remove();
    document.body.append(grid);
    await settle(grid);

    const widthAfter = widths(grid)[0];
    handle.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: rect.left + 200 }));
    await settle(grid);

    expect(widths(grid)[0]).toBe(widthAfter);
    expect(root(grid).querySelector('.container')!.classList.contains('resizing')).toBe(false);
  });

  it('com o seletor aberto: tira o listener do document', async () => {
    const grid = await createGrid({ columns: [{ path: 'a', label: 'A' }], items: [{}] });
    grid.openColumnChooser();
    await settle(grid);

    const remove = vi.spyOn(document, 'removeEventListener');
    grid.remove();

    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    remove.mockRestore();
  });
});

describe('com ordenação (frente 03)', () => {
  const people = () => [
    { name: 'Carla', city: 'Recife', rank: 2 },
    { name: 'Ana', city: 'Belém', rank: 3 },
    { name: 'Bruno', city: 'Natal', rank: 1 },
  ];

  const names = (grid: DataGrid) => dataRows(grid).map(row => row.cells[0].textContent.trim());

  it('a alça (clique, duplo clique, Enter, Espaço, arrasto) nunca ordena', async () => {
    const grid = await createGrid({
      columns: [{ path: 'name', label: 'Name', width: 120 }, { path: 'city', label: 'City', width: 120 }],
      items: people(),
      configure: g => g.columnResizing = true,
    });
    const handle = handles(grid)[0];

    await userEvent.click(handle);
    await userEvent.dblClick(handle);
    key(handle, 'Enter');
    key(handle, ' ');
    await settle(grid);
    await dragHandle(grid, handles(grid)[0], 30);

    expect(grid.getSorting()).toEqual([]);
    expect(headers(grid)[0].getAttribute('aria-sort')).toBe('none');
    expect(names(grid)).toEqual(['Carla', 'Ana', 'Bruno']);

    // O cabeçalho em si continua ordenando.
    await userEvent.click(headers(grid)[0].querySelector('.header-text')!);
    await settle(grid);
    expect(names(grid)).toEqual(['Ana', 'Bruno', 'Carla']);
  });

  it('colunas fixas e ocultas ordenam normalmente', async () => {
    const columns: GridColumnDef[] = [
      { path: 'name', label: 'Name', fixed: 'start' },
      { path: 'city', label: 'City', fixed: 'end' },
      { path: 'rank', label: 'Rank', visible: false },
    ];
    const grid = await createGrid({ columns, items: people() });

    await userEvent.click(headers(grid).find(th => th.textContent.includes('City'))!);
    await settle(grid);
    expect(names(grid)).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(headers(grid).at(-1)!.getAttribute('aria-sort')).toBe('ascending');
    expect(headers(grid).at(-1)!.classList.contains('fixed-end')).toBe(true);

    grid.sortColumn(columns[2], 'asc');
    await settle(grid);
    expect(names(grid)).toEqual(['Bruno', 'Carla', 'Ana']);
    expect(headerLabels(grid)).toEqual(['Name', 'City']);

    // Ocultar a coluna ordenada mantém a ordenação.
    grid.sortColumn(columns[0], 'desc');
    grid.openColumnChooser();
    await settle(grid);
    root(grid).querySelector<HTMLInputElement>('.column-chooser-list input[type=checkbox]')!.click();
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['City']);
    expect(grid.getSorting().map(s => s.column.label)).toEqual(['Name']);
  });
});

// Rótulos longos (colunas de documento do pivô): quebrar em várias linhas em vez de reticências.
describe('headerWrap', () => {
  const longLabel = 'Documento de treinamento obrigatório';
  const items = Array.from({ length: 40 }, (_, i) => ({ a: `a${i}`, b: `b${i}`, c: '' }));
  const header = (grid: DataGrid, index: number) => grid.shadowRoot!.querySelectorAll<HTMLElement>('th.header-column')[index];

  const truncated = (th: HTMLElement) => {
    const text = th.querySelector<HTMLElement>('.header-text')!;
    return text.scrollWidth > text.clientWidth;
  };

  it('quebra o rótulo e o cabeçalho cresce; a coluna pode desligar; auto-size mede numa linha', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: longLabel, width: 170 }, { path: 'b', label: longLabel, width: 110, headerWrap: false }, { path: 'c', label: 'C' }],
      items,
      configure: g => g.headerWrap = true,
    });

    expect(header(grid, 0).classList.contains('header-wrap')).toBe(true);
    expect(truncated(header(grid, 0))).toBe(false);
    const wrapped = header(grid, 0).getBoundingClientRect().height;
    expect(wrapped).toBeGreaterThan(52);
    expect(header(grid, 1).classList.contains('header-wrap')).toBe(false);
    expect(truncated(header(grid, 1))).toBe(true);

    // Auto-size: largura do rótulo inteiro numa linha (não encolhe até a maior palavra).
    grid.autoSizeColumn(grid.columns[0]);
    await settle(grid);
    expect(truncated(header(grid, 0))).toBe(false);
    expect(header(grid, 0).querySelector('.header-text')!.getClientRects().length).toBe(1);
    // Uma linha só: a altura da linha do cabeçalho volta à das outras colunas.
    expect(header(grid, 0).getBoundingClientRect().height).toBeLessThan(wrapped);
  });

  // Relato da 0.3.2 (click): sem max-lines a palavra maior que a coluna saía
  // cortada no meio da letra. No Chromium, \`-webkit-box\` com \`line-clamp:
  // none\` desliga as reticências de todas as linhas; com um número (ou num
  // bloco comum) cada linha que transborda ganha reticências, como a
  // referência. As reticências não aparecem no DOM: confere o mecanismo.
  it('palavra maior que a coluna: reticências por linha, com e sem max-lines', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: 'PRO-014 - Procedimento de Brindes, Presentes e Hospitalidades', width: 110 }, { path: 'c', label: 'C' }],
      items,
      configure: g => g.headerWrap = true,
    });
    const text = () => header(grid, 0).querySelector<HTMLElement>('.header-text')!;

    const clampsAll = () => {
      const style = getComputedStyle(text());
      return style.display === '-webkit-box' && style.webkitLineClamp === 'none';
    };

    expect(text().scrollWidth).toBeGreaterThan(text().clientWidth);
    expect(getComputedStyle(text()).textOverflow).toBe('ellipsis');
    expect(clampsAll()).toBe(false);

    for (const value of ['none', '2']) {
      grid.style.setProperty('--u-grid-header-cell-max-lines', value);
      await settle(grid);
      expect(clampsAll(), value).toBe(false);
    }

    expect(getComputedStyle(text()).webkitLineClamp).toBe('2');
  });

  // Relato do click na 0.4.1: com column-auto-width a medida não reservava a seta da ordenação; ao
  // ordenar, o texto estreitava e quebrava em 2 linhas enquanto as vizinhas seguiam numa.
  for (const sortMode of ['single', 'multiple'] as const) {
    it(`column-auto-width reserva a seta da ordenação (${sortMode}): ordenar não muda a largura nem quebra o texto`, async () => {
      const grid = await createGrid({
        columns: [
          { path: 'a', label: '001 - Código de Ética', minWidth: 160, maxWidth: 280 },
          { path: 'b', label: '002 - Conduta', minWidth: 160, maxWidth: 280 },
        ],
        items: [{ a: 'x', b: 'y' }],
        configure: g => {
          g.columnAutoWidth = true;
          g.headerWrap = true;
          g.sortMode = sortMode;
          g.style.setProperty('--u-grid-header-cell-max-lines', '2');
        },
      });
      await settle(grid);
      await settle(grid);

      const text = () => header(grid, 0).querySelector<HTMLElement>('.header-text')!;

      const lines = () => {
        const range = document.createRange();
        range.selectNodeContents(text());
        return new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size;
      };

      const before = header(grid, 0).getBoundingClientRect().width;
      expect(lines()).toBe(1);

      grid.sortColumn(grid.columns[0], 'asc');

      if (sortMode === 'multiple') {
        grid.sortColumn(grid.columns[1], 'asc', { append: true });
      }

      await settle(grid);
      await settle(grid);

      expect(header(grid, 0).getBoundingClientRect().width).toBeCloseTo(before, 0);
      expect(lines()).toBe(1);
    });
  }

  // Relato do usuário: com header-wrap, o cabeçalho que quebrava centralizava o funil e o "⋮" entre as
  // linhas e eles saíam da altura dos das outras colunas.
  it('botões na altura da última linha do rótulo: iguais com e sem quebra', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'a', label: '004 - Gestão de riscos', width: 260 },
        { path: 'b', label: '005 - Gestão dos Serviços Terceirizados', width: 200 },
        { path: 'c', label: 'C' },
      ],
      items: [{ a: 1, b: 2, c: 3 }],
      configure: g => {
        g.headerWrap = true;
        g.headerFilter = true;
      },
    });
    await settle(grid);

    const centerOf = (el: Element) => {
      const r = el.getBoundingClientRect();
      return (r.top + r.bottom) / 2;
    };

    const lastLineCenter = (index: number) => {
      const range = document.createRange();
      range.selectNodeContents(header(grid, index).querySelector('.header-text')!);
      const rects = [...range.getClientRects()].filter(r => r.width > 0);
      const last = rects.reduce((a, r) => r.bottom > a.bottom ? r : a);
      return (last.top + last.bottom) / 2;
    };

    const menu = (index: number) => header(grid, index).querySelector('.column-header-menu-button')!;
    const range = document.createRange();
    range.selectNodeContents(header(grid, 1).querySelector('.header-text')!);
    const wrappedLines = new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size;

    expect(wrappedLines).toBeGreaterThanOrEqual(2);
    expect(Math.abs(centerOf(menu(0)) - centerOf(menu(1)))).toBeLessThanOrEqual(1);
    expect(Math.abs(centerOf(menu(1)) - lastLineCenter(1))).toBeLessThanOrEqual(3);
    expect(Math.abs(centerOf(menu(0)) - lastLineCenter(0))).toBeLessThanOrEqual(3);
  });

  it('<u-grid-column header-wrap> e header-wrap="false" contra o padrão do grid', async () => {
    const grid = document.createElement('u-grid');
    grid.style.cssText = 'display:block;height:300px';
    grid.setAttribute('header-wrap', '');
    grid.innerHTML = `<u-grid-column path="a" width="170">${longLabel}</u-grid-column>`
      + `<u-grid-column path="b" width="110" header-wrap="false">${longLabel}</u-grid-column><u-grid-column path="c">C</u-grid-column>`;
    grid.items = items;
    document.body.append(grid);
    await settle(grid);

    expect(grid.headerWrap).toBe(true);
    expect(truncated(header(grid, 0))).toBe(false);
    expect(truncated(header(grid, 1))).toBe(true);
  });

  it('cabeçalho alto demais (> 50% da altura visível) deixa de grudar; foco não fica sob ele', async () => {
    const grid = await createGrid({
      columns: [{ path: 'a', label: `${longLabel} ${longLabel} ${longLabel}`, width: 90 }, { path: 'b', label: 'B', width: 90 }],
      items,
      height: '320px',
      configure: g => g.headerWrap = true,
    });
    const container = grid.shadowRoot!.querySelector('.container')!;
    const thead = grid.shadowRoot!.querySelector('thead')!;

    expect(thead.getBoundingClientRect().height).toBeGreaterThan(160);
    expect(container.classList.contains('header-rows-scroll')).toBe(true);
    expect(getComputedStyle(thead).position).toBe('static');

    // O cabeçalho solto não conta como área coberta: PageDown anda uma página de verdade (APG).
    grid.focusCell(items[0], 'b');
    await settle(grid);
    const activeRow = () => Number((grid.shadowRoot!.activeElement as HTMLElement).closest('tr')!.getAttribute('aria-rowindex'));
    const before = activeRow();
    await userEvent.keyboard('{PageDown}');
    await settle(grid);
    expect(activeRow() - before).toBeGreaterThanOrEqual(4);

    // Grid mais alto: volta a grudar, e a célula focada fica abaixo do cabeçalho.
    grid.style.height = '900px';
    await settle(grid);
    await settle(grid);
    expect(container.classList.contains('header-rows-scroll')).toBe(false);
    grid.focusCell(items[30], 'b');
    await settle(grid);
    const cell = grid.shadowRoot!.activeElement as HTMLElement;
    expect(cell.getBoundingClientRect().top).toBeGreaterThanOrEqual(Math.floor(thead.getBoundingClientRect().bottom));
  });
});

// Relato de uso (0.3.0): "Obrigatório" cortado 1px — medido com a fonte de reserva antes de a web font chegar.
it('fonte carregada depois da medida: column-auto-width mede de novo (document.fonts loadingdone)', async () => {
  const grid = await createGrid({
    columns: [{ path: 'a', label: 'Obrigatório' }, { path: 'b', label: 'Certificado' }, { path: 'c', label: 'C' }],
    items: [{ a: 'x', b: 'y', c: 'z' }],
    configure: g => {
      // Estreito: as colunas ficam na largura medida (nada a distribuir).
      g.style.width = '200px';
      g.columnAutoWidth = true;
      g.headerFilter = true;
    },
  });
  const width = () => root(grid).querySelector<HTMLElement>('th.header-column')!.getBoundingClientRect().width;
  const before = width();

  // A fonte "chega" mais larga (aqui, um tamanho maior); sem o evento, a largura medida não muda.
  grid.style.setProperty('--u-grid-header-cell-font-size', '20px');
  await settle(grid);
  expect(width()).toBe(before);

  document.fonts.dispatchEvent(new Event('loadingdone'));
  await settle(grid);
  await settle(grid);
  expect(width()).toBeGreaterThan(before);
  const text = root(grid).querySelector<HTMLElement>('th.header-column .header-text')!;
  expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
});

// Relato de uso (0.3.0): rótulos longos quebravam no meio da palavra ("Procediment/o") e o cabeçalho chegava a 6 linhas.
describe('headerWrap: só entre palavras e --u-grid-header-cell-max-lines', () => {
  const long = 'PRO-014 - Procedimento de Brindes, Presentes e Hospitalidades';
  const make = (configure?: (grid: DataGrid) => void) => createGrid({
    columns: [
      { path: 'a', label: long, width: 150, headerWrap: true },
      { path: 'b', label: 'Custom', width: 150, headerWrap: true, headerRenderer: () => html`<b>${long}</b>` },
      { path: 'c', label: 'C' },
    ],
    items: [{ a: 'x', b: 'y', c: 'z' }],
    configure: g => {
      g.headerFilter = true;
      configure?.(g);
    },
  });
  const label = (grid: DataGrid, index = 0) => root(grid).querySelectorAll<HTMLElement>('th.header-column .header-text')[index];

  /** Linhas visíveis: os topos distintos das caixas de texto que cabem na caixa do rótulo. */
  const lines = (element: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const box = element.getBoundingClientRect();
    return new Set([...range.getClientRects()].filter(rect => rect.top < box.bottom - 1).map(rect => Math.round(rect.top))).size;
  };

  it('não parte palavras; palavra maior que a coluna fica com reticências', async () => {
    const grid = await make();
    const walker = document.createTreeWalker(label(grid), NodeFilter.SHOW_TEXT);
    let text = walker.nextNode();

    while (text && !text.textContent!.includes('Procedimento')) {
      text = walker.nextNode();
    }

    const range = document.createRange();
    const start = text!.textContent!.indexOf('Procedimento');
    range.setStart(text!, start);
    range.setEnd(text!, start + 'Procedimento'.length);

    // A palavra numa linha só (cortada com reticências se não couber), nunca em duas.
    expect(new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size).toBe(1);
    expect(getComputedStyle(label(grid)).overflowWrap).toBe('normal');
  });

  it('limite de linhas: corta com reticências, dica com o texto inteiro; headerRenderer nunca é cortado', async () => {
    const grid = await make(g => g.style.setProperty('--u-grid-header-cell-max-lines', '2'));
    const text = label(grid);

    expect(lines(text)).toBeLessThanOrEqual(2);
    expect(text.scrollHeight).toBeGreaterThan(text.clientHeight);
    text.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
    expect(text.title).toBe(long);
    // O nome do cabeçalho segue sendo o rótulo inteiro.
    expect(text.closest('th')!.getAttribute('aria-labelledby')).toBe(text.id);
    expect(text.textContent.trim()).toBe(long);

    // Conteúdo próprio (pode ter controles): sem corte.
    const custom = label(grid, 1);
    expect(getComputedStyle(custom).webkitLineClamp).toBe('none');
    expect(custom.scrollHeight).toBeLessThanOrEqual(custom.clientHeight + 1);

    const { default: axe } = await import('axe-core');
    const result = await axe.run(grid as unknown as Element);
    expect(result.violations.map(v => v.id)).toEqual([]);
  });
});
