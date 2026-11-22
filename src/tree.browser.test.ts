/**
 * Frente 25: dados em árvore (`treeMode`). Render (recuo, botão, ARIA do
 * treegrid), expansão (clique, teclado da APG, métodos, evento, estado),
 * filtro com os modos, ordenação por nível, resumos por nó, seleção
 * recursiva, inserir filho, exportação, combinações e fonte remota.
 */
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type {
  DataGrid,
  GridColumnDef,
  GridLoadOptions,
  GridNodeExpansionChangeEventDetail,
  GridSelectionChangeEventDetail,
} from './grid.js';
import { cleanup, createGrid, settle } from './test/fixture.js';

afterEach(cleanup);

interface TreeItem {
  id: number;
  parentId: number | null;
  name: string;
  size: number;
  children?: TreeItem[];
}

/** a(1) → a1(2), a2(3) → a2x(4); b(5) → b1(6); c(7). */
const flatItems = (): TreeItem[] => [
  { id: 1, parentId: null, name: 'a', size: 10 },
  { id: 2, parentId: 1, name: 'a1', size: 1 },
  { id: 3, parentId: 1, name: 'a2', size: 2 },
  { id: 4, parentId: 3, name: 'a2x', size: 4 },
  { id: 5, parentId: null, name: 'b', size: 20 },
  { id: 6, parentId: 5, name: 'b1', size: 8 },
  { id: 7, parentId: null, name: 'c', size: 30 },
];

const nestedItems = (): TreeItem[] => [
  { id: 1, parentId: null, name: 'a', size: 10, children: [
    { id: 2, parentId: 1, name: 'a1', size: 1 },
    { id: 3, parentId: 1, name: 'a2', size: 2, children: [{ id: 4, parentId: 3, name: 'a2x', size: 4 }] },
  ] },
  { id: 5, parentId: null, name: 'b', size: 20, children: [{ id: 6, parentId: 5, name: 'b1', size: 8 }] },
  { id: 7, parentId: null, name: 'c', size: 30 },
];

const columns = (): GridColumnDef[] => [
  { path: 'name', label: 'Name' },
  { path: 'size', label: 'Size', dataType: 'number' },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;

const rows = (grid: DataGrid): HTMLTableRowElement[] =>
  [...root(grid).querySelectorAll<HTMLTableRowElement>('tbody.body-rows > tr[role=row], tbody > tr[role=row][data-index]')]
    .filter((tr, index, all) => all.indexOf(tr) === index && !tr.classList.contains('no-data-row'));

/** Nomes com o recuo (2 espaços por nível, pelo `aria-level`). */
const tree = (grid: DataGrid): string[] =>
  rows(grid).map(tr => `${'  '.repeat(Number(tr.getAttribute('aria-level')) - 1)}${tr.querySelector('.tree-content')?.textContent.trim() ?? ''}`);

const treeCell = (grid: DataGrid, name: string): HTMLTableCellElement =>
  rows(grid).find(tr => tr.querySelector('.tree-content')?.textContent.trim() === name)!.querySelector<HTMLTableCellElement>('td.tree-cell')!;

const flatGrid = (configure?: (grid: DataGrid) => void, gridColumns = columns()) => createGrid({
  columns: gridColumns,
  items: flatItems(),
  setBeforeConnect: true,
  configure: grid => {
    grid.treeMode = 'flat';
    grid.keyExpr = 'id';
    grid.parentKeyExpr = 'parentId';
    configure?.(grid);
  },
});

describe('árvore: render e ARIA', () => {
  it('plana: só as raízes, recuo e treegrid com level/setsize/posinset/expanded', async () => {
    const grid = await flatGrid();

    expect(tree(grid)).toEqual(['a', 'b', 'c']);
    expect(root(grid).querySelector('table')!.getAttribute('role')).toBe('treegrid');

    const [a, , c] = rows(grid);
    expect(a.getAttribute('aria-level')).toBe('1');
    expect(a.getAttribute('aria-setsize')).toBe('3');
    expect(a.getAttribute('aria-posinset')).toBe('1');
    expect(a.getAttribute('aria-expanded')).toBe('false');
    expect(a.querySelector('td.tree-cell')!.getAttribute('aria-expanded')).toBe('false');
    expect(a.querySelector('td.tree-cell')!.getAttribute('part')).toBe('cell tree-cell');
    // Folha: sem botão e sem aria-expanded.
    expect(c.hasAttribute('aria-expanded')).toBe(false);
    expect(c.querySelector('.tree-toggle')).toBeNull();
    expect(c.querySelector('.tree-toggle-spacer')).not.toBeNull();
  });

  it('aninhada: mesma árvore, sem mutar os dados', async () => {
    const items = nestedItems();
    const grid = await createGrid({
      columns: columns(),
      items,
      setBeforeConnect: true,
      configure: g => {
        g.treeMode = 'nested';
        g.autoExpandNodes = true;
      },
    });

    expect(tree(grid)).toEqual(['a', '  a1', '  a2', '    a2x', 'b', '  b1', 'c']);
    expect(items[0].children).toHaveLength(2);
    expect(grid.items).toBe(items);
  });

  it('lista comum sem keyExpr/parentKeyExpr no modo flat (aviso)', async () => {
    const grid = await createGrid({
      columns: columns(),
      items: flatItems(),
      setBeforeConnect: true,
      configure: g => {
        g.treeMode = 'flat';
      },
    });

    expect(root(grid).querySelector('table')!.getAttribute('role')).toBe('grid');
    expect(rows(grid)).toHaveLength(7);
  });

  it('treeColumn escolhe a coluna da árvore', async () => {
    const grid = await flatGrid(g => {
      g.treeColumn = 'size';
    });

    const cell = rows(grid)[0].querySelector('td.tree-cell')!;
    expect(cell.getAttribute('aria-colindex')).toBe('2');
  });
});

describe('árvore: expandir e recolher', () => {
  it('clique no botão expande, foca a célula da árvore e dispara o evento', async () => {
    const grid = await flatGrid();
    const events: GridNodeExpansionChangeEventDetail[] = [];
    grid.addEventListener('u-grid-node-expansion-change', event => events.push(event.detail));

    treeCell(grid, 'a').querySelector<HTMLElement>('.tree-toggle')!.click();
    await settle(grid);

    expect(tree(grid)).toEqual(['a', '  a1', '  a2', 'b', 'c']);
    expect(events).toEqual([{ rowKey: 1, expanded: true, source: 'user' }]);
    expect(root(grid).activeElement).toBe(treeCell(grid, 'a'));
    expect(rows(grid)[0].getAttribute('part')).toContain('expanded');
  });

  it('métodos: expandNode (Promise), collapseNode, isNodeExpanded, expandAllNodes, collapseAllNodes', async () => {
    const grid = await flatGrid();

    expect(await grid.expandNode(3)).toBe(true);
    expect(grid.isNodeExpanded(3)).toBe(true);
    await settle(grid);
    // a2 expandido, mas a recolhido: a2x não aparece.
    expect(tree(grid)).toEqual(['a', 'b', 'c']);

    await grid.expandNode(1);
    await settle(grid);
    expect(tree(grid)).toEqual(['a', '  a1', '  a2', '    a2x', 'b', 'c']);

    expect(await grid.expandNode(7)).toBe(false);
    expect(await grid.expandNode(999)).toBe(false);

    grid.collapseNode(1);
    await settle(grid);
    expect(tree(grid)).toEqual(['a', 'b', 'c']);

    grid.expandAllNodes();
    await settle(grid);
    expect(tree(grid)).toEqual(['a', '  a1', '  a2', '    a2x', 'b', '  b1', 'c']);

    grid.collapseAllNodes();
    await settle(grid);
    expect(tree(grid)).toEqual(['a', 'b', 'c']);
  });

  it('teclado da APG: → expande, → de novo anda, ← recolhe, ← vai ao pai, *', async () => {
    const grid = await flatGrid();
    treeCell(grid, 'a').focus();
    await settle(grid);

    await userEvent.keyboard('{ArrowRight}');
    await settle(grid);
    expect(tree(grid)).toEqual(['a', '  a1', '  a2', 'b', 'c']);
    expect(root(grid).activeElement).toBe(treeCell(grid, 'a'));

    await userEvent.keyboard('{ArrowRight}');
    await settle(grid);
    // Expandido: vai à célula seguinte.
    expect(root(grid).activeElement?.getAttribute('aria-colindex')).toBe('2');

    await userEvent.keyboard('{ArrowLeft}{ArrowDown}{ArrowDown}');
    await settle(grid);
    expect(root(grid).activeElement).toBe(treeCell(grid, 'a2'));

    // ← numa folha/recolhido: ao pai.
    await userEvent.keyboard('{ArrowLeft}');
    await settle(grid);
    expect(root(grid).activeElement).toBe(treeCell(grid, 'a'));

    // ← num expandido: recolhe.
    await userEvent.keyboard('{ArrowLeft}');
    await settle(grid);
    expect(tree(grid)).toEqual(['a', 'b', 'c']);

    // *: expande os irmãos (a e b).
    await userEvent.keyboard('*');
    await settle(grid);
    expect(tree(grid)).toEqual(['a', '  a1', '  a2', 'b', '  b1', 'c']);
    expect(root(grid).querySelector('[role=status], [aria-live]')!.textContent).toContain('Expanded rows: 2');
  });

  it('Enter na célula da árvore alterna (sem edição)', async () => {
    const grid = await flatGrid();
    treeCell(grid, 'b').focus();
    await userEvent.keyboard('{Enter}');
    await settle(grid);
    expect(tree(grid)).toEqual(['a', 'b', '  b1', 'c']);
  });

  it('RTL: ← expande e → recolhe', async () => {
    const grid = await flatGrid(g => {
      g.dir = 'rtl';
    });
    treeCell(grid, 'b').focus();
    await userEvent.keyboard('{ArrowLeft}');
    await settle(grid);
    expect(tree(grid)).toEqual(['a', 'b', '  b1', 'c']);
    await userEvent.keyboard('{ArrowRight}');
    await settle(grid);
    expect(tree(grid)).toEqual(['a', 'b', 'c']);
  });

  it('recolher com a célula ativa num descendente leva o foco à célula da árvore do nó', async () => {
    const grid = await flatGrid(g => {
      g.autoExpandNodes = true;
    });
    treeCell(grid, 'a2x').focus();
    grid.collapseNode(1);
    await settle(grid);

    expect(root(grid).activeElement).toBe(treeCell(grid, 'a'));
  });

  it('estado: nodeExpansion em getState/setState', async () => {
    const grid = await flatGrid();
    await grid.expandNode(1);
    expect(grid.getState().nodeExpansion).toEqual({ all: null, expanded: [1], collapsed: [] });

    grid.collapseNode(1);
    grid.setState({ version: 1, nodeExpansion: { all: true, expanded: [], collapsed: [5] } }, { partial: true });
    await settle(grid);
    expect(tree(grid)).toEqual(['a', '  a1', '  a2', '    a2x', 'b', 'c']);
  });
});

describe('árvore: filtro, ordenação e resumos', () => {
  it('filtro with-ancestors / full-branch / match-only, com os ancestrais expandidos', async () => {
    const grid = await flatGrid();
    grid.searchText = 'a2';
    await settle(grid);
    // a2 e a2x passam; a (ancestral) aparece e expande.
    expect(tree(grid)).toEqual(['a', '  a2', '    a2x']);

    grid.searchText = 'b';
    grid.treeFilterMode = 'match-only';
    await settle(grid);
    expect(tree(grid)).toEqual(['b', '  b1']);

    grid.filterValue = ['name', '=', 'a2'];
    grid.searchText = '';
    grid.treeFilterMode = 'full-branch';
    await settle(grid);
    expect(tree(grid)).toEqual(['a', '  a2', '    a2x']);

    grid.treeFilterMode = 'match-only';
    await settle(grid);
    expect(tree(grid)).toEqual(['a2']);
    expect(rows(grid)[0].getAttribute('aria-level')).toBe('1');
  });

  it('ordenação dentro de cada nível', async () => {
    const grid = await flatGrid(g => {
      g.autoExpandNodes = true;
    });
    grid.sortColumn(grid.columns[1], 'desc');
    await settle(grid);
    expect(tree(grid)).toEqual(['c', 'b', '  b1', 'a', '  a2', '    a2x', '  a1']);
  });

  it('resumos por nó: inline, column e getNodeSummaryValues', async () => {
    const grid = await flatGrid(g => {
      g.autoExpandNodes = true;
      g.summary = { node: [{ column: 'size', type: 'sum' }, { column: 'size', type: 'count', display: 'column' }] };
    });

    expect(grid.getNodeSummaryValues(1).map(value => value.value)).toEqual([7, 3]);
    expect(treeCell(grid, 'a').querySelector('.tree-summary')!.textContent).toContain('7');
    // `column`: a contagem no lugar do valor do nó.
    expect(rows(grid)[0].querySelectorAll('td')[1].textContent).toContain('3');
    expect(grid.getNodeSummaryValues(7)).toEqual([]);
  });

  it('agrupamento é ignorado (e volta ao desligar a árvore)', async () => {
    const grid = await flatGrid(undefined, [{ path: 'name', label: 'Name' }, { path: 'size', label: 'Size', groupIndex: 0 }]);

    expect(grid.getGrouping()).toEqual([]);
    expect(root(grid).querySelector('table')!.getAttribute('role')).toBe('treegrid');

    grid.treeMode = 'none';
    await settle(grid);
    expect(grid.getGrouping().map(column => column.path)).toEqual(['size']);
  });
});

describe('árvore: seleção recursiva', () => {
  it('marca a subárvore, pai misto e completo', async () => {
    const grid = await flatGrid(g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
      g.recursiveSelection = true;
      g.autoExpandNodes = true;
    });
    const events: GridSelectionChangeEventDetail[] = [];
    grid.addEventListener('u-grid-selection-change', event => events.push(event.detail));

    grid.selectRows([3]);
    await settle(grid);
    expect([...grid.selectedKeys].sort()).toEqual([3, 4]);

    const checkbox = (name: string) => treeCell(grid, name).closest('tr')!.querySelector('[role=checkbox], input[type=checkbox]')!;
    const state = (name: string) => checkbox(name).getAttribute('aria-checked') ?? String((checkbox(name) as HTMLInputElement).indeterminate ? 'mixed' : (checkbox(name) as HTMLInputElement).checked);
    expect(state('a')).toBe('mixed');
    expect(treeCell(grid, 'a').closest('tr')!.getAttribute('aria-selected')).toBe('false');

    grid.selectRows([2], { append: true });
    await settle(grid);
    expect([...grid.selectedKeys].sort()).toEqual([1, 2, 3, 4]);
    expect(state('a')).toBe('true');

    grid.deselectRows([4]);
    await settle(grid);
    expect([...grid.selectedKeys].sort()).toEqual([2]);
    expect(events.length).toBe(3);
  });
});

describe('árvore: edição e exportação', () => {
  it('addRow com parentKey: 1º filho do pai (que expande), recuo e parentKey no evento e na mudança', async () => {
    const grid = await flatGrid(g => {
      g.editMode = 'batch';
      g.allowAdding = true;
      g.allowEditing = true;
    });
    const adding: unknown[] = [];
    grid.addEventListener('u-grid-row-adding', event => adding.push(event.detail.parentKey));

    grid.addRow({ name: 'new' }, { parentKey: 5 });
    await settle(grid);

    expect(adding).toEqual([5]);
    const newRow = rows(grid)[2];
    expect(rows(grid)[1].querySelector('.tree-content')!.textContent.trim()).toBe('b');
    expect(newRow.getAttribute('aria-level')).toBe('2');
    expect(grid.getChanges()[0]).toMatchObject({ type: 'add', parentKey: 5, data: { name: 'new', parentId: 5 } });

    // Salvar (itens locais): a fonte copiada ganha o nó e a árvore o mostra sob b.
    let saved: unknown[] | null = null;
    grid.addEventListener('u-grid-save', event => {
      saved = event.detail.items;
    });
    await grid.saveChanges();
    await settle(grid);
    expect(saved).toHaveLength(8);
    // O nó salvo vai para o fim da lista plana: o último filho de b.
    expect(tree(grid)).toEqual(['a', 'b', '  b1', '  new', 'c']);
  });

  it('aninhada: salvar um filho novo copia só o caminho', async () => {
    const items = nestedItems();
    const grid = await createGrid({
      columns: columns(),
      items,
      setBeforeConnect: true,
      configure: g => {
        g.treeMode = 'nested';
        g.keyExpr = 'id';
        g.editMode = 'batch';
        g.allowAdding = true;
      },
    });

    grid.addRow({ id: 99, name: 'z' }, { parentKey: 3 });
    await grid.saveChanges();
    await settle(grid);

    expect(tree(grid)).toEqual(['a', '  a1', '  a2', '    z', '    a2x', 'b', 'c']);
    expect(items[0].children![1].children).toHaveLength(1);
    expect(grid.items).not.toBe(items);
  });

  it('exportação: só os nós expandidos, com o nível', async () => {
    const grid = await flatGrid();
    await grid.expandNode(1);
    const data = await grid.getExportData();
    expect(data.rows.map(row => row.rowType === 'data' ? `${row.level}:${String((row.item as TreeItem).name)}` : row.rowType))
      .toEqual(['0:a', '1:a1', '1:a2', '0:b', '0:c']);
  });

  it('exportar selecionadas inclui nós de ramos recolhidos; addRow com pai inexistente não adiciona', async () => {
    const grid = await flatGrid(g => {
      g.selectionMode = 'multiple';
      g.editMode = 'batch';
      g.allowAdding = true;
    });
    grid.selectRows([4, 6]);
    const data = await grid.getExportData({ selectedOnly: true });
    expect(data.rows.map(row => row.rowType === 'data' ? `${row.level}:${String((row.item as TreeItem).name)}` : row.rowType)).toEqual(['2:a2x', '1:b1']);

    expect(grid.addRow({ name: 'x' }, { parentKey: 999 })).toBeNull();
    expect(grid.hasChanges()).toBe(false);
  });

  it('expandAllNodes sem mudança não dispara; rodapé de nó tem part próprio', async () => {
    const grid = await flatGrid(g => {
      g.summary = { node: [{ column: 'size', type: 'sum', display: 'footer' }] };
    });
    const events: GridNodeExpansionChangeEventDetail[] = [];
    grid.addEventListener('u-grid-node-expansion-change', event => events.push(event.detail));

    grid.expandAllNodes();
    grid.expandAllNodes();
    await settle(grid);
    expect(events).toHaveLength(1);
    expect(root(grid).querySelector('tr[part~=node-footer-row]')).not.toBeNull();
    expect(root(grid).querySelector('tr[part~=group-footer-row]')).toBeNull();
  });

  it('menu da linha: expandir nó e inserir filho', async () => {
    const grid = await flatGrid(g => {
      g.rowMenu = true;
      g.editMode = 'batch';
      g.allowAdding = true;
    });
    treeCell(grid, 'b').focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await settle(grid);

    const items = [...root(grid).querySelectorAll('[role=menuitem]')].map(item => item.textContent.trim());
    expect(items).toContain('Expand');
    expect(items).toContain('Add child row');
  });
});

describe('árvore: roteiro de foco', () => {
  it('Esc no filho novo devolve o foco à célula da árvore do pai', async () => {
    const grid = await flatGrid(g => {
      g.editMode = 'batch';
      g.allowAdding = true;
      g.allowEditing = true;
    });
    treeCell(grid, 'b').focus();
    grid.addRow({}, { parentKey: 5 });
    await settle(grid);
    expect(root(grid).activeElement?.closest('tr')?.getAttribute('aria-level')).toBe('2');

    await userEvent.keyboard('{Escape}');
    await settle(grid);
    grid.discardChanges();
    await settle(grid);
    expect(root(grid).activeElement).toBe(treeCell(grid, 'b'));
  });

  it('collapseNode com o foco fora do grid não rouba o foco', async () => {
    const grid = await flatGrid(g => {
      g.autoExpandNodes = true;
    });
    const outside = document.createElement('button');
    document.body.append(outside);
    treeCell(grid, 'a2x').focus();
    outside.focus();

    grid.collapseNode(1);
    grid.collapseAllNodes();
    await settle(grid);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('Espaço num nó misto marca a subárvore; Enter numa célula editável não alterna', async () => {
    const grid = await flatGrid(g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
      g.recursiveSelection = true;
      g.autoExpandNodes = true;
      g.allowEditing = true;
    });
    grid.selectRows([4]);
    await settle(grid);
    treeCell(grid, 'a').focus();
    await userEvent.keyboard(' ');
    await settle(grid);
    expect([...grid.selectedKeys].sort()).toEqual([1, 2, 3, 4]);

    await userEvent.keyboard('{Enter}');
    await settle(grid);
    // Edita (não alterna): a continua expandido.
    expect(grid.isNodeExpanded(1)).toBe(true);
  });

  it('← vai ao pai em outra página (paging)', async () => {
    const grid = await flatGrid(g => {
      g.autoExpandNodes = true;
      g.paging = true;
      g.pageSize = 2;
    });
    grid.collapseNode(3);
    grid.pageIndex = 1;
    await settle(grid);
    // Página 2: a2 (recolhido), b.
    treeCell(grid, 'a2').focus();
    await userEvent.keyboard('{ArrowLeft}');
    await settle(grid);
    expect(grid.pageIndex).toBe(0);
    expect(root(grid).activeElement).toBe(treeCell(grid, 'a'));
  });

  it('remoto: ↓ pula o esqueleto da carga; axe com esqueleto e rodapé de nó', async () => {
    let release: () => void = () => undefined;
    const grid = await createGrid({
      columns: columns(),
      setBeforeConnect: true,
      configure: g => {
        g.treeMode = 'flat';
        g.keyExpr = 'id';
        g.parentKeyExpr = 'parentId';
        g.hasChildrenExpr = (item: TreeItem) => item.id === 1;
        g.dataSource = {
          load: options => options.tree?.parentKeys?.[0] === null
            ? Promise.resolve({ data: flatItems().filter(item => item.parentId === null) })
            : new Promise(resolve => {
              release = () => resolve({ data: flatItems().filter(item => item.parentId === 1) });
            }),
        };
      },
    });

    treeCell(grid, 'a').focus();
    const loaded = grid.expandNode(1);
    await settle(grid);
    expect(root(grid).querySelector('tr[aria-busy=true]')).not.toBeNull();

    const result = await axe.run(grid);
    expect(result.violations.map(violation => violation.id)).toEqual([]);

    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    expect(root(grid).activeElement).toBe(treeCell(grid, 'b'));

    release();
    expect(await loaded).toBe(true);
  });

  it('axe com rodapé de resumos por nó e filho novo', async () => {
    const grid = await flatGrid(g => {
      g.autoExpandNodes = true;
      g.editMode = 'batch';
      g.allowAdding = true;
      g.allowEditing = true;
      g.summary = { total: [{ column: 'size', type: 'sum' }], node: [{ column: 'size', type: 'sum', display: 'footer' }] };
    });
    grid.addRow({ name: 'n' }, { parentKey: 5 });
    await settle(grid);

    const result = await axe.run(grid);
    expect(result.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.html).join(' | ')}`)).toEqual([]);
    expect(root(grid).querySelector('tfoot tr')!.getAttribute('aria-level')).toBe('1');
  });
});

describe('árvore: colunas ocultas por espaço (frente 21)', () => {
  it('linha adaptativa logo abaixo do nó e acima dos filhos, no nível do nó; axe limpo', async () => {
    const wide: GridColumnDef[] = [
      { path: 'name', label: 'Name', width: 160 },
      { path: 'size', label: 'Size', width: 160, dataType: 'number' },
      { path: 'id', label: 'Id', width: 160 },
      { path: 'parentId', label: 'Parent', width: 160 },
    ];
    const grid = await flatGrid(g => {
      g.style.width = '420px';
      g.autoHideColumns = true;
      g.autoExpandNodes = true;
      g.autoExpandRows = true;
    }, wide);
    await settle(grid);
    await settle(grid);

    expect(grid.getAdaptiveColumns().length).toBeGreaterThan(0);
    const all = [...root(grid).querySelectorAll<HTMLTableRowElement>('tbody.body-rows > tr[role=row]')];
    const kinds = all.slice(0, 4).map(tr => tr.classList.contains('detail-row') ? `detail:${tr.getAttribute('aria-level')}` : `node:${tr.getAttribute('aria-level')}`);
    // a, detalhe de a (no nível dos filhos: a está expandido), a1, detalhe de a1 (folha: no nível dela).
    expect(kinds).toEqual(['node:1', 'detail:2', 'node:2', 'detail:2']);
    expect(tree(grid).filter(name => name.trim())
      .slice(0, 4)).toEqual(['a', '  a1', '  a2', '    a2x']);

    const result = await axe.run(grid);
    expect(result.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.html).join(' | ')}`)).toEqual([]);

    // Recolher o detalhe de um nó (pelo método da frente 08/21) não mexe nos filhos.
    grid.collapseRow(1);
    await settle(grid);
    const after = [...root(grid).querySelectorAll<HTMLTableRowElement>('tbody.body-rows > tr[role=row]')].slice(0, 2);
    expect(after.map(tr => tr.classList.contains('detail-row'))).toEqual([false, false]);
  });

  it('teclado e foco: ↓ passa por nó → detalhe → filho; recolher o ancestral com o foco no detalhe de um descendente leva ao nó; axe em RTL', async () => {
    const wide: GridColumnDef[] = [
      { path: 'name', label: 'Name', width: 160 },
      { path: 'size', label: 'Size', width: 160, dataType: 'number' },
      { path: 'id', label: 'Id', width: 160 },
      { path: 'parentId', label: 'Parent', width: 160 },
    ];
    const grid = await flatGrid(g => {
      g.style.width = '420px';
      g.autoHideColumns = true;
      g.autoExpandNodes = true;
      g.autoExpandRows = true;
    }, wide);
    await settle(grid);
    await settle(grid);

    treeCell(grid, 'a').focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    expect(root(grid).activeElement?.closest('tr')?.classList.contains('detail-row')).toBe(true);
    await userEvent.keyboard('{ArrowDown}');
    await settle(grid);
    expect(root(grid).activeElement).toBe(treeCell(grid, 'a1'));

    // Foco no detalhe de a2x (descendente de a); recolher a.
    const a2x = treeCell(grid, 'a2x').closest('tr')!;
    a2x.nextElementSibling!.querySelector<HTMLElement>('[tabindex]')!.focus();
    await settle(grid);
    grid.collapseNode(1);
    await settle(grid);
    expect(root(grid).activeElement).toBe(treeCell(grid, 'a'));

    // Célula de expansão: nome e estado na célula, botão oculto.
    const toggleCell = treeCell(grid, 'a').closest('tr')!.querySelector('td.detail-toggle-cell')!;
    expect(toggleCell.getAttribute('aria-label')).toBe('Row details');
    expect(toggleCell.querySelector('button')!.getAttribute('aria-hidden')).toBe('true');

    grid.dir = 'rtl';
    await settle(grid);
    const result = await axe.run(grid);
    expect(result.violations.map(violation => violation.id)).toEqual([]);
  });

  it('parts compostos: rodapé de nó com summary-row e footer-row; resumo column é summary-cell', async () => {
    const grid = await flatGrid(g => {
      g.autoExpandNodes = true;
      g.summary = { node: [{ column: 'size', type: 'sum', display: 'footer' }, { column: 'size', type: 'count', display: 'column' }] };
    });

    expect(root(grid).querySelector('tr[part~=node-footer-row]')!.getAttribute('part')).toBe('row summary-row footer-row node-footer-row');
    expect(rows(grid)[0].querySelectorAll('td')[1].getAttribute('part')).toBe('cell summary-cell');
  });
});

describe('árvore: acessibilidade', () => {
  it('a linha da árvore tem a altura de row-height (o botão de 24 px cabe)', async () => {
    for (const height of [48, 32]) {
      // A mesma altura da lista comum (com `row-height` pequeno, a lista já passa dele pelo respiro das células).
      const list = await createGrid({ columns: columns(), items: flatItems(), setBeforeConnect: true, configure: g => {
        g.rowHeight = height;
      } });
      const expected = Math.round(rows(list)[0].getBoundingClientRect().height);
      list.remove();

      const grid = await flatGrid(g => {
        g.rowHeight = height;
      });
      const heights = rows(grid).map(tr => Math.round(tr.getBoundingClientRect().height));
      expect(heights).toEqual(heights.map(() => expected));
      grid.remove();
    }
  });

  it('axe sem violações (recolhido, expandido, filtrado, RTL)', async () => {
    const grid = await flatGrid(g => {
      g.selectionMode = 'multiple';
      g.showCheckboxes = true;
      g.recursiveSelection = true;
    });

    const check = async () => {
      const result = await axe.run(grid);
      expect(result.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.html).join(' | ')}`)).toEqual([]);
    };

    await check();
    grid.expandAllNodes();
    await settle(grid);
    await check();
    grid.searchText = 'a2';
    await settle(grid);
    await check();
    grid.dir = 'rtl';
    await settle(grid);
    await check();
  });
});

describe('árvore: fonte remota', () => {
  it('carrega a raiz e os filhos sob demanda (parentKeys), com anúncio', async () => {
    const all = flatItems();
    const calls: GridLoadOptions[] = [];
    const grid = await createGrid({
      columns: columns(),
      setBeforeConnect: true,
      configure: g => {
        g.treeMode = 'flat';
        g.keyExpr = 'id';
        g.parentKeyExpr = 'parentId';
        g.hasChildrenExpr = (item: TreeItem) => all.some(other => other.parentId === item.id);
        g.dataSource = {
          load: options => {
            calls.push(options);
            const parents = options.tree?.parentKeys ?? [];
            return Promise.resolve({ data: all.filter(item => parents.includes(item.parentId)) });
          },
        };
      },
    });

    expect(calls[0].tree).toEqual({ parentKeys: [null] });
    expect(tree(grid)).toEqual(['a', 'b', 'c']);
    expect(rows(grid)[0].getAttribute('aria-expanded')).toBe('false');

    expect(await grid.expandNode(1)).toBe(true);
    await settle(grid);
    expect(calls[1].tree).toEqual({ parentKeys: [1] });
    expect(tree(grid)).toEqual(['a', '  a1', '  a2', 'b', 'c']);
    expect(root(grid).querySelector('[aria-live]')!.textContent).toContain('Child rows loaded: 2');
  });

  it('erro de carga: o nó volta a recolhido com evento api', async () => {
    const grid = await createGrid({
      columns: columns(),
      setBeforeConnect: true,
      configure: g => {
        g.treeMode = 'flat';
        g.keyExpr = 'id';
        g.parentKeyExpr = 'parentId';
        g.hasChildrenExpr = () => true;
        g.dataSource = {
          load: options => options.tree?.parentKeys?.[0] !== null
            ? Promise.reject(new Error('boom'))
            : Promise.resolve({ data: [{ id: 1, parentId: null, name: 'a', size: 1 }] }),
        };
      },
    });
    const events: GridNodeExpansionChangeEventDetail[] = [];
    grid.addEventListener('u-grid-node-expansion-change', event => events.push(event.detail));

    expect(await grid.expandNode(1)).toBe(false);
    await settle(grid);
    expect(events).toEqual([{ rowKey: 1, expanded: true, source: 'api' }, { rowKey: 1, expanded: false, source: 'api' }]);
    expect(grid.isNodeExpanded(1)).toBe(false);
    expect(root(grid).querySelector('[aria-live]')!.textContent).toContain('Could not load child rows');
  });
});

describe('focusCell com expandAncestors (nós fechados)', () => {
  it('sem a opção não abre; com ela abre os nós acima da linha e foca', async () => {
    const grid = await flatGrid();
    expect(tree(grid)).toEqual(['a', 'b', 'c']);

    expect(grid.focusCell(4)).toBe(false);
    expect(tree(grid)).toEqual(['a', 'b', 'c']);

    expect(grid.focusCell(4, 'size', { expandAncestors: true })).toBe(true);
    await settle(grid);
    expect(tree(grid)).toEqual(['a', '  a1', '  a2', '    a2x', 'b', 'c']);
    expect((root(grid).activeElement as HTMLElement).closest('tr')!.textContent).toContain('a2x');
  });
});
