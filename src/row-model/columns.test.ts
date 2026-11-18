import { describe, expect, it } from 'vitest';

import { columnWindow, prefixOffsets } from '../render/column-window.js';
import {
  ancestorsOf,
  buildColumnTree,
  buildHeaderRows,
  headerCellAt,
  type HeaderSlot,
  moveAmongSiblings,
  normalizeLeafOrder,
  orderedSiblings,
  rootOf,
} from './columns.js';

interface Col {
  label: string;
  columns?: Col[] | null;
}

const leaf = (label: string): Col => ({ label });
const band = (label: string, ...columns: Col[]): Col => ({ label, columns });
const labels = (columns: readonly (Col | null)[]): string[] => columns.map(column => column?.label ?? '·');

// País | População (Total, Urbana) | PIB (Total, Setores (Agro, Ind, Serv))
const country = leaf('Country');
const popTotal = leaf('PopTotal');
const urban = leaf('Urban');
const population = band('Population', popTotal, urban);
const gdpTotal = leaf('GdpTotal');
const agro = leaf('Agro');
const industry = leaf('Industry');
const services = leaf('Services');
const sectors = band('Sectors', agro, industry, services);
const gdp = band('Gdp', gdpTotal, sectors);
const definitions = [country, population, gdp];

describe('buildColumnTree', () => {
  it('folhas em profundidade, pais e profundidade das bandas', () => {
    const tree = buildColumnTree(definitions);

    expect(labels(tree.leaves)).toEqual(['Country', 'PopTotal', 'Urban', 'GdpTotal', 'Agro', 'Industry', 'Services']);
    expect(labels(tree.bands)).toEqual(['Population', 'Gdp', 'Sectors']);
    expect(tree.maxBandDepth).toBe(2);
    expect(tree.parentOf.get(agro)).toBe(sectors);
    expect(tree.parentOf.get(country)).toBeNull();
    expect(labels(ancestorsOf(tree, agro))).toEqual(['Gdp', 'Sectors']);
    expect(rootOf(tree, agro)).toBe(gdp);
    expect(rootOf(tree, country)).toBe(country);
  });

  it('sem bandas: profundidade 0', () => {
    const tree = buildColumnTree([leaf('a'), leaf('b')]);

    expect(tree.maxBandDepth).toBe(0);
    expect(tree.bands).toEqual([]);
  });

  it('coluna repetida ou ciclo vale só na 1ª vez; `columns: []` é folha', () => {
    const a = leaf('a');
    const cyclic: Col = { label: 'cyclic', columns: [] };
    cyclic.columns!.push(cyclic, a);
    const empty = band('empty');
    const tree = buildColumnTree([a, cyclic, empty]);

    expect(labels(tree.leaves)).toEqual(['a', 'empty']);
    expect(labels(tree.childrenOf.get(cyclic)!)).toEqual([]);
    expect(tree.childrenOf.has(empty)).toBe(false);
  });
});

describe('ordem das folhas', () => {
  const tree = buildColumnTree(definitions);

  it('normaliza: folhas de cada banda juntas, na ordem da 1ª folha', () => {
    // Urbana foi parar depois do PIB: volta para junto da população.
    const flat = [country, popTotal, gdpTotal, agro, urban, industry, services];

    expect(labels(normalizeLeafOrder(flat, tree))).toEqual(['Country', 'PopTotal', 'Urban', 'GdpTotal', 'Agro', 'Industry', 'Services']);
  });

  it('irmãos na ordem atual, só os presentes', () => {
    const flat = [gdpTotal, agro, industry, services, country, urban, popTotal];

    expect(labels(orderedSiblings(flat, tree, null))).toEqual(['Gdp', 'Country', 'Population']);
    expect(labels(orderedSiblings(flat, tree, population))).toEqual(['Urban', 'PopTotal']);
    expect(labels(orderedSiblings([country], tree, null))).toEqual(['Country']);
  });

  it('move folha dentro da banda e banda inteira entre irmãos', () => {
    const flat = tree.leaves;

    expect(labels(moveAmongSiblings(flat, tree, services, 0))).toEqual(['Country', 'PopTotal', 'Urban', 'GdpTotal', 'Services', 'Agro', 'Industry']);
    // Banda do 3º lugar para o 1º: o bloco todo vai junto.
    expect(labels(moveAmongSiblings(flat, tree, gdp, 0))).toEqual(['GdpTotal', 'Agro', 'Industry', 'Services', 'Country', 'PopTotal', 'Urban']);
    // Índice além do fim: último entre os irmãos (sem sair da banda).
    expect(labels(moveAmongSiblings(flat, tree, popTotal, 99))).toEqual(['Country', 'Urban', 'PopTotal', 'GdpTotal', 'Agro', 'Industry', 'Services']);
    // Banda aninhada antes do total do PIB.
    expect(labels(moveAmongSiblings(flat, tree, sectors, 0))).toEqual(['Country', 'PopTotal', 'Urban', 'Agro', 'Industry', 'Services', 'GdpTotal']);
  });

  it('sem bandas é o moveColumn de antes', () => {
    const a = leaf('a');
    const b = leaf('b');
    const c = leaf('c');
    const flatTree = buildColumnTree([a, b, c]);

    expect(labels(moveAmongSiblings([a, b, c], flatTree, a, 2))).toEqual(['b', 'a', 'c']);
    expect(labels(moveAmongSiblings([a, b, c], flatTree, c, 0))).toEqual(['c', 'a', 'b']);
    expect(labels(moveAmongSiblings([a, b, c], flatTree, a, 3))).toEqual(['b', 'c', 'a']);
  });
});

describe('buildHeaderRows', () => {
  const tree = buildColumnTree(definitions);
  const slotsOf = (columns: readonly (Col | null)[], chains?: Col[][]): HeaderSlot<Col>[] =>
    columns.map((column, index) => ({ leaf: column, chain: chains?.[index] ?? (column ? ancestorsOf(tree, column) : []) }));
  const describeRows = (rows: ReturnType<typeof buildHeaderRows<Col>>): string[] =>
    rows.map(row => row.map(cell => `${cell.column?.label ?? '·'}${cell.span > 1 ? `/${cell.span}` : ''}${cell.rowSpan > 1 ? `^${cell.rowSpan}` : ''}`).join(' '));

  it('três níveis com colspan e rowspan', () => {
    const rows = buildHeaderRows(slotsOf(tree.leaves), tree.maxBandDepth + 1);

    expect(describeRows(rows)).toEqual([
      'Country^3 Population/2 Gdp/4',
      'PopTotal^2 Urban^2 GdpTotal^2 Sectors/3',
      'Agro Industry Services',
    ]);
  });

  it('coluna oculta reduz o colspan; banda sem filho visível some', () => {
    const visible = [country, urban, gdpTotal, agro];
    const rows = buildHeaderRows(slotsOf(visible), 3);

    expect(describeRows(rows)).toEqual([
      'Country^3 Population Gdp/2',
      'Urban^2 GdpTotal^2 Sectors',
      'Agro',
    ]);
  });

  it('espaçador herda as bandas comuns aos vizinhos', () => {
    // Janela: Country | (espaçador dentro do PIB) | Services
    const slots = slotsOf([country, gdpTotal, null, services], [[], [gdp], [gdp], [gdp, sectors]]);
    const rows = buildHeaderRows(slots, 3);

    expect(describeRows(rows)).toEqual([
      'Country^3 Gdp/3',
      'GdpTotal^2 ·^2 Sectors',
      'Services',
    ]);
  });

  it('célula que cobre (nível, posição)', () => {
    const rows = buildHeaderRows(slotsOf(tree.leaves), 3);

    expect(headerCellAt(rows, 0, 4)?.column).toBe(gdp);
    expect(headerCellAt(rows, 1, 4)?.column).toBe(sectors);
    expect(headerCellAt(rows, 2, 4)?.column).toBe(agro);
    // A folha com rowspan cobre os níveis de baixo.
    expect(headerCellAt(rows, 2, 0)?.column).toBe(country);
    expect(headerCellAt(rows, 2, 3)?.column).toBe(gdpTotal);
  });
});

describe('columnWindow', () => {
  const offsets = prefixOffsets([100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);

  it('colunas que cruzam a área visível', () => {
    expect(columnWindow(offsets, 0, 250, 0)).toEqual({ first: 0, last: 2 });
    expect(columnWindow(offsets, 150, 200, 0)).toEqual({ first: 1, last: 3 });
    expect(columnWindow(offsets, 300, 200, 0)).toEqual({ first: 3, last: 4 });
  });

  it('overscan e limites', () => {
    expect(columnWindow(offsets, 300, 200, 100)).toEqual({ first: 2, last: 5 });
    expect(columnWindow(offsets, 5000, 200, 0)).toEqual({ first: 9, last: 9 });
    expect(columnWindow(prefixOffsets([]), 0, 100, 0)).toEqual({ first: 0, last: -1 });
  });

  it('larguras diferentes', () => {
    const mixed = prefixOffsets([50, 300, 20, 20, 400]);

    expect(columnWindow(mixed, 60, 300, 0)).toEqual({ first: 1, last: 2 });
    expect(columnWindow(mixed, 60, 340, 0)).toEqual({ first: 1, last: 4 });
    expect(columnWindow(mixed, 0, 40, 0)).toEqual({ first: 0, last: 0 });
  });
});
