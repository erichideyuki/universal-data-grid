/**
 * Spec 17 — auditoria de acessibilidade (WCAG 2.2 AA + APG "Data Grid").
 * Um teste por correção sem mudança de API, todos falhavam antes dela:
 * foco que some com a linha/chip, foco coberto pelo rodapé de totais,
 * teclas do cabeçalho no rodapé, F2 até a alça, nome do cabeçalho,
 * seletor de colunas, anúncios, níveis do treegrid, `lang`, contraste,
 * `forced-colors` e `prefers-reduced-motion`.
 */
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { commands, userEvent } from 'vitest/browser';

import { SYNC_FILTER_LIMIT } from './features/filtering.js';
import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
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
  await commands.emulateMedia({ forcedColors: null, reducedMotion: null });
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
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'city', label: 'City' },
  { path: 'age', label: 'Age' },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const focused = (grid: DataGrid): HTMLElement | null => root(grid).activeElement as HTMLElement | null;
const liveRegion = (grid: DataGrid): HTMLElement => root(grid).querySelector<HTMLElement>('[role=status]')!;
const headerCell = (grid: DataGrid, label: string): HTMLElement =>
  [...root(grid).querySelectorAll<HTMLElement>('th.header-column')].find(th => th.querySelector('.header-text')!.textContent === label)!;
const cellOf = (grid: DataGrid, text: string): HTMLElement =>
  [...root(grid).querySelectorAll<HTMLElement>('td[role=gridcell]')].find(td => td.textContent.trim() === text)!;

const press = async (grid: DataGrid, key: string, init: KeyboardEventInit = {}): Promise<void> => {
  const target = focused(grid) ?? root(grid).querySelector<HTMLElement>('table [tabindex="0"]')!;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

// ------------------------------------------------------------- contraste

type Rgba = [number, number, number, number];

const parseColor = (value: string): Rgba => {
  // Normaliza qualquer cor CSS (color-mix, system colors) pelo canvas 2D.
  const context = document.createElement('canvas').getContext('2d')!;
  context.fillStyle = '#000';
  context.fillStyle = value;
  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
};

const over = ([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba =>
  [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];

const luminance = ([r, g, b]: Rgba): number => {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a: Rgba, b: Rgba): number => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const WHITE: Rgba = [255, 255, 255, 1];

/** Cor que a palavra-chave do sistema tem neste navegador (para comparar com o computado). */
const systemColor = (keyword: string): string => {
  const probe = document.createElement('div');
  probe.style.color = keyword;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
};

// ----------------------------------------------------------------- foco

describe('foco não se perde (WCAG 2.4.3)', () => {
  it('filterValue por API tira a linha focada: o foco vai à célula ativa realocada', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    cellOf(grid, 'Caio').focus();
    await settle(grid);

    grid.filterValue = ['name', '<>', 'Caio'];
    await settle(grid);

    const active = focused(grid);
    expect(active?.matches('td[role=gridcell][tabindex="0"]')).toBe(true);
  });

  it('desagrupar pelo teclado sem cabeçalho de colunas não deixa o foco no <body>', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, { path: 'name', label: 'Name' }],
      items: people(),
      configure: g => g.showColumnHeaders = false,
    });
    const chip = root(grid).querySelector<HTMLElement>('.group')!;
    chip.focus();

    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true, cancelable: true }));
    await settle(grid);

    expect(focused(grid)).not.toBeNull();
  });

  it('menu do painel aberto na área vazia: Esc devolve o foco ao chip ativo', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, ...columns().filter(c => c.path !== 'city')],
      items: people(),
    });
    const panel = root(grid).querySelector<HTMLElement>('.group-container')!;
    panel.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 300, clientY: 20 }));
    await settle(grid);

    const item = root(grid).querySelector<HTMLElement>('.group-panel-menu [role=menuitem]')!;
    expect(focused(grid)).toBe(item);
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
    await settle(grid);

    expect(focused(grid)?.classList.contains('group')).toBe(true);
  });

  it('clique no botão de expandir do grupo: o foco vai à célula do grupo e as setas seguem', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, ...columns().filter(c => c.path !== 'city')],
      items: people(),
    });
    const toggle = root(grid).querySelector<HTMLElement>('button.group-toggle')!;
    await userEvent.click(toggle);
    await settle(grid);

    expect(focused(grid)?.classList.contains('grouping-cell')).toBe(true);

    await press(grid, 'ArrowDown');
    expect(focused(grid)?.matches('td[data-col]')).toBe(true);
  });

  it('seletor de colunas: fixar no início mantém o foco no mesmo botão', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.columnChooser = true });
    root(grid).querySelector<HTMLElement>('.column-chooser-button')!.click();
    await settle(grid);

    const pin = root(grid).querySelectorAll<HTMLElement>('.column-chooser-item')[2].querySelector<HTMLElement>('.pin-start')!;
    pin.focus();
    pin.click();
    await settle(grid);

    const active = focused(grid);
    expect(active?.classList.contains('pin-start')).toBe(true);
    expect(active?.getAttribute('aria-pressed')).toBe('true');
    expect(active?.getAttribute('aria-describedby')).toBe(pin.getAttribute('aria-describedby'));
  });

  it('seletor de colunas: Tab para fora do painel fecha (não fica aberto atrás do foco)', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.columnChooser = true });
    const after = document.createElement('button');
    after.textContent = 'after';
    document.body.append(after);

    root(grid).querySelector<HTMLElement>('.column-chooser-button')!.click();
    await settle(grid);
    const controls = root(grid).querySelectorAll<HTMLElement>('.column-chooser button');
    controls[controls.length - 1].focus();

    await userEvent.tab();
    await settle(grid);
    after.remove();

    expect(root(grid).querySelector('.column-chooser')).toBeNull();
  });
});

describe('foco não obscurecido (WCAG 2.4.11)', () => {
  it('com rodapé de totais, ↓ até o fim deixa a célula focada acima do rodapé', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ name: `P${i}`, city: 'Rio', age: i }));
    const grid = await createGrid({
      columns: columns(),
      items,
      height: '300px',
      configure: g => g.summary = { total: [{ column: 'age', type: 'sum' }, { column: 'age', type: 'avg' }, { column: 'age', type: 'max' }] },
    });
    cellOf(grid, 'P0').focus();

    for (let i = 0; i < 8; i++) {
      await press(grid, 'ArrowDown');
    }

    const cell = focused(grid)!.getBoundingClientRect();
    const footer = root(grid).querySelector('tfoot')!.getBoundingClientRect();
    expect(cell.bottom).toBeLessThanOrEqual(footer.top + 1);
  });
});

// --------------------------------------------------------------- teclado

describe('teclado', () => {
  it('teclas do cabeçalho não valem no rodapé de totais (Espaço na caixa não seleciona tudo)', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: people(),
      configure: g => {
        g.selectionMode = 'multiple';
        g.showCheckboxes = true;
        g.summary = { total: [{ column: 'age', type: 'sum' }] };
      },
    });
    const footerBox = root(grid).querySelector<HTMLElement>('tfoot td[data-col="0"]')!;
    footerBox.focus();
    await press(grid, ' ');

    expect(grid.selectedKeys).toEqual([]);

    root(grid).querySelector<HTMLElement>('tfoot td[data-col="1"]')!.focus();
    await press(grid, 'g', { ctrlKey: true });
    expect(grid.columns.some(c => c.groupIndex !== undefined)).toBe(false);
    expect(root(grid).querySelector('.group')).toBeNull();
  });

  it('F2 percorre funil → alça → célula no cabeçalho (spec 05)', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.headerFilter = true;
      g.columnResizing = true;
    } });
    const th = headerCell(grid, 'City');
    th.focus();

    await press(grid, 'F2');
    expect(focused(grid)?.classList.contains('header-filter-button')).toBe(true);
    await press(grid, 'F2');
    expect(focused(grid)?.classList.contains('resize-handle')).toBe(true);
    await press(grid, 'F2');
    expect(focused(grid)).toBe(th);
  });
});

// ------------------------------------------------------------ ARIA/nomes

describe('ARIA e nomes', () => {
  it('nome do cabeçalho é só o rótulo (sem o da alça e do funil)', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.headerFilter = true;
      g.columnResizing = true;
    } });
    const th = headerCell(grid, 'City');
    const ids = th.getAttribute('aria-labelledby')?.split(' ') ?? [];

    expect(ids.map(id => root(grid).getElementById(id)?.textContent).join(' ')).toBe('City');
  });

  it('treegrid: linhas de dados e rodapés de grupo têm aria-level abaixo do grupo', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, ...columns().filter(c => c.path !== 'city')],
      items: people(),
      configure: g => {
        g.autoExpandGroups = true;
        g.summary = { group: [{ column: 'age', type: 'sum', display: 'footer' }] };
      },
    });

    expect(root(grid).querySelector('table')!.getAttribute('role')).toBe('treegrid');
    expect(root(grid).querySelector('tr.group-row')!.getAttribute('aria-level')).toBe('1');
    expect(dataRows(grid).map(tr => tr.getAttribute('aria-level'))).toEqual(dataRows(grid).map(() => '2'));
    expect(root(grid).querySelector('tr.group-footer-row')!.getAttribute('aria-level')).toBe('2');

    const result = await axe.run(grid, { resultTypes: ['violations'] });
    expect(result.violations.map(v => v.id)).toEqual([]);
  });

  it('aria-busy no grid enquanto o filtro corre em fatias', async () => {
    const items = Array.from({ length: SYNC_FILTER_LIMIT + 50_000 }, (_, i) => ({ name: `P${i}`, city: i % 2 ? 'Rio' : 'SP', age: i }));
    const grid = await createGrid({ columns: columns(), items, height: '300px' });
    const table = root(grid).querySelector('table')!;

    // O 1º filtro sobre itens novos é síncrono; o seguinte corre em fatias.
    grid.searchText = 'Rio';
    await settle(grid);
    grid.searchText = 'SP';

    // Só o render (microtarefa) roda: as fatias seguem por MessageChannel.
    for (let i = 0; i < 3; i++) {
      await Promise.resolve();
    }

    expect(table.getAttribute('aria-busy')).toBe('true');

    await settle(grid);
    expect(table.hasAttribute('aria-busy')).toBe(false);
  });

  it('clone do arrasto fica fora da árvore de acessibilidade', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    const th = headerCell(grid, 'Name');
    const rect = th.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const pointer = (type: string, target: EventTarget, px: number) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, cancelable: true, clientX: px, clientY: y,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    }));

    pointer('pointerdown', th, x);
    pointer('pointermove', th, x + 5);
    pointer('pointermove', document, x + 30);
    await new Promise(resolve => requestAnimationFrame(resolve));

    const ghost = root(grid).querySelector<HTMLElement>('.move-container');
    pointer('pointerup', document, x + 30);
    await settle(grid);

    expect(ghost).not.toBeNull();
    expect(ghost!.getAttribute('aria-hidden')).toBe('true');
    expect(ghost!.querySelector('[tabindex]') ?? (ghost!.firstElementChild!.hasAttribute('tabindex') ? ghost : null)).toBeNull();
  });

  it('textos da interface levam o lang da tradução quando difere da página (WCAG 3.1.2)', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, ...columns().filter(c => c.path !== 'city')],
      items: people(),
      configure: g => {
        g.language = 'ar';
        g.showSearchPanel = true;
      },
    });

    expect(liveRegion(grid).getAttribute('lang')).toBe('ar');
    expect(root(grid).querySelector('.search-panel')!.closest('[lang]')!.getAttribute('lang')).toBe('ar');

    root(grid).querySelector('.group')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 10, clientY: 10 }));
    await settle(grid);
    expect(root(grid).querySelector('.group-panel-menu')!.closest('[lang]')!.getAttribute('lang')).toBe('ar');
  });
});

// ---------------------------------------------------------------- anúncios

describe('anúncios (WCAG 4.1.3)', () => {
  it('Ctrl+G numa coluna não agrupável não anuncia "agrupado"', async () => {
    const grid = await createGrid({
      columns: [{ path: 'name', label: 'Name', groupable: false }, { path: 'city', label: 'City' }],
      items: people(),
      configure: g => g.language = 'en',
    });
    headerCell(grid, 'Name').focus();
    await press(grid, 'g', { ctrlKey: true });

    expect(liveRegion(grid).textContent).toBe('');
  });

  it('o mesmo texto anunciado de novo muda a região (é relido)', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.language = 'en';
      g.showSearchPanel = true;
    } });
    const input = root(grid).querySelector<HTMLInputElement>('.search-input')!;

    const search = async (text: string) => {
      await userEvent.fill(input, text);
      await new Promise(resolve => setTimeout(resolve, 400));
      await settle(grid);
      return liveRegion(grid).textContent;
    };

    // "Ca" e "Cai" deixam a mesma linha (Caio): a mesma contagem duas vezes.
    const first = await search('Ca');
    const second = await search('Cai');

    expect(first).not.toBe('');
    expect(second.trim()).toBe(first.trim());
    expect(second).not.toBe(first);
  });

  it('Espaço alterna uma linha e anuncia a contagem (o aria-selected do <tr> não é lido)', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.language = 'en';
      g.selectionMode = 'multiple';
    } });
    cellOf(grid, 'Bia').focus();
    await press(grid, ' ');

    expect(liveRegion(grid).textContent).toContain('1');
  });
});

// --------------------------------------------------------- estilo e modos

describe('contraste dos padrões (WCAG 1.4.3, 1.4.11)', () => {
  it('placeholder da busca ≥ 4,5:1 sobre o fundo do campo', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showSearchPanel = true });
    const input = root(grid).querySelector<HTMLInputElement>('.search-input')!;
    const panel = root(grid).querySelector<HTMLElement>('.search-panel')!;
    const background = over(parseColor(getComputedStyle(panel).backgroundColor), WHITE);
    const placeholder = getComputedStyle(input, '::placeholder');
    const color = parseColor(placeholder.color);
    const text = over([color[0], color[1], color[2], color[3] * Number(placeholder.opacity || 1)], background);

    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('limite do editor da linha de filtro ≥ 3:1 contra o fundo', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showFilterRow = true });
    const editor = root(grid).querySelector<HTMLElement>('.filter-editor')!;
    const border = over(parseColor(getComputedStyle(editor).borderBottomColor), WHITE);

    expect(contrast(border, WHITE)).toBeGreaterThanOrEqual(3);
  });
});

describe('forced-colors e prefers-reduced-motion', () => {
  it('em alto contraste a linha selecionada usa Highlight e as linhas da grade viram bordas', async () => {
    await commands.emulateMedia({ forcedColors: 'active' });
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.selectionMode = 'multiple';
      g.showRowLines = true;
    } });
    grid.selectRows([grid.items[1]]);
    await settle(grid);

    const selected = dataRows(grid).find(tr => tr.getAttribute('aria-selected') === 'true')!;
    expect(getComputedStyle(selected.cells[0]).backgroundColor).toBe(systemColor('Highlight'));
    expect(getComputedStyle(root(grid).querySelector('thead')!).borderBottomStyle).toBe('solid');
  });

  it('com movimento reduzido as transições somem', async () => {
    await commands.emulateMedia({ reducedMotion: 'reduce' });
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.columnResizing = true });
    const handle = root(grid).querySelector<HTMLElement>('.resize-handle')!;

    expect(getComputedStyle(handle, '::after').transitionDuration).toBe('0s');
  });
});
