/**
 * Frente 18 — barra de ferramentas e menu de contexto: composição da barra
 * (`toolbarItems`), roving, recolhimento no "mais", exportar pela interface,
 * menu de contexto em todos os alvos (`u-grid-context-menu-opening`), itens
 * embutidos, teclado (Shift+F10, tecla Menu, setas, letra, Esc/Tab),
 * `copySelection()`, `openContextMenu()`, toque longo e axe.
 */
import { html } from 'lit';

import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';

import type { GridContextMenuOpeningEventDetail } from './features/context-menu.js';
import type { GridToolbarItem } from './features/toolbar.js';
import type { GridColumnDef } from './grid-column-def.js';
import { type DataGrid, GRID_DEFAULT_TOOLBAR_ITEMS, type GridExportingEventDetail } from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';

declare module 'vitest/browser' {
  interface BrowserCommands {
    emulateMedia: (options: { forcedColors?: 'active' | 'none' | null; reducedMotion?: 'reduce' | 'no-preference' | null }) => Promise<void>;
  }
}

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await commands.emulateMedia({ forcedColors: null });
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
  { id: 4, name: 'Duda', city: 'BH', age: 19 },
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'city', label: 'City' },
  { path: 'age', label: 'Age' },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const focused = (grid: DataGrid): HTMLElement | null => root(grid).activeElement as HTMLElement | null;
const roving = (grid: DataGrid): HTMLElement => root(grid).querySelector<HTMLElement>('.toolbar-roving')!;
const rovingItems = (grid: DataGrid): HTMLElement[] => [...roving(grid).querySelectorAll<HTMLElement>('[data-roving]')];
const menu = (grid: DataGrid): HTMLElement | null => root(grid).querySelector<HTMLElement>('[role=menu]');
const menuItems = (grid: DataGrid): HTMLElement[] => [...menu(grid)?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []];
const menuTexts = (grid: DataGrid): string[] => menuItems(grid).map(item => item.querySelector('.menu-item-text')!.textContent.trim());
const itemNamed = (grid: DataGrid, text: string): HTMLElement => menuItems(grid).find(item => item.querySelector('.menu-item-text')!.textContent.trim() === text)!;
const headerCell = (grid: DataGrid, label: string): HTMLElement =>
  [...root(grid).querySelectorAll<HTMLElement>('th.header-column')].find(th => th.querySelector('.header-text')!.textContent === label)!;
const cellOf = (grid: DataGrid, text: string): HTMLElement =>
  [...root(grid).querySelectorAll<HTMLElement>('td[role=gridcell]')].find(td => td.textContent.trim() === text)!;
const liveRegion = (grid: DataGrid): HTMLElement => root(grid).querySelector<HTMLElement>('[role=status]')!;

const key = async (grid: DataGrid, target: HTMLElement, name: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  await settle(grid);
  return event;
};

const contextMenu = async (grid: DataGrid, target: HTMLElement, init: MouseEventInit = {}): Promise<MouseEvent> => {
  const event = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 40, clientY: 40, ...init });
  target.dispatchEvent(event);
  await settle(grid);
  return event;
};

const create = (configure?: (grid: DataGrid) => void, height = '400px') =>
  createGrid({ columns: columns(), items: people(), height, configure: grid => {
    grid.keyExpr = 'id';
    configure?.(grid);
  } });

describe('barra: composição', () => {
  it('automática = GRID_DEFAULT_TOOLBAR_ITEMS: painel, botões no fim e a busca avulsa na ponta', async () => {
    const grid = await create(g => {
      g.columnChooser = true;
      g.showSearchPanel = true;
      g.exportFormats = ['csv'];
    });

    expect(GRID_DEFAULT_TOOLBAR_ITEMS).toEqual(['groupPanel', 'addRowButton', 'saveButton', 'discardButton', 'exportButton', 'columnChooserButton', 'searchPanel']);
    const toolbar = root(grid).querySelector<HTMLElement>('[part=toolbar]')!;
    expect(roving(grid).getAttribute('role')).toBe('toolbar');
    expect(root(grid).getElementById(roving(grid).getAttribute('aria-labelledby')!)!.textContent).toBe('Grid toolbar');
    expect(rovingItems(grid).map(item => item.getAttribute('data-roving'))).toEqual(['b:exportButton', 'b:columnChooserButton']);
    // A busca fica fora do roving, depois dele.
    expect(roving(grid).contains(toolbar.querySelector('.search-panel'))).toBe(false);
    expect(toolbar.lastElementChild!.querySelector('.search-panel')).not.toBeNull();
    // O painel de grupos é um grupo dentro da barra (não outra barra).
    expect(toolbar.querySelector('.group-container')!.getAttribute('role')).toBe('group');
  });

  it('toolbarItems: ordem, lado, embutido desligado (aviso), botão sem nome (aviso), [] esconde', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const action = vi.fn();
    const grid = await create(g => {
      g.columnChooser = true;
      g.toolbarItems = [
        { text: 'Refresh', action, location: 'start' },
        'columnChooserButton',
        'addRowButton',
        { text: '', action },
        { name: 'groupPanel', location: 'end' },
      ];
    });

    expect(rovingItems(grid).map(item => item.getAttribute('data-roving'))).toEqual(['h:0', 'b:columnChooserButton']);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/addRowButton" is not shown/);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/without `text`/);
    // O painel foi para o fim (depois do seletor).
    const children = [...roving(grid).children];
    expect(children.indexOf(roving(grid).querySelector('.group-container')!)).toBeGreaterThan(children.indexOf(roving(grid).querySelector('.column-chooser-button')!));

    rovingItems(grid)[0].click();
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ grid }));

    expect(Object.isFrozen(grid.toolbarItems)).toBe(true);
    grid.toolbarItems = [];
    await settle(grid);
    expect(root(grid).querySelector('[part=toolbar]')).toBeNull();
  });

  it('botão do hospedeiro só com ícone: nome pelo texto, ícone aria-hidden; `renderer` fora do roving com signal', async () => {
    let signal: AbortSignal | undefined;
    const icon = html`<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"></path></svg>`;
    const grid = await create(g => {
      g.toolbarItems = [
        { text: 'Refresh', icon: 'R', showText: 'in-menu', action: () => undefined },
        { text: 'Print', icon, action: () => undefined },
        {
          renderer: ({ signal: s }) => {
            signal = s;
            const select = document.createElement('select');
            select.setAttribute('aria-label', 'View');
            return select;
          },
        },
      ];
    });

    const [refresh, print] = rovingItems(grid);
    expect(refresh.getAttribute('aria-label')).toBe('Refresh');
    expect(refresh.querySelector('.toolbar-icon')!.getAttribute('aria-hidden')).toBe('true');
    expect(print.textContent.trim()).toBe('Print');
    expect(roving(grid).querySelector('.toolbar-content')).toBeNull();
    expect(grid.querySelector('select[aria-label=View]')).not.toBeNull();
    expect(signal!.aborted).toBe(false);

    grid.toolbarItems = [];
    await settle(grid);
    expect(signal!.aborted).toBe(true);
    expect(grid.querySelector('select')).toBeNull();
  });
});

describe('barra: avisos e validação', () => {
  it('embutido desligado avisa uma vez (também em string, renderizando de novo); exportFormats valida na propriedade', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await create(g => {
      g.toolbarItems = ['exportButton', 'columnChooserButton'];
    });

    grid.striped = true;
    await settle(grid);
    grid.striped = false;
    await settle(grid);
    const messages = warn.mock.calls.flat().map(String);
    expect(messages.filter(text => text.includes('"exportButton" is not shown'))).toHaveLength(1);
    expect(messages.filter(text => text.includes('"columnChooserButton" is not shown'))).toHaveLength(1);

    grid.exportFormats = ['CSV', 'pdf'] as never;
    expect(grid.exportFormats).toEqual(['csv']);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/unknown export format\(s\) ignored: pdf/);
  });
});

describe('barra: roving', () => {
  it('um ponto de Tab; ←/→/Home/End; RTL inverte; chips no limite passam ao vizinho', async () => {
    const grid = await create(g => {
      g.columnChooser = true;
      g.toolbarItems = [{ text: 'One', action: () => undefined, location: 'start' }, 'groupPanel', 'columnChooserButton'];
    });

    grid.groupColumn(grid.columns[1]);
    await settle(grid);

    const tabStops = () => rovingItems(grid).filter(item => item.tabIndex === 0);
    expect(tabStops()).toHaveLength(1);

    rovingItems(grid)[0].focus();
    await key(grid, focused(grid)!, 'ArrowRight');
    expect(focused(grid)!.classList.contains('group')).toBe(true);
    await key(grid, focused(grid)!, 'ArrowRight');
    expect(focused(grid)!.classList.contains('column-chooser-button')).toBe(true);
    expect(tabStops()).toEqual([focused(grid)]);
    await key(grid, focused(grid)!, 'Home');
    expect(focused(grid)!.textContent.trim()).toBe('One');
    await key(grid, focused(grid)!, 'End');
    expect(focused(grid)!.classList.contains('column-chooser-button')).toBe(true);

    grid.setAttribute('dir', 'rtl');
    await settle(grid);
    await key(grid, focused(grid)!, 'ArrowRight');
    expect(focused(grid)!.classList.contains('group')).toBe(true);
  });

  it('chip desagrupado (Delete) não deixa a barra sem ponto de Tab', async () => {
    const grid = await create(g => {
      g.columnChooser = true;
    });

    grid.groupColumn(grid.columns[1]);
    await settle(grid);

    const chip = root(grid).querySelector<HTMLElement>('.group')!;
    chip.focus();
    await key(grid, chip, 'Delete');
    expect(root(grid).querySelector('.group')).toBeNull();
    expect(rovingItems(grid).filter(item => item.tabIndex === 0)).toHaveLength(1);
  });
});

describe('barra: recolhimento no "mais"', () => {
  const many = (action: () => void): GridToolbarItem[] => ['One', 'Two', 'Three', 'Four', 'Five'].map(text => ({ text: `Action ${text}`, action, locateInMenu: 'auto' as const }));

  it('o que não cabe vai ao "mais" (do fim); o item roda pelo menu e o foco volta ao botão', async () => {
    const action = vi.fn();
    const grid = await create(g => {
      g.style.width = '320px';
      g.toolbarItems = many(action);
    });

    await vi.waitFor(() => expect(root(grid).querySelector('.toolbar-more-button')).not.toBeNull());
    const more = root(grid).querySelector<HTMLElement>('.toolbar-more-button')!;
    const visible = rovingItems(grid).filter(item => item !== more)
      .map(item => item.textContent.trim());
    expect(visible.length).toBeLessThan(5);
    expect(roving(grid).scrollWidth).toBeLessThanOrEqual(roving(grid).clientWidth + 1);
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    expect(more.getAttribute('aria-label')).toBe('More actions');

    more.focus();
    await key(grid, more, 'ArrowDown');
    expect(menu(grid)!.getAttribute('aria-labelledby')).toBe(more.id);
    expect(menuTexts(grid)).toEqual(['Action One', 'Action Two', 'Action Three', 'Action Four', 'Action Five'].slice(visible.length));
    expect(focused(grid)).toBe(menuItems(grid)[0]);

    menuItems(grid)[0].click();
    await settle(grid);
    expect(action).toHaveBeenCalledTimes(1);
    expect(menu(grid)).toBeNull();
    expect(focused(grid)).toBe(more);

    // Mais largo: tudo volta para a barra.
    grid.style.width = '1200px';
    await vi.waitFor(() => expect(root(grid).querySelector('.toolbar-more-button')).toBeNull());
  });

  it('`always` vai sempre; o seletor pelo "mais" abre o painel e devolve o foco ao "mais"', async () => {
    const grid = await create(g => {
      g.columnChooser = true;
      g.toolbarItems = [{ name: 'columnChooserButton', locateInMenu: 'always' }];
    });

    const more = root(grid).querySelector<HTMLElement>('.toolbar-more-button')!;
    more.click();
    await settle(grid);
    expect(menuItems(grid)[0].getAttribute('aria-haspopup')).toBe('dialog');
    menuItems(grid)[0].click();
    await settle(grid);
    expect(root(grid).querySelector('.column-chooser')).not.toBeNull();

    await key(grid, focused(grid)!, 'Escape');
    expect(root(grid).querySelector('.column-chooser')).toBeNull();
    expect(focused(grid)).toBe(more);
  });
});

describe('exportar pela interface', () => {
  const fakeExporter = () => vi.fn((_grid: DataGrid, _options: { selectedOnly: boolean; signal: AbortSignal }) => Promise.resolve());

  it('menu CSV/Excel (+ selecionadas); u-grid-exporting → exportador → u-grid-export + anúncio', async () => {
    const exporter = fakeExporter();
    const grid = await create(g => {
      g.exportFormats = ['csv', 'xlsx'];
      g.xlsxExporter = exporter;
      g.selectionMode = 'multiple';
    });

    const events: string[] = [];
    grid.addEventListener('u-grid-exporting', event => events.push(`exporting:${event.detail.format}:${event.detail.selectedOnly}`));
    grid.addEventListener('u-grid-export', event => events.push(`export:${event.detail.format}`));

    const button = root(grid).querySelector<HTMLElement>('.export-button')!;
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    button.click();
    await settle(grid);
    expect(menuTexts(grid)).toEqual(['Export to CSV', 'Export selected rows to CSV', 'Export to Excel', 'Export selected rows to Excel']);
    expect(itemNamed(grid, 'Export selected rows to Excel').getAttribute('aria-disabled')).toBe('true');

    itemNamed(grid, 'Export to Excel').click();
    await vi.waitFor(() => expect(events).toEqual(['exporting:xlsx:false', 'export:xlsx']));
    expect(exporter).toHaveBeenCalledWith(grid, expect.objectContaining({ selectedOnly: false }));
    expect(focused(grid)).toBe(button);
    await vi.waitFor(() => expect(liveRegion(grid).textContent.trim()).toBe('Exported to Excel'));
  });

  it('cancelado não exporta; erro dispara u-grid-export-error; sem exportador o xlsx some (aviso)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exporter = vi.fn(() => Promise.reject(new Error('boom')));
    const grid = await create(g => {
      g.setAttribute('export-formats', 'csv, xlsx pdf');
    });

    expect(grid.exportFormats).toEqual(['csv', 'xlsx']);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/pdf/);
    // Só CSV (sem exportador): botão direto.
    const button = root(grid).querySelector<HTMLElement>('.export-button')!;
    expect(button.hasAttribute('aria-haspopup')).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Export to CSV');

    grid.addEventListener('u-grid-exporting', event => event.preventDefault(), { once: true });
    const download = vi.spyOn(grid, 'downloadCsv');
    button.click();
    await settle(grid);
    expect(download).not.toHaveBeenCalled();

    grid.xlsxExporter = exporter;
    grid.exportFormats = ['xlsx'];
    await settle(grid);
    const failures: GridExportingEventDetail[] = [];
    grid.addEventListener('u-grid-export-error', event => failures.push(event.detail));
    root(grid).querySelector<HTMLElement>('.export-button')!.click();
    await vi.waitFor(() => expect(failures).toHaveLength(1));
    expect(error).toHaveBeenCalled();
    await vi.waitFor(() => expect(liveRegion(grid).textContent.trim()).toBe('Export failed'));
  });

  it('desconectar aborta a exportação em curso (signal) sem evento de erro', async () => {
    let received: AbortSignal | undefined;
    const grid = await create(g => {
      g.exportFormats = ['xlsx'];

      g.xlsxExporter = (_grid, { signal }) => {
        received = signal;
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
      };
    });

    const errors = vi.fn();
    grid.addEventListener('u-grid-export-error', errors);
    root(grid).querySelector<HTMLElement>('.export-button')!.click();
    await settle(grid);
    expect(root(grid).querySelector('.export-button')!.getAttribute('aria-disabled')).toBe('true');
    grid.remove();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(received!.aborted).toBe(true);
    expect(errors).not.toHaveBeenCalled();
    expect(grid._memoryStats.exportTimers).toBe(0);
  });
});

describe('menu de contexto', () => {
  it('cabeçalho: ordenar, fixar ▸, largura, mover, agrupar, colunas; o evento acrescenta e tira; a ação do hospedeiro recebe o contexto', async () => {
    const action = vi.fn();
    const grid = await create(g => {
      g.columnResizing = true;
      g.columnChooser = true;
    });

    grid.addEventListener('u-grid-context-menu-opening', event => {
      const detail = event.detail;
      expect(detail.target).toBe('header');
      expect(detail.column?.label).toBe('City');
      expect(detail.cellType).toBe('header');
      detail.menuItems.splice(detail.menuItems.findIndex(item => item.name === 'autoSizeColumn'), 1);
      detail.menuItems.push({ id: 'stats', text: 'Statistics', separatorBefore: true, action });
    });

    const event = await contextMenu(grid, headerCell(grid, 'City'));
    expect(event.defaultPrevented).toBe(true);
    expect(menu(grid)!.getAttribute('part')).toBe('menu column-header-menu');
    expect(menuTexts(grid)).toEqual([
      'Sort ascending',
      'Sort descending',
      'Pin column',
      'Auto-size all columns',
      'Increase width',
      'Decrease width',
      'Move left',
      'Move right',
      'Group by this column',
      'Choose columns',
      'Reset columns',
      'Statistics',
    ]);
    // "Limpar ordenação" só com a coluna ordenada (AG Grid).
    expect(menuTexts(grid)).not.toContain('Clear sorting');
    // Texto do hospedeiro: idioma do conteúdo (o `lang` mais próximo do grid), não o da i18n.
    expect(itemNamed(grid, 'Statistics').getAttribute('lang')).toBe(grid.closest('[lang]')?.getAttribute('lang') ?? '');
    expect(itemNamed(grid, 'Sort ascending').getAttribute('lang')).toBe('en');
    expect(menu(grid)!.querySelectorAll('[role=separator]').length).toBeGreaterThan(1);

    itemNamed(grid, 'Sort descending').click();
    await settle(grid);
    expect(grid.getSorting().map(sort => `${sort.column.label}:${sort.order}`)).toEqual(['City:desc']);
    expect(focused(grid)).toBe(headerCell(grid, 'City'));

    await contextMenu(grid, headerCell(grid, 'City'));
    itemNamed(grid, 'Statistics').click();
    await settle(grid);
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ target: 'header', column: grid.columns[1], grid, menuItem: expect.objectContaining({ id: 'stats' }) }));
    expect(focused(grid)).toBe(headerCell(grid, 'City'));

    await contextMenu(grid, headerCell(grid, 'City'));
    itemNamed(grid, 'Pin column').click();
    await settle(grid);
    [...root(grid).querySelectorAll<HTMLElement>('.context-menu-panel-submenu [role=menuitemradio]')].find(item => item.textContent.trim() === 'Pin to end')!.click();
    await settle(grid);
    expect(headerCell(grid, 'City').classList.contains('fixed')).toBe(true);
  });

  it('cancelado ou vazio: sem menu e sem preventDefault (fica o do navegador); Ctrl+clique e texto selecionado também', async () => {
    const grid = await create();

    grid.addEventListener('u-grid-context-menu-opening', event => event.preventDefault(), { once: true });
    let event = await contextMenu(grid, headerCell(grid, 'Name'));
    expect(event.defaultPrevented).toBe(false);
    expect(menu(grid)).toBeNull();

    // Linhas sem `row-menu` e sem itens do hospedeiro: nada.
    event = await contextMenu(grid, cellOf(grid, 'Ana'));
    expect(event.defaultPrevented).toBe(false);
    expect(menu(grid)).toBeNull();

    grid.rowMenu = true;
    await settle(grid);
    event = await contextMenu(grid, cellOf(grid, 'Ana'), { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(menu(grid)).toBeNull();
  });

  it('item embutido de outro alvo e item sem nome: avisa e ignora', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await create();

    grid.addEventListener('u-grid-context-menu-opening', event => {
      event.detail.menuItems.splice(0, Infinity, { name: 'copyCell' }, { text: 'No action' });
    }, { once: true });

    const event = await contextMenu(grid, headerCell(grid, 'Name'));
    expect(event.defaultPrevented).toBe(false);
    expect(menu(grid)).toBeNull();
    expect(warn.mock.calls.flat().join(' ')).toMatch(/"copyCell" does not apply to "header"/);
  });

  it('linha (`row-menu`): copiar célula/selecionadas, editar, excluir, detalhe; contexto com item, chave e coluna', async () => {
    const writes: string[] = [];
    vi.spyOn(navigator.clipboard, 'write').mockImplementation(async items => {
      writes.push(await (await items[0].getType('text/plain')).text());
    });
    const grid = await create(g => {
      g.rowMenu = true;
      g.selectionMode = 'multiple';
      g.allowEditing = true;
      g.allowRemoving = true;
      g.detailRenderer = () => 'detail';
      g.exportFormats = ['csv'];
    });

    let detail: GridContextMenuOpeningEventDetail | undefined;
    grid.addEventListener('u-grid-context-menu-opening', event => {
      detail = event.detail;
    });

    grid.selectRows([1, 2]);
    await settle(grid);
    await contextMenu(grid, cellOf(grid, 'Rio'));
    expect(detail).toMatchObject({ target: 'row', cellType: 'data', rowKey: 1, column: grid.columns[1] });
    expect(detail!.item).toMatchObject({ name: 'Ana' });
    expect(menu(grid)!.getAttribute('aria-label')).toBe('Row options');
    expect(menuTexts(grid)).toEqual(['Copy', 'Copy selected rows', 'Export selected rows to CSV', 'Edit', 'Delete', 'Show details']);

    itemNamed(grid, 'Copy').click();
    await vi.waitFor(() => expect(writes).toEqual(['Rio']));
    expect(focused(grid)).toBe(cellOf(grid, 'Rio'));

    await contextMenu(grid, cellOf(grid, 'Rio'));
    itemNamed(grid, 'Copy selected rows').click();
    await vi.waitFor(() => expect(writes[1]).toBe('Ana\tRio\t30\r\nBia\tSP\t25'));

    await contextMenu(grid, cellOf(grid, 'Rio'));
    itemNamed(grid, 'Edit').click();
    await settle(grid);
    expect(focused(grid)!.matches('input')).toBe(true);
  });

  it('linha de grupo: expandir/recolher, tudo, desagrupar; nome com o valor do grupo', async () => {
    const grid = await create(g => {
      g.rowMenu = true;
      g.autoExpandGroups = true;
    });

    grid.groupColumn(grid.columns[1]);
    await settle(grid);

    const group = root(grid).querySelector<HTMLElement>('tr.group-row td[tabindex]')!;
    await contextMenu(grid, group);
    expect(menu(grid)!.getAttribute('aria-label')).toBe('Options for group BH');
    expect(menuTexts(grid)).toEqual(['Collapse group', 'Expand all groups', 'Collapse all groups', 'Ungroup']);

    itemNamed(grid, 'Collapse group').click();
    await settle(grid);
    expect(grid.isGroupExpanded(['BH'])).toBe(false);
    expect(focused(grid)!.closest('tr')!.classList.contains('group-row')).toBe(true);
  });

  it('teclado: Shift+F10 na célula abre, setas e letra andam, Esc devolve o foco à célula; Tab fecha', async () => {
    const grid = await create(g => {
      g.rowMenu = true;
      g.allowEditing = true;
      g.allowRemoving = true;
    });

    const cell = cellOf(grid, 'Bia');
    cell.focus();
    await settle(grid);
    const event = await key(grid, cell, 'F10', { shiftKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(focused(grid)).toBe(menuItems(grid)[0]);

    await key(grid, focused(grid)!, 'ArrowUp');
    expect(focused(grid)).toBe(menuItems(grid).at(-1));
    await key(grid, focused(grid)!, 'e');
    expect(focused(grid)!.textContent.trim()).toBe('Edit');
    await key(grid, focused(grid)!, 'Home');
    expect(focused(grid)).toBe(menuItems(grid)[0]);

    await key(grid, focused(grid)!, 'Escape');
    expect(menu(grid)).toBeNull();
    expect(focused(grid)).toBe(cellOf(grid, 'Bia'));

    await key(grid, cellOf(grid, 'Bia'), 'ContextMenu');
    expect(menu(grid)).not.toBeNull();
    await key(grid, focused(grid)!, 'Tab');
    expect(menu(grid)).toBeNull();
    expect(focused(grid)).toBe(cellOf(grid, 'Bia'));
  });

  it('Shift+F10 num campo editável da célula fica com o menu nativo', async () => {
    const grid = await create(g => {
      g.rowMenu = true;
      g.allowEditing = true;
    });

    grid.editCell(2, grid.columns[0]);
    await settle(grid);
    const input = focused(grid)!;
    expect(input.matches('input')).toBe(true);
    const event = await key(grid, input, 'F10', { shiftKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(menu(grid)).toBeNull();
  });

  it('painel de grupos e cabeçalho usam o mesmo motor (part `menu`)', async () => {
    const grid = await create();

    grid.groupColumn(grid.columns[1]);
    await settle(grid);
    await contextMenu(grid, root(grid).querySelector<HTMLElement>('.group')!);
    expect(menu(grid)!.getAttribute('part')).toBe('menu group-panel-menu');
    expect(menuTexts(grid)).toEqual(['Ungroup', 'Move left', 'Move right', 'Ungroup all', 'Expand all groups', 'Collapse all groups']);
  });

  it('openContextMenu/closeContextMenu: abre sob a âncora e devolve o foco a ela', async () => {
    const grid = await create(g => {
      g.rowMenu = true;
    });

    const anchor = document.createElement('button');
    anchor.textContent = 'More';
    document.body.append(anchor);
    anchor.focus();

    expect(grid.openContextMenu({ rowKey: 999 })).toBe(false);
    expect(grid.openContextMenu({ rowKey: 3, column: grid.columns[0] }, anchor)).toBe(true);
    await settle(grid);
    expect(menuTexts(grid)).toEqual(['Copy']);
    await key(grid, focused(grid)!, 'Escape');
    expect(document.activeElement).toBe(anchor);

    expect(grid.openContextMenu({ column: grid.columns[2] })).toBe(true);
    await settle(grid);
    expect(menu(grid)!.getAttribute('aria-label')).toBe('Options for Age');
    grid.closeContextMenu();
    await settle(grid);
    expect(menu(grid)).toBeNull();
    anchor.remove();
  });

  it('toque longo abre o menu e engole o clique seguinte; mover cancela', async () => {
    const grid = await create(g => {
      g.rowMenu = true;
    });

    const cell = cellOf(grid, 'Caio');
    const touch = (type: string, x = 20, y = 20) => cell.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, cancelable: true, pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: x, clientY: y,
    }));

    touch('pointerdown');
    touch('pointermove', 60, 20);
    await new Promise(resolve => setTimeout(resolve, 600));
    await settle(grid);
    expect(menu(grid)).toBeNull();

    touch('pointerdown');
    await new Promise(resolve => setTimeout(resolve, 600));
    await settle(grid);
    expect(menu(grid)).not.toBeNull();

    const click = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
    cell.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(grid._memoryStats.longPressTimers).toBe(0);
  });
});

describe('copySelection()', () => {
  it('copia as selecionadas pela Clipboard API; cancelado escreve o que o ouvinte pôs; clipboard-mode none', async () => {
    const writes: { text: string; html: string | null }[] = [];
    vi.spyOn(navigator.clipboard, 'write').mockImplementation(async items => {
      const item = items[0];
      writes.push({
        text: await (await item.getType('text/plain')).text(),
        html: item.types.includes('text/html') ? await (await item.getType('text/html')).text() : null,
      });
    });
    const grid = await create(g => {
      g.selectionMode = 'multiple';
    });

    expect(await grid.copySelection()).toBe(false);

    grid.selectRows([2, 4]);
    await settle(grid);
    const sources: string[] = [];
    grid.addEventListener('u-grid-copying', event => sources.push(event.detail.source));
    expect(await grid.copySelection()).toBe(true);
    expect(writes[0].text).toBe('Bia\tSP\t25\r\nDuda\tBH\t19');
    expect(writes[0].html).toContain('<table');
    expect(sources).toEqual(['api']);

    grid.addEventListener('u-grid-copying', event => {
      event.preventDefault();
      event.detail.clipboardData.setData('text/plain', 'custom');
    }, { once: true });
    expect(await grid.copySelection()).toBe(true);
    expect(writes[1]).toEqual({ text: 'custom', html: null });

    vi.spyOn(navigator.clipboard, 'write').mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    expect(await grid.copySelection()).toBe(false);

    grid.clipboardMode = 'none';
    expect(await grid.copySelection()).toBe(false);
  });
});

describe('axe', () => {
  it('sem violações: barra com "mais", menu da barra aberto, menu de contexto aberto, RTL', async () => {
    const grid = await create(g => {
      g.columnChooser = true;
      g.showSearchPanel = true;
      g.exportFormats = ['csv'];
      g.rowMenu = true;
      g.toolbarItems = [...GRID_DEFAULT_TOOLBAR_ITEMS, { text: 'Refresh', action: () => undefined, locateInMenu: 'always' }];
    });

    grid.groupColumn(grid.columns[1]);
    await settle(grid);
    const run = async () => (await axe.run(grid, { resultTypes: ['violations'] })).violations.map(v => v.id);
    expect(await run()).toEqual([]);

    root(grid).querySelector<HTMLElement>('.toolbar-more-button')!.click();
    await settle(grid);
    expect(menu(grid)).not.toBeNull();
    expect(await run()).toEqual([]);
    await key(grid, focused(grid)!, 'Escape');

    await contextMenu(grid, headerCell(grid, 'Name'));
    expect(await run()).toEqual([]);
    await key(grid, focused(grid)!, 'Escape');

    grid.setAttribute('dir', 'rtl');
    grid.language = 'ar';
    await settle(grid);
    expect(await run()).toEqual([]);
  });
});

describe('roteiro de teclado e foco depois de cada ação', () => {
  it('excluir: diálogo; cancelar volta à célula; confirmar leva à mesma coluna da linha seguinte', async () => {
    const grid = await create(g => {
      g.rowMenu = true;
      g.allowRemoving = true;
    });

    cellOf(grid, 'Bia').focus();
    await key(grid, cellOf(grid, 'Bia'), 'F10', { shiftKey: true });
    itemNamed(grid, 'Delete').click();
    await settle(grid);
    const dialog = root(grid).querySelector<HTMLDialogElement>('dialog.remove-dialog')!;
    expect(dialog.open).toBe(true);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle(grid);
    expect(focused(grid)).toBe(cellOf(grid, 'Bia'));

    await key(grid, cellOf(grid, 'Bia'), 'F10', { shiftKey: true });
    itemNamed(grid, 'Delete').click();
    await settle(grid);
    root(grid).querySelector<HTMLElement>('dialog .danger')!.click();
    await settle(grid);
    await settle(grid);
    expect(grid.items.map((item: Person) => item.name)).toEqual(['Ana', 'Caio', 'Duda']);
    expect(focused(grid)).toBe(cellOf(grid, 'Caio'));
  });

  it('lote: restaurar volta à célula; detalhe: mostrar/ocultar volta à célula', async () => {
    const grid = await create(g => {
      g.rowMenu = true;
      g.allowRemoving = true;
      g.editMode = 'batch';
      g.detailRenderer = () => 'detail';
    });

    grid.removeRow(2);
    await settle(grid);
    await key(grid, cellOf(grid, 'Bia'), 'F10', { shiftKey: true });
    itemNamed(grid, 'Restore').click();
    await settle(grid);
    expect(grid.hasChanges()).toBe(false);
    expect(focused(grid)).toBe(cellOf(grid, 'Bia'));

    await key(grid, cellOf(grid, 'Bia'), 'F10', { shiftKey: true });
    itemNamed(grid, 'Show details').click();
    await settle(grid);
    expect(grid.isRowExpanded(2)).toBe(true);
    expect(focused(grid)).toBe(cellOf(grid, 'Bia'));
  });

  it('tecla Menu no cabeçalho e no chip; clique no chip não ordenável abre o menu; desagrupar tudo vai ao próximo item da barra', async () => {
    const grid = await create(g => {
      g.columnChooser = true;
      g.sortMode = 'none';
    });

    await key(grid, headerCell(grid, 'City'), 'ContextMenu');
    expect(menu(grid)!.getAttribute('part')).toBe('menu column-header-menu');
    itemNamed(grid, 'Group by this column').click();
    await settle(grid);
    expect(grid.getGrouping().map(column => column.path)).toEqual(['city']);
    expect(focused(grid)).not.toBeNull();

    const chip = root(grid).querySelector<HTMLElement>('.group')!;
    expect(chip.getAttribute('aria-haspopup')).toBe('menu');
    chip.click();
    await settle(grid);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    await key(grid, focused(grid)!, 'Escape');
    expect(focused(grid)).toBe(chip);

    await key(grid, chip, 'ContextMenu');
    itemNamed(grid, 'Ungroup all').click();
    await settle(grid);
    expect(grid.getGrouping()).toEqual([]);
    expect(focused(grid)!.classList.contains('column-chooser-button')).toBe(true);
  });

  it('nome da barra com o do grid (aria-labelledby, idioma de cada parte); toque longo num campo fica nativo', async () => {
    const grid = await create(g => {
      g.setAttribute('aria-label', 'Orders');
      g.columnChooser = true;
      g.rowMenu = true;
      g.allowEditing = true;
      g.toolbarItems = [{ text: 'One', action: () => undefined }, 'columnChooserButton'];
    });

    const ids = roving(grid).getAttribute('aria-labelledby')!.split(' ');
    expect(ids.map(id => root(grid).getElementById(id)!.textContent)).toEqual(['Orders', 'Grid toolbar']);
    expect(root(grid).getElementById(ids[1])!.getAttribute('lang')).toBe('en');

    grid.editCell(1, grid.columns[0]);
    await settle(grid);
    const input = focused(grid)!;
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerType: 'touch', isPrimary: true, pointerId: 9 }));
    await new Promise(resolve => setTimeout(resolve, 600));
    await settle(grid);
    expect(menu(grid)).toBeNull();
    expect(focused(grid)).toBe(input);
  });

  it('forced-colors: item focado em Highlight; desabilitado focado segue GrayText', async () => {
    await commands.emulateMedia({ forcedColors: 'active' });
    const grid = await create();

    await key(grid, headerCell(grid, 'Name'), 'F10', { shiftKey: true });
    const first = menuItems(grid)[0];
    first.focus();
    await settle(grid);
    expect(getComputedStyle(first).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const disabled = itemNamed(grid, 'Move left');
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    disabled.focus();
    await settle(grid);
    expect(getComputedStyle(disabled).color).not.toBe(getComputedStyle(first).color);
  });
});

describe('ajustes aprovados depois da entrega', () => {
  it('"Copiar" do menu que não consegue escrever anuncia a falha; copySelection() (API) não anuncia', async () => {
    vi.spyOn(navigator.clipboard, 'write').mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const grid = await create(g => {
      g.rowMenu = true;
      g.selectionMode = 'multiple';
    });

    grid.selectRows([1]);
    await settle(grid);
    expect(await grid.copySelection()).toBe(false);
    await settle(grid);
    expect(liveRegion(grid).textContent.trim()).not.toBe('Could not copy to the clipboard.');

    await contextMenu(grid, cellOf(grid, 'Rio'));
    itemNamed(grid, 'Copy').click();
    await vi.waitFor(() => expect(liveRegion(grid).textContent.trim()).toBe('Could not copy to the clipboard.'));
    expect(focused(grid)).toBe(cellOf(grid, 'Rio'));
  });

  it('botão desabilitado da barra: opacidade 0,38 no botão inteiro (não só a cor); axe sem violações', async () => {
    const grid = await create(g => {
      g.editMode = 'batch';
      g.allowEditing = true;
      g.toolbarItems = ['saveButton', 'discardButton', { text: 'Refresh', action: () => undefined, disabled: true }, { text: 'Print', action: () => undefined }];
    });

    const save = root(grid).querySelector<HTMLElement>('.save-button')!;
    const refresh = rovingItems(grid).find(item => item.textContent.trim() === 'Refresh')!;
    const print = rovingItems(grid).find(item => item.textContent.trim() === 'Print')!;

    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(getComputedStyle(save).opacity).toBe('0.38');
    expect(getComputedStyle(refresh).opacity).toBe('0.38');
    expect(getComputedStyle(print).opacity).toBe('1');
    // A cor do desabilitado é a do botão: a diferença é a opacidade, não o matiz.
    expect(getComputedStyle(refresh).color).toBe(getComputedStyle(print).color);
    expect((await axe.run(grid, { resultTypes: ['violations'] })).violations.map(v => v.id)).toEqual([]);
  });
});
