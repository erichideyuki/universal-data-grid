import { describe, expect, it } from 'vitest';

import type { DataRow } from './types.js';
import {
  ancestorsOfMatches,
  buildFlatIndex,
  buildNestedIndex,
  buildTreeView,
  childCount,
  childrenReader,
  flattenTree,
  partialSelection,
  recursiveSelectionChange,
  structuralView,
  type TreeIndex,
  treeVisibility,
} from './tree.js';

interface Node { id: number; parentId?: number | null; name: string; children?: Node[] }

const flat: Node[] = [
  { id: 1, parentId: 0, name: 'a' },
  { id: 2, parentId: 1, name: 'a1' },
  { id: 3, parentId: 1, name: 'a2' },
  { id: 4, parentId: 3, name: 'a2x' },
  { id: 5, parentId: 0, name: 'b' },
  { id: 6, parentId: 5, name: 'b1' },
];

const keyOf = (item: unknown) => (item as Node).id;
const parentOf = (item: unknown) => (item as Node).parentId;
const names = (index: TreeIndex, rows: { length: number; at(i: number): unknown }) =>
  Array.from({ length: rows.length }, (_, i) => {
    const row = rows.at(i) as DataRow;
    return `${'  '.repeat(row.tree!.level)}${(row.item as Node).name}`;
  });

const flatten = (index: TreeIndex, expanded: (key: unknown) => boolean, match: Uint8Array | null = null, mode: 'with-ancestors' | 'full-branch' | 'match-only' = 'with-ancestors', order: Int32Array | null = null) => {
  const view = buildTreeView(index, treeVisibility(index, match, mode), order, mode);
  return { view, rows: flattenTree(index, view, node => expanded(keyOf(index.nodes[node])), item => String(keyOf(item))) };
};

describe('árvore: índice', () => {
  it('plana: pai por chave, nível, raiz por rootValue/null/pai inexistente', () => {
    const items = [...flat, { id: 7, parentId: null, name: 'c' }, { id: 8, parentId: 99, name: 'orfao' }];
    const index = buildFlatIndex(items, keyOf, parentOf, 0);

    expect(Array.from(index.parent)).toEqual([-1, 0, 0, 2, -1, 4, -1, -1]);
    expect(Array.from(index.level)).toEqual([0, 1, 1, 2, 0, 1, 0, 0]);
    expect(index.orphans).toBe(1);
    expect(index.nodes).toBe(items);
  });

  it('plana: filho antes do pai gera ordem topológica; ciclo vira raiz', () => {
    const items: Node[] = [
      { id: 2, parentId: 1, name: 'filho' },
      { id: 1, parentId: 0, name: 'pai' },
      { id: 3, parentId: 4, name: 'c1' },
      { id: 4, parentId: 3, name: 'c2' },
    ];
    const index = buildFlatIndex(items, keyOf, parentOf, 0);

    expect(Array.from(index.level)).toEqual([1, 0, expect.any(Number), expect.any(Number)]);
    expect(index.cycles).toBe(1);
    expect(Array.from(index.topo!).indexOf(1)).toBeLessThan(Array.from(index.topo!).indexOf(0));
    expect([index.parent[2], index.parent[3]].filter(p => p === -1)).toHaveLength(1);
  });

  it('plana: rootValue compara pelo texto (atributo)', () => {
    const index = buildFlatIndex([{ id: 1, parentId: 0, name: 'a' }], keyOf, parentOf, '0');
    expect(index.parent[0]).toBe(-1);
    expect(index.orphans).toBe(0);
  });

  it('aninhada: pré-ordem, sem mutar, repetido ignorado', () => {
    const shared: Node = { id: 9, name: 'x' };
    const roots: Node[] = [
      { id: 1, name: 'a', children: [{ id: 2, name: 'a1' }, shared] },
      { id: 3, name: 'b', children: [shared] },
    ];
    const index = buildNestedIndex(roots, childrenReader('children'));

    expect(index.nodes.map(node => (node as Node).name)).toEqual(['a', 'a1', 'x', 'b']);
    expect(Array.from(index.parent)).toEqual([-1, 0, 0, -1]);
    expect(index.cycles).toBe(1);
    expect(roots[1].children).toHaveLength(1);
  });

  it('aninhada com keyOf: chave repetida conta', () => {
    const roots: Node[] = [{ id: 1, name: 'a', children: [{ id: 1, name: 'dup' }] }];
    const index = buildNestedIndex(roots, childrenReader('children'), keyOf);
    expect(index.duplicates).toBe(1);
    expect(index.keyIndex.get(1)).toBe(0);
  });
});

describe('árvore: achatamento', () => {
  const index = buildFlatIndex(flat, keyOf, parentOf, 0);

  it('recolhido: só raízes, com posinset/setsize', () => {
    const { rows } = flatten(index, () => false);
    expect(names(index, rows)).toEqual(['a', 'b']);
    expect((rows.at(1) as DataRow).tree).toEqual({ node: 4, level: 0, posInSet: 2, setSize: 2 });
  });

  it('expandido: pré-ordem, trechos de irmãos', () => {
    const { rows } = flatten(index, () => true);
    expect(names(index, rows)).toEqual(['a', '  a1', '  a2', '    a2x', 'b', '  b1']);
    expect((rows.at(2) as DataRow).tree).toMatchObject({ level: 1, posInSet: 2, setSize: 2 });
    expect(rows.indexOfDataKey(6, keyOf)).toBe(5);
  });

  it('expansão parcial', () => {
    const { rows } = flatten(index, key => key === 1);
    expect(names(index, rows)).toEqual(['a', '  a1', '  a2', 'b']);
  });

  it('ordem: irmãos pela ordem dada, níveis preservados', () => {
    // Ordem global decrescente por id.
    const order = Int32Array.from([5, 4, 3, 2, 1, 0]);
    const { rows } = flatten(index, () => true, null, 'with-ancestors', order);
    expect(names(index, rows)).toEqual(['b', '  b1', 'a', '  a2', '    a2x', '  a1']);
  });

  it('filtro with-ancestors / full-branch / match-only', () => {
    const match = Uint8Array.from(flat.map(node => node.name === 'a2' || node.name === 'b1' ? 1 : 0));

    expect(names(index, flatten(index, () => true, match, 'with-ancestors').rows)).toEqual(['a', '  a2', 'b', '  b1']);
    expect(names(index, flatten(index, () => true, match, 'full-branch').rows)).toEqual(['a', '  a2', '    a2x', 'b', '  b1']);
    expect(names(index, flatten(index, () => true, match, 'match-only').rows)).toEqual(['a2', 'b1']);
  });

  it('match-only pendura no ancestral visível mais próximo', () => {
    const match = Uint8Array.from(flat.map(node => node.name === 'a' || node.name === 'a2x' ? 1 : 0));
    const { rows, view } = flatten(index, () => true, match, 'match-only');
    expect(names(index, rows)).toEqual(['a', '  a2x']);
    expect(childCount(view, 0)).toBe(1);
  });

  it('ancestrais dos que passam', () => {
    const match = Uint8Array.from(flat.map(node => node.name === 'a2x' ? 1 : 0));
    expect(Array.from(ancestorsOfMatches(index, match))).toEqual([1, 0, 1, 0, 0, 0]);
  });

  it('hasChildren remoto e linhas extras depois dos filhos', () => {
    const view = buildTreeView(index, null, null, 'with-ancestors');
    const rows = flattenTree(
      index,
      view,
      node => node <= 1,
      item => String(keyOf(item)),
      node => node === 1,
      (node, list) => list.push({ isGroup: false, isFooter: true, key: `f:${node}`, groupKey: String(node), level: 1, path: [], summaries: [] }),
    );

    // a, a1 (sem filhos carregados, mas expandido), rodapé de a1, a2, rodapé de a, b.
    expect(rows.slice().map(row => row.key)).toEqual(['d:1', 'd:2', 'f:1', 'd:3', 'f:0', 'd:5']);
  });

  it('1 milhão de nós em 6 níveis: montar e expandir tudo sem objeto por linha', () => {
    const items: { id: number; parentId: number }[] = [];
    // 10 + 100 + ... ≈ 1,1 mi.
    let previous = [0];
    let id = 1;

    for (let level = 0; level < 6; level++) {
      const next: number[] = [];

      for (const parentId of previous) {
        for (let k = 0; k < 10; k++) {
          items.push({ id, parentId });
          next.push(id++);
        }
      }

      previous = next;
    }

    const big = buildFlatIndex(items, item => (item as { id: number }).id, item => (item as { parentId: number }).parentId, 0);
    const view = buildTreeView(big, null, null, 'with-ancestors');
    const rows = flattenTree(big, view, () => true, item => String((item as { id: number }).id));

    expect(rows.length).toBe(items.length);
    expect((rows.at(rows.length - 1) as DataRow).tree!.level).toBe(5);
  });
});

describe('árvore: seleção recursiva', () => {
  const index = buildFlatIndex(flat, keyOf, parentOf, 0);
  const structure = structuralView(index);

  it('marca a subárvore e sobe enquanto todos os irmãos estão marcados', () => {
    const selected = new Set<number>();
    const apply = (node: number, select: boolean) => {
      for (const changed of recursiveSelectionChange(index, structure, node, select, n => selected.has(n))) {
        if (select) {
          selected.add(changed);
        } else {
          selected.delete(changed);
        }
      }
    };

    apply(3, true);
    // a2x sozinho completa a2 (filho único); a1 ainda não.
    expect([...selected].sort()).toEqual([2, 3]);
    expect(Array.from(partialSelection(index, n => selected.has(n)))).toEqual([1, 0, 1, 0, 0, 0]);

    apply(1, true);
    expect([...selected].sort()).toEqual([0, 1, 2, 3]);

    apply(3, false);
    expect([...selected].sort()).toEqual([1]);

    apply(0, true);
    expect([...selected].sort()).toEqual([0, 1, 2, 3]);
    apply(0, false);
    expect(selected.size).toBe(0);
  });
});
