/**
 * Menu do cabeçalho e seletor de colunas como os do AG Grid (spec 18,
 * "Referência medida"): botão "⋮" sempre visível, layout do cabeçalho pelo
 * alinhamento lógico, submenu "Fixar coluna ▸" (rádio), "Auto-ajustar todas",
 * "Escolher colunas", "Redefinir colunas", `columnFixing`, `resetColumns()`,
 * `autoSizeAllColumns()`, e o seletor com busca, "Mostrar todas" e
 * reordenação (alça e Alt+Shift+↑/↓). Teclado, foco, anúncios e axe.
 */
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

import type { GridContextMenuOpeningEventDetail } from './features/context-menu.js';
import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid } from './grid.js';
import { cleanup, createGrid, headerLabels, parkPointer, settle } from './test/fixture.js';

beforeEach(parkPointer);

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await page.viewport(414, 896);
});

interface Person {
  id: number;
  name: string;
  city: string;
  age: number;
}

const people = (): Person[] => [
  { id: 1, name: 'Ana', city: 'Rio', age: 30 },
  { id: 2, name: 'Bia', city: 'SP', age: 25 },
  { id: 3, name: 'Caio', city: 'Rio', age: 41 },
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name', name: 'name' },
  { path: 'city', label: 'City', name: 'city' },
  { path: 'age', label: 'Age', name: 'age', alignment: 'end' },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const focused = (grid: DataGrid): HTMLElement | null => root(grid).activeElement as HTMLElement | null;
const menu = (grid: DataGrid): HTMLElement | null => root(grid).querySelector<HTMLElement>('.context-menu-panel');
const submenu = (grid: DataGrid): HTMLElement | null => root(grid).querySelector<HTMLElement>('.context-menu-panel-submenu');
const itemsOf = (panel: HTMLElement | null): HTMLElement[] => [...panel?.querySelectorAll<HTMLElement>('[role^=menuitem]') ?? []];
const textOf = (item: HTMLElement): string => item.querySelector('.menu-item-text')!.textContent.trim();
const menuTexts = (grid: DataGrid): string[] => itemsOf(menu(grid)).map(textOf);
const itemNamed = (grid: DataGrid, text: string, panel = menu(grid)): HTMLElement => itemsOf(panel).find(item => textOf(item) === text)!;
const headerCell = (grid: DataGrid, label: string): HTMLElement =>
  [...root(grid).querySelectorAll<HTMLElement>('th.header-column')].find(th => th.querySelector('.header-text')!.textContent === label)!;
const menuButton = (grid: DataGrid, label: string): HTMLElement => headerCell(grid, label).querySelector<HTMLElement>('.column-header-menu-button')!;
const liveRegion = (grid: DataGrid): HTMLElement => root(grid).querySelector<HTMLElement>('[role=status]')!;
const chooser = (grid: DataGrid): HTMLElement | null => root(grid).querySelector<HTMLElement>('.column-chooser');
const chooserLabels = (grid: DataGrid): string[] =>
  [...chooser(grid)?.querySelectorAll('.column-chooser-list > .column-chooser-item > .column-chooser-row label span') ?? []].map(span => span.textContent);
const chooserBox = (grid: DataGrid, label: string): HTMLInputElement =>
  [...chooser(grid)!.querySelectorAll<HTMLElement>('.column-chooser-item')].find(li => li.querySelector('.column-chooser-row label span')!.textContent === label)!
    .querySelector<HTMLInputElement>('.column-chooser-row input')!;

const key = async (grid: DataGrid, target: HTMLElement, name: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  await settle(grid);
  return event;
};

const create = (configure?: (grid: DataGrid) => void, cols = columns()) =>
  createGrid({ columns: cols, items: people(), height: '400px', configure: grid => {
    grid.style.width = '720px';
    configure?.(grid);
  } });

/** Foca a célula do cabeçalho como o roving faria (clique). */
const focusHeader = async (grid: DataGrid, label: string): Promise<HTMLElement> => {
  const cell = headerCell(grid, label);
  cell.focus();
  await settle(grid);
  return cell;
};

const axeRun = async (grid: DataGrid) => {
  const results = await axe.run(grid.shadowRoot as unknown as Element, { rules: { region: { enabled: false } } });
  return results.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.html.slice(0, 80)).join(' | ')}`);
};

describe('botão "⋮" do cabeçalho', () => {
  it('em toda coluna com menu: fora do Tab, nome com a coluna, aria-haspopup/expanded, ícone oculto; F2 chega nele', async () => {
    const grid = await create(g => g.headerFilter = true);
    const button = menuButton(grid, 'City');

    expect(button).toBeTruthy();
    expect(button.getAttribute('tabindex')).toBe('-1');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    // Ícone em máscara CSS (sem nó de SVG): só o nome oculto como conteúdo.
    expect(button.querySelector('svg')).toBeNull();
    expect(getComputedStyle(button, '::before').maskImage).toContain('svg');
    expect(button.textContent.trim()).toBe('Options for City');
    expect(button.querySelector('[lang] [lang]')).toBeTruthy();
    // Fora do rótulo: o nome do columnheader não inclui o botão.
    expect(headerCell(grid, 'City').querySelector('.header-text')!.contains(button)).toBe(false);
    expect(headerCell(grid, 'City').getAttribute('aria-keyshortcuts')).toContain('F2');

    // F2: funil, depois o "⋮" (ordem do DOM), depois volta à célula.
    const cell = await focusHeader(grid, 'City');
    await key(grid, cell, 'F2');
    expect(focused(grid)!.classList.contains('header-filter-button')).toBe(true);
    await key(grid, focused(grid)!, 'F2');
    expect(focused(grid)).toBe(menuButton(grid, 'City'));

    // Alt+↓ continua sendo do filtro (na célula).
    await key(grid, focused(grid)!, 'Escape');
    expect(focused(grid)).toBe(headerCell(grid, 'City'));
    await key(grid, headerCell(grid, 'City'), 'ArrowDown', { altKey: true });
    expect(menu(grid)).toBeNull();
    expect(root(grid).querySelector('.header-filter')).toBeTruthy();
  });

  it('show-column-header-menu-button="false" esconde; column-header-menu="false" também; o menu de contexto continua', async () => {
    const grid = await create();
    expect(root(grid).querySelectorAll('.column-header-menu-button')).toHaveLength(3);

    grid.setAttribute('show-column-header-menu-button', 'false');
    await settle(grid);
    expect(grid.showColumnHeaderMenuButton).toBe(false);
    expect(root(grid).querySelectorAll('.column-header-menu-button')).toHaveLength(0);
    expect(headerCell(grid, 'City').getAttribute('aria-keyshortcuts')).not.toContain('F2');

    const cell = await focusHeader(grid, 'City');
    await key(grid, cell, 'F10', { shiftKey: true });
    expect(menu(grid)).toBeTruthy();
    await key(grid, itemsOf(menu(grid))[0], 'Escape');

    grid.showColumnHeaderMenuButton = true;
    grid.columnHeaderMenu = false;
    await settle(grid);
    expect(root(grid).querySelectorAll('.column-header-menu-button')).toHaveLength(0);
  });

  it('clique abre sob o botão (aria-expanded) e clique de novo fecha; Enter/Espaço/↓ abrem no 1º item, ↑ no último', async () => {
    const grid = await create();

    menuButton(grid, 'Name').click();
    await settle(grid);
    expect(menu(grid)).toBeTruthy();
    expect(menuButton(grid, 'Name').getAttribute('aria-expanded')).toBe('true');
    // Clicar no botão não ordena.
    expect(grid.getSorting()).toEqual([]);

    menuButton(grid, 'Name').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    menuButton(grid, 'Name').click();
    await settle(grid);
    expect(menu(grid)).toBeNull();

    for (const name of ['Enter', ' ', 'ArrowDown']) {
      await key(grid, menuButton(grid, 'Name'), name);
      expect(focused(grid)).toBe(itemsOf(menu(grid))[0]);
      await key(grid, focused(grid)!, 'Escape');
      expect(grid.getSorting()).toEqual([]);
    }

    await key(grid, menuButton(grid, 'Name'), 'ArrowUp');
    const items = itemsOf(menu(grid));
    expect(focused(grid)).toBe(items[items.length - 1]);
  });
});

// Pedido do click (0.6.0): coluna de ações com o cabeçalho só com o título (revisão de API e de a11y).
describe('headerMenu: false numa coluna', () => {
  const withActions = (): GridColumnDef[] => [
    ...columns(),
    { name: 'actions', label: 'Actions', fixed: 'end', sortable: false, groupable: false, resizable: false, headerMenu: false },
  ];

  it('coluna de ações: sem "⋮", sem Shift+F10/F2 anunciados, Shift+F10 e clique direito deixam o menu do navegador', async () => {
    const grid = await create(g => g.columnResizing = true, withActions());
    const actions = headerCell(grid, 'Actions');

    expect(actions.querySelector('.column-header-menu-button')).toBeNull();
    expect(actions.getAttribute('aria-keyshortcuts') ?? '').not.toMatch(/Shift\+F10|F2/);
    expect(root(grid).querySelectorAll('.column-header-menu-button')).toHaveLength(3);

    const cell = await focusHeader(grid, 'Actions');
    const shiftF10 = await key(grid, cell, 'F10', { shiftKey: true });
    expect(shiftF10.defaultPrevented).toBe(false);
    expect(menu(grid)).toBeNull();
    expect(focused(grid)).toBe(actions);

    const right = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true });
    actions.dispatchEvent(right);
    await settle(grid);
    expect(right.defaultPrevented).toBe(false);
    expect(menu(grid)).toBeNull();

    // As outras colunas mantêm os itens do grid inteiro.
    menuButton(grid, 'City').click();
    await settle(grid);
    expect(menuTexts(grid)).toEqual(expect.arrayContaining(['Auto-size all columns', 'Reset columns']));
    expect(await axeRun(grid)).toEqual([]);
  });

  it('coluna que ainda se arrasta: o menu fica só com as alternativas de ponteiro único (largura, mover, agrupar — WCAG 2.5.7)', async () => {
    const cols = columns();
    cols[1] = { ...cols[1], headerMenu: false };
    const grid = await create(g => {
      g.columnResizing = true;
      g.columnChooser = true;
    }, cols);

    expect(menuButton(grid, 'City')).toBeTruthy();
    expect(headerCell(grid, 'City').getAttribute('aria-keyshortcuts')).toContain('Shift+F10');
    menuButton(grid, 'City').click();
    await settle(grid);
    expect(menuTexts(grid)).toEqual([
      'Auto-size column',
      'Increase width',
      'Decrease width',
      'Move left',
      'Move right',
      'Group by this column',
    ]);
  });

  it('o hospedeiro ainda põe itens pelo u-grid-context-menu-opening (sem "⋮"); true segue o grid, que sempre vence', async () => {
    const grid = await create(undefined, withActions());
    const action = vi.fn();
    grid.addEventListener('u-grid-context-menu-opening', ({ detail }) => {
      if (detail.target === 'header' && detail.column?.name === 'actions') {
        detail.menuItems.push({ id: 'host', text: 'Host action', action });
      }
    });

    const cell = await focusHeader(grid, 'Actions');
    await key(grid, cell, 'F10', { shiftKey: true });
    expect(menuTexts(grid)).toEqual(['Host action']);
    expect(focused(grid)).toBe(itemsOf(menu(grid))[0]);
    await key(grid, focused(grid)!, 'Escape');
    expect(menu(grid)).toBeNull();
    expect(focused(grid)).toBe(headerCell(grid, 'Actions'));

    const cols = columns();
    cols[1] = { ...cols[1], headerMenu: true };
    grid.columns = cols;
    grid.columnHeaderMenu = false;
    await settle(grid);
    expect(root(grid).querySelectorAll('.column-header-menu-button')).toHaveLength(0);
  });

  it('header-menu="false" no <u-grid-column>; mudar com o foco no "⋮" devolve o foco à célula', async () => {
    const element = document.createElement('u-grid-column');
    element.setAttribute('header-menu', 'false');
    expect((element as unknown as GridColumnDef).headerMenu).toBe(false);
    element.setAttribute('header-menu', '');
    expect((element as unknown as GridColumnDef).headerMenu).toBe(true);

    const grid = await create();
    const cell = await focusHeader(grid, 'Name');
    await key(grid, cell, 'F2');
    expect(focused(grid)).toBe(menuButton(grid, 'Name'));

    // Única coluna sem arrasto possível: sem ordenação nem agrupamento, e sem vizinha (as outras escondidas).
    grid.columns = [{ path: 'name', label: 'Name', name: 'name', sortable: false, groupable: false, headerMenu: false }];
    await settle(grid);
    expect(menuButton(grid, 'Name')).toBeNull();
    expect(focused(grid)).toBe(headerCell(grid, 'Name'));
  });

  it('banda com headerMenu: false: só o cabeçalho da banda perde os itens (fica Mover); as filhas mantêm o menu', async () => {
    const grid = await create(undefined, [
      { path: 'name', label: 'Name', name: 'name' },
      { label: 'Place', headerMenu: false, columns: [{ path: 'city', label: 'City', name: 'city' }, { path: 'age', label: 'Age', name: 'age' }] },
    ]);
    const band = [...root(grid).querySelectorAll<HTMLElement>('th.band-header')].find(th => th.textContent.includes('Place'))!;

    band.focus();
    await settle(grid);
    await key(grid, band, 'F10', { shiftKey: true });
    expect(menuTexts(grid)).toEqual(['Move left', 'Move right']);
    await key(grid, focused(grid)!, 'Escape');

    // Coluna dentro de banda não se fixa (só o nível de cima): o resto do menu completo fica.
    menuButton(grid, 'City').click();
    await settle(grid);
    expect(menuTexts(grid)).toEqual(expect.arrayContaining(['Sort ascending', 'Group by this column', 'Reset columns']));
  });

  it('RTL, axe com o menu reduzido aberto, e sem painel de grupos "Agrupar" não segura o menu', async () => {
    const cols = columns();
    cols[1] = { ...cols[1], headerMenu: false, resizable: false };
    const grid = await create(g => {
      g.dir = 'rtl';
      g.language = 'ar';
    }, cols);

    menuButton(grid, 'City').click();
    await settle(grid);
    expect(itemsOf(menu(grid))).toHaveLength(3); // mover ×2, agrupar
    expect(await axeRun(grid)).toEqual([]);
    await key(grid, itemsOf(menu(grid))[0], 'Escape');

    grid.showGroupPanel = false;
    await settle(grid);
    menuButton(grid, 'City').click();
    await settle(grid);
    expect(itemsOf(menu(grid))).toHaveLength(2); // só mover
    await key(grid, itemsOf(menu(grid))[0], 'Escape');

    // Sem vizinha (as outras escondidas): nada a substituir, o "⋮" some.
    grid.columns = [cols[1]];
    await settle(grid);
    expect(menuButton(grid, 'City')).toBeNull();
  });

  it('header-menu="false" mudado com o menu aberto: o menu fecha e o foco volta à célula', async () => {
    const grid = document.createElement('u-grid');
    grid.style.display = 'block';
    grid.style.height = '300px';
    grid.innerHTML = `
      <u-grid-column path="name">Name</u-grid-column>
      <u-grid-column name="actions" fixed="end" sortable="false" groupable="false">Actions</u-grid-column>`;
    document.body.append(grid);
    grid.items = people();
    await settle(grid);

    menuButton(grid, 'Actions').click();
    await settle(grid);
    expect(menu(grid)).toBeTruthy();

    grid.querySelectorAll('u-grid-column')[1].setAttribute('header-menu', 'false');
    await settle(grid);
    expect(menu(grid)).toBeNull();
    expect(menuButton(grid, 'Actions')).toBeNull();
    expect(focused(grid)).toBe(headerCell(grid, 'Actions'));
    grid.remove();
  });

  it('<u-grid-column header-menu="false"> dentro de um <u-grid>: o "⋮" some só dela', async () => {
    const grid = document.createElement('u-grid');
    grid.style.display = 'block';
    grid.style.height = '300px';
    grid.innerHTML = `
      <u-grid-column path="name">Name</u-grid-column>
      <u-grid-column name="actions" fixed="end" sortable="false" groupable="false" header-menu="false">Actions</u-grid-column>`;
    document.body.append(grid);
    grid.items = people();
    await settle(grid);

    expect(menuButton(grid, 'Name')).toBeTruthy();
    expect(menuButton(grid, 'Actions')).toBeNull();
    grid.remove();
  });
});

describe('layout do cabeçalho pelo alinhamento lógico', () => {
  const positions = (grid: DataGrid, label: string) => {
    const cell = headerCell(grid, label);
    const rect = (selector: string) => cell.querySelector(selector)!.getBoundingClientRect();
    return { cell: cell.getBoundingClientRect(), text: rect('.header-text'), sort: rect('.sort-indicator'), filter: rect('.header-filter-button'), menu: rect('.column-header-menu-button') };
  };

  const setup = (dir: 'ltr' | 'rtl') => create(g => {
    g.dir = dir;
    g.headerFilter = true;
    g.columnResizing = true;
  }, [
    { path: 'name', label: 'Name', sortOrder: 'asc', sortIndex: 0, width: 220 },
    { path: 'age', label: 'Age', alignment: 'end', sortOrder: 'desc', sortIndex: 1, width: 220 },
  ]);

  it('LTR: início [texto][seta] … [funil][⋮]; fim [⋮][funil] … [seta][texto]; nada sobre a alça (que fica no padding do fim)', async () => {
    const grid = await setup('ltr');
    const start = positions(grid, 'Name');

    expect(start.sort.left).toBeGreaterThanOrEqual(start.text.right - 1);
    expect(start.filter.left).toBeGreaterThan(start.sort.right + 20);
    expect(start.menu.left).toBeGreaterThanOrEqual(start.filter.right - 1);
    // ⋮ na ponta do fim, avançando sobre o padding até a alça (8px); a alça fica só sobre o resto do padding.
    const handle = headerCell(grid, 'Name').querySelector('.resize-handle')!.getBoundingClientRect();
    expect(start.menu.right).toBeLessThanOrEqual(start.cell.right - 8 + 0.5);
    expect(start.menu.right).toBeGreaterThan(start.cell.right - 8 - 4);
    expect(handle.left).toBeGreaterThanOrEqual(start.menu.right - 0.5);
    expect(Math.round(start.menu.width)).toBe(24);
    expect(Math.round(start.filter.width)).toBe(24);

    const end = positions(grid, 'Age');
    expect(end.filter.left).toBeGreaterThanOrEqual(end.menu.right - 1);
    expect(end.sort.left).toBeGreaterThan(end.filter.right + 20);
    expect(end.text.left).toBeGreaterThanOrEqual(end.sort.right - 1);
    expect(end.menu.left).toBeLessThan(end.cell.left + 20);
  });

  it('RTL espelha: início com o ⋮ à esquerda; fim com o ⋮ à direita', async () => {
    const grid = await setup('rtl');
    const start = positions(grid, 'Name');

    expect(start.sort.right).toBeLessThanOrEqual(start.text.left + 1);
    expect(start.menu.right).toBeLessThanOrEqual(start.filter.left + 1);
    expect(start.menu.left).toBeGreaterThanOrEqual(start.cell.left + 8 - 0.5);

    const end = positions(grid, 'Age');
    expect(end.menu.left).toBeGreaterThanOrEqual(end.filter.right - 1);
    expect(end.text.right).toBeLessThanOrEqual(end.sort.left + 1);
    expect(end.menu.right).toBeGreaterThan(end.cell.right - 20);
  });

  it('o hover não desloca nada; texto longo corta com reticências sem cobrir os ícones', async () => {
    const grid = await create(g => g.headerFilter = true, [
      { path: 'name', label: 'A very long column header label that never fits', width: 160 },
      { path: 'age', label: 'Age' },
    ]);
    const cell = root(grid).querySelector<HTMLElement>('th.header-column')!;
    const text = cell.querySelector<HTMLElement>('.header-text')!;
    const before = cell.querySelector('.column-header-menu-button')!.getBoundingClientRect().left;

    cell.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    await settle(grid);
    expect(cell.querySelector('.column-header-menu-button')!.getBoundingClientRect().left).toBe(before);
    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    expect(getComputedStyle(text).textOverflow).toBe('ellipsis');
    expect(text.getBoundingClientRect().right).toBeLessThanOrEqual(cell.querySelector('.header-filter-button')!.getBoundingClientRect().left);
  });
});

describe('itens do menu do cabeçalho (ordem do AG Grid)', () => {
  it('ordem, "Fixar coluna ▸" com os três lados no evento, "limpar" só com ordenação, "Escolher colunas" só com o seletor', async () => {
    const grid = await create(g => g.columnResizing = true);
    let detail: GridContextMenuOpeningEventDetail | undefined;
    grid.addEventListener('u-grid-context-menu-opening', event => {
      detail = { ...event.detail, menuItems: structuredClone(event.detail.menuItems) };
    });

    menuButton(grid, 'City').click();
    await settle(grid);
    expect(menuTexts(grid)).toEqual([
      'Sort ascending',
      'Sort descending',
      'Pin column',
      'Auto-size column',
      'Auto-size all columns',
      'Increase width',
      'Decrease width',
      'Move left',
      'Move right',
      'Group by this column',
      'Reset columns',
    ]);
    expect(detail!.menuItems.find(item => item.name === 'fixColumn')).toEqual({
      name: 'fixColumn',
      disabled: false,
      separatorBefore: true,
      items: [
        { name: 'fixColumnStart', disabled: false, separatorBefore: false },
        { name: 'fixColumnEnd', disabled: false, separatorBefore: false },
        { name: 'unfixColumn', disabled: false, separatorBefore: false },
      ],
    });

    const pin = itemNamed(grid, 'Pin column');
    expect(pin.getAttribute('aria-haspopup')).toBe('menu');
    expect(pin.getAttribute('aria-expanded')).toBe('false');
    await key(grid, pin, 'Escape');

    grid.columnChooser = true;
    grid.sortColumn(grid.columns[1], 'asc');
    await settle(grid);
    menuButton(grid, 'City').click();
    await settle(grid);
    expect(menuTexts(grid)).toContain('Clear sorting');
    expect(menuTexts(grid).slice(-2)).toEqual(['Choose columns', 'Reset columns']);
    expect(itemNamed(grid, 'Choose columns').getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('column-fixing="false" tira o "Fixar coluna" (sem depender do seletor)', async () => {
    const grid = await create();
    menuButton(grid, 'City').click();
    await settle(grid);
    expect(menuTexts(grid)).toContain('Pin column');
    await key(grid, itemsOf(menu(grid))[0], 'Escape');

    grid.setAttribute('column-fixing', 'false');
    await settle(grid);
    expect(grid.columnFixing).toBe(false);
    menuButton(grid, 'City').click();
    await settle(grid);
    expect(menuTexts(grid)).not.toContain('Pin column');
  });

  it('item de fixar levado ao nível de cima funciona; `items` em item do hospedeiro avisa e é ignorado', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await create();
    grid.addEventListener('u-grid-context-menu-opening', ({ detail }) => {
      const pin = detail.menuItems.find(item => item.name === 'fixColumn')!;
      detail.menuItems.push(pin.items!.splice(1, 1)[0]);
      detail.menuItems.push({ id: 'x', text: 'Host', action: () => undefined, items: [{ id: 'y', text: 'Nested', action: () => undefined }] });
    });

    menuButton(grid, 'City').click();
    await settle(grid);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('only "fixColumn" has a submenu'));
    expect(menuTexts(grid).slice(-2)).toEqual(['Pin to end', 'Host']);
    expect(itemNamed(grid, 'Host').hasAttribute('aria-haspopup')).toBe(false);

    itemNamed(grid, 'Pin to end').click();
    await settle(grid);
    expect(headerCell(grid, 'City').classList.contains('fixed-end')).toBe(true);
  });
});

describe('submenu "Fixar coluna": teclado, foco e anúncio', () => {
  // Relato do usuário: o item com submenu não mostrava a seta (padding no <svg> deixava 1×1 px).
  for (const dir of ['ltr', 'rtl'] as const) {
    it(`o item com submenu mostra a seta inteira no fim (${dir})`, async () => {
      const grid = await create(g => g.dir = dir);
      menuButton(grid, 'City').click();
      await settle(grid);

      const pin = itemNamed(grid, 'Pin column');
      const arrow = pin.querySelector<SVGElement>('.menu-item-arrow')!;
      const drawn = arrow.querySelector('path')!.getBoundingClientRect();
      const box = pin.getBoundingClientRect();
      const text = pin.querySelector('.menu-item-text')!.getBoundingClientRect();

      expect(drawn.width).toBeGreaterThan(5);
      expect(drawn.height).toBeGreaterThan(9);

      // no fim do item (direita em LTR, esquerda em RTL), sem encostar no texto
      if (dir === 'ltr') {
        expect(drawn.left).toBeGreaterThan(text.right);
        expect(box.right - drawn.right).toBeLessThan(32);
      } else {
        expect(drawn.right).toBeLessThan(text.left);
        expect(drawn.left - box.left).toBeLessThan(32);
      }
    });
  }

  const script = async (dir: 'ltr' | 'rtl') => {
    // Janela larga: o submenu cabe do lado do fim.
    await page.viewport(1024, 768);
    const grid = await create(g => {
      g.dir = dir;
      // Espaço à esquerda: em RTL o submenu abre para lá.
      g.style.marginLeft = dir === 'rtl' ? '280px' : '0';
    });
    const cell = await focusHeader(grid, 'City');

    // F2 → ⋮ → Enter → até "Fixar coluna" → abre (→, ou ← em RTL) → Esc → Esc.
    await key(grid, cell, 'F2');
    expect(focused(grid)).toBe(menuButton(grid, 'City'));
    await key(grid, focused(grid)!, 'Enter');
    await key(grid, focused(grid)!, 'p');
    const pin = itemNamed(grid, 'Pin column');
    expect(focused(grid)).toBe(pin);

    // A seta "de fechar" no item pai não abre nada.
    await key(grid, pin, dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
    expect(submenu(grid)).toBeNull();

    await key(grid, pin, dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    expect(submenu(grid)).toBeTruthy();
    expect(pin.getAttribute('aria-expanded')).toBe('true');
    expect(pin.getAttribute('aria-controls')).toBe(submenu(grid)!.id);
    const radios = itemsOf(submenu(grid));
    expect(radios.map(item => item.getAttribute('role'))).toEqual(['menuitemradio', 'menuitemradio', 'menuitemradio']);
    expect(radios.map(item => item.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
    expect(submenu(grid)!.querySelector('[role=group]')!.getAttribute('aria-label')).toBe('Pin column');
    expect(focused(grid)).toBe(radios[0]);

    // Submenu ao lado do pai, do lado do fim (à direita em LTR, à esquerda em RTL).
    const parentRect = pin.getBoundingClientRect();
    const subRect = submenu(grid)!.getBoundingClientRect();

    if (dir === 'rtl') {
      expect(subRect.right).toBeLessThanOrEqual(parentRect.left + 1);
    } else {
      expect(subRect.left).toBeGreaterThanOrEqual(parentRect.right - 1);
    }

    // ↓ circula no submenu (Home/End e letra também valem nele).
    await key(grid, radios[0], 'ArrowDown');
    expect(focused(grid)).toBe(itemsOf(submenu(grid))[1]);
    await key(grid, focused(grid)!, 'End');
    expect(focused(grid)).toBe(itemsOf(submenu(grid))[2]);

    await key(grid, focused(grid)!, 'Escape');
    expect(submenu(grid)).toBeNull();
    expect(focused(grid)).toBe(itemNamed(grid, 'Pin column'));
    expect(menu(grid)).toBeTruthy();

    await key(grid, focused(grid)!, 'Escape');
    expect(menu(grid)).toBeNull();
    expect(focused(grid)).toBe(headerCell(grid, 'City'));
    return grid;
  };

  it('LTR: F2 → ⋮ → Enter → → → Esc → Esc, foco de volta na célula', async () => {
    await script('ltr');
  });

  it('RTL: ← abre e → fecha', async () => {
    const grid = await script('rtl');
    const cell = headerCell(grid, 'City');
    await key(grid, cell, 'F10', { shiftKey: true });
    await key(grid, focused(grid)!, 'p');
    await key(grid, focused(grid)!, 'ArrowLeft');
    expect(submenu(grid)).toBeTruthy();
    await key(grid, focused(grid)!, 'ArrowRight');
    expect(submenu(grid)).toBeNull();
    expect(focused(grid)).toBe(itemNamed(grid, 'Pin column'));
  });

  it('Enter no pai abre; Tab fecha a cadeia toda; o ponteiro sobre o pai abre e sobre outro item fecha', async () => {
    const grid = await create();
    const cell = await focusHeader(grid, 'City');
    await key(grid, cell, 'F10', { shiftKey: true });
    await key(grid, focused(grid)!, 'p');
    await key(grid, focused(grid)!, 'Enter');
    expect(focused(grid)).toBe(itemsOf(submenu(grid))[0]);

    await key(grid, focused(grid)!, 'Tab');
    expect(menu(grid)).toBeNull();
    expect(submenu(grid)).toBeNull();
    expect(focused(grid)).toBe(headerCell(grid, 'City'));

    menuButton(grid, 'City').click();
    await settle(grid);
    itemNamed(grid, 'Pin column').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await settle(grid);
    expect(submenu(grid)).toBeTruthy();
    itemNamed(grid, 'Sort ascending').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await settle(grid);
    expect(submenu(grid)).toBeNull();
  });

  it('foco no submenu e o ponteiro sobre outro item do menu de cima: o foco volta ao menu, não ao <body>', async () => {
    const grid = await create();
    const cell = await focusHeader(grid, 'City');
    await key(grid, cell, 'F10', { shiftKey: true });
    await key(grid, focused(grid)!, 'p');
    await key(grid, focused(grid)!, 'ArrowRight');
    expect(submenu(grid)!.contains(focused(grid))).toBe(true);

    itemNamed(grid, 'Sort ascending').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await settle(grid);
    expect(submenu(grid)).toBeNull();
    expect(menu(grid)!.contains(focused(grid))).toBe(true);
    await key(grid, focused(grid)!, 'Escape');
    expect(focused(grid)).toBe(headerCell(grid, 'City'));
  });

  it('fixar pelo submenu: fixa, anuncia, foco volta à célula da coluna; o lado atual vem marcado e só fecha', async () => {
    const grid = await create();
    const fixed = vi.fn();
    grid.addEventListener('u-grid-column-fixed-change', fixed);
    const cell = await focusHeader(grid, 'Age');
    await key(grid, cell, 'F10', { shiftKey: true });
    await key(grid, focused(grid)!, 'p');
    await key(grid, focused(grid)!, 'ArrowRight');
    // Enter no item (botão) ativa pelo clique nativo.
    focused(grid)!.click();
    await settle(grid);

    expect(fixed).toHaveBeenCalledTimes(1);
    expect(headerCell(grid, 'Age').classList.contains('fixed-start')).toBe(true);
    expect(liveRegion(grid).textContent).toBe('Age pinned to start');
    expect(focused(grid)).toBe(headerCell(grid, 'Age'));

    await key(grid, headerCell(grid, 'Age'), 'F10', { shiftKey: true });
    await key(grid, focused(grid)!, 'p');
    await key(grid, focused(grid)!, 'ArrowRight');
    const radios = itemsOf(submenu(grid));
    expect(radios.map(item => item.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(radios[0].getAttribute('aria-disabled')).toBe('false');
    radios[0].click();
    await settle(grid);
    expect(menu(grid)).toBeNull();
    expect(fixed).toHaveBeenCalledTimes(1);
    expect(focused(grid)).toBe(headerCell(grid, 'Age'));

    await key(grid, headerCell(grid, 'Age'), 'F10', { shiftKey: true });
    await key(grid, focused(grid)!, 'p');
    await key(grid, focused(grid)!, 'ArrowRight');
    itemNamed(grid, 'Unpin', submenu(grid)).click();
    await settle(grid);
    expect(liveRegion(grid).textContent).toBe('Age unpinned');
    expect(headerCell(grid, 'Age').classList.contains('fixed')).toBe(false);
  });

  it('axe sem violações com o submenu aberto (LTR e RTL)', async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const grid = await create(g => {
        g.dir = dir;
        g.columnChooser = true;
      });
      menuButton(grid, 'City').click();
      await settle(grid);
      await key(grid, itemNamed(grid, 'Pin column'), dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
      expect(submenu(grid)).toBeTruthy();
      expect(await axeRun(grid)).toEqual([]);
      cleanup();
    }
  });
});

describe('ações do menu do cabeçalho', () => {
  it('Mover à esquerda: o foco segue a coluna até a célula nova e anuncia a posição', async () => {
    const grid = await create();
    const reorder = vi.fn();
    grid.addEventListener('u-grid-column-reorder', reorder);
    const cell = await focusHeader(grid, 'City');
    await key(grid, cell, 'F10', { shiftKey: true });
    itemNamed(grid, 'Move left').click();
    await settle(grid);

    expect(headerLabels(grid)).toEqual(['City', 'Name', 'Age']);
    expect(focused(grid)).toBe(headerCell(grid, 'City'));
    expect(headerCell(grid, 'City').getAttribute('aria-colindex')).toBe('1');
    expect(liveRegion(grid).textContent).toBe('City moved to position 1 of 3');
    expect(reorder).toHaveBeenCalledTimes(1);
  });

  it('Auto-ajustar todas: ajusta as colunas redimensionáveis, anuncia e devolve o foco; autoSizeAllColumns() não dispara eventos', async () => {
    const grid = await create(g => g.columnResizing = true, [
      { path: 'name', label: 'Name', width: 300 },
      { path: 'city', label: 'City', width: 300 },
      { path: 'age', label: 'Age', width: 300, resizable: false },
    ]);
    const resize = vi.fn();
    grid.addEventListener('u-grid-column-resize', resize);

    const cell = await focusHeader(grid, 'Name');
    await key(grid, cell, 'F10', { shiftKey: true });
    itemNamed(grid, 'Auto-size all columns').click();
    await settle(grid);

    expect(headerCell(grid, 'Name').getBoundingClientRect().width).toBeLessThan(200);
    expect(headerCell(grid, 'City').getBoundingClientRect().width).toBeLessThan(200);
    // A não redimensionável fica com a largura dela (a última coluna só leva a sobra do grid).
    expect(resize.mock.calls.map(([event]) => (event as CustomEvent).detail.column.label)).toEqual(['Name', 'City']);
    expect(grid.getState().columns!.find(column => column.name === 'age')!.width).toBeNull();
    expect(liveRegion(grid).textContent).toBe('All columns auto-sized');
    expect(focused(grid)).toBe(headerCell(grid, 'Name'));

    grid.setColumnWidth(grid.columns[0], 320);
    grid.setColumnWidth(grid.columns[2], 320);
    await settle(grid);
    resize.mockClear();
    grid.autoSizeAllColumns();
    await settle(grid);
    // A API ajusta todas as visíveis (também a não redimensionável pelo usuário), sem eventos.
    expect(headerCell(grid, 'Name').getBoundingClientRect().width).toBeLessThan(200);
    // Na última coluna a largura própria encolhe (a sobra do grid continua com ela).
    expect(grid.getState().columns!.find(column => column.name === 'age')!.width).toBeLessThan(200);
    expect(resize).not.toHaveBeenCalled();
  });

  it('Escolher colunas abre o seletor junto da célula; Esc devolve o foco à célula', async () => {
    const grid = await create(g => g.columnChooser = true);
    const cell = await focusHeader(grid, 'City');
    await key(grid, cell, 'F10', { shiftKey: true });
    itemNamed(grid, 'Choose columns').click();
    await settle(grid);

    expect(menu(grid)).toBeNull();
    expect(chooser(grid)).toBeTruthy();
    expect(focused(grid)!.classList.contains('column-chooser-search')).toBe(true);
    await key(grid, focused(grid)!, 'Escape');
    expect(chooser(grid)).toBeNull();
    expect(focused(grid)).toBe(headerCell(grid, 'City'));
  });

  it('resetColumns(): ordem, largura, visibilidade e fixação da definição; ordenação e agrupamento ficam; só u-grid-state-change', async () => {
    const cols: GridColumnDef[] = [
      { path: 'name', label: 'Name', name: 'name', width: 120 },
      { path: 'city', label: 'City', name: 'city' },
      { path: 'age', label: 'Age', name: 'age', fixed: 'end' },
      { path: 'id', label: 'Id', name: 'id' },
    ];
    const grid = await create(g => {
      g.columnChooser = true;
      g.stateChangeDelay = 0;
    }, cols);
    grid.setState({
      version: grid.getState().version,
      columns: [
        { name: 'id', groupIndex: 0 },
        { name: 'name', width: 260, sortOrder: 'desc', sortIndex: 0 },
        { name: 'city', visible: false },
        { name: 'age', fixed: null },
      ],
    }, { partial: true });
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['Name', 'Age']);

    const events = vi.fn();
    const stateChange = vi.fn();

    for (const type of ['u-grid-column-reorder', 'u-grid-column-resize', 'u-grid-column-visibility-change', 'u-grid-column-fixed-change', 'u-grid-sort-change']) {
      grid.addEventListener(type, events);
    }

    grid.addEventListener('u-grid-state-change', stateChange);
    await new Promise(resolve => setTimeout(resolve, 20));
    stateChange.mockClear();

    grid.resetColumns();
    await settle(grid);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(headerLabels(grid)).toEqual(['Name', 'City', 'Age']);
    expect(Math.round(headerCell(grid, 'Name').getBoundingClientRect().width)).toBe(120);
    expect(headerCell(grid, 'Age').classList.contains('fixed-end')).toBe(true);
    expect(grid.getSorting().map(sort => `${sort.column.label}:${sort.order}`)).toEqual(['Name:desc']);
    expect(grid.getState().columns!.find(column => column.name === 'id')!.groupIndex).toBe(0);
    expect(events).not.toHaveBeenCalled();
    expect(stateChange).toHaveBeenCalledTimes(1);
    expect(stateChange.mock.calls[0][0].detail.sources).toEqual(['api']);

    // Pelo menu: mesmo efeito, origem do usuário, foco de volta na célula.
    grid.setColumnWidth(cols[0], 260);
    await settle(grid);
    await new Promise(resolve => setTimeout(resolve, 20));
    stateChange.mockClear();
    const cell = await focusHeader(grid, 'City');
    await key(grid, cell, 'F10', { shiftKey: true });
    itemNamed(grid, 'Reset columns').click();
    await settle(grid);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(Math.round(headerCell(grid, 'Name').getBoundingClientRect().width)).toBe(120);
    expect(stateChange.mock.calls[0][0].detail.sources).toEqual(['user']);
    expect(focused(grid)).toBe(headerCell(grid, 'City'));
    // Pelo menu é anunciado; pela API (acima) não.
    expect(liveRegion(grid).textContent).toBe('Columns reset');
  });
});

describe('seletor de colunas como o do AG Grid', () => {
  const chooserColumns = (): GridColumnDef[] => [
    { path: 'name', label: 'Name' },
    { path: 'city', label: 'City' },
    { path: 'age', label: 'Age' },
    { path: 'id', label: 'Código', visible: false },
  ];

  it('sem botões de fixar; busca com nome filtra (sem acento/caixa) e anuncia a contagem depois da espera', async () => {
    const grid = await create(g => g.columnChooser = true, chooserColumns());
    grid.openColumnChooser();
    await settle(grid);

    expect(chooser(grid)!.querySelector('.column-chooser-pin')).toBeNull();
    expect(chooserLabels(grid)).toEqual(['Name', 'City', 'Age', 'Código']);
    const search = chooser(grid)!.querySelector<HTMLInputElement>('.column-chooser-search')!;
    expect(search.getAttribute('aria-label')).toBe('Search columns');
    expect(focused(grid)).toBe(search);

    search.value = 'CODI';
    search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await settle(grid);
    expect(chooserLabels(grid)).toEqual(['Código']);
    expect(grid._memoryStats.chooserTimers).toBe(1);
    expect(liveRegion(grid).textContent).not.toBe('Columns: 1');
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(liveRegion(grid).textContent).toBe('Columns: 1');
    expect(grid._memoryStats.chooserTimers).toBe(0);

    // Fechar limpa a busca e o timer.
    search.value = 'a';
    search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await key(grid, search, 'Escape');
    expect(grid._memoryStats.chooserTimers).toBe(0);
    grid.openColumnChooser();
    await settle(grid);
    expect(chooserLabels(grid)).toHaveLength(4);
  });

  it('"Mostrar todas": misto com uma oculta; marcar mostra todas; desmarcar deixa a última visível', async () => {
    const grid = await create(g => g.columnChooser = true, chooserColumns());
    grid.openColumnChooser();
    await settle(grid);
    const all = chooser(grid)!.querySelector<HTMLInputElement>('.column-chooser-all input')!;
    expect(chooser(grid)!.querySelector('.column-chooser-all')!.textContent.trim()).toBe('Show all columns');
    expect(all.indeterminate).toBe(true);

    all.click();
    await settle(grid);
    expect(headerLabels(grid)).toEqual(['Name', 'City', 'Age', 'Código']);
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);

    all.click();
    await settle(grid);
    expect(headerLabels(grid)).toHaveLength(1);
    expect(all.indeterminate).toBe(true);
  });

  it('Alt+Shift+↑/↓ na caixa: move, dispara u-grid-column-reorder, anuncia e o foco fica na caixa', async () => {
    const grid = await create(g => g.columnChooser = true, chooserColumns());
    const reorder = vi.fn();
    grid.addEventListener('u-grid-column-reorder', reorder);
    grid.openColumnChooser();
    await settle(grid);

    const box = chooserBox(grid, 'Age');
    expect(box.getAttribute('aria-keyshortcuts')).toBe('Alt+Shift+ArrowUp Alt+Shift+ArrowDown');
    expect(box.getAttribute('aria-describedby')).toBe('column-chooser-reorder-hint');
    expect(chooser(grid)!.querySelector('#column-chooser-reorder-hint')!.textContent).toBe('Alt+Shift+Up or Down arrow moves the column');
    box.focus();
    await key(grid, box, 'ArrowUp', { altKey: true, shiftKey: true });

    expect(chooserLabels(grid)).toEqual(['Name', 'Age', 'City', 'Código']);
    expect(headerLabels(grid)).toEqual(['Name', 'Age', 'City']);
    expect(reorder).toHaveBeenCalledTimes(1);
    expect(reorder.mock.calls[0][0].detail).toMatchObject({ index: 1, previousIndex: 2 });
    expect(liveRegion(grid).textContent).toBe('Age moved to position 2 of 4');
    expect(focused(grid)).toBe(chooserBox(grid, 'Age'));

    await key(grid, chooserBox(grid, 'Age'), 'ArrowDown', { altKey: true, shiftKey: true });
    expect(chooserLabels(grid)).toEqual(['Name', 'City', 'Age', 'Código']);
    expect(focused(grid)).toBe(chooserBox(grid, 'Age'));

    // No limite não move.
    await key(grid, chooserBox(grid, 'Name'), 'ArrowUp', { altKey: true, shiftKey: true });
    expect(reorder).toHaveBeenCalledTimes(2);
  });

  it('Alt+Shift+↑ recusado (coluna livre contra fixa): nada muda, anuncia o porquê, o foco fica', async () => {
    const grid = await create(g => g.columnChooser = true, [
      { path: 'id', label: 'Id', fixed: 'start' },
      { path: 'name', label: 'Name' },
      { path: 'city', label: 'City' },
    ]);
    const reorder = vi.fn();
    grid.addEventListener('u-grid-column-reorder', reorder);
    grid.openColumnChooser();
    await settle(grid);

    const box = chooserBox(grid, 'Name');
    box.focus();
    await key(grid, box, 'ArrowUp', { altKey: true, shiftKey: true });

    expect(chooserLabels(grid)).toEqual(['Id', 'Name', 'City']);
    expect(reorder).not.toHaveBeenCalled();
    expect(liveRegion(grid).textContent).toBe('Name can\'t move past Id');
    expect(focused(grid)).toBe(chooserBox(grid, 'Name'));
  });

  it('alça de arrasto: aria-hidden, fora do foco; arrastar Name para depois de Age reordena', async () => {
    const grid = await create(g => g.columnChooser = true, chooserColumns());
    grid.openColumnChooser();
    await settle(grid);

    const handle = chooser(grid)!.querySelector<HTMLElement>('.column-chooser-drag-handle')!;
    expect(handle.getAttribute('aria-hidden')).toBe('true');
    expect(handle.tabIndex).toBe(-1);

    const ageRow = chooserBox(grid, 'Age').closest('li')!.getBoundingClientRect();
    const pointer = (type: string, y: number) => handle.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: y,
    }));
    pointer('pointerdown', handle.getBoundingClientRect().top + 4);
    expect(grid._memoryStats.chooserTimers).toBe(1);
    pointer('pointermove', ageRow.bottom - 4);
    expect(chooserBox(grid, 'Age').closest('li')!.classList.contains('drop-after')).toBe(true);
    pointer('pointerup', ageRow.bottom - 4);
    await settle(grid);

    expect(chooserLabels(grid)).toEqual(['City', 'Age', 'Name', 'Código']);
    expect(grid._memoryStats.chooserTimers).toBe(0);
  });

  it('axe sem violações com o seletor aberto e buscando', async () => {
    const grid = await create(g => g.columnChooser = true, chooserColumns());
    grid.openColumnChooser();
    await settle(grid);
    expect(await axeRun(grid)).toEqual([]);
  });
});

// Relato de uso (0.2.0): "Versão" virava "Ver…" numa coluna de 110px com funil e "⋮".
describe('espaço dos botões do cabeçalho', () => {
  it('funil e ⋮ juntos e sobre o padding do fim, sem cobrir a alça; o rótulo ganha o espaço', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'v', label: 'Versão', width: 110 },
        { path: 'n', label: 'Número', width: 110, dataType: 'number' },
        { path: 'x', label: 'X' },
      ],
      items: [{ v: 'a', n: 1, x: 1 }],
      configure: g => {
        g.headerFilter = true;
        g.columnResizing = true;
      },
    });
    const [start, end] = [...grid.shadowRoot!.querySelectorAll<HTMLElement>('th.header-column')];

    const box = (th: HTMLElement, selector: string) => {
      const cell = th.getBoundingClientRect();
      const rect = th.querySelector(selector)!.getBoundingClientRect();
      return { left: Math.round(rect.left - cell.left), right: Math.round(rect.right - cell.left), width: Math.round(rect.width) };
    };

    // Alvos de 24px (WCAG 2.5.8) lado a lado; o "⋮" termina onde começa a alça (8px do fim).
    const funnel = box(start, '.header-filter-button');
    const button = box(start, '.column-header-menu-button');
    const handle = box(start, '.resize-handle');

    expect([funnel.width, button.width]).toEqual([24, 24]);
    expect(funnel.right).toBe(button.left);
    expect(button.right).toBe(handle.left);
    expect(handle.right).toBe(110);
    // 110 − 16 (padding do começo) − 4 (espaço até os botões) − 48 − 8 (alça) = 34 (era 24).
    expect(box(start, '.header-text').width).toBe(34);

    // Alinhada no fim: os botões vão para o começo, sem avançar sobre o padding (o "⋮" não encosta no da coluna anterior).
    expect(box(end, '.column-header-menu-button').left).toBe(16);

    // RTL: espelhado — o "⋮" termina (à esquerda) onde começa a alça.
    grid.dir = 'rtl';
    await settle(grid);
    const [rtlStart, rtlEnd] = [...grid.shadowRoot!.querySelectorAll<HTMLElement>('th.header-column')];
    expect(box(rtlStart, '.column-header-menu-button').left).toBe(box(rtlStart, '.resize-handle').right);
    expect(box(rtlStart, '.resize-handle').left).toBe(0);
    expect(110 - box(rtlEnd, '.column-header-menu-button').right).toBe(16);
  });
});
