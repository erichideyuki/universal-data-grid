import { describe, expect, it } from 'vitest';

import { initialSorting, nextSorting, sortingAfterGesture } from '../features/sorting.js';
import type { GridColumnDef } from '../grid-column-def.js';
import { createComparer, rankValues } from './compare.js';
import { buildGroups } from './group.js';
import { sortItems } from './sort.js';

const compare = createComparer('en');
const col = (path: string, extra: Partial<GridColumnDef> = {}): GridColumnDef => ({ path, label: path, ...extra });

describe('sortItems', () => {
  it('não muta items e sem chaves devolve o próprio array', () => {
    const items = Object.freeze([{ n: 2 }, { n: 1 }]);
    const a = col('n');

    expect(sortItems(items, [], 'en')).toBe(items);
    expect(sortItems(items, [{ column: a, order: 'asc' }], 'en').map(i => i.n)).toEqual([1, 2]);
    expect(items.map(i => i.n)).toEqual([2, 1]);
  });

  it('é estável nas duas direções', () => {
    const items = [{ k: 1, id: 'a' }, { k: 0, id: 'b' }, { k: 1, id: 'c' }, { k: 0, id: 'd' }];
    const k = col('k');

    expect(sortItems(items, [{ column: k, order: 'asc' }], 'en').map(i => i.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(sortItems(items, [{ column: k, order: 'desc' }], 'en').map(i => i.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('várias colunas por prioridade', () => {
    const items = [
      { a: 'x', b: 2 },
      { a: 'y', b: 1 },
      { a: 'x', b: 1 },
      { a: 'y', b: 2 },
    ];
    const sorted = sortItems(items, [{ column: col('a'), order: 'desc' }, { column: col('b'), order: 'asc' }], 'en');

    expect(sorted.map(i => `${i.a}${i.b}`)).toEqual(['y1', 'y2', 'x1', 'x2']);
  });

  it('vazios no início em asc e no fim em desc', () => {
    const items = [{ v: 2 }, { v: null }, { v: 1 }, {}, { v: Number.NaN }];
    const v = col('v');
    const text = (rows: readonly any[]) => rows.map(i => String(i.v));

    expect(text(sortItems(items, [{ column: v, order: 'asc' }], 'en'))).toEqual(['null', 'undefined', 'NaN', '1', '2']);
    expect(text(sortItems(items, [{ column: v, order: 'desc' }], 'en'))).toEqual(['2', '1', 'null', 'undefined', 'NaN']);
  });

  it('textos em ordem natural e datas iguais empatam', () => {
    const t = col('t');
    const words = [{ t: 'item 10' }, { t: 'item 2' }, { t: 'Item 1' }];
    expect(sortItems(words, [{ column: t, order: 'asc' }], 'en').map(i => i.t)).toEqual(['Item 1', 'item 2', 'item 10']);

    const d = col('d');
    const dates = [{ d: new Date(2020, 0, 1), id: 1 }, { d: new Date(2019, 0, 1), id: 2 }, { d: new Date(2020, 0, 1), id: 3 }];
    expect(sortItems(dates, [{ column: d, order: 'asc' }], 'en').map(i => i.id)).toEqual([2, 1, 3]);
  });

  it('usa valueGetter e converte pelo dataType declarado', () => {
    const items = [{ n: '10' }, { n: '9' }, { n: '100' }];
    const asNumber = col('n', { dataType: 'number' });
    const doubled: GridColumnDef = { label: 'x2', valueGetter: (item: any) => -Number(item.n) };

    expect(sortItems(items, [{ column: asNumber, order: 'asc' }], 'en').map(i => i.n)).toEqual(['9', '10', '100']);
    expect(sortItems(items, [{ column: col('n', { dataType: 'string' }), order: 'asc' }], 'en').map(i => i.n))
      .toEqual(['9', '10', '100']);
    expect(sortItems(items, [{ column: doubled, order: 'asc' }], 'en').map(i => i.n)).toEqual(['100', '10', '9']);
  });

  it('mesma ordem que createComparer(language, dataType) em cada tipo', () => {
    const raw = ['2024-03-05', '10', 9, null, '2023-12-31', 'x', true, '0', 1.5, undefined, '9'];
    const items = raw.map((v, id) => ({ v, id }));

    for (const dataType of ['string', 'number', 'date', 'datetime', 'boolean'] as const) {
      const comparer = createComparer('en', dataType);
      const expected = [...items].sort((a, b) => comparer(a.v, b.v) || a.id - b.id).map(i => i.id);
      const sorted = sortItems(items, [{ column: col('v', { dataType }), order: 'asc' }], 'en').map(i => i.id);

      expect(sorted, dataType).toEqual(expected);
    }
  });

  it('comparador próprio recebe valores e itens', () => {
    const calls: unknown[][] = [];
    const priority = col('p', {
      comparator: (a, b, itemA, itemB) => {
        calls.push([a, b, itemA.id, itemB.id]);
        const rank = { low: 0, mid: 1, high: 2 } as Record<string, number>;
        return rank[a] - rank[b];
      },
    });
    const items = [{ p: 'high', id: 1 }, { p: 'low', id: 2 }, { p: 'mid', id: 3 }];

    expect(sortItems(items, [{ column: priority, order: 'asc' }], 'en').map(i => i.p)).toEqual(['low', 'mid', 'high']);
    expect(sortItems(items, [{ column: priority, order: 'desc' }], 'en').map(i => i.p)).toEqual(['high', 'mid', 'low']);
    expect(calls[0]).toHaveLength(4);
    expect(typeof calls[0][2]).toBe('number');
  });
});

describe('rankValues', () => {
  // Atalho de texto (dígitos preenchidos + collator não numérico) tem de dar
  // exatamente a ordem do comparador padrão.
  it('dá a mesma ordem que createComparer em textos aleatórios', () => {
    const alphabet = ['a', 'A', 'b', 'B', 'é', 'E', 'z', '0', '1', '2', '9', '0', ' ', '-', '.', '_', 'ß', 'ç'];
    let seed = 42;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const texts = Array.from({ length: 3000 }, () =>
      Array.from({ length: 1 + Math.floor(random() * 8) }, () => alphabet[Math.floor(random() * alphabet.length)]).join(''));

    for (const language of ['en', 'pt', 'de', 'sv', 'ja']) {
      const comparer = createComparer(language);
      const ranks = rankValues(texts, language);
      const expected = texts.map((_, i) => i).sort((a, b) => comparer(texts[a], texts[b]));

      for (let i = 1; i < expected.length; i++) {
        const [a, b] = [expected[i - 1], expected[i]];
        expect(Math.sign(ranks[a] - ranks[b]), `${language}: "${texts[a]}" × "${texts[b]}"`).toBe(Math.sign(comparer(texts[a], texts[b])));
      }
    }
  });

  it('textos com dígitos não ASCII, mistura de tipos e vazios', () => {
    const values = ['item ١٠', 'item ٢', 'b', 3, null, new Date(0), true, 'a 10', 'a 9', undefined];
    const comparer = createComparer('ar');
    const ranks = rankValues(values, 'ar');
    const expected = values.map((_, i) => i).sort((a, b) => comparer(values[a], values[b]));
    const actual = values.map((_, i) => i).sort((a, b) => ranks[a] - ranks[b] || a - b);

    expect(actual).toEqual(expected);
  });
});

describe('buildGroups com direção', () => {
  it('grupos seguem a direção da coluna e os itens a ordem de entrada', () => {
    const items = sortItems([{ g: 'a', n: 2 }, { g: 'b', n: 1 }, { g: 'a', n: 1 }], [{ column: col('n'), order: 'asc' }], 'en');
    const groups = buildGroups(items, [col('g')], () => compare, ['desc']);

    expect(groups.map(g => g.value)).toEqual(['b', 'a']);
    expect(groups[1].items.map((i: any) => i.n)).toEqual([1, 2]);
  });

  it('comparador próprio também ordena os grupos', () => {
    const order = ['high', 'low'];
    const g = col('g', { comparator: (a, b) => order.indexOf(a) - order.indexOf(b) });

    expect(buildGroups([{ g: 'low' }, { g: 'high' }], [g], () => compare).map(n => n.value)).toEqual(['high', 'low']);
  });
});

describe('transições de ordenação', () => {
  const a = col('a');
  const b = col('b');
  const g = col('g');
  const notGrouped = () => false;
  const groupedG = (c: GridColumnDef) => c === g;

  it('clique alterna asc → desc → asc e substitui as outras colunas', () => {
    const gesture = { remove: false, append: false };
    let s = sortingAfterGesture([], a, gesture, 'multiple', notGrouped);
    expect(s).toEqual([{ column: a, order: 'asc' }]);
    s = sortingAfterGesture(s, a, gesture, 'multiple', notGrouped);
    expect(s).toEqual([{ column: a, order: 'desc' }]);
    s = sortingAfterGesture(s, a, gesture, 'multiple', notGrouped);
    expect(s).toEqual([{ column: a, order: 'asc' }]);
    expect(sortingAfterGesture(s, b, gesture, 'multiple', notGrouped)).toEqual([{ column: b, order: 'asc' }]);
  });

  it('Shift acrescenta só no modo multiple e alterna no lugar', () => {
    const shift = { remove: false, append: true };
    const start = [{ column: a, order: 'asc' as const }];

    expect(sortingAfterGesture(start, b, shift, 'single', notGrouped)).toEqual([{ column: b, order: 'asc' }]);

    const two = sortingAfterGesture(start, b, shift, 'multiple', notGrouped);
    expect(two).toEqual([{ column: a, order: 'asc' }, { column: b, order: 'asc' }]);
    expect(sortingAfterGesture(two, a, shift, 'multiple', notGrouped))
      .toEqual([{ column: a, order: 'desc' }, { column: b, order: 'asc' }]);
  });

  it('Ctrl remove só a coluna', () => {
    const two = [{ column: a, order: 'asc' as const }, { column: b, order: 'desc' as const }];
    expect(sortingAfterGesture(two, a, { remove: true, append: false }, 'multiple', notGrouped))
      .toEqual([{ column: b, order: 'desc' }]);
  });

  it('substituir mantém a direção das colunas agrupadas', () => {
    const s = [{ column: g, order: 'desc' as const }, { column: a, order: 'asc' as const }];
    expect(nextSorting(s, b, 'asc', false, groupedG)).toEqual([{ column: g, order: 'desc' }, { column: b, order: 'asc' }]);
    expect(nextSorting(s, g, 'asc', false, groupedG)).toEqual([{ column: g, order: 'asc' }, { column: a, order: 'asc' }]);
  });

  it('ordenação inicial por sortIndex e depois pela definição', () => {
    const x = col('x', { sortOrder: 'desc' });
    const y = col('y', { sortOrder: 'asc', sortIndex: 1 });
    const z = col('z', { sortOrder: 'asc', sortIndex: 0 });
    const w = col('w', { sortIndex: 2 });

    expect(initialSorting([x, y, z, w]).map(s => s.column.path)).toEqual(['z', 'y', 'x']);
  });
});
