import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { GridColumnDef } from './grid-column-def.js';
import type { DataGrid, GridSortEventDetail } from './grid.js';
import { cellText, cleanup, createGrid, dataRows, groupLabels, headerLabels, settle } from './test/fixture.js';

afterEach(cleanup);

const people = () => [
  { name: 'Carol', age: 30, city: 'Rio' },
  { name: 'alice', age: 25, city: 'Lima' },
  { name: 'Bob', age: 30, city: 'Lima' },
  { name: 'dave', age: null, city: 'Rio' },
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'age', label: 'Age' },
  { path: 'city', label: 'City' },
];

const headers = (grid: DataGrid) => [...grid.shadowRoot!.querySelectorAll<HTMLElement>('th.header-column')];
const header = (grid: DataGrid, label: string) => headers(grid).find(th => th.querySelector('.header-text')!.textContent === label)!;
const column = (grid: DataGrid, label: string) => grid.columns.find(c => c.label === label)!;
const names = (grid: DataGrid) => dataRows(grid).map(r => cellText(r.cells[0]));
const ariaSorts = (grid: DataGrid) => headers(grid).map(th => th.getAttribute('aria-sort'));
const announcement = (grid: DataGrid) => grid.shadowRoot!.querySelector('[role=status]')!.textContent.trim();
const sortIndexes = (grid: DataGrid) =>
  headers(grid).map(th => th.querySelector('.sort-indicator')?.getAttribute('data-sort-index') ?? null);

const click = async (grid: DataGrid, target: HTMLElement, init: MouseEventInit = {}) => {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, ...init }));
  await settle(grid);
};

const press = async (grid: DataGrid, target: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const sortingOf = (grid: DataGrid) => grid.getSorting().map(s => `${s.column.label}:${s.order}`);

describe('ordenação pelo cabeçalho', () => {
  it('clique alterna asc → desc → asc, com aria-sort e sem mutar items', async () => {
    const items = people();
    const grid = await createGrid({ columns: columns(), items });

    expect(ariaSorts(grid)).toEqual(['none', 'none', 'none']);

    await click(grid, header(grid, 'Name'));
    expect(names(grid)).toEqual(['alice', 'Bob', 'Carol', 'dave']);
    expect(ariaSorts(grid)).toEqual(['ascending', 'none', 'none']);

    await click(grid, header(grid, 'Name'));
    expect(names(grid)).toEqual(['dave', 'Carol', 'Bob', 'alice']);
    expect(ariaSorts(grid)).toEqual(['descending', 'none', 'none']);

    await click(grid, header(grid, 'Name'));
    expect(ariaSorts(grid)).toEqual(['ascending', 'none', 'none']);
    expect(items.map(i => i.name)).toEqual(['Carol', 'alice', 'Bob', 'dave']);
    expect(headerLabels(grid)).toEqual(['Name', 'Age', 'City']);
  });

  it('modo single: clique em outra coluna substitui e Shift não acrescenta', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });

    await click(grid, header(grid, 'Name'));
    await click(grid, header(grid, 'City'), { shiftKey: true });

    expect(sortingOf(grid)).toEqual(['City:asc']);
  });

  it('modo multiple: Shift acrescenta, mostra a prioridade e Ctrl remove', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.sorting = 'multiple' });

    await click(grid, header(grid, 'Age'));
    expect(sortIndexes(grid)).toEqual([null, null, null]);

    await click(grid, header(grid, 'Name'), { shiftKey: true });
    expect(sortingOf(grid)).toEqual(['Age:asc', 'Name:asc']);
    expect(sortIndexes(grid)).toEqual(['2', '1', null]);
    // Nulos primeiro em asc; empate em 30 desempatado pelo nome.
    expect(names(grid)).toEqual(['dave', 'alice', 'Bob', 'Carol']);

    await click(grid, header(grid, 'Age'), { shiftKey: true });
    expect(sortingOf(grid)).toEqual(['Age:desc', 'Name:asc']);
    expect(names(grid)).toEqual(['Bob', 'Carol', 'alice', 'dave']);

    await click(grid, header(grid, 'Age'), { ctrlKey: true });
    expect(sortingOf(grid)).toEqual(['Name:asc']);
    expect(sortIndexes(grid)).toEqual([null, null, null]);
    expect(ariaSorts(grid)).toEqual(['ascending', 'none', 'none']);

    await click(grid, header(grid, 'Name'), { metaKey: true });
    expect(sortingOf(grid)).toEqual([]);
    expect(names(grid)).toEqual(['Carol', 'alice', 'Bob', 'dave']);
  });

  it('modo none e colunas não ordenáveis não reagem nem têm aria-sort', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'name', label: 'Name' },
        { path: 'age', label: 'Age', sortable: false },
        { label: 'Actions', renderer: () => document.createElement('button') },
      ],
      items: people(),
    });

    expect(ariaSorts(grid)).toEqual(['none', null, null]);
    expect(headers(grid).map(th => th.tabIndex)).toEqual([0, -1, -1]);

    await click(grid, header(grid, 'Age'));
    expect(sortingOf(grid)).toEqual([]);

    grid.sorting = 'none';
    await settle(grid);
    await click(grid, header(grid, 'Name'));
    expect(sortingOf(grid)).toEqual([]);
    expect(ariaSorts(grid)).toEqual([null, null, null]);
  });

  it('teclado: Enter e Espaço ordenam, com Shift como no mouse, e anunciam', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.sorting = 'multiple' });

    await press(grid, header(grid, 'City'), 'Enter');
    expect(sortingOf(grid)).toEqual(['City:asc']);
    expect(announcement(grid)).toBe('Sorted by City, ascending');

    await press(grid, header(grid, 'Name'), ' ', { shiftKey: true });
    expect(sortingOf(grid)).toEqual(['City:asc', 'Name:asc']);

    await press(grid, header(grid, 'City'), 'Enter', { ctrlKey: true });
    expect(sortingOf(grid)).toEqual(['Name:asc']);
    expect(announcement(grid)).toBe('Sorting removed from City');

    await press(grid, header(grid, 'Name'), 'a');
    expect(sortingOf(grid)).toEqual(['Name:asc']);
  });

  it('anúncio no idioma do grid', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.language = 'pt' });

    await click(grid, header(grid, 'Name'));
    await click(grid, header(grid, 'Name'));
    expect(announcement(grid)).toBe('Ordenado por Name, decrescente');
  });

  it('o clique que termina um arrasto de cabeçalho não ordena', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    const name = header(grid, 'Name');
    const width = name.getBoundingClientRect().width;

    await userEvent.dragAndDrop(name, header(grid, 'City'), { steps: 10, targetPosition: { x: 4, y: 10 } });
    await settle(grid);

    expect(headerLabels(grid)).toEqual(['Age', 'Name', 'City']);
    expect(sortingOf(grid)).toEqual([]);

    // Arrasto que volta ao próprio cabeçalho: se o navegador entregar o
    // clique final no <th>, ele é ignorado.
    const again = header(grid, 'Name');
    await userEvent.dragAndDrop(again, again, { steps: 10, sourcePosition: { x: 10, y: 10 }, targetPosition: { x: Math.min(width - 2, 60), y: 12 } });
    await click(grid, header(grid, 'Name'));
    expect(sortingOf(grid)).toEqual([]);

    // Fora de arrasto, o clique ordena.
    await userEvent.click(header(grid, 'Age'));
    await settle(grid);
    expect(sortingOf(grid)).toEqual(['Age:asc']);
  });
});

describe('eventos', () => {
  it('u-grid-sorting cancelado não ordena; u-grid-sort-change sai do shadow com o detalhe', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    const changes: GridSortEventDetail[] = [];
    document.body.addEventListener('u-grid-sort-change', e => changes.push(e.detail));

    const cancel = (e: Event) => e.preventDefault();
    grid.addEventListener('u-grid-sorting', cancel);

    await click(grid, header(grid, 'Name'));
    grid.sortBy(column(grid, 'Age'), 'desc');
    await settle(grid);

    expect(sortingOf(grid)).toEqual([]);
    expect(ariaSorts(grid)).toEqual(['none', 'none', 'none']);
    expect(names(grid)).toEqual(['Carol', 'alice', 'Bob', 'dave']);
    expect(changes).toHaveLength(0);

    grid.removeEventListener('u-grid-sorting', cancel);
    let before: GridSortEventDetail | undefined;
    grid.addEventListener('u-grid-sorting', e => {
      before = e.detail;
      expect(sortingOf(grid)).toEqual([]);
    }, { once: true });

    await click(grid, header(grid, 'Name'));

    expect(before?.sorting.map(s => s.order)).toEqual(['asc']);
    expect(changes).toHaveLength(1);
    expect(changes[0].previous).toEqual([]);
    expect(changes[0].sorting).toEqual([{ column: column(grid, 'Name'), order: 'asc' }]);
  });
});

describe('API', () => {
  it('sortBy, append, clearSorting e getSorting (cópia)', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    const age = column(grid, 'Age');
    const name = column(grid, 'Name');

    grid.sortBy(age, 'desc');
    grid.sortBy(name, 'asc', { append: true });
    await settle(grid);
    expect(sortingOf(grid)).toEqual(['Age:desc', 'Name:asc']);
    expect(names(grid)).toEqual(['Bob', 'Carol', 'alice', 'dave']);

    grid.getSorting().pop();
    expect(grid.getSorting()).toHaveLength(2);

    grid.sortBy(age, null);
    expect(sortingOf(grid)).toEqual(['Name:asc']);

    grid.clearSorting();
    await settle(grid);
    expect(sortingOf(grid)).toEqual([]);
    expect(Object.keys(age).sort()).toEqual(['label', 'path']);
  });

  it('ordenação inicial pelas colunas (sortOrder + sortIndex), também declarativa', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'name', label: 'Name', sortOrder: 'asc', sortIndex: 1 },
        { path: 'age', label: 'Age', sortOrder: 'desc', sortIndex: 0 },
        { path: 'city', label: 'City' },
      ],
      items: people(),
    });

    expect(sortingOf(grid)).toEqual(['Age:desc', 'Name:asc']);
    expect(names(grid)).toEqual(['Bob', 'Carol', 'alice', 'dave']);

    // Reatribuir as mesmas colunas não reaplica a ordenação inicial.
    grid.clearSorting();
    grid.columns = [...grid.columns];
    await settle(grid);
    expect(sortingOf(grid)).toEqual([]);

    const declarative = document.createElement('u-grid');
    declarative.style.cssText = 'display:block;height:300px';
    declarative.innerHTML = `
      <u-grid-column path="name">Name</u-grid-column>
      <u-grid-column path="age" sort-order="desc">Age</u-grid-column>
      <u-grid-column path="city" sortable="false">City</u-grid-column>`;
    declarative.items = people();
    document.body.append(declarative);
    await settle(declarative);

    expect(sortingOf(declarative)).toEqual(['Age:desc']);
    expect(ariaSorts(declarative)).toEqual(['none', 'descending', null]);
  });

  it('comparador próprio', async () => {
    const rank: Record<string, number> = { low: 0, mid: 1, high: 2 };
    const grid = await createGrid({
      columns: [{ path: 'p', label: 'P', comparator: (a, b) => rank[a] - rank[b] }],
      items: [{ p: 'mid' }, { p: 'high' }, { p: 'low' }],
    });

    await click(grid, header(grid, 'P'));
    expect(names(grid)).toEqual(['low', 'mid', 'high']);
    await click(grid, header(grid, 'P'));
    expect(names(grid)).toEqual(['high', 'mid', 'low']);
  });
});

describe('ordenação com grupos', () => {
  const grouped = () => createGrid({
    columns: [
      { path: 'city', label: 'City', groupIndex: 0 },
      { path: 'name', label: 'Name' },
      { path: 'age', label: 'Age' },
    ],
    items: people(),
    configure: g => g.autoExpandGroups = true,
  });

  const chip = (grid: DataGrid) => grid.shadowRoot!.querySelector<HTMLElement>('.group')!;
  const nameCells = (grid: DataGrid) => dataRows(grid).map(r => cellText(r.cells[1]));

  it('linhas ordenadas dentro dos grupos', async () => {
    const grid = await grouped();

    await click(grid, header(grid, 'Name'));
    expect(groupLabels(grid)).toEqual(['City: Lima', 'City: Rio']);
    expect(nameCells(grid)).toEqual(['alice', 'Bob', 'Carol', 'dave']);

    await click(grid, header(grid, 'Name'));
    expect(nameCells(grid)).toEqual(['Bob', 'alice', 'dave', 'Carol']);
  });

  it('o grupo segue a direção da coluna; clique e Enter no chip alternam', async () => {
    const grid = await grouped();

    expect(chip(grid).getAttribute('aria-label')).toBe('City, ascending');

    await click(grid, chip(grid));
    expect(groupLabels(grid)).toEqual(['City: Rio', 'City: Lima']);
    expect(sortingOf(grid)).toEqual(['City:desc']);
    expect(chip(grid).getAttribute('aria-label')).toBe('City, descending');

    // Ordenar outra coluna (substituindo) mantém a direção do grupo.
    await click(grid, header(grid, 'Name'));
    expect(sortingOf(grid)).toEqual(['City:desc', 'Name:asc']);
    expect(groupLabels(grid)).toEqual(['City: Rio', 'City: Lima']);
    // Só a coluna comum entra na numeração do cabeçalho.
    expect(sortIndexes(grid)).toEqual([null, null]);

    await press(grid, chip(grid), 'Enter');
    expect(groupLabels(grid)).toEqual(['City: Lima', 'City: Rio']);

    grid.sortBy(column(grid, 'City'), 'desc');
    await settle(grid);
    expect(groupLabels(grid)).toEqual(['City: Rio', 'City: Lima']);
  });

  it('agrupar uma coluna ordenada usa a direção dela', async () => {
    const grid = await createGrid({ columns: columns(), items: people(), configure: g => g.autoExpandGroups = true });

    grid.sortBy(column(grid, 'City'), 'desc');
    grid.groupColumn(column(grid, 'City'), 0);
    await settle(grid);

    expect(groupLabels(grid)).toEqual(['City: Rio', 'City: Lima']);
  });
});
