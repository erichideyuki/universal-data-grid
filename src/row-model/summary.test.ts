import { describe, expect, it } from 'vitest';

import type { GridColumnDef } from '../grid-column-def.js';
import { createComparer } from './compare.js';
import { flattenRows } from './flatten.js';
import { buildGroups, groupKeyOf } from './group.js';
import { formatSummaryValue, summarize, type SummarySpec } from './summary.js';
import type { GroupFooterRow, GroupNode, GroupRow } from './types.js';

const compare = createComparer('en');
const byColumn = () => compare;

const amount: GridColumnDef = { path: 'amount', label: 'Amount' };
const city: GridColumnDef = { path: 'city', label: 'City' };
const day: GridColumnDef = { path: 'day', label: 'Day', dataType: 'date' };

const spec = (type: SummarySpec['type'], column: GridColumnDef | undefined = amount, dataType?: SummarySpec['dataType']): SummarySpec => ({
  column,
  type,
  dataType,
  compare: createComparer('en', dataType),
});

const items = [
  { city: 'Rio', amount: 10, day: '2024-03-01' },
  { city: 'Lima', amount: null, day: null },
  { city: 'Rio', amount: '5', day: '2024-01-15' },
  { city: 'Lima', amount: 7, day: '2023-12-31' },
  { city: 'Rio', amount: undefined, day: '' },
];

const context = { language: 'en', trueText: 'True', falseText: 'False' };

describe('summarize', () => {
  it('sum/min/max/avg ignoram vazios; count conta linhas', () => {
    const values = summarize(items, [spec('sum'), spec('min', amount, 'number'), spec('max', amount, 'number'), spec('avg'), spec('count')]);

    expect(values).toEqual([22, 5, 10, 22 / 3, 5]);
  });

  it('média só dos não nulos (não divide pelo total de linhas)', () => {
    expect(summarize([{ amount: 4 }, { amount: null }, { amount: undefined }], [spec('avg')])).toEqual([4]);
  });

  it('sem valores: sum 0, avg/min/max nulos, count 0', () => {
    expect(summarize([{ amount: null }], [spec('sum'), spec('avg'), spec('min'), spec('max')])).toEqual([0, null, null, null]);
    expect(summarize([], [spec('count'), spec('sum')])).toEqual([0, 0]);
  });

  it('min/max de datas pelo tipo da coluna (texto ISO vira data)', () => {
    const [min, max] = summarize(items, [spec('min', day, 'date'), spec('max', day, 'date')]) as Date[];

    expect(min.getFullYear()).toBe(2023);
    expect(max.getMonth()).toBe(2);
  });

  it('min/max com números em texto e datas mistas (Date e ISO), também entre grupos', () => {
    const rows = [
      { g: 'a', n: '10', d: new Date(2024, 5, 1) },
      { g: 'a', n: 9, d: '2024-01-02' },
      { g: 'b', n: '100', d: 'not a date' },
      { g: 'b', n: 'x', d: '2023-07-04' },
    ];
    const n: GridColumnDef = { path: 'n' };
    const d: GridColumnDef = { path: 'd' };
    const specs = [spec('min', n, 'number'), spec('max', n, 'number'), spec('min', d, 'date'), spec('max', d, 'date')];
    const [min, max, first, last] = summarize(rows, specs) as [number, number, Date, Date];

    expect([min, max]).toEqual([9, 100]);
    expect(first.getFullYear()).toBe(2023);
    expect(last.getMonth()).toBe(5);
    expect(specs.every(item => item.keys === undefined)).toBe(true);

    const [a, b] = buildGroups(rows, [{ path: 'g' }], byColumn);
    const [parent] = buildGroups(rows, [{ path: 'x' }, { path: 'g' }], byColumn, [], specs);

    expect([a.items.length, b.items.length]).toEqual([2, 2]);
    expect(parent.summaries.slice(0, 2)).toEqual([9, 100]);
    expect((parent.summaries[2] as Date).getFullYear()).toBe(2023);
  });

  it('min/max de textos pelo idioma', () => {
    expect(summarize(items, [spec('min', city, 'string'), spec('max', city, 'string')])).toEqual(['Lima', 'Rio']);
  });

  it('função própria recebe valores e itens congelados', () => {
    let frozen = false;

    const distinct = (values: readonly unknown[], rows: readonly unknown[]) => {
      frozen = Object.isFrozen(values);
      return `${new Set(values).size}/${rows.length}`;
    };

    expect(summarize(items, [spec(distinct, city)])).toEqual(['2/5']);
    expect(frozen).toBe(true);
  });

  it('não muta os itens', () => {
    const copy = structuredClone(items);
    summarize(items, [spec('sum'), spec('min', day, 'date')]);
    expect(items).toEqual(copy);
  });
});

describe('resumos de grupo na mesma passada', () => {
  const groups = buildGroups(items, [city], byColumn, [], [spec('sum'), spec('count'), spec('avg')]);

  it('cada grupo tem os próprios valores', () => {
    expect(groups.map(group => [group.value, ...group.summaries])).toEqual([
      ['Lima', 7, 2, 7],
      ['Rio', 15, 3, 7.5],
    ]);
  });

  it('pais juntam os filhos (multinível)', () => {
    const rows = [
      { a: 'x', b: 1, amount: 1 },
      { a: 'x', b: 2, amount: 2 },
      { a: 'x', b: 2, amount: null },
      { a: 'y', b: 1, amount: 10 },
    ];
    const [x, y] = buildGroups(rows, [{ path: 'a' }, { path: 'b' }], byColumn, [], [
      spec('sum'),
      spec('min', amount, 'number'),
      spec('avg'),
      spec('count'),
      spec(values => values.length),
    ]);

    expect(x.summaries).toEqual([3, 1, 1.5, 3, 3]);
    expect(x.children.map(child => child.summaries)).toEqual([[1, 1, 1, 1, 1], [2, 2, 2, 2, 2]]);
    expect(y.summaries).toEqual([10, 10, 10, 1, 1]);
  });

  it('sem resumos o nó tem lista vazia', () => {
    expect(buildGroups(items, [city], byColumn)[0].summaries).toEqual([]);
  });
});

describe('groupValueGetter (agrupar por faixa)', () => {
  const people = [
    { name: 'Ana', year: 1994 },
    { name: 'bruno', year: 2001 },
    { name: 'Alice', year: 1999 },
    { name: 'Carla', year: 1987 },
  ];

  it('agrupa pela década e ordena pelo valor', () => {
    const decade: GridColumnDef = { path: 'year', dataType: 'date', groupValueGetter: (item: any) => Math.floor(item.year / 10) * 10 };
    const groups = buildGroups(people, [decade], () => createComparer('en'));

    expect(groups.map(group => [group.value, group.items.length])).toEqual([[1980, 1], [1990, 2], [2000, 1]]);
  });

  it('agrupa pela inicial, sem o comparator da coluna', () => {
    const initial: GridColumnDef = {
      path: 'name',
      comparator: () => {
        throw new Error('não deve ser usado na faixa');
      },
      groupValueGetter: (item: any) => item.name[0].toUpperCase(),
    };

    expect(buildGroups(people, [initial], byColumn).map(group => group.value)).toEqual(['A', 'B', 'C']);
  });

  it('a chave do caminho casa com a do nó (com e sem faixa)', () => {
    const decade: GridColumnDef = { path: 'year', groupValueGetter: (item: any) => Math.floor(item.year / 10) * 10 };
    const [first] = buildGroups(people, [decade], byColumn);

    expect(groupKeyOf([1980], [decade])).toBe(first.key);
    expect(first.path).toEqual([1980]);

    const typed: GridColumnDef = { path: 'n', dataType: 'number' };
    const [node] = buildGroups([{ n: '10' }], [typed], byColumn);

    expect(groupKeyOf([10], [typed])).toBe(node.key);
    expect(groupKeyOf([], [typed])).toBeUndefined();
    expect(groupKeyOf([10, 1], [typed])).toBeUndefined();
  });
});

describe('flattenRows com rodapé e nível', () => {
  const groups: GroupNode[] = buildGroups(items, [city], byColumn, [], [spec('sum')]);

  it('rodapé depois dos itens, só no grupo expandido', () => {
    const rows = flattenRows(items, groups, key => key === groups[1].key, item => String((item as { amount: unknown }).amount), true).slice();
    const kinds = rows.map(row => row.isGroup ? 'g' : row.isFooter ? 'f' : 'd');

    expect(kinds).toEqual(['g', 'g', 'd', 'd', 'd', 'f']);
    expect((rows.at(-1) as GroupFooterRow).summaries).toEqual([15]);
    expect((rows[1] as GroupRow).path).toEqual(['Rio']);
  });

  it('isExpanded recebe o nível', () => {
    const levels: number[] = [];
    flattenRows(items, groups, (_, level) => {
      levels.push(level);
      return false;
    }, String);

    expect(levels).toEqual([0, 0]);
  });
});

describe('formatSummaryValue', () => {
  it('número com separador e até 2 casas; count inteiro', () => {
    expect(formatSummaryValue(1234.5678, spec('avg'), null, context)).toBe('1,234.57');
    expect(formatSummaryValue(1234, spec('count'), null, context)).toBe('1,234');
  });

  it('format do item; da coluna só se for Intl', () => {
    const money: GridColumnDef = { path: 'amount', format: { style: 'currency', currency: 'USD' } };
    const fn: GridColumnDef = { path: 'amount', format: value => `#${String(value)}` };

    expect(formatSummaryValue(5, spec('sum', money), null, context)).toBe('$5.00');
    expect(formatSummaryValue(5, spec('sum', fn), null, context)).toBe('5');
    expect(formatSummaryValue(5, spec('sum', fn), value => `<${String(value)}>`, context)).toBe('<5>');
    // count ignora o format da coluna
    expect(formatSummaryValue(3, spec('count', money), null, context)).toBe('3');
  });

  it('min de data formatado como data; vazio sem texto', () => {
    expect(formatSummaryValue(new Date(2024, 0, 15), spec('min', day, 'date'), null, context)).toBe('1/15/2024');
    expect(formatSummaryValue(null, spec('avg'), null, context)).toBe('');
  });
});
