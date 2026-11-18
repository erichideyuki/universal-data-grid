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
  [...root(grid).querySelectorAll<HTMLElement>('th.header-column, th.band-header')].find(th => th.querySelector('.header-text')!.textContent === label)!;
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
    expect(active?.getAttribute('aria-label')).toBe('Pin Age to start');
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

  it('F2 percorre funil → menu → alça → célula no cabeçalho (spec 05)', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.headerFilter = true;
      g.columnResizing = true;
    } });
    const th = headerCell(grid, 'City');
    th.focus();

    await press(grid, 'F2');
    expect(focused(grid)?.classList.contains('header-filter-button')).toBe(true);
    await press(grid, 'F2');
    expect(focused(grid)?.classList.contains('column-header-menu-button')).toBe(true);
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

// ------------------------------------------- aprovados pelo usuário (A1–A14)

describe('A8 — Ctrl+G na linha de grupo desagrupa', () => {
  it('sem painel de grupos, o agrupamento do Ctrl+G do cabeçalho tem volta', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.language = 'en';
      g.showGroupPanel = false;
    } });
    headerCell(grid, 'City').focus();
    await press(grid, 'g', { ctrlKey: true });
    expect(grid.getGrouping().map(c => c.path)).toEqual(['city']);

    root(grid).querySelector<HTMLElement>('.grouping-cell')!.focus();
    await press(grid, 'g', { ctrlKey: true });

    expect(grid.getGrouping()).toEqual([]);
    expect(liveRegion(grid).textContent).toContain('City');
    expect(focused(grid)).toBe(headerCell(grid, 'City'));
  });
});

describe('A11 — ↓/↑ no botão de operação', () => {
  it('abrem o menu no 1º/último item', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.showFilterRow = true });
    const button = root(grid).querySelector<HTMLElement>('.filter-operation-button')!;
    button.focus();

    await press(grid, 'ArrowDown');
    let items = [...root(grid).querySelectorAll<HTMLElement>('.filter-menu [role^=menuitem]')];
    expect(focused(grid)).toBe(items[0]);

    await press(grid, 'Escape');
    expect(focused(grid)).toBe(button);

    await press(grid, 'ArrowUp');
    items = [...root(grid).querySelectorAll<HTMLElement>('.filter-menu [role^=menuitem]')];
    expect(focused(grid)).toBe(items[items.length - 1]);
  });
});

describe('A12 — conteúdo interativo das células', () => {
  it('sai da ordem de Tab; Enter entra nele e Esc volta à célula', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'name', label: 'Name' },
        {
          label: 'Action',
          renderer: (item: Person) => {
            const button = document.createElement('button');
            button.textContent = `Open ${item.name}`;
            return button;
          },
        },
      ],
      items: people(),
    });
    await settle(grid);
    const buttons = [...grid.querySelectorAll('button')];

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every(button => button.getAttribute('tabindex') === '-1')).toBe(true);

    const cell = root(grid).querySelector<HTMLElement>('tbody td[data-col="1"]')!;
    cell.focus();
    await press(grid, 'Enter');
    expect(document.activeElement?.textContent).toBe('Open Ana');

    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
    await settle(grid);
    expect(focused(grid)).toBe(cell);
  });
});

describe('A9 — a barra reflui a 320 px', () => {
  it('quebra linha sem sobrepor e o cabeçalho prende abaixo dela', async () => {
    const host = document.createElement('div');
    host.style.width = '320px';
    document.body.append(host);
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, { path: 'name', label: 'Name', groupIndex: 1 }, { path: 'age', label: 'Age' }],
      items: people(),
      configure: g => {
        g.showSearchPanel = true;
        g.columnChooser = true;
      },
    });
    host.append(grid);
    await settle(grid);
    await new Promise(resolve => requestAnimationFrame(resolve));
    await settle(grid);

    const toolbar = root(grid).querySelector<HTMLElement>('.header')!;
    const parts = [...root(grid).querySelectorAll<HTMLElement>('.group, .search-panel, .column-chooser-button')].map(e => e.getBoundingClientRect());
    const overlaps = parts.some((a, i) => parts.some((b, j) => i < j && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
    const thead = root(grid).querySelector('thead')!.getBoundingClientRect();
    host.remove();

    expect(overlaps).toBe(false);
    expect(toolbar.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth + 1);
    expect(thead.top).toBeGreaterThanOrEqual(toolbar.getBoundingClientRect().bottom - 1);
  });
});

describe('A3 — alvo da alça de redimensionar', () => {
  it('tem 24 px e não cobre o rótulo do cabeçalho', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.columnResizing = true });
    const th = headerCell(grid, 'Name');
    const handle = th.querySelector<HTMLElement>('.resize-handle')!.getBoundingClientRect();
    const content = th.querySelector<HTMLElement>('.header-content')!.getBoundingClientRect();

    expect(handle.width).toBeGreaterThanOrEqual(24);
    expect(content.right).toBeLessThanOrEqual(handle.left + 0.5);
  });
});

describe('A2/A4 — seleção não só por cor; cor do texto própria', () => {
  it('linha selecionada tem barra no início (≥ 3:1 contra o fundo)', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.selectionMode = 'multiple' });
    grid.selectRows([grid.items[0]]);
    await settle(grid);

    const selected = dataRows(grid).find(tr => tr.getAttribute('aria-selected') === 'true')!;
    const shadow = getComputedStyle(selected.cells[0]).boxShadow;
    const color = shadow.match(/rgba?\([^)]*\)/)![0];
    expect(shadow).toMatch(/inset 3px 0px 0px 0px|rgb\([^)]*\) 3px 0px 0px 0px inset/);
    expect(contrast(over(parseColor(color), WHITE), WHITE)).toBeGreaterThanOrEqual(3);
  });

  it('não herda a cor do texto da página', async () => {
    document.body.style.color = 'rgb(240, 240, 240)';
    const grid = await createGrid({ columns: columns(), items: people() });
    const cell = cellOf(grid, 'Ana');
    const text = parseColor(getComputedStyle(cell).color);
    document.body.style.color = '';

    expect(contrast(text, WHITE)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('A1 — menu do cabeçalho (alternativa ao arrasto, WCAG 2.5.7)', () => {
  const menuItems = (grid: DataGrid) => [...root(grid).querySelectorAll<HTMLElement>('.column-header-menu [role=menuitem]')];
  const headerOrder = (grid: DataGrid) => [...root(grid).querySelectorAll('th.header-column .header-text')].map(e => e.textContent);

  const openByKey = async (grid: DataGrid, label: string) => {
    headerCell(grid, label).focus();
    await press(grid, 'F10', { shiftKey: true });
  };

  it('Shift+F10 abre; "Mover" respeita o limite; mover leva o foco junto e anuncia', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.language = 'en' });
    await openByKey(grid, 'Name');

    const labels = menuItems(grid).map(item => [item.textContent.trim(), item.getAttribute('aria-disabled')]);
    expect(labels).toEqual([['Group by this column', 'false'], ['Move left', 'true'], ['Move right', 'false']]);
    expect(focused(grid)).toBe(menuItems(grid)[0]);
    expect(root(grid).querySelector('.column-header-menu')!.getAttribute('aria-label')).toBe('Options for Name');

    await press(grid, 'ArrowDown');
    await press(grid, 'ArrowDown');
    expect(focused(grid)!.textContent.trim()).toBe('Move right');
    focused(grid)!.click();
    await settle(grid);

    expect(headerOrder(grid)).toEqual(['City', 'Name', 'Age']);
    expect(focused(grid)).toBe(headerCell(grid, 'Name'));
    expect(liveRegion(grid).textContent).toContain('Name moved to position 2 of 3');
  });

  it('RTL: "Mover para a esquerda" vai para o fim', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.language = 'en';
      g.setAttribute('dir', 'rtl');
    } });
    await openByKey(grid, 'Name');
    const left = menuItems(grid).find(item => item.textContent.trim() === 'Move left')!;

    expect(left.getAttribute('aria-disabled')).toBe('false');
    left.click();
    await settle(grid);
    expect(headerOrder(grid)).toEqual(['City', 'Name', 'Age']);
  });

  it('clique direito abre no ponto; Esc devolve o foco ao cabeçalho; "Agrupar" agrupa', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.language = 'en' });
    const th = headerCell(grid, 'City');
    const event = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 50, clientY: 50 });
    th.dispatchEvent(event);
    await settle(grid);

    expect(event.defaultPrevented).toBe(true);
    await press(grid, 'Escape');
    expect(focused(grid)).toBe(th);

    th.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 50, clientY: 50 }));
    await settle(grid);
    menuItems(grid)[0].click();
    await settle(grid);

    expect(grid.getGrouping().map(c => c.path)).toEqual(['city']);
    expect(focused(grid)).not.toBeNull();
  });

  it('sem ações para a coluna: menu do navegador, sem botão e sem Shift+F10', async () => {
    const grid = await createGrid({ columns: [{ path: 'name', label: 'Name', groupable: false }], items: people() });
    const th = headerCell(grid, 'Name');
    const event = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true });
    th.dispatchEvent(event);
    await settle(grid);

    expect(event.defaultPrevented).toBe(false);
    expect(th.querySelector('.column-header-menu-button')).toBeNull();
    // Coluna única: nem Alt+Shift (sem vizinha) — sem atributo.
    expect(th.getAttribute('aria-keyshortcuts') ?? '').not.toContain('Shift+F10');
  });

  it('botão abre o menu; com column-resizing, largura por clique sem arrasto', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.language = 'en';
      g.columnResizing = true;
    } });
    const button = headerCell(grid, 'Age').querySelector<HTMLElement>('.column-header-menu-button')!;
    const before = headerCell(grid, 'Age').getBoundingClientRect().width;

    expect(button.getAttribute('aria-label')).toBe('Options for Age');
    button.click();
    await settle(grid);
    const wider = menuItems(grid).find(item => item.textContent.trim() === 'Increase width')!;
    wider.focus();
    wider.click();
    await settle(grid);

    expect(headerCell(grid, 'Age').getBoundingClientRect().width).toBeGreaterThan(before);
    expect(root(grid).querySelector('.column-header-menu')).not.toBeNull();
    expect(liveRegion(grid).textContent).toMatch(/^Age width: \d+ px/);

    const result = await axe.run(grid, { resultTypes: ['violations'] });
    expect(result.violations.map(v => v.id)).toEqual([]);
  });

  it('menu do chip: "Mover" muda o nível e anuncia', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, { path: 'name', label: 'Name', groupIndex: 1 }, { path: 'age', label: 'Age' }],
      items: people(),
      configure: g => g.language = 'en',
    });
    const chip = root(grid).querySelectorAll<HTMLElement>('.group')[0];
    chip.focus();
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, composed: true, cancelable: true }));
    await settle(grid);

    const right = [...root(grid).querySelectorAll<HTMLElement>('.group-panel-menu [role=menuitem]')].find(i => i.textContent.trim() === 'Move right')!;
    right.click();
    await settle(grid);

    expect(grid.getGrouping().map(c => c.path)).toEqual(['name', 'city']);
    expect(liveRegion(grid).textContent).toContain('City moved to grouping level 2 of 2');
  });
});

describe('A5/A13/A14 — descrição e atalhos do cabeçalho', () => {
  it('prioridade da ordenação, fixada e filtrada; aria-sort só na 1ª', async () => {
    const grid = await createGrid({
      columns: [{ path: 'name', label: 'Name', fixed: 'start' }, { path: 'city', label: 'City' }, { path: 'age', label: 'Age' }],
      items: people(),
      configure: g => {
        g.language = 'en';
        g.headerFilter = true;
      },
    });
    grid.sortColumn(grid.columns[2], 'asc');
    grid.sortColumn(grid.columns[1], 'desc', { append: true });
    grid.filterValue = ['city', '=', 'Rio'];
    await settle(grid);

    const description = (label: string) => {
      const id = headerCell(grid, label).getAttribute('aria-describedby');
      return id ? root(grid).getElementById(id)!.textContent : '';
    };

    expect(headerCell(grid, 'Age').getAttribute('aria-sort')).toBe('ascending');
    expect(headerCell(grid, 'City').getAttribute('aria-sort')).toBe('none');
    expect(description('City')).toBe('Sorted descending, priority 2, Filtered');
    expect(description('Name')).toBe('Pinned to start');
    expect(description('Age')).toBe('');

    const funnel = headerCell(grid, 'City').querySelector<HTMLElement>('.header-filter-button')!;
    expect(funnel.getAttribute('aria-describedby')).toBe(headerCell(grid, 'City').getAttribute('aria-describedby'));
    expect(funnel.querySelector('circle')).not.toBeNull();
    expect(headerCell(grid, 'Age').querySelector('.header-filter-button circle')).toBeNull();
  });

  it('aria-keyshortcuts com nomes do UI Events conforme os recursos', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.headerFilter = true;
      g.columnResizing = true;
    } });

    expect(headerCell(grid, 'Name').getAttribute('aria-keyshortcuts')).toBe(
      'Shift+F10 Control+G Meta+G Alt+Shift+ArrowLeft Alt+Shift+ArrowRight Alt+ArrowLeft Alt+ArrowRight Alt+ArrowDown F2',
    );
  });
});

describe('A6 — anúncios', () => {
  it('ordenar com 2+ colunas anuncia a prioridade; menu do painel anuncia', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, ...columns().filter(c => c.path !== 'city')],
      items: people(),
      configure: g => {
        g.language = 'en';
        g.sortMode = 'multiple';
      },
    });
    grid.sortColumn(grid.columns[1], 'asc');
    await settle(grid);
    headerCell(grid, 'Age').focus();
    await press(grid, 'Enter', { shiftKey: true });
    expect(liveRegion(grid).textContent).toBe('Sorted by Age, ascending, priority 2');

    root(grid).querySelector('.group')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 10, clientY: 10 }));
    await settle(grid);
    [...root(grid).querySelectorAll<HTMLElement>('.group-panel-menu [role=menuitem]')].find(i => i.textContent.trim() === 'Expand all groups')!.click();
    await settle(grid);
    expect(liveRegion(grid).textContent).toBe('All groups expanded');
  });

  it('Alt+→ no cabeçalho anuncia a largura depois da espera; timer solto ao remover', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => {
      g.language = 'en';
      g.columnResizing = true;
    } });
    headerCell(grid, 'Name').focus();
    await press(grid, 'ArrowRight', { altKey: true });
    expect(grid._memoryStats.announceTimers).toBe(1);

    await new Promise(resolve => setTimeout(resolve, 600));
    await settle(grid);
    expect(liveRegion(grid).textContent).toMatch(/^Name width: \d+ px/);

    await press(grid, 'ArrowRight', { altKey: true });
    grid.remove();
    expect(grid._memoryStats.announceTimers).toBe(0);
  });
});

describe('A10 — lista do funil em árvore', () => {
  const cities = (): Person[] => [
    ...people(),
    { name: 'Eva', city: 'Recife', age: 50 },
    { name: 'Fábio', city: '', age: 33 },
  ];

  const open = async (grid: DataGrid, label: string) => {
    headerCell(grid, label).querySelector<HTMLElement>('.header-filter-button')!.click();
    await settle(grid);
    return root(grid).querySelector<HTMLElement>('.header-filter')!;
  };

  const treeItems = (popover: HTMLElement) => [...popover.querySelectorAll<HTMLElement>('[role=treeitem]')];

  const key = async (grid: DataGrid, target: HTMLElement, name: string, init: KeyboardEventInit = {}) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init }));
    await settle(grid);
  };

  it('um ponto de Tab; setas movem; Espaço marca; Enter aplica; nome = texto + contagem', async () => {
    const grid = await createGrid({ columns: columns(), items: cities(), configure: g => {
      g.language = 'en';
      g.headerFilter = true;
    } });
    const popover = await open(grid, 'City');
    const tree = popover.querySelector<HTMLElement>('[role=tree]')!;

    expect(tree.getAttribute('aria-multiselectable')).toBe('true');
    expect(treeItems(popover).filter(item => item.tabIndex === 0)).toHaveLength(1);
    expect(treeItems(popover).map(item => item.getAttribute('aria-posinset'))).toEqual(['1', '2', '3', '4', '5']);
    expect(treeItems(popover)[0].getAttribute('aria-setsize')).toBe('5');

    // ↓ na busca vai à árvore.
    const search = popover.querySelector<HTMLElement>('.header-filter-search')!;
    await key(grid, search, 'ArrowDown');
    expect(focused(grid)).toBe(treeItems(popover)[0]);

    await key(grid, focused(grid)!, 'ArrowDown');
    expect(focused(grid)).toBe(treeItems(popover)[1]);
    expect(treeItems(popover)[1].tabIndex).toBe(0);
    expect(treeItems(popover)[0].tabIndex).toBe(-1);

    await key(grid, focused(grid)!, ' ');
    expect(treeItems(popover)[1].getAttribute('aria-checked')).toBe('false');

    await key(grid, focused(grid)!, 'Enter');
    expect(root(grid).querySelector('.header-filter')).toBeNull();
    expect(grid.filterValue).not.toBeNull();
  });

  it('busca: "Select all results (n)", contagem anunciada e Enter = OK', async () => {
    const grid = await createGrid({ columns: columns(), items: cities(), configure: g => {
      g.language = 'en';
      g.headerFilter = true;
    } });
    const popover = await open(grid, 'City');
    const search = popover.querySelector<HTMLInputElement>('.header-filter-search')!;
    await userEvent.fill(search, 'r');
    await new Promise(resolve => setTimeout(resolve, 600));
    await settle(grid);

    expect(popover.querySelector('.header-filter-select-all')!.textContent).toContain('Select all results (2)');
    expect(popover.querySelector('[role=status]')!.textContent).toBe('Values: 2');

    const result = await axe.run(grid, { resultTypes: ['violations'] });
    expect(result.violations.map(v => v.id)).toEqual([]);

    await key(grid, search, 'Enter');
    expect(root(grid).querySelector('.header-filter')).toBeNull();
  });

  it('datas: → expande e vai ao filho, ← volta ao pai; RTL inverte', async () => {
    const dated = [{ name: 'A', city: 'x', age: 1, born: '1994-03-05' }, { name: 'B', city: 'y', age: 2, born: '1994-07-01' }];

    for (const dir of ['ltr', 'rtl']) {
      const grid = await createGrid({
        columns: [{ path: 'name', label: 'Name' }, { path: 'born', label: 'Born', dataType: 'date' }],
        items: dated,
        configure: g => {
          g.language = 'en';
          g.headerFilter = true;
          g.setAttribute('dir', dir);
        },
      });
      const [expand, collapse] = dir === 'rtl' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
      const popover = await open(grid, 'Born');
      const year = treeItems(popover)[0];
      year.focus();

      expect(year.getAttribute('aria-expanded')).toBe('false');
      await key(grid, year, expand);
      expect(treeItems(popover)[0].getAttribute('aria-expanded')).toBe('true');
      await key(grid, focused(grid)!, expand);
      expect(focused(grid)!.getAttribute('aria-level')).toBe('2');
      await key(grid, focused(grid)!, collapse);
      expect(focused(grid)).toBe(treeItems(popover)[0]);
      cleanup();
    }
  });

  it('corte em 500 valores avisa "Showing 500 of N"', async () => {
    const many = Array.from({ length: 520 }, (_, i) => ({ name: `N${i}`, city: `C${i}`, age: i }));
    const grid = await createGrid({ columns: columns(), items: many, configure: g => {
      g.language = 'en';
      g.headerFilter = true;
    } });
    const popover = await open(grid, 'City');
    const tree = popover.querySelector<HTMLElement>('[role=tree]')!;

    expect(root(grid).getElementById(tree.getAttribute('aria-describedby')!)!.textContent).toBe('Showing 500 of 520');
  });
});

describe('A12 — mais de um focável na célula; custom elements', () => {
  class ShadowButton extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open', delegatesFocus: true }).innerHTML = '<button>inner</button>';
    }
  }

  if (!customElements.get('a11y-shadow-button')) {
    customElements.define('a11y-shadow-button', ShadowButton);
  }

  it('Tab circula entre os focáveis da célula; hospedeiro com shadow root sai da ordem de Tab', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'name', label: 'Name' },
        {
          label: 'Actions',
          renderer: (item: Person) => {
            const box = document.createElement('div');
            const open = document.createElement('button');
            open.textContent = `Open ${item.name}`;
            const fancy = document.createElement('a11y-shadow-button');
            box.append(open, fancy);
            return box;
          },
        },
      ],
      items: people(),
    });
    await settle(grid);

    expect([...grid.querySelectorAll('a11y-shadow-button')].every(host => host.getAttribute('tabindex') === '-1')).toBe(true);

    const cell = root(grid).querySelector<HTMLElement>('tbody td[data-col="1"]')!;
    cell.focus();
    await press(grid, 'Enter');
    const first = document.activeElement!;
    expect(first.textContent).toBe('Open Ana');

    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true, cancelable: true }));
    await settle(grid);
    expect(document.activeElement!.localName).toBe('a11y-shadow-button');

    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true, cancelable: true }));
    await settle(grid);
    expect(document.activeElement).toBe(first);
  });
});

describe('revisão da implementação (A1–A14)', () => {
  it('sem funil nem alça, F2 (que leva ao "⋮") entra no aria-keyshortcuts', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });

    expect(headerCell(grid, 'Name').getAttribute('aria-keyshortcuts')).toBe(
      'Shift+F10 Control+G Meta+G Alt+Shift+ArrowLeft Alt+Shift+ArrowRight F2',
    );
  });

  it('hospedeiro que cancela o contextmenu do painel de grupos fica com o dele', async () => {
    const grid = await createGrid({
      columns: [{ path: 'city', label: 'City', groupIndex: 0 }, ...columns().filter(c => c.path !== 'city')],
      items: people(),
    });
    const cancel = (event: Event) => event.preventDefault();
    grid.addEventListener('contextmenu', cancel, { capture: true });
    root(grid).querySelector('.group')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }));
    await settle(grid);
    grid.removeEventListener('contextmenu', cancel, { capture: true });

    expect(root(grid).querySelector('.group-panel-menu')).toBeNull();
  });
});

describe('revisão de a11y da implementação', () => {
  it('botão do renderer que remove a própria linha: o foco volta à célula ativa', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'name', label: 'Name' },
        {
          label: 'Delete',
          renderer: (item: Person) => {
            const button = document.createElement('button');
            button.textContent = `Delete ${item.name}`;
            button.addEventListener('click', () => {
              grid.items = grid.items.filter(other => other !== item);
            });
            return button;
          },
        },
      ],
      items: people(),
    });
    await settle(grid);

    root(grid).querySelector<HTMLElement>('tbody td[data-col="1"]')!.focus();
    await press(grid, 'Enter');
    (document.activeElement as HTMLElement).click();
    await settle(grid);
    await settle(grid);

    expect(document.activeElement).toBe(grid);
    expect(focused(grid)?.matches('td[tabindex="0"]')).toBe(true);
  });

  it('custom element decorativo na célula não vira alvo de foco; as setas seguem', async () => {
    class Badge extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = '<span>new</span>';
      }
    }

    if (!customElements.get('a11y-badge')) {
      customElements.define('a11y-badge', Badge);
    }

    const grid = await createGrid({
      columns: [{ path: 'name', label: 'Name' }, { label: 'Tag', renderer: () => document.createElement('a11y-badge') }],
      items: people(),
    });
    await settle(grid);
    const badge = grid.querySelector('a11y-badge')!;

    expect(badge.hasAttribute('tabindex')).toBe(false);
    await userEvent.click(badge);
    await press(grid, 'ArrowDown');
    expect(focused(grid)?.matches('td[data-col]')).toBe(true);
  });

  it('o "⋮" não cobre o funil nem a seta (coluna à direita, com alça)', async () => {
    const grid = await createGrid({
      columns: [{ path: 'name', label: 'Name' }, { path: 'age', label: 'Age', alignment: 'end' }],
      items: people(),
      configure: g => {
        g.headerFilter = true;
        g.columnResizing = true;
      },
    });
    grid.sortColumn(grid.columns[1], 'asc');
    await settle(grid);
    const th = headerCell(grid, 'Age');
    th.focus();
    await settle(grid);

    const rect = (selector: string) => th.querySelector(selector)!.getBoundingClientRect();
    const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const button = rect('.column-header-menu-button');

    expect(overlap(button, rect('.header-filter-button'))).toBe(false);
    expect(overlap(button, rect('.sort-indicator'))).toBe(false);
    expect(overlap(button, rect('.resize-handle'))).toBe(false);
  });

  it('clicar no "⋮" com o menu aberto fecha', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    const button = headerCell(grid, 'Name').querySelector<HTMLElement>('.column-header-menu-button')!;
    await userEvent.click(button);
    await settle(grid);
    expect(root(grid).querySelector('.column-header-menu')).not.toBeNull();

    await userEvent.click(headerCell(grid, 'Name').querySelector<HTMLElement>('.column-header-menu-button')!);
    await settle(grid);
    expect(root(grid).querySelector('.column-header-menu')).toBeNull();
    expect(headerCell(grid, 'Name').querySelector('.column-header-menu-button')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('Enter que confirma a composição (IME) não aplica o filtro do funil', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.headerFilter = true });
    headerCell(grid, 'City').querySelector<HTMLElement>('.header-filter-button')!.click();
    await settle(grid);
    const search = root(grid).querySelector<HTMLElement>('.header-filter-search')!;
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, composed: true, cancelable: true }));
    await settle(grid);

    expect(root(grid).querySelector('.header-filter')).not.toBeNull();
  });

  it('o menu nativo não abre por cima dos menus do grid', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    headerCell(grid, 'Name').focus();
    await press(grid, 'F10', { shiftKey: true });
    const item = root(grid).querySelector<HTMLElement>('.column-header-menu [role=menuitem]')!;
    const event = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true });
    item.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

describe('bandas e virtualização de colunas (frente 13)', () => {
  const bandColumns = (): GridColumnDef[] => [
    { path: 'name', label: 'Name', width: 140 },
    { label: 'Place', columns: [{ path: 'city', label: 'City', width: 120 }, { label: 'Details', columns: [{ path: 'age', label: 'Age', width: 90 }] }] },
  ];

  it('axe sem violações: 3 níveis + caixas + agrupado + linha de filtro + RTL', async () => {
    const grid = await createGrid({
      columns: bandColumns(),
      items: people(),
      configure: g => {
        g.selectionMode = 'multiple';
        g.showCheckboxes = true;
        g.showFilterRow = true;
        g.columnChooser = true;
        g.dir = 'rtl';
      },
    });

    grid.groupColumn(grid.columns[0]);
    await settle(grid);

    const header = [...root(grid).querySelectorAll('thead tr')].map(tr => tr.getAttribute('aria-rowindex'));
    expect(header).toEqual(['1', '2', '3', '4']);
    expect((await axe.run(grid, { resultTypes: ['violations'] })).violations.map(v => v.id)).toEqual([]);

    grid.openColumnChooser();
    await settle(grid);
    expect((await axe.run(grid, { resultTypes: ['violations'] })).violations.map(v => v.id)).toEqual([]);
  });

  it('axe sem violações com a virtualização rolada ao meio', async () => {
    const wide: GridColumnDef[] = Array.from({ length: 12 }, (_, band) => ({
      label: `Band ${band}`,
      columns: Array.from({ length: 10 }, (__, i) => ({ path: `c${band * 10 + i}`, label: `C${band * 10 + i}`, width: 100 })),
    }));
    const items = Array.from({ length: 20 }, (_, r) => Object.fromEntries(Array.from({ length: 120 }, (__, c) => [`c${c}`, `${r}.${c}`])));
    const grid = await createGrid({ columns: wide, items, configure: g => g.showFilterRow = true });
    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;

    scroller.scrollLeft = 6000;
    scroller.dispatchEvent(new Event('scroll'));
    await settle(grid);

    expect(root(grid).querySelectorAll('.column-spacer').length).toBeGreaterThan(0);
    expect((await axe.run(grid, { resultTypes: ['violations'] })).violations.map(v => v.id)).toEqual([]);
  });

  it('roteiro de teclado: menu da banda, mover e o foco segue a banda', async () => {
    const grid = await createGrid({ columns: [{ path: 'age', label: 'Age' }, ...bandColumns()], items: people() });

    headerCell(grid, 'Place').focus();
    await settle(grid);
    await press(grid, 'F10', { shiftKey: true });

    const menu = root(grid).querySelector<HTMLElement>('.column-header-menu')!;
    const moveLeft = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')].find(item => item.textContent.trim() === 'Move left')!;
    expect(focused(grid)).toBe(menu.querySelector('[role=menuitem]'));
    moveLeft.click();
    await settle(grid);

    expect(focused(grid)!.querySelector('.header-text')!.textContent).toBe('Place');
    expect(liveRegion(grid).textContent).toContain('Place');
    await press(grid, 'ArrowDown');
    expect(focused(grid)!.querySelector('.header-text')!.textContent).toBe('City');
  });
});
