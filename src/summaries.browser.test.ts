import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef, GridSummary } from './grid-column-def.js';
import type { DataGrid, GridGroupEventDetail, GridGroupExpansionChangeEventDetail } from './grid.js';
import { bodyRows, cellText, cleanup, createGrid, dataRows, groupInfos, groupLabels, groupToggles, settle } from './test/fixture.js';

afterEach(cleanup);

const sales = () => [
  { country: 'Brazil', city: 'Rio', amount: 10, day: '2024-03-01' },
  { country: 'Brazil', city: 'SP', amount: 30, day: '2024-01-15' },
  { country: 'Brazil', city: 'SP', amount: null, day: '2024-02-01' },
  { country: 'Peru', city: 'Lima', amount: 7, day: '2023-12-31' },
];

const columns = (): GridColumnDef[] => [
  { path: 'country', label: 'Country' },
  { path: 'city', label: 'City' },
  { path: 'amount', label: 'Amount', dataType: 'number' },
  { path: 'day', label: 'Day', dataType: 'date' },
];

const root = (grid: DataGrid) => grid.shadowRoot!;
const column = (grid: DataGrid, label: string) => grid.columns.find(c => c.label === label)!;
const totalRow = (grid: DataGrid) => root(grid).querySelector<HTMLTableRowElement>('tfoot tr.total-row');
const footerRows = (grid: DataGrid) => [...root(grid).querySelectorAll<HTMLTableRowElement>('tbody tr.group-footer-row')];
/** Texto VISÍVEL de uma célula de resumo (o rótulo completo vai num trecho só para o leitor de tela). */
const visibleText = (td: Element) => (td.querySelector('[aria-hidden=true]') ?? td).textContent.trim();
/** Nome acessível de uma célula de resumo (do conteúdo, não de `aria-label` — WCAG 2.5.3). */
const accessibleLabel = (td: Element) => td.querySelector('.visually-hidden')?.textContent.trim() ?? '';
/** Texto de cada célula de uma linha de resumo, a partir das colunas comuns. */
const summaryTexts = (row: HTMLTableRowElement) =>
  [...row.querySelectorAll<HTMLTableCellElement>('td[aria-colindex]:not(.selection-cell)')].map(visibleText);

const press = async (grid: DataGrid, target: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));
  await settle(grid);
};

const grouped = async (summary: GridSummary | null, configure?: (grid: DataGrid) => void) => {
  const defs = columns();
  defs[0].groupIndex = 0;

  return createGrid({
    columns: defs,
    items: sales(),
    configure: grid => {
      grid.language = 'en';
      grid.summary = summary;
      configure?.(grid);
    },
  });
};

describe('rodapé de totais', () => {
  it('fica num rowgroup próprio, fora do tbody, sob as colunas', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: sales(),
      configure: g => {
        g.language = 'en';
        g.summary = {
          total: [
            { column: 'amount', type: 'sum' },
            { column: 'amount', type: 'avg' },
            { column: 'country', type: 'count' },
            { column: 'day', type: 'min' },
          ],
        };
      },
    });

    const row = totalRow(grid)!;

    expect(row.closest('tfoot')!.getAttribute('role')).toBe('rowgroup');
    expect(row.getAttribute('part')).toBe('summary-row total-row');
    expect(summaryTexts(row)).toEqual(['Count: 4', '', 'Sum: 47Avg: 15.67', 'Min: 12/31/2023']);
    expect(getComputedStyle(row.closest('tfoot')!).position).toBe('sticky');

    // Rótulo completo para o leitor de tela.
    const amountCell = row.querySelector('td[aria-colindex="3"]')!;
    expect(accessibleLabel(amountCell)).toBe('Sum of Amount: 47, Avg of Amount: 15.67');
    expect(amountCell.getAttribute('part')).toBe('summary-cell');

    // aria-rowcount conta o rodapé; o rodapé é a última linha.
    const rowCount = Number(root(grid).querySelector('[role=grid]')!.getAttribute('aria-rowcount'));
    expect(Number(row.getAttribute('aria-rowindex'))).toBe(rowCount);
  });

  it('recalcula ao trocar items e summary; some sem summary', async () => {
    const grid = await createGrid({ columns: columns(), items: sales(), configure: g => g.summary = { total: [{ column: 'amount', type: 'sum', label: 'Total' }] } });

    expect(summaryTexts(totalRow(grid)!)[2]).toBe('Total: 47');

    grid.items = [{ amount: 1 }, { amount: 2 }];
    await settle(grid);
    expect(summaryTexts(totalRow(grid)!)[2]).toBe('Total: 3');

    grid.summary = null;
    await settle(grid);
    expect(totalRow(grid)).toBeNull();
  });

  it('format do item, função própria e coluna oculta', async () => {
    const defs = columns();
    defs[3].visible = false;
    const grid = await createGrid({
      columns: defs,
      items: sales(),
      configure: g => {
        g.language = 'en';
        g.summary = {
          total: [
            { column: 'amount', type: 'max', format: { style: 'currency', currency: 'USD' } },
            { column: defs[1], type: values => new Set(values).size, label: 'Cities' },
            { column: 'day', type: 'max' },
          ],
        };
      },
    });

    expect(summaryTexts(totalRow(grid)!)).toEqual(['', 'Cities: 3', 'Max: $30.00']);
  });

  it('getSummaryValues devolve valor e texto', async () => {
    const grid = await grouped({
      total: [{ column: 'amount', type: 'sum', name: 'total' }],
      group: [{ column: 'amount', type: 'sum' }, { column: 'amount', type: 'count', display: 'footer' }],
    });

    const [total] = grid.getSummaryValues();
    expect(total.item.name).toBe('total');
    expect(total.value).toBe(47);
    expect(total.text).toBe('47');

    expect(grid.getSummaryValues(['Brazil']).map(value => value.value)).toEqual([40, 3]);
    expect(grid.getSummaryValues(['Nowhere'])).toEqual([]);
  });

  it('não muta items nem summary', async () => {
    const items = sales();
    const summary: GridSummary = { total: [{ column: 'amount', type: 'sum' }] };
    Object.freeze(summary.total!);
    items.forEach(Object.freeze);
    await createGrid({ columns: columns(), items, configure: g => g.summary = summary });

    expect(items).toEqual(sales());
  });
});

describe('linha de grupo', () => {
  it('mostra a contagem e os resumos inline; show-group-count="false" esconde a contagem', async () => {
    const grid = await grouped({ group: [{ column: 'amount', type: 'sum' }] });

    expect(groupLabels(grid)).toEqual(['Country: Brazil', 'Country: Peru']);
    expect(groupInfos(grid)).toEqual(['(3, Sum of Amount: 40)', '(1, Sum of Amount: 7)']);
    // Nome acessível: o texto da célula da linha de grupo (o botão é `aria-hidden`, frente 05).
    expect(grid.shadowRoot!.querySelector('.grouping-cell')!.textContent.replace(/\s+/g, ' ').trim()).toBe('Country: Brazil (3, Sum of Amount: 40)');

    grid.setAttribute('show-group-count', 'false');
    await settle(grid);
    expect(groupInfos(grid)).toEqual(['(Sum of Amount: 40)', '(Sum of Amount: 7)']);

    grid.summary = null;
    await settle(grid);
    expect(groupInfos(grid)).toEqual(['', '']);
  });

  it('display column: célula própria sob a coluna, rótulo cobre as anteriores', async () => {
    const grid = await grouped({ group: [{ column: 'amount', type: 'max', display: 'column' }] });
    const row = bodyRows(grid)[0];
    const label = row.querySelector<HTMLTableCellElement>('.grouping-cell')!;
    const summary = row.querySelector<HTMLTableCellElement>('td[part=summary-cell]')!;

    // Comuns visíveis: city (1), amount (2), day (3); o rótulo ocupa city.
    expect(label.colSpan).toBe(1);
    expect(summary.getAttribute('aria-colindex')).toBe('2');
    expect(visibleText(summary)).toBe('Max: 30');
    expect(accessibleLabel(summary)).toBe('Max of Amount: 30');
    expect(groupInfos(grid)[0]).toBe('(3)');
  });

  it('display column na 1ª coluna do último nível vai para o texto', async () => {
    const defs = columns();
    defs[0].groupIndex = 0;
    const grid = await createGrid({
      columns: [defs[0], defs[2], defs[1]],
      items: sales(),
      configure: g => {
        g.language = 'en';
        g.summary = { group: [{ column: 'amount', type: 'sum', display: 'column' }] };
      },
    });

    expect(bodyRows(grid)[0].querySelector('td[part=summary-cell]')).toBeNull();
    expect(groupInfos(grid)[0]).toBe('(3, Sum of Amount: 40)');
  });

  it('display footer: rodapé depois dos itens, só com o grupo expandido', async () => {
    const grid = await grouped({ group: [{ column: 'amount', type: 'sum', display: 'footer' }] });

    expect(footerRows(grid)).toHaveLength(0);

    grid.expandAllGroups();
    await settle(grid);

    const footers = footerRows(grid);
    expect(footers).toHaveLength(2);
    expect(footers[0].getAttribute('part')).toBe('row group-footer-row summary-row');
    expect(summaryTexts(footers[0])).toEqual(['', 'Sum: 40', '']);
    expect(dataRows(grid)).toHaveLength(4);
    // Rodapé vem depois das 3 linhas do Brasil.
    expect(bodyRows(grid).indexOf(footers[0])).toBe(4);
  });

  it('groupValueGetter agrupa por faixa e mostra o valor devolvido', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'name', label: 'Name', groupIndex: 0, groupValueGetter: (item: { name: string }) => item.name[0].toUpperCase() },
        { path: 'year', label: 'Year', format: { style: 'currency', currency: 'USD' }, groupValueGetter: (item: { year: number }) => Math.floor(item.year / 10) * 10 },
      ],
      items: [{ name: 'ana', year: 1994 }, { name: 'Bia', year: 2001 }, { name: 'Alice', year: 1999 }],
      configure: g => g.language = 'en',
    });

    expect(groupLabels(grid)).toEqual(['Name: A', 'Name: B']);

    grid.groupColumn(column(grid, 'Year'), 0);
    await settle(grid);
    // Sem o format de moeda e sem separador de milhar.
    expect(groupLabels(grid)).toEqual(['Year: 1990', 'Year: 2000']);
  });

  it('formata pelos textos do idioma e em RTL', async () => {
    const grid = await grouped({ group: [{ column: 'amount', type: 'sum' }] }, g => {
      g.language = 'ar';
      g.dir = 'rtl';
    });

    expect(groupInfos(grid)[0]).toContain('المجموع');
    expect(groupInfos(grid)[0]).toContain('Amount');
  });
});

describe('expansão por API', () => {
  const events = (grid: DataGrid) => {
    const list: GridGroupExpansionChangeEventDetail[] = [];
    grid.addEventListener('u-grid-group-expansion-change', event => list.push(event.detail));
    return list;
  };

  const multi = async () => {
    const defs = columns();
    defs[0].groupIndex = 0;
    defs[1].groupIndex = 1;

    return createGrid({ columns: defs, items: sales(), configure: g => g.language = 'en' });
  };

  it('expandGroup/collapseGroup/isGroupExpanded com evento só quando muda', async () => {
    const grid = await multi();
    const log = events(grid);

    expect(grid.isGroupExpanded(['Brazil'])).toBe(false);

    grid.expandGroup(['Brazil']);
    await settle(grid);
    expect(grid.isGroupExpanded(['Brazil'])).toBe(true);
    expect(groupLabels(grid)).toEqual(['Country: Brazil', 'City: Rio', 'City: SP', 'Country: Peru']);

    grid.expandGroup(['Brazil']);
    grid.expandGroup(['Brazil', 'SP']);
    await settle(grid);
    expect(dataRows(grid)).toHaveLength(2);

    expect(Object.isFrozen(log[0].groupPath)).toBe(true);
    expect(log).toEqual([
      { groupPath: ['Brazil'], groupIndex: 0, expanded: true, source: 'api' },
      { groupPath: ['Brazil', 'SP'], groupIndex: 1, expanded: true, source: 'api' },
    ]);

    grid.collapseGroup(['Brazil']);
    await settle(grid);
    expect(groupLabels(grid)).toEqual(['Country: Brazil', 'Country: Peru']);
    // O filho guardou o estado.
    expect(grid.isGroupExpanded(['Brazil', 'SP'])).toBe(true);
  });

  it('expandAllGroups/collapseAllGroups por nível e em todos', async () => {
    const grid = await multi();
    const log = events(grid);

    grid.expandAllGroups(0);
    await settle(grid);
    expect(groupLabels(grid)).toHaveLength(5);
    expect(dataRows(grid)).toHaveLength(0);

    grid.expandAllGroups();
    await settle(grid);
    expect(dataRows(grid)).toHaveLength(4);

    grid.collapseAllGroups(1);
    await settle(grid);
    expect(dataRows(grid)).toHaveLength(0);
    expect(grid.isGroupExpanded(['Brazil'])).toBe(true);

    grid.collapseAllGroups();
    grid.collapseAllGroups();
    await settle(grid);
    expect(groupLabels(grid)).toHaveLength(2);

    expect(log.map(({ groupPath, groupIndex, expanded }) => [groupPath, groupIndex, expanded])).toEqual([
      [null, 0, true],
      [null, null, true],
      [null, 1, false],
      [null, null, false],
    ]);
  });

  it('o padrão de *AllGroups vale para grupos novos; mudar autoExpandGroups zera o estado', async () => {
    const grid = await multi();

    grid.expandAllGroups();
    grid.items = [...sales(), { country: 'Chile', city: 'Santiago', amount: 1, day: null }];
    await settle(grid);
    expect(grid.isGroupExpanded(['Chile', 'Santiago'])).toBe(true);

    grid.collapseGroup(['Peru']);
    grid.autoExpandGroups = true;
    await settle(grid);
    expect(grid.isGroupExpanded(['Peru'])).toBe(true);

    grid.autoExpandGroups = false;
    await settle(grid);
    expect(grid.isGroupExpanded(['Chile'])).toBe(false);
  });

  it('estado preservado em troca de dados e ordenação; toggle do usuário com source user', async () => {
    const grid = await multi();
    const log = events(grid);

    groupToggles(grid)[1].click();
    await settle(grid);
    expect(log.at(-1)).toEqual({ groupPath: ['Peru'], groupIndex: 0, expanded: true, source: 'user' });
    expect(Object.isFrozen(log.at(-1)!.groupPath)).toBe(true);

    grid.items = sales().reverse()
      .map(item => ({ ...item }));
    grid.sortColumn(column(grid, 'Country'), 'desc');
    await settle(grid);

    expect(groupLabels(grid)).toEqual(['Country: Peru', 'City: Lima', 'Country: Brazil']);
  });

  it('o mapa de expansão não cresce com grupos que voltam ao padrão', async () => {
    const grid = await multi();

    for (let i = 0; i < 20; i++) {
      grid.expandGroup(['Brazil']);
      grid.collapseGroup(['Brazil']);
    }

    grid.expandGroup(['Peru']);
    expect(grid._memoryStats.expansion).toBe(1);

    grid.collapseAllGroups();
    expect(grid._memoryStats.expansion).toBe(0);
  });
});

describe('menu do painel de grupos', () => {
  const chips = (grid: DataGrid) => [...root(grid).querySelectorAll<HTMLElement>('.group')];
  const menu = (grid: DataGrid) => root(grid).querySelector<HTMLElement>('[role=menu]');
  const items = (grid: DataGrid) => [...menu(grid)!.querySelectorAll<HTMLElement>('[role=menuitem]')];

  it('Shift+F10 no chip abre; setas, Home/End; Esc fecha e devolve o foco', async () => {
    const grid = await grouped(null);
    const chip = chips(grid)[0];

    // Ordenável: a ativação ordena, o menu é atalho (não é "botão de menu").
    expect(chip.hasAttribute('aria-haspopup')).toBe(false);
    expect(chip.getAttribute('aria-keyshortcuts')).toBe('Shift+F10');
    chip.focus();
    await press(grid, chip, 'F10', { shiftKey: true });

    expect(menu(grid)!.getAttribute('part')).toBe('group-panel-menu');
    // Fora do role="grid" (que só pode ter linhas).
    expect(menu(grid)!.closest('[role=grid]')).toBeNull();
    expect(items(grid).map(item => item.textContent.trim())).toEqual(['Ungroup Country', 'Ungroup all', 'Expand all groups', 'Collapse all groups']);
    expect(root(grid).activeElement).toBe(items(grid)[0]);

    await press(grid, items(grid)[0], 'ArrowUp');
    expect(root(grid).activeElement).toBe(items(grid)[3]);
    await press(grid, items(grid)[3], 'Home');
    expect(root(grid).activeElement).toBe(items(grid)[0]);
    await press(grid, items(grid)[0], 'End');
    expect(root(grid).activeElement).toBe(items(grid)[3]);

    await press(grid, items(grid)[3], 'Escape');
    expect(menu(grid)).toBeNull();
    expect(root(grid).activeElement).toBe(chips(grid)[0]);
  });

  it('expandir/recolher tudo e desagrupar pelo menu (source user)', async () => {
    const grid = await grouped(null);
    const expansion: GridGroupExpansionChangeEventDetail[] = [];
    const grouping: GridGroupEventDetail[] = [];
    grid.addEventListener('u-grid-group-expansion-change', event => expansion.push(event.detail));
    grid.addEventListener('u-grid-group-change', event => grouping.push(event.detail));

    chips(grid)[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 20, clientY: 20 }));
    await settle(grid);
    items(grid)[2].click();
    await settle(grid);

    expect(menu(grid)).toBeNull();
    expect(dataRows(grid)).toHaveLength(4);
    expect(expansion).toEqual([{ groupPath: null, groupIndex: null, expanded: true, source: 'user' }]);

    await press(grid, chips(grid)[0], 'ContextMenu');
    items(grid)[1].click();
    await settle(grid);

    expect(grid.getGrouping()).toEqual([]);
    expect(grouping).toHaveLength(1);
    expect(grouping[0].source).toBe('user');
  });

  it('desagrupar pelo teclado leva o foco ao chip vizinho e depois ao cabeçalho', async () => {
    const defs = columns();
    defs[0].groupIndex = 0;
    defs[1].groupIndex = 1;
    const grid = await createGrid({ columns: defs, items: sales() });

    chips(grid)[1].focus();
    await press(grid, chips(grid)[1], 'ContextMenu');
    items(grid)[0].click();
    await settle(grid);

    expect(grid.getGrouping()).toEqual([defs[0]]);
    expect(root(grid).activeElement).toBe(chips(grid)[0]);

    await press(grid, chips(grid)[0], 'ContextMenu');
    items(grid)[1].click();
    await settle(grid);

    expect(root(grid).activeElement?.matches('th.header-column')).toBe(true);
  });

  it('fecha sozinho quando o agrupamento some por API', async () => {
    const grid = await grouped(null);

    await press(grid, chips(grid)[0], 'ContextMenu');
    expect(menu(grid)).not.toBeNull();

    grid.ungroupColumn(column(grid, 'Country'));
    await settle(grid);
    expect(menu(grid)).toBeNull();
  });

  it('clique fora fecha; group-panel-menu="false" desliga', async () => {
    const grid = await grouped(null);

    await press(grid, chips(grid)[0], 'ContextMenu');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await settle(grid);
    expect(menu(grid)).toBeNull();

    grid.setAttribute('group-panel-menu', 'false');
    await settle(grid);

    const event = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true });
    chips(grid)[0].dispatchEvent(event);
    await press(grid, chips(grid)[0], 'ContextMenu');

    expect(event.defaultPrevented).toBe(false);
    expect(menu(grid)).toBeNull();
    expect(chips(grid)[0].hasAttribute('aria-haspopup')).toBe(false);
  });

  it('chip de coluna não ordenável é focável e abre o menu com Enter', async () => {
    const defs = columns();
    defs[0].groupIndex = 0;
    defs[0].sortable = false;
    const grid = await createGrid({ columns: defs, items: sales() });
    const chip = chips(grid)[0];

    expect(chip.tabIndex).toBe(0);
    expect(chip.getAttribute('aria-haspopup')).toBe('menu');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    await press(grid, chip, 'Enter');
    expect(menu(grid)).not.toBeNull();
    expect(chips(grid)[0].getAttribute('aria-expanded')).toBe('true');
  });
});

describe('groupable', () => {
  it('groupable=false barra o usuário, não a API', async () => {
    const defs = columns();
    defs[1].groupable = false;
    const grid = await createGrid({ columns: defs, items: sales() });

    grid._userGroupColumn(defs[1], 0);
    await settle(grid);
    expect(grid.getGrouping()).toEqual([]);

    grid.groupColumn(defs[1]);
    await settle(grid);
    expect(grid.getGrouping()).toEqual([defs[1]]);
  });

  it('padrão: coluna sem valor não é agrupável pelo usuário', async () => {
    const actions: GridColumnDef = { label: 'Actions', renderer: () => null };
    const grid = await createGrid({ columns: [...columns(), actions], items: sales() });

    grid._userGroupColumn(actions, 0);
    await settle(grid);
    expect(grid.getGrouping()).toEqual([]);
  });

  it('<u-grid-column groupable="false"> e groupValueGetter reagrupa', async () => {
    const grid = document.createElement('u-grid');
    grid.innerHTML = '<u-grid-column path="name" groupable="false">Name</u-grid-column><u-grid-column path="n" group-index="0">N</u-grid-column>';
    document.body.append(grid);
    grid.items = [{ name: 'a', n: 1 }, { name: 'b', n: 12 }];
    await settle(grid);

    const [name, n] = [...grid.querySelectorAll('u-grid-column')];
    expect(name.groupable).toBe(false);
    expect(groupLabels(grid)).toEqual(['N: 1', 'N: 12']);

    n.groupValueGetter = (item: { n: number }) => item.n < 10 ? 'small' : 'big';
    await settle(grid);
    expect(groupLabels(grid)).toEqual(['N: big', 'N: small']);
    expect(cellText(bodyRows(grid)[0].cells[1])).toContain('N: big');
  });
});
