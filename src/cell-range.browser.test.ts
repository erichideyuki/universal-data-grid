/**
 * Frente 19: intervalo de células — gestos de teclado e ponteiro, ARIA,
 * anúncios, convivência com a seleção de linhas (05), copiar (12) e colar
 * (09), resumo, métodos, limpeza por mudança de linhas/colunas,
 * virtualização, RTL e axe.
 */
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

import type { GridColumnDef } from './grid-column-def.js';
import type {
  DataGrid,
  GridCellRangeChangeEventDetail,
  GridCopyEventDetail,
  GridPasteEventDetail,
  GridSavingEventDetail,
} from './grid.js';
import { cleanup, createGrid, dataRows, settle } from './test/fixture.js';

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
  await commands.emulateMedia({ forcedColors: null });
});

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
  { name: '=1+1', city: 'Natal', age: 50 },
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'city', label: 'City' },
  { path: 'age', label: 'Age', dataType: 'number' },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const table = (grid: DataGrid): HTMLTableElement => root(grid).querySelector('table')!;
const focused = (grid: DataGrid): HTMLElement | null => root(grid).activeElement as HTMLElement | null;

/** Célula de dados (linha visível `row`, coluna `col` 0-based entre as de dados). */
const cell = (grid: DataGrid, row: number, col: number): HTMLElement =>
  dataRows(grid)[row].querySelectorAll<HTMLElement>('td[data-col]:not(.selection-cell):not(.command-cell)')[col];

const press = async (grid: DataGrid, key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> => {
  const target = focused(grid) ?? table(grid).querySelector<HTMLElement>('[tabindex="0"]')!;
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  await settle(grid);
  return event;
};

/** Texto das células com `aria-selected="true"`, por linha. */
const selectedTexts = (grid: DataGrid): string[][] =>
  dataRows(grid)
    .map(tr => [...tr.querySelectorAll('td[aria-selected="true"]')].map(td => td.textContent.trim()))
    .filter(row => row.length);

const centerOf = (element: Element): { clientX: number; clientY: number } => {
  const box = element.getBoundingClientRect();
  return { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
};

const pointer = (type: string, target: Element, at: Element, init: PointerEventInit = {}): PointerEvent => {
  const event = new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'mouse',
    button: type === 'pointermove' ? -1 : 0,
    buttons: type === 'pointerup' ? 0 : 1,
    ...centerOf(at),
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

/** Arrasto de `from` até `to` (o `pointerdown` também foca a célula, como o navegador). */
const drag = async (grid: DataGrid, from: HTMLElement, to: HTMLElement, init: PointerEventInit = {}): Promise<void> => {
  pointer('pointerdown', from, from, init);
  from.focus();
  pointer('pointermove', table(grid), to, init);
  await settle(grid);
  pointer('pointerup', table(grid), to, init);
  to.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, ...init }));
  await settle(grid);
};

const click = async (grid: DataGrid, target: HTMLElement, init: PointerEventInit = {}): Promise<void> => {
  const down = pointer('pointerdown', target, target, init);

  if (!down.defaultPrevented) {
    target.focus();
  }

  pointer('pointerup', table(grid), target, init);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, ...init }));
  await settle(grid);
};

const announcement = (grid: DataGrid): string =>
  root(grid).querySelector('.visually-hidden[role=status]')!.textContent;

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const create = (configure?: (grid: DataGrid) => void, items = people()): Promise<DataGrid> =>
  createGrid({
    columns: columns(),
    items,
    configure: grid => {
      grid.cellSelectionMode = 'multiple';
      configure?.(grid);
    },
  });

const copyFrom = (target: HTMLElement): { text: string; html: string; prevented: boolean } => {
  const clipboardData = new DataTransfer();
  const event = new ClipboardEvent('copy', { clipboardData, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return { text: clipboardData.getData('text/plain'), html: clipboardData.getData('text/html'), prevented: event.defaultPrevented };
};

const pasteInto = async (grid: DataGrid, target: HTMLElement, text: string): Promise<boolean> => {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', text);
  const event = new ClipboardEvent('paste', { clipboardData, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  await settle(grid);
  return event.defaultPrevented;
};

describe('teclado', () => {
  it('Shift+setas estendem; o foco vai ao canto que anda; aria-selected nas células', async () => {
    const grid = await create();
    const events: GridCellRangeChangeEventDetail[] = [];
    grid.addEventListener('u-grid-cell-range-change', event => events.push(event.detail));

    cell(grid, 0, 0).focus();
    await press(grid, 'ArrowDown', { shiftKey: true });
    await press(grid, 'ArrowRight', { shiftKey: true });

    expect(selectedTexts(grid)).toEqual([['Ana', 'Rio'], ['Bia', 'SP']]);
    expect(focused(grid)?.textContent.trim()).toBe('SP');
    expect(table(grid).getAttribute('aria-multiselectable')).toBe('true');
    expect(cell(grid, 2, 0).hasAttribute('aria-selected')).toBe(false);
    expect(cell(grid, 0, 0).getAttribute('part')).toBe('cell selected');
    expect(events.length).toBe(2);
    expect(events[1]).toMatchObject({ source: 'user' });
    expect(events[1].ranges).toEqual([{ startRowIndex: 0, endRowIndex: 1, startColumn: grid.columns[0], endColumn: grid.columns[1] }]);
    expect(Object.isFrozen(events[1].ranges[0])).toBe(true);

    // Anúncio só depois da pausa, com palavras (sem "×").
    expect(announcement(grid)).not.toContain('Selected cells');
    await wait(600);
    expect(announcement(grid)).toContain('Selected cells: 4. Rows: 2, columns: 2');

    // Seta sem Shift: anda e desfaz.
    await press(grid, 'ArrowDown');
    expect(selectedTexts(grid)).toEqual([]);
    expect(grid.getCellRanges()).toEqual([]);
  });

  it('Ctrl+Shift+setas, Shift+Home/End, Ctrl+Shift+End e Shift+PageDown', async () => {
    const grid = await create();
    cell(grid, 1, 1).focus();

    await press(grid, 'ArrowDown', { shiftKey: true, ctrlKey: true });
    expect(grid.getCellRanges()[0]).toMatchObject({ startRowIndex: 1, endRowIndex: 4 });

    await press(grid, 'End', { shiftKey: true });
    expect(grid.getCellRanges()[0]).toMatchObject({ endColumn: grid.columns[2] });

    await press(grid, 'Home', { shiftKey: true });
    expect(grid.getCellRanges()[0]).toMatchObject({ startColumn: grid.columns[1], endColumn: grid.columns[0] });

    await press(grid, 'Home', { shiftKey: true, ctrlKey: true });
    expect(grid.getCellRanges()[0]).toMatchObject({ startRowIndex: 1, endRowIndex: 0, endColumn: grid.columns[0] });

    await press(grid, 'End', { shiftKey: true, ctrlKey: true });
    expect(grid.getCellRanges()[0]).toMatchObject({ endRowIndex: 4, endColumn: grid.columns[2] });
    expect(focused(grid)?.textContent.trim()).toBe('50');

    await press(grid, 'PageUp', { shiftKey: true });
    expect(grid.getCellRanges()[0].endRowIndex).toBe(0);
  });

  it('Ctrl+A seleciona todas as células sem mover a ativa; o próximo Shift+seta recomeça nela', async () => {
    const grid = await create();
    cell(grid, 2, 1).focus();

    await press(grid, 'a', { ctrlKey: true });
    expect(selectedTexts(grid).flat().length).toBe(15);
    expect(focused(grid)?.textContent.trim()).toBe('Rio');

    await press(grid, 'ArrowRight', { shiftKey: true });
    expect(grid.getCellRanges()).toEqual([{ startRowIndex: 2, endRowIndex: 2, startColumn: grid.columns[1], endColumn: grid.columns[2] }]);
  });

  it('Shift+F8 adiciona intervalos pelo teclado (visível e anunciado); Esc desliga', async () => {
    const grid = await create();
    cell(grid, 0, 0).focus();
    await press(grid, 'ArrowDown', { shiftKey: true });

    await press(grid, 'F8', { shiftKey: true });
    expect(announcement(grid)).toContain('Adding to selection');
    expect(root(grid).querySelector('.cell-range-adding')?.textContent).toBe('Adding to selection');

    await press(grid, 'ArrowRight');
    await press(grid, 'ArrowRight');
    await press(grid, 'ArrowDown', { shiftKey: true });

    expect(grid.getCellRanges().map(range => [range.startRowIndex, range.endRowIndex, range.startColumn.path])).toEqual([
      [0, 1, 'name'],
      [1, 2, 'age'],
    ]);

    await wait(600);
    expect(announcement(grid)).toContain('Selected ranges: 2. Cells: 4');

    await press(grid, 'Escape');
    expect(announcement(grid)).toContain('Stopped adding to selection');
    expect(root(grid).querySelector('.cell-range-adding')).toBeNull();
  });

  it('RTL: Shift+← estende para a coluna seguinte', async () => {
    const grid = await create(g => g.setAttribute('dir', 'rtl'));
    cell(grid, 0, 0).focus();

    await press(grid, 'ArrowLeft', { shiftKey: true });
    expect(selectedTexts(grid)).toEqual([['Ana', 'Rio']]);
  });
});

describe('ponteiro', () => {
  it('arrasto seleciona o retângulo; o evento sai ao soltar; o foco fica no fim', async () => {
    const grid = await create();
    const events: GridCellRangeChangeEventDetail[] = [];
    grid.addEventListener('u-grid-cell-range-change', event => events.push(event.detail));

    await drag(grid, cell(grid, 0, 0), cell(grid, 2, 1));

    expect(selectedTexts(grid)).toEqual([['Ana', 'Rio'], ['Bia', 'SP'], ['Caio', 'Rio']]);
    expect(events.length).toBe(1);
    expect(focused(grid)?.textContent.trim()).toBe('Rio');
    expect(grid._memoryStats.rangeDrag).toBe(0);
  });

  it('Shift+clique estende da âncora; Ctrl+clique soma intervalos', async () => {
    const grid = await create();

    await click(grid, cell(grid, 0, 0));
    await click(grid, cell(grid, 1, 2), { shiftKey: true });
    expect(selectedTexts(grid)).toEqual([['Ana', 'Rio', '30'], ['Bia', 'SP', '25']]);
    expect(focused(grid)?.textContent.trim()).toBe('25');

    await click(grid, cell(grid, 3, 0), { ctrlKey: true });
    expect(grid.getCellRanges().length).toBe(2);
    expect(cell(grid, 3, 0).getAttribute('aria-selected')).toBe('true');

    // Clique simples desfaz.
    await click(grid, cell(grid, 4, 1));
    expect(grid.getCellRanges()).toEqual([]);
  });

  it('com a seleção de linhas ligada, o clique na célula não seleciona a linha', async () => {
    const grid = await create(g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
    });

    await click(grid, cell(grid, 0, 0));
    expect(grid.selectedKeys).toEqual([]);

    // Shift+↓ na coluna de caixas segue a 05 (linhas).
    const checkbox = dataRows(grid)[0].querySelector<HTMLElement>('.selection-cell')!;
    checkbox.focus();
    await press(grid, ' ');
    await press(grid, 'ArrowDown', { shiftKey: true });
    expect(grid.selectedKeys.length).toBe(2);
    expect(grid.getCellRanges()).toEqual([]);
  });
});

describe('copiar e colar', () => {
  it('copia os intervalos empilhados com a proteção contra fórmula; anuncia a contagem', async () => {
    const grid = await create();
    let detail: GridCopyEventDetail | undefined;
    grid.addEventListener('u-grid-copying', event => {
      detail = event.detail;
    });

    grid.selectCellRange({ startRowIndex: 3, endRowIndex: 4, startColumn: 'name', endColumn: 'city' });
    grid.selectCellRange({ startRowIndex: 0, endRowIndex: 0, startColumn: 'age', endColumn: 'age' }, { append: true });
    await settle(grid);

    const copied = copyFrom(cell(grid, 3, 0));

    expect(copied.prevented).toBe(true);
    expect(copied.text).toBe('Duda\tBH\r\n\'=1+1\tNatal\r\n30');
    expect(copied.html).toContain('mso-number-format');
    expect(detail?.ranges.length).toBe(2);
    expect(detail?.items).toEqual([grid.items[0], grid.items[3], grid.items[4]]);
    expect(detail?.columns).toEqual(grid.columns);
    await settle(grid);
    expect(announcement(grid)).toBe('Copied cells: 5');
  });

  it('com linhas selecionadas e sem intervalo, copia as linhas (regra da 12)', async () => {
    const grid = await create(g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
    });
    grid.selectRows([grid.items[1]]);
    await settle(grid);

    expect(copyFrom(cell(grid, 0, 0)).text).toBe('Bia\tSP\t25');
  });

  it('cola em lote: mosaico, conversão no idioma, validação; o ouvinte pode transformar values', async () => {
    const grid = await create(g => {
      g.allowEditing = true;
      g.editMode = 'batch';
      g.clipboardMode = 'copy-paste';
    });
    const events: GridPasteEventDetail[] = [];
    grid.addEventListener('u-grid-pasting', event => {
      events.push(event.detail);
      event.detail.values[0][0] = event.detail.values[0][0].toUpperCase();
    });

    grid.selectCellRange({ startRowIndex: 0, endRowIndex: 3, startColumn: 'city', endColumn: 'age' });
    await settle(grid);

    expect(await pasteInto(grid, cell(grid, 3, 2), 'x\t1,234\ny\t\'=2')).toBe(true);
    expect(events[0].range).toMatchObject({ startRowIndex: 0, endRowIndex: 3 });
    expect(grid.getChanges().map(change => change.data)).toEqual([
      { city: 'X', age: 1234 },
      { city: 'y' },
      { city: 'X', age: 1234 },
      { city: 'y' },
    ]);
    // `'=2` virou `=2`: texto que não é número na coluna numérica fica pendente inválido.
    expect(dataRows(grid)[1].querySelectorAll('td.invalid').length).toBe(1);
    expect(announcement(grid)).toBe('Pasted cells: 8');
  });

  it('cola no modo célula: salva de uma vez; cancelado não muda nada; sem copy-paste não cola', async () => {
    const grid = await create(g => {
      g.allowEditing = true;
      g.clipboardMode = 'copy-paste';
    });
    const saving: GridSavingEventDetail[] = [];
    grid.addEventListener('u-grid-saving', event => saving.push(event.detail));

    const cancel = (event: Event) => event.preventDefault();
    grid.addEventListener('u-grid-pasting', cancel);
    expect(await pasteInto(grid, cell(grid, 0, 1), 'Recife')).toBe(false);
    expect(grid.hasChanges()).toBe(false);
    grid.removeEventListener('u-grid-pasting', cancel);

    await pasteInto(grid, cell(grid, 0, 1), 'Recife\nSalvador');
    await settle(grid);
    expect(saving.length).toBe(1);
    expect(saving[0].changes.length).toBe(2);
    expect((grid.items as Person[]).slice(0, 2).map(item => item.city)).toEqual(['Recife', 'Salvador']);

    grid.clipboardMode = 'copy';
    await settle(grid);
    expect(await pasteInto(grid, cell(grid, 0, 1), 'X')).toBe(false);
  });
});

describe('estado e métodos', () => {
  it('selectCellRange/getCellRanges/clearCellRanges e getRowIndex/getRowKey', async () => {
    const grid = await create(g => {
      g.keyExpr = 'name';
    });

    expect(grid.selectCellRange({ startRowIndex: 0, endRowIndex: 0, startColumn: 'name', endColumn: 'name' })).toBe(false);
    expect(grid.selectCellRange({ startRowIndex: 0, endRowIndex: 9, startColumn: 'name', endColumn: 'age' })).toBe(false);
    expect(grid.selectCellRange({ startRowIndex: 0, endRowIndex: 1, startColumn: 'nope', endColumn: 'age' })).toBe(false);
    expect(grid.selectCellRange({ startRowIndex: grid.getRowIndex('Bia'), endRowIndex: 2, startColumn: 'name', endColumn: grid.columns[2] })).toBe(true);
    expect(grid.focusedRowKey).toBe('Caio');
    expect(grid.getRowKey(1)).toBe('Bia');
    expect(grid.getRowKey(99)).toBeUndefined();

    await settle(grid);
    const summary = await grid.getCellRangeSummary();
    expect(summary).toEqual({ count: 6, numericCount: 2, sum: 66, avg: 33, complete: true });

    grid.clearCellRanges();
    expect(grid.getCellRanges()).toEqual([]);
  });

  it('ordenar limpa os intervalos (evento com a origem da causa); trocar items do mesmo tamanho mantém', async () => {
    const grid = await create();
    const events: GridCellRangeChangeEventDetail[] = [];
    grid.addEventListener('u-grid-cell-range-change', event => events.push(event.detail));

    grid.selectCellRange({ startRowIndex: 0, endRowIndex: 1, startColumn: 'name', endColumn: 'city' });
    await settle(grid);

    grid.items = people().map(person => ({ ...person }));
    await settle(grid);
    expect(grid.getCellRanges().length).toBe(1);

    root(grid).querySelector<HTMLElement>('th.header-column')!.click();
    await settle(grid);
    expect(grid.getCellRanges()).toEqual([]);
    expect(events.at(-1)).toMatchObject({ ranges: [], source: 'user' });

    grid.selectCellRange({ startRowIndex: 0, endRowIndex: 1, startColumn: 'name', endColumn: 'city' });
    grid.cellSelectionMode = 'none';
    await settle(grid);
    expect(grid.getCellRanges()).toEqual([]);
    expect(events.at(-1)).toMatchObject({ source: 'api' });
    expect(table(grid).hasAttribute('aria-multiselectable')).toBe(false);
  });

  it('resumo na barra (role=status, depois da pausa)', async () => {
    const grid = await create(g => {
      g.showCellRangeSummary = true;
      g.language = 'pt';
    });
    const status = root(grid).querySelector('.cell-range-summary')!;
    expect(status.getAttribute('role')).toBe('status');

    grid.selectCellRange({ startRowIndex: 0, endRowIndex: 4, startColumn: 'city', endColumn: 'age' });
    await settle(grid);
    expect(status.textContent).toBe('');
    await wait(700);
    await settle(grid);
    expect(status.textContent).toContain('165');
    expect(status.textContent).toContain('33');
  });
});

describe('virtualização, fixas e bandas', () => {
  it('intervalo de 10 mil linhas: só as renderizadas recebem marca; rola e continua marcado', async () => {
    const items = Array.from({ length: 10_000 }, (_, index) => ({ name: `n${index}`, city: `c${index}`, age: index }));
    const grid = await create(undefined, items);

    cell(grid, 0, 0).focus();
    await press(grid, 'a', { ctrlKey: true });
    expect(root(grid).querySelectorAll('td[aria-selected="true"]').length).toBeLessThan(400);

    await press(grid, 'End', { ctrlKey: true });
    // Ctrl+End sem Shift desfaz (anda).
    expect(grid.getCellRanges()).toEqual([]);

    await press(grid, 'Home', { ctrlKey: true, shiftKey: true });
    expect(grid.getCellRanges()[0]).toMatchObject({ startRowIndex: 9_999, endRowIndex: 0 });
    expect(selectedTexts(grid)[0][0]).toBe('n0');
  });

  it('atravessa colunas fixas e bandas na ordem de exibição', async () => {
    const grid = await createGrid({
      items: people(),
      columns: [
        { path: 'age', label: 'Age', fixed: 'end' },
        { label: 'Person', columns: [{ path: 'name', label: 'Name' }, { path: 'city', label: 'City' }] },
      ],
      configure: g => {
        g.cellSelectionMode = 'single';
      },
    });

    cell(grid, 0, 0).focus();
    await press(grid, 'End', { shiftKey: true });
    expect(selectedTexts(grid)).toEqual([['Ana', 'Rio', '30']]);
    expect(grid.getCellRanges()[0].endColumn.path).toBe('age');
  });
});

describe('acessibilidade', () => {
  it('axe sem violações com intervalo (LTR, RTL, com seleção de linhas e barra)', async () => {
    const grid = await create(g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
      g.showCellRangeSummary = true;
    });
    grid.selectRows([grid.items[0]]);
    grid.selectCellRange({ startRowIndex: 0, endRowIndex: 2, startColumn: 'name', endColumn: 'age' });
    await settle(grid);
    cell(grid, 2, 2).focus();

    expect((await axe.run(grid, { resultTypes: ['violations'] })).violations.map(v => v.id)).toEqual([]);

    grid.setAttribute('dir', 'rtl');
    await settle(grid);
    expect((await axe.run(grid, { resultTypes: ['violations'] })).violations.map(v => v.id)).toEqual([]);
  });

  it('anel de foco distinto do contorno: faixa clara entre eles', async () => {
    const grid = await create();
    cell(grid, 0, 0).focus();
    await press(grid, 'ArrowDown', { shiftKey: true });

    const active = focused(grid)!;
    const style = getComputedStyle(active);
    expect(active.matches(':focus-visible')).toBe(true);
    expect(style.boxShadow).toContain('255, 255, 255');
    expect(getComputedStyle(active, '::before').insetBlockStart).toBe('4px');
  });

  it('forced-colors: contorno Highlight (HighlightText na linha selecionada), anel CanvasText', async () => {
    const grid = await create(g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
    });
    grid.selectRows([grid.items[0]]);
    grid.selectCellRange({ startRowIndex: 0, endRowIndex: 1, startColumn: 'name', endColumn: 'city' });
    await settle(grid);
    await commands.emulateMedia({ forcedColors: 'active' });

    const probe = document.createElement('span');
    document.body.append(probe);

    const systemColor = (color: string): string => {
      probe.style.color = color;
      return getComputedStyle(probe).color;
    };

    const plain = getComputedStyle(cell(grid, 1, 0), '::before');
    const selectedRow = getComputedStyle(cell(grid, 0, 0), '::before');

    expect(plain.borderTopStyle === 'none' ? plain.borderBottomColor : plain.borderInlineStartColor).toBe(systemColor('Highlight'));
    expect(selectedRow.borderInlineStartColor).toBe(systemColor('HighlightText'));

    cell(grid, 1, 1).focus();
    await press(grid, 'ArrowUp', { shiftKey: true });
    const active = focused(grid)!;
    expect(getComputedStyle(active).outlineColor).toBe(systemColor('CanvasText'));
    probe.remove();
  });
});
