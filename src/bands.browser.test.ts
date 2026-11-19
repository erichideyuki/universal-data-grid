import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid, GridColumnReorderEventDetail, GridColumnVisibilityChangeEventDetail } from './grid.js';
import { bodyRows, cleanup, createGrid, settle } from './test/fixture.js';

afterEach(cleanup);

const root = (grid: DataGrid) => grid.shadowRoot!;
const headerRows = (grid: DataGrid) => [...root(grid).querySelectorAll<HTMLTableRowElement>('thead tr[role=row]:not(.filter-row)')];
const describeHeader = (grid: DataGrid): string[] => headerRows(grid).map(tr => [...tr.children]
  .filter(cell => cell.getAttribute('role') !== 'presentation' || cell.classList.contains('column-spacer'))
  .map(cell => {
    const th = cell as HTMLTableCellElement;
    const label = th.classList.contains('column-spacer') ? '·' : th.querySelector('.header-text')?.textContent?.trim() ?? th.className.split(' ')[0];
    return `${label}${th.colSpan > 1 ? `/${th.colSpan}` : ''}${th.rowSpan > 1 ? `^${th.rowSpan}` : ''}`;
  })
  .join(' '));
const headerCell = (grid: DataGrid, label: string) =>
  [...root(grid).querySelectorAll<HTMLElement>('thead th')].find(th => th.querySelector('.header-text')?.textContent?.trim() === label)!;
const focusedLabel = (grid: DataGrid) =>
  (root(grid).activeElement as HTMLElement | null)?.querySelector('.header-text')?.textContent?.trim()
  ?? (root(grid).activeElement as HTMLElement | null)?.textContent?.trim();
const key = (target: Element, keyName: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, composed: true, cancelable: true, ...init }));

const pressOnActive = async (grid: DataGrid, keyName: string, init: KeyboardEventInit = {}) => {
  key(root(grid).activeElement!, keyName, init);
  await settle(grid);
};

/** País | População (Total, Urbana) | PIB (Total, Setores (Agro, Indústria, Serviços)) */
const makeColumns = () => {
  const country: GridColumnDef = { path: 'country', label: 'Country', width: 120 };
  const popTotal: GridColumnDef = { path: 'pop', label: 'PopTotal', width: 100 };
  const urban: GridColumnDef = { path: 'urban', label: 'Urban', width: 100 };
  const population: GridColumnDef = { label: 'Population', columns: [popTotal, urban] };
  const gdpTotal: GridColumnDef = { path: 'gdp', label: 'GdpTotal', width: 100 };
  const agro: GridColumnDef = { path: 'agro', label: 'Agro', width: 90 };
  const industry: GridColumnDef = { path: 'industry', label: 'Industry', width: 90 };
  const services: GridColumnDef = { path: 'services', label: 'Services', width: 90 };
  const sectors: GridColumnDef = { label: 'Sectors', columns: [agro, industry, services] };
  const gdp: GridColumnDef = { label: 'Gdp', columns: [gdpTotal, sectors] };

  return { country, popTotal, urban, population, gdpTotal, agro, industry, services, sectors, gdp, all: [country, population, gdp] };
};

const items = [
  { country: 'A', pop: 1, urban: 2, gdp: 3, agro: 4, industry: 5, services: 6 },
  { country: 'B', pop: 7, urban: 8, gdp: 9, agro: 10, industry: 11, services: 12 },
];

describe('cabeçalho em bandas', () => {
  it('uma linha por nível, colspan e rowspan nativos, aria-rowindex e aria-colindex reais', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items });

    expect(describeHeader(grid)).toEqual([
      'Country^3 Population/2 Gdp/4',
      'PopTotal^2 Urban^2 GdpTotal^2 Sectors/3',
      'Agro Industry Services',
    ]);
    expect(headerRows(grid).map(tr => tr.getAttribute('aria-rowindex'))).toEqual(['1', '2', '3']);
    expect(headerCell(grid, 'Gdp').getAttribute('aria-colindex')).toBe('4');
    expect(headerCell(grid, 'Sectors').getAttribute('aria-colindex')).toBe('5');
    expect(headerCell(grid, 'Gdp').getAttribute('aria-colspan')).toBeNull();
    expect(headerCell(grid, 'Gdp').getAttribute('part')).toBe('header-cell band-header-cell');
    expect(headerCell(grid, 'Gdp').hasAttribute('aria-sort')).toBe(false);
    expect(bodyRows(grid)[0].getAttribute('aria-rowindex')).toBe('4');
    const table = root(grid).querySelector('table')!;
    expect(table.getAttribute('aria-rowcount')).toBe('5');
    expect(table.getAttribute('aria-colcount')).toBe('7');
  });

  it('ids do cabeçalho únicos e um só tabindex=0', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items, configure: g => g.headerFilter = true });
    const ids = [...root(grid).querySelectorAll('[id]')].map(element => element.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(root(grid).querySelectorAll('thead [tabindex="0"]')).toHaveLength(1);
    // A folha é nomeada pelo próprio rótulo (não pelo da banda com o mesmo aria-colindex).
    const leaf = headerCell(grid, 'GdpTotal');
    expect(root(grid).getElementById(leaf.getAttribute('aria-labelledby')!)!.textContent).toBe('GdpTotal');
  });

  it('colspan com coluna oculta; banda sem coluna visível some', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: [c.country, c.population, { ...c.gdp, columns: [c.gdpTotal, { ...c.sectors, columns: [{ ...c.agro, visible: false }, c.industry] }] }], items });

    expect(describeHeader(grid)[0]).toBe('Country^3 Population/2 Gdp/2');
    expect(describeHeader(grid)[2]).toBe('Industry');

    const hidden = await createGrid({ columns: [c.country, { ...c.population, columns: [{ ...c.popTotal, visible: false }, { ...c.urban, visible: false }] }], items });
    // Sem banda visível sobra um nível só.
    expect(describeHeader(hidden)).toEqual(['Country']);
  });

  it('posição nativa de cada cabeçalho folha = a da célula do corpo', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items, configure: g => {
      g.selectionMode = 'multiple'; g.showCheckboxes = true;
    } });
    // Mapa nativo do cabeçalho (colspan/rowspan) → coluna de cada folha.
    const occupied: boolean[][] = [];
    const positions = new Map<string, number>();

    headerRows(grid).forEach((tr, rowIndex) => {
      occupied[rowIndex] ??= [];
      let col = 0;

      for (const cell of tr.children as HTMLCollectionOf<HTMLTableCellElement>) {
        while (occupied[rowIndex][col]) {
          col++;
        }

        for (let r = 0; r < cell.rowSpan; r++) {
          occupied[rowIndex + r] ??= [];

          for (let k = 0; k < cell.colSpan; k++) {
            occupied[rowIndex + r][col + k] = true;
          }
        }

        if (cell.classList.contains('header-column')) {
          positions.set(cell.getAttribute('aria-colindex')!, col);
        }

        col += cell.colSpan;
      }
    });

    const row = bodyRows(grid)[0];
    const cells = [...row.children] as HTMLTableCellElement[];

    for (const [colIndex, position] of positions) {
      const td = cells.find(cell => cell.getAttribute('aria-colindex') === colIndex)!;
      expect(cells.indexOf(td)).toBe(position);
    }
  });

  it('<u-grid-column> aninhado vira banda; label sem o texto das aninhadas', async () => {
    const grid = document.createElement('u-grid');
    grid.style.display = 'block';
    grid.style.height = '300px';
    grid.innerHTML = `
      <u-grid-column path="country">Country</u-grid-column>
      <u-grid-column>Population
        <u-grid-column path="pop">Total</u-grid-column>
        <u-grid-column path="urban">Urban</u-grid-column>
      </u-grid-column>`;
    document.body.append(grid);
    grid.items = items;
    await settle(grid);

    const band = grid.querySelectorAll('u-grid-column')[1];
    expect(band.label).toBe('Population');
    expect(band.columns).toHaveLength(2);
    expect(Object.isFrozen(band.columns)).toBe(true);
    expect(band.columns).toBe(band.columns);
    expect(grid.querySelector('u-grid-column')!.columns).toBeNull();
    expect(describeHeader(grid)).toEqual(['Country^2 Population/2', 'Total Urban']);

    // Coluna nova dentro da banda.
    const added = document.createElement('u-grid-column');
    added.path = 'gdp';
    added.textContent = 'Gdp';
    band.append(added);
    await settle(grid);
    await settle(grid);
    expect(describeHeader(grid)).toEqual(['Country^2 Population/3', 'Total Urban Gdp']);

    // Mudança numa coluna aninhada chega ao grid.
    band.columns![0].visible = false;
    await settle(grid);
    expect(describeHeader(grid)).toEqual(['Country^2 Population/2', 'Urban Gdp']);
  });
});

describe('reordenar com bandas', () => {
  it('moveColumn: índice entre as irmãs; a coluna não sai da banda; banda move o bloco', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items });

    grid.moveColumn(c.services, 0);
    await settle(grid);
    expect(describeHeader(grid)[2]).toBe('Services Agro Industry');

    grid.moveColumn(c.popTotal, 99);
    await settle(grid);
    expect(describeHeader(grid)[1]).toBe('Urban^2 PopTotal^2 GdpTotal^2 Sectors/3');

    grid.moveColumn(c.gdp, 0);
    await settle(grid);
    expect(describeHeader(grid)[0]).toBe('Gdp/4 Country^3 Population/2');
    expect(bodyRows(grid)[0].querySelector('td[aria-colindex="1"]')!.textContent.trim()).toBe('3');
  });

  it('Alt+Shift+→ na banda move o bloco e anuncia; na folha só dentro da banda', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items });
    const reorder = vi.fn<(detail: GridColumnReorderEventDetail) => void>();
    grid.addEventListener('u-grid-column-reorder', event => reorder(event.detail));

    headerCell(grid, 'Population').focus();
    await pressOnActive(grid, 'ArrowRight', { altKey: true, shiftKey: true });

    expect(describeHeader(grid)[0]).toBe('Country^3 Gdp/4 Population/2');
    expect(reorder).toHaveBeenLastCalledWith(expect.objectContaining({ column: c.population, band: null, index: 2, previousIndex: 1 }));
    expect(focusedLabel(grid)).toBe('Population');
    expect(root(grid).querySelector('[role=status]')!.textContent).toContain('Population');

    // Última da banda: não sai dela.
    headerCell(grid, 'Urban').focus();
    await pressOnActive(grid, 'ArrowRight', { altKey: true, shiftKey: true });
    expect(describeHeader(grid)[1]).toBe('GdpTotal^2 Sectors/3 PopTotal^2 Urban^2');

    await pressOnActive(grid, 'ArrowLeft', { altKey: true, shiftKey: true });
    expect(describeHeader(grid)[1]).toBe('GdpTotal^2 Sectors/3 Urban^2 PopTotal^2');
    expect(reorder).toHaveBeenLastCalledWith(expect.objectContaining({ column: c.urban, band: c.population, index: 0, previousIndex: 1 }));
  });

  it('menu da banda: só mover; sem agrupar nem redimensionar', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items, configure: g => g.columnResizing = true });

    headerCell(grid, 'Population').focus();
    await pressOnActive(grid, 'F10', { shiftKey: true });

    const menu = root(grid).querySelector('.column-header-menu')!;
    expect([...menu.querySelectorAll('[role=menuitem]')].map(item => item.textContent.trim())).toEqual(['Move left', 'Move right']);
  });
});

describe('teclado entre níveis', () => {
  it('↑/↓ entre níveis, ←/→ pulam o colspan, rowspan não muda o nível lembrado', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items });

    headerCell(grid, 'Agro').focus();
    await settle(grid);
    await pressOnActive(grid, 'ArrowUp');
    expect(focusedLabel(grid)).toBe('Sectors');
    await pressOnActive(grid, 'ArrowUp');
    expect(focusedLabel(grid)).toBe('Gdp');
    await pressOnActive(grid, 'ArrowLeft');
    expect(focusedLabel(grid)).toBe('Population');
    // ↓ entrando pelo fim: o último filho.
    await pressOnActive(grid, 'ArrowDown');
    expect(focusedLabel(grid)).toBe('Urban');
    await pressOnActive(grid, 'ArrowLeft');
    expect(focusedLabel(grid)).toBe('PopTotal');
    // Folha com rowspan: o nível lembrado (2º) continua.
    await pressOnActive(grid, 'ArrowLeft');
    expect(focusedLabel(grid)).toBe('Country');
    await pressOnActive(grid, 'ArrowRight');
    expect(focusedLabel(grid)).toBe('PopTotal');
    await pressOnActive(grid, 'ArrowDown');
    expect(bodyRows(grid)[0].contains(root(grid).activeElement)).toBe(true);
    await pressOnActive(grid, 'ArrowUp');
    expect(focusedLabel(grid)).toBe('PopTotal');
    await pressOnActive(grid, 'Home', { ctrlKey: true });
    expect(focusedLabel(grid)).toBe('Country');
    expect(root(grid).activeElement!.closest('tr')!.getAttribute('aria-rowindex')).toBe('1');
    expect(root(grid).querySelectorAll('thead [tabindex="0"]')).toHaveLength(1);
  });

  it('RTL: ← vai para o fim lógico', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items, configure: g => g.dir = 'rtl' });

    headerCell(grid, 'Population').focus();
    await pressOnActive(grid, 'ArrowLeft');
    expect(focusedLabel(grid)).toBe('Gdp');
  });

  it('focus-change no cabeçalho da banda traz a banda', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items });
    const listener = vi.fn();
    grid.addEventListener('u-grid-focus-change', event => listener((event as CustomEvent).detail));

    headerCell(grid, 'Urban').focus();
    await settle(grid);
    await pressOnActive(grid, 'ArrowUp');
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ cellType: 'header', column: c.population }));
  });
});

describe('foco e teclado na banda (revisão de a11y)', () => {
  it('sem o "⋮" (revisão do site): F2 na banda não sai dela e não entra no aria-keyshortcuts; Shift+F10 abre o menu', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items });
    const band = headerCell(grid, 'Population');

    expect(band.getAttribute('aria-keyshortcuts') ?? '').not.toContain('F2');
    band.focus();
    await pressOnActive(grid, 'F2');
    expect(root(grid).activeElement).toBe(headerCell(grid, 'Population'));

    await pressOnActive(grid, 'F10', { shiftKey: true });
    expect(root(grid).querySelector('.column-header-menu')).not.toBeNull();
    await pressOnActive(grid, 'Escape');
    expect(root(grid).activeElement).toBe(headerCell(grid, 'Population'));
  });

  it('banda ocultada com o foco nela: o foco não cai no body', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items });

    headerCell(grid, 'Sectors').focus();
    await settle(grid);
    grid._userSetVisible(c.sectors, false);
    await settle(grid);
    await settle(grid);

    expect(root(grid).activeElement).not.toBeNull();
    expect(root(grid).querySelectorAll('thead [tabindex="0"]')).toHaveLength(1);

    grid._userSetVisible(c.gdp, false);
    grid._userSetVisible(c.population, false);
    await settle(grid);
    await settle(grid);
    // Sobrou um nível só.
    expect(headerRows(grid)).toHaveLength(1);
    expect(root(grid).activeElement).not.toBeNull();
  });

  it('Ctrl+G na folha única de uma sub-banda: o foco fica num nível que existe', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: [c.country, { ...c.gdp, columns: [c.gdpTotal, { ...c.sectors, columns: [c.agro] }] }], items });

    headerCell(grid, 'Agro').focus();
    await pressOnActive(grid, 'g', { ctrlKey: true });
    await settle(grid);

    expect(grid.getGrouping()).toEqual([c.agro]);
    expect(root(grid).activeElement).not.toBeNull();
    expect(root(grid).activeElement!.closest('thead, tbody')).not.toBeNull();
  });

  it('RTL: Alt+Shift+← na banda move para o fim lógico', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items, configure: g => g.dir = 'rtl' });

    headerCell(grid, 'Population').focus();
    await pressOnActive(grid, 'ArrowLeft', { altKey: true, shiftKey: true });
    expect(describeHeader(grid)[0]).toBe('Country^3 Gdp/4 Population/2');
    expect(focusedLabel(grid)).toBe('Population');
  });

  it('aria-keyshortcuts sem Alt+Shift quando não há irmã para trocar', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: [c.country, { ...c.population, columns: [c.popTotal] }], items });

    expect(headerCell(grid, 'PopTotal').getAttribute('aria-keyshortcuts')).not.toContain('Alt+Shift');
    expect(headerCell(grid, 'Population').getAttribute('aria-keyshortcuts')).toContain('Alt+Shift+ArrowLeft');
  });
});

describe('fixar, ocultar e seletor', () => {
  it('banda fixa fixa as filhas; fixed numa aninhada é ignorado', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: [c.country, { ...c.population, fixed: 'end' }, { ...c.gdp, columns: [{ ...c.gdpTotal, fixed: 'start' }, c.sectors] }], items });

    expect(describeHeader(grid)[0]).toBe('Country^3 Gdp/4 Population/2');
    expect(headerCell(grid, 'Urban').classList.contains('fixed-end')).toBe(true);
    expect(headerCell(grid, 'Population').classList.contains('fixed-end')).toBe(true);
    expect(headerCell(grid, 'GdpTotal').classList.contains('fixed')).toBe(false);
  });

  it('seletor: banda tri-state, lista aninhada; um evento por coluna mudada', async () => {
    const c = makeColumns();
    const band: GridColumnDef = { ...c.population, columns: [c.popTotal, { ...c.urban, visible: false }] };
    const grid = await createGrid({ columns: [c.country, band], items, configure: g => g.columnChooser = true });
    const events: GridColumnVisibilityChangeEventDetail[] = [];
    grid.addEventListener('u-grid-column-visibility-change', event => events.push(event.detail));

    grid.openColumnChooser();
    await settle(grid);
    const bandBox = () => root(grid).querySelector<HTMLInputElement>('.column-chooser-band > label input')!;
    const nested = root(grid).querySelector('.column-chooser-nested')!;

    expect(bandBox().indeterminate).toBe(true);
    expect(nested.getAttribute('aria-labelledby')).toBe(bandBox().nextElementSibling!.id);
    expect(root(grid).querySelectorAll('.column-chooser-band .column-chooser-nested .column-chooser-pin')).toHaveLength(0);

    // Misto → todas visíveis.
    bandBox().click();
    await settle(grid);
    expect(describeHeader(grid)).toEqual(['Country^2 Population/2', 'PopTotal Urban']);
    expect(events.map(e => [e.column.label, e.visible])).toEqual([['Urban', true]]);

    // Todas → banda oculta (as filhas ficam como estavam; caixas desmarcadas).
    bandBox().click();
    await settle(grid);
    expect(describeHeader(grid)).toEqual(['Country']);
    expect([...nested.querySelectorAll('input')].map(input => input.checked)).toEqual([false, false]);

    // Banda oculta → volta como estava (todas visíveis).
    bandBox().click();
    await settle(grid);
    expect(describeHeader(grid)).toEqual(['Country^2 Population/2', 'PopTotal Urban']);

    // Oculta com as colunas mistas e marcada de novo: o misto volta (APG tri-state).
    nested.querySelectorAll('input')[1].click();
    await settle(grid);
    expect(bandBox().indeterminate).toBe(true);
    grid._userSetVisible(band, false);
    await settle(grid);
    expect(describeHeader(grid)).toEqual(['Country']);
    bandBox().click();
    await settle(grid);
    expect(bandBox().indeterminate).toBe(true);
    expect(describeHeader(grid)).toEqual(['Country^2 Population', 'PopTotal']);

    // Marcar uma filha com a banda oculta mostra a banda (as outras ficam como estavam).
    grid._userSetVisible(band, false);
    await settle(grid);
    events.length = 0;
    nested.querySelectorAll('input')[1].click();
    await settle(grid);
    expect(describeHeader(grid)).toEqual(['Country^2 Population/2', 'PopTotal Urban']);
    expect(events.map(e => [e.column.label, e.visible])).toEqual([['Population', true], ['Urban', true]]);
  });

  it('não oculta a última coluna visível pela banda', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: [c.population], items, configure: g => g.columnChooser = true });

    grid.openColumnChooser();
    await settle(grid);
    expect(root(grid).querySelector<HTMLInputElement>('.column-chooser-band > label input')!.disabled).toBe(true);
  });

  it('agrupar folha de banda: sai do cabeçalho e volta ao fim da banda', async () => {
    const c = makeColumns();
    const grid = await createGrid({ columns: c.all, items });

    grid.groupColumn(c.popTotal);
    await settle(grid);
    expect(describeHeader(grid)[0]).toContain('Population');
    expect(describeHeader(grid)[1]).toBe('Urban^2 GdpTotal^2 Sectors/3');

    grid.ungroupColumn(c.popTotal);
    await settle(grid);
    expect(describeHeader(grid)[1]).toBe('Urban^2 PopTotal^2 GdpTotal^2 Sectors/3');

    // Banda não agrupa nem ordena.
    grid.groupColumn(c.population);
    grid.sortColumn(c.population, 'asc');
    await settle(grid);
    expect(grid.getGrouping()).toEqual([]);
    expect(grid.getSorting()).toEqual([]);
  });
});

describe('virtualização de colunas', () => {
  const wide = (count: number, width = 100): GridColumnDef[] =>
    Array.from({ length: count }, (_, i) => ({ path: `c${i}`, label: `C${i}`, width }));
  const wideItems = (count: number, rows = 30) =>
    Array.from({ length: rows }, (_row, r) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`c${i}`, `${r}-${i}`])));

  it('auto: virtual com mais de 50 colunas; aria-colcount total e espaçadoras sem índice', async () => {
    const grid = await createGrid({ columns: wide(300), items: wideItems(300) });
    const headers = root(grid).querySelectorAll('th.header-column');

    expect(headers.length).toBeLessThan(40);
    expect(root(grid).querySelector('table')!.getAttribute('aria-colcount')).toBe('300');
    const spacer = root(grid).querySelector('tbody .column-spacer')!;
    expect(spacer.getAttribute('role')).toBe('presentation');
    expect(spacer.hasAttribute('aria-colindex')).toBe(false);
    // Larguras: colgroup soma 300 × 100.
    expect(root(grid).querySelector('table')!.getBoundingClientRect().width).toBeCloseTo(30000, -1);

    const standard = await createGrid({ columns: wide(300), items: wideItems(300, 2), configure: g => g.columnRenderingMode = 'standard' });
    expect(root(standard).querySelectorAll('th.header-column')).toHaveLength(300);
  });

  it('rolar na horizontal troca as colunas e mantém aria-colindex real', async () => {
    const grid = await createGrid({ columns: wide(300), items: wideItems(300) });
    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;

    scroller.scrollLeft = 15000;
    scroller.dispatchEvent(new Event('scroll'));
    await settle(grid);

    const indexes = [...root(grid).querySelectorAll('th.header-column')].map(th => Number(th.getAttribute('aria-colindex')));
    // A 1ª é a da célula ativa (cabeçalho da C0), que fica no DOM; depois, a janela.
    expect(indexes[0]).toBe(1);
    expect(indexes[1]).toBeGreaterThan(140);
    expect(indexes).toContain(151);
    const cell = bodyRows(grid)[0].querySelector('td[aria-colindex="151"]')!;
    expect(cell.textContent.trim()).toBe('0-150');
  });

  it('←/→ até coluna fora do DOM: ela entra, recebe o foco e a rolagem a mostra', async () => {
    const grid = await createGrid({ columns: [{ path: 'c0', label: 'C0', width: 100, fixed: 'start' }, ...wide(300).slice(1)], items: wideItems(300) });
    const first = bodyRows(grid)[0].querySelector<HTMLElement>('td[aria-colindex="1"]')!;

    first.focus();
    await settle(grid);
    await pressOnActive(grid, 'End');
    await settle(grid);

    const active = root(grid).activeElement as HTMLElement;
    expect(active.getAttribute('aria-colindex')).toBe('300');
    expect(active.textContent.trim()).toBe('0-299');

    // Não fica sob a coluna fixa (2.4.11).
    const fixed = bodyRows(grid)[0].querySelector<HTMLElement>('td[aria-colindex="1"]')!;
    expect(active.getBoundingClientRect().left).toBeGreaterThanOrEqual(fixed.getBoundingClientRect().right - 1);

    await pressOnActive(grid, 'Home');
    expect((root(grid).activeElement as HTMLElement).getAttribute('aria-colindex')).toBe('1');
    await pressOnActive(grid, 'ArrowRight');
    expect((root(grid).activeElement as HTMLElement).getAttribute('aria-colindex')).toBe('2');
  });

  it('a célula ativa fica no DOM ao rolar para longe', async () => {
    const grid = await createGrid({ columns: wide(300), items: wideItems(300) });
    const cell = bodyRows(grid)[0].querySelector<HTMLElement>('td[aria-colindex="2"]')!;
    cell.focus();
    await settle(grid);

    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;
    scroller.scrollLeft = 20000;
    scroller.dispatchEvent(new Event('scroll'));
    await settle(grid);

    expect(root(grid).activeElement?.getAttribute('aria-colindex')).toBe('2');
    // Duas espaçadoras: antes da ativa? Não: a ativa é a 2ª; depois dela e entre ela e a janela.
    expect(bodyRows(grid)[0].querySelectorAll('.column-spacer').length).toBeGreaterThanOrEqual(1);
  });

  it('bandas com virtualização: a banda parcialmente fora mostra a parte renderizada', async () => {
    const leaves = wide(120);
    const columns: GridColumnDef[] = [
      { label: 'First', columns: leaves.slice(0, 60) },
      { label: 'Second', columns: leaves.slice(60) },
    ];
    const grid = await createGrid({ columns, items: wideItems(120, 5) });
    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;

    scroller.scrollLeft = 5500;
    scroller.dispatchEvent(new Event('scroll'));
    await settle(grid);

    const bands = [...root(grid).querySelectorAll<HTMLTableCellElement>('th.band-header')];
    expect(bands.map(th => th.querySelector('.header-text')!.textContent)).toEqual(['First', 'Second']);
    const firstRendered = root(grid).querySelector('th.header-column')!.getAttribute('aria-colindex');
    expect(bands[0].getAttribute('aria-colindex')).toBe(firstRendered);

    // O rótulo fica na parte visível da área de rolagem (banda larga com a coluna ativa longe).
    const area = scroller.getBoundingClientRect();
    const label = bands[0].querySelector('.header-text')!.getBoundingClientRect();
    expect(label.right).toBeGreaterThan(area.left);
    expect(label.left).toBeLessThan(area.right);

    // ↑ de uma folha até a banda cuja 1ª folha está fora da janela: a coluna lembrada vale.
    const leaf = root(grid).querySelector<HTMLElement>('th.header-column[aria-colindex="58"]')!;
    leaf.focus();
    await settle(grid);
    await pressOnActive(grid, 'ArrowUp');
    expect(focusedLabel(grid)).toBe('First');
    await pressOnActive(grid, 'ArrowDown');
    expect((root(grid).activeElement as HTMLElement).getAttribute('aria-colindex')).toBe('58');
  });

  it('valor desconhecido avisa uma vez e usa auto', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await createGrid({ columns: wide(3), items: wideItems(3, 1), configure: g => g.setAttribute('column-rendering-mode', 'banana') });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('column-rendering-mode'));
    expect(root(grid).querySelectorAll('th.header-column')).toHaveLength(3);
    warn.mockRestore();
  });
});

describe('estado (frente 11) com bandas', () => {
  /** Definições novas a cada grid (o estado identifica pelo `name`/`path`, não pelo objeto). */
  const named = () => {
    const c = makeColumns();

    return {
      ...c,
      all: [
        c.country,
        { ...c.population, name: 'population', columns: [c.popTotal, c.urban] },
        { ...c.gdp, name: 'gdp', columns: [c.gdpTotal, { ...c.sectors, name: 'sectors', columns: [c.agro, c.industry, c.services] }] },
      ],
    };
  };

  it('ordem dentro das bandas, visibilidade e fixação das bandas e larguras vão e voltam', async () => {
    const a = named();
    const grid = await createGrid({ columns: a.all, items });
    const [, population, gdp] = a.all;
    const sectors = gdp.columns![1];

    grid.moveColumn(gdp, 0);
    grid.moveColumn(a.services, 0);
    grid.moveColumn(a.urban, 0);
    grid._userSetVisible(a.industry, false);
    grid._userSetVisible(sectors, false);
    grid._userSetFixed(population, 'end');
    grid.setColumnWidth(a.agro, 140);
    await settle(grid);

    const header = describeHeader(grid);
    const json = JSON.stringify(grid.getState());
    const state = JSON.parse(json);

    // Setores oculta: sobram 2 níveis.
    expect(header).toEqual([
      'Gdp Country^2 Population/2',
      'GdpTotal Urban PopTotal',
    ]);
    expect(state.columns.find((entry: { name: string }) => entry.name === 'sectors')).toEqual({ name: 'sectors', visible: false });
    expect(state.columns.find((entry: { name: string }) => entry.name === 'population')).toEqual({ name: 'population', visible: true, fixed: 'end' });
    // Coluna de banda: visibilidade própria, sem `fixed`.
    expect(state.columns.find((entry: { name: string }) => entry.name === 'industry')).toMatchObject({ visible: false });
    expect(state.columns.find((entry: { name: string }) => entry.name === 'agro')).not.toHaveProperty('fixed');

    // Grid novo, definições novas: mesmo estado.
    const b = named();
    const restored = await createGrid({ columns: b.all, items });
    restored.setState(state);
    await settle(restored);

    expect(describeHeader(restored)).toEqual(header);
    expect(headerCell(restored, 'Urban').classList.contains('fixed-end')).toBe(true);
    expect(JSON.stringify(restored.getState())).toBe(json);

    // A banda oculta volta com o estado próprio das colunas (Industry continua oculta).
    restored._userSetVisible(b.all[2].columns![1], true);
    await settle(restored);
    expect(describeHeader(restored)).toEqual([
      'Gdp/3 Country^3 Population/2',
      'GdpTotal^2 Sectors/2 Urban^2 PopTotal^2',
      'Services Agro',
    ]);
    expect(headerCell(restored, 'Agro').getBoundingClientRect().width).toBeCloseTo(140, 0);

    // resetState: definição de novo.
    restored.resetState();
    await settle(restored);
    expect(describeHeader(restored)[0]).toBe('Country^3 Population/2 Gdp/4');
  });
});
