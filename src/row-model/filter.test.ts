import { describe, expect, it } from 'vitest';

import type { GridColumnDef, GridFilterExpression } from '../grid-column-def.js';
import { distinctValues } from './distinct.js';
import {
  combineFilters,
  compileFilter,
  type FilterContext,
  FilterExpressionError,
  filterItems,
  filterMask,
  filterFieldOf,
  findColumnCondition,
  hasColumnCondition,
  replaceColumnCondition,
  resolveFilterColumn,
  searchExpression,
  splitConjuncts,
} from './filter.js';
import { createTextMatcher, foldText, splitMatches } from './fold.js';
import { displayAlphabet, formatCell, resolveDataType } from './format.js';

const col = (path: string, extra: Partial<GridColumnDef> = {}): GridColumnDef => ({ path, label: path, ...extra });

const formatContextOf = (items: readonly unknown[], column: GridColumnDef, language: string) => ({
  language,
  dataType: resolveDataType(items, column),
  trueText: 'Yes',
  falseText: 'No',
});

const contextFor = (items: readonly unknown[], columns: GridColumnDef[], language = 'en'): FilterContext => ({
  language,
  columns,
  dataTypeOf: column => resolveDataType(items, column),
  textOf: (item, column) => formatCell(item, column, formatContextOf(items, column, language)),
  alphabetOf: column => displayAlphabet(column, formatContextOf(items, column, language), foldText),
});

const run = (items: readonly any[], columns: GridColumnDef[], expression: GridFilterExpression | null, key = 'id'): unknown[] =>
  filterItems(items, compileFilter(expression, contextFor(items, columns))).map(item => item[key]);

describe('foldText / createTextMatcher', () => {
  it('ignora caixa e acento, inclusive texto em NFD', () => {
    expect(foldText('José ÁRVORE')).toBe('jose arvore');

    const matcher = createTextMatcher('jose')!;

    expect(matcher.test('JOSÉ')).toBe(true);
    expect(matcher.test('José')).toBe(true);
    expect(matcher.test('Joao')).toBe(false);
    expect(createTextMatcher('ÇÃO')!.test('ação')).toBe(true);
  });

  it('escapa caracteres de regex do termo', () => {
    const matcher = createTextMatcher('a.b(c)*[d]')!;

    expect(matcher.test('xa.b(c)*[d]y')).toBe(true);
    expect(matcher.test('aXb(c)*[d]')).toBe(false);
    expect(createTextMatcher('   ')).not.toBeNull();
    expect(createTextMatcher('')).toBeNull();
  });

  it('modos início/fim/igual', () => {
    expect(createTextMatcher('an', 'startswith')!.test('Ana')).toBe(true);
    expect(createTextMatcher('an', 'startswith')!.test('Joana')).toBe(false);
    expect(createTextMatcher('na', 'endswith')!.test('Joana')).toBe(true);
    expect(createTextMatcher('ana', 'equals')!.test('ANÁ')).toBe(true);
    expect(createTextMatcher('ana', 'equals')!.test('Joana')).toBe(false);
  });

  it('separa os trechos para o destaque, preservando o texto original', () => {
    expect(splitMatches('São Paulo, sao', createTextMatcher('sao'))).toEqual(['', 'São', ' Paulo, ', 'sao', '']);
    expect(splitMatches('abc', null)).toEqual(['abc']);
    expect(splitMatches('<b>x</b>', createTextMatcher('x'))).toEqual(['<b>', 'x', '</b>']);
  });
});

describe('compileFilter — operadores por tipo', () => {
  const people = [
    { id: 1, name: 'Ana', age: 30, born: '1994-03-05', active: true, at: '2024-01-02T10:00:00' },
    { id: 2, name: 'José', age: 41, born: '1983-07-20', active: false, at: '2024-01-02T18:30:00' },
    { id: 3, name: 'joana', age: 25, born: '1999-12-31', active: true, at: '2024-01-03T08:00:00' },
    { id: 4, name: null, age: null, born: null, active: null, at: null },
    { id: 5, name: '', age: 30, born: '1994-03-05', active: false, at: '2024-02-01T00:00:00' },
  ];
  const columns = [
    col('name'),
    col('age'),
    col('born', { dataType: 'date' }),
    col('active'),
    col('at', { dataType: 'datetime' }),
  ];

  const cases: [string, GridFilterExpression, number[]][] = [
    // texto
    ['contains ignora caixa', ['name', 'contains', 'AN'], [1, 3]],
    ['contains ignora acento', ['name', 'contains', 'jose'], [2]],
    ['notcontains (vazios passam)', ['name', 'notcontains', 'an'], [2, 4, 5]],
    ['startswith', ['name', 'startswith', 'jo'], [2, 3]],
    ['endswith', ['name', 'endswith', 'NA'], [1, 3]],
    ['= em texto ignora caixa/acento', ['name', '=', 'JOSE'], [2]],
    ['<> em texto', ['name', '<>', 'ana'], [2, 3, 4, 5]],
    ['< em texto (collator base)', ['name', '<', 'j'], [1]],
    ['contains vazio = sem condição', ['name', 'contains', ''], [1, 2, 3, 4, 5]],
    // número
    ['= número', ['age', '=', 30], [1, 5]],
    ['= número em texto', ['age', '=', '30'], [1, 5]],
    ['<> número (vazio passa)', ['age', '<>', 30], [2, 3, 4]],
    ['<', ['age', '<', 30], [3]],
    ['<=', ['age', '<=', 30], [1, 3, 5]],
    ['>', ['age', '>', 30], [2]],
    ['>=', ['age', '>=', 30], [1, 2, 5]],
    ['between inclusivo', ['age', 'between', [25, 30]], [1, 3, 5]],
    ['between aberto no fim', ['age', 'between', [31, null]], [2]],
    ['contains em número usa o texto exibido', ['age', 'contains', '4'], [2]],
    // data (dia)
    ['= data compara o dia', ['born', '=', new Date(1994, 2, 5, 15, 0)], [1, 5]],
    ['> data', ['born', '>', '1994-03-05'], [3]],
    ['between data', ['born', 'between', ['1980-01-01', '1995-01-01']], [1, 2, 5]],
    // datetime
    ['= datetime com só data compara o dia', ['at', '=', '2024-01-02'], [1, 2]],
    ['= datetime com instante', ['at', '=', new Date(2024, 0, 2, 18, 30)], [2]],
    ['< datetime', ['at', '<', '2024-01-02T12:00:00'], [1]],
    // booleano
    ['= true', ['active', '=', true], [1, 3]],
    ['= "false"', ['active', '=', 'false'], [2, 5]],
    // conjuntos
    ['anyof texto (caixa/acento)', ['name', 'anyof', ['ANA', 'jose']], [1, 2]],
    ['anyof com vazio', ['name', 'anyof', [null, 'Ana']], [1, 4, 5]],
    ['noneof', ['age', 'noneof', [30, null]], [2, 3]],
    ['anyof datetime por dia', ['at', 'anyof', ['2024-01-03', '2024-02-01']], [3, 5]],
    ['anyof data', ['born', 'anyof', ['1983-07-20']], [2]],
    // vazios
    ['isblank', ['name', 'isblank'], [4, 5]],
    ['isnotblank', ['age', 'isnotblank'], [1, 2, 3, 5]],
    ['= null é isblank', ['age', '=', null], [4]],
    ['<> null é isnotblank', ['age', '<>', null], [1, 2, 3, 5]],
    // atalho [path, valor]
    ['atalho = ', ['age', 41], [2]],
  ];

  it.each(cases)('%s', (_name, expression, expected) => {
    expect(run(people, columns, expression)).toEqual(expected);
  });
});

describe('compileFilter — grupos e negação', () => {
  const items = [
    { id: 1, a: 1, b: 'x' },
    { id: 2, a: 2, b: 'y' },
    { id: 3, a: 3, b: 'x' },
    { id: 4, a: 4, b: 'y' },
  ];
  const columns = [col('a'), col('b')];

  it('and / or (and liga mais forte) e itens seguidos = and', () => {
    expect(run(items, columns, [['a', '>', 1], 'and', ['b', '=', 'x']])).toEqual([3]);
    expect(run(items, columns, [['a', '=', 1], 'or', ['a', '=', 4]])).toEqual([1, 4]);
    expect(run(items, columns, [['a', '=', 1], 'or', ['a', '>', 2], 'and', ['b', '=', 'y']])).toEqual([1, 4]);
    expect(run(items, columns, [['a', '>', 1], ['b', '=', 'y']])).toEqual([2, 4]);
  });

  it('aninhado e negação', () => {
    expect(run(items, columns, ['!', ['b', '=', 'x']])).toEqual([2, 4]);
    expect(run(items, columns, [['!', [['a', '=', 1], 'or', ['a', '=', 2]]], 'and', ['b', '=', 'y']])).toEqual([4]);
  });

  it('sem filtro efetivo devolve null (e filterItems devolve o próprio array)', () => {
    const context = contextFor(items, columns);

    expect(compileFilter(null, context)).toBeNull();
    expect(compileFilter([], context)).toBeNull();
    expect(compileFilter(['b', 'contains', ''], context)).toBeNull();
    expect(filterItems(items, null)).toBe(items);
  });

  it('expressão malformada lança FilterExpressionError', () => {
    const context = contextFor(items, columns);

    expect(() => compileFilter(['a', 'like', 1] as never, context)).toThrow(FilterExpressionError);
    expect(() => compileFilter([['a', '=', 1], 'and'] as never, context)).toThrow(FilterExpressionError);
    expect(() => compileFilter(['and', ['a', '=', 1]] as never, context)).toThrow(FilterExpressionError);
  });

  it('não muta items nem a expressão', () => {
    const frozen = Object.freeze(items.map(item => Object.freeze({ ...item })));
    const expression = Object.freeze([Object.freeze(['a', '>', 1]), 'and', Object.freeze(['b', '=', 'x'])]) as unknown as GridFilterExpression;

    expect(run(frozen, columns, expression)).toEqual([3]);
  });
});

describe('compileFilter — colunas', () => {
  it('lê pelo valueGetter da coluna do path e usa o displayValue nas operações de texto', () => {
    const items = [{ id: 1, code: 'br' }, { id: 2, code: 'pt' }];
    const columns = [
      col('code', {
        valueGetter: item => (item as { code: string }).code.toUpperCase(),
        displayValue: value => value === 'BR' ? 'Brasil' : 'Portugal',
      }),
    ];

    expect(run(items, columns, ['code', 'contains', 'bras'])).toEqual([1]);
    expect(run(items, columns, ['code', '=', 'PORTUGAL'])).toEqual([2]);
    expect(run(items, columns, ['code', 'anyof', ['pt']])).toEqual([2]);
  });

  it('path sem coluna lê o caminho do item; com duas colunas no mesmo path, vale a primeira', () => {
    const items = [{ id: 1, a: { b: 5 } }, { id: 2, a: { b: 7 } }];

    expect(run(items, [], ['a.b', '>', 6])).toEqual([2]);

    const first = col('a.b', { valueGetter: () => 0 });
    const second = col('a.b');

    expect(run(items, [first, second], ['a.b', '=', 0])).toEqual([1, 2]);
  });

  it('booleano por texto exibido (contains) usa trueText/falseText', () => {
    const items = [{ id: 1, ok: true }, { id: 2, ok: false }];

    expect(run(items, [col('ok')], ['ok', 'contains', 'ye'])).toEqual([1]);
  });

  it('format numérico do idioma entra no contains', () => {
    const items = [{ id: 1, n: 1234.5 }, { id: 2, n: 99 }];
    const context = contextFor(items, [col('n', { format: { useGrouping: true, minimumFractionDigits: 1 } })], 'pt-BR');

    expect(filterItems(items, compileFilter(['n', 'contains', '1.234,5'], context)).map(item => item.id)).toEqual([1]);
  });
});

describe('alfabeto do texto formatado (atalho da busca)', () => {
  it('termo com letras pula número/data que convertem, mas não valores que não convertem', () => {
    const items = [{ id: 1, n: 12, d: '2024-03-05' }, { id: 2, n: 'n/a 12', d: 'unknown' }, { id: 3, n: null, d: null }];
    const columns = [col('n', { dataType: 'number', emptyText: 'none' }), col('d', { dataType: 'date' })];

    expect(run(items, columns, ['n', 'contains', 'n/a'])).toEqual([2]);
    expect(run(items, columns, ['n', 'contains', '12'])).toEqual([1, 2]);
    expect(run(items, columns, ['n', 'contains', 'non'])).toEqual([3]);
    expect(run(items, columns, ['d', 'contains', 'unk'])).toEqual([2]);
    expect(run(items, columns, ['n', 'notcontains', 'x'])).toEqual([1, 2, 3]);
  });

  it('nomes de mês, AM/PM, moeda e booleano entram no alfabeto', () => {
    const items = [{ id: 1, d: '2024-03-05T15:00:00', p: 9.5, b: true }];
    const columns = [
      col('d', { dataType: 'datetime', format: { month: 'long', hour: 'numeric' } }),
      col('p', { format: { style: 'currency', currency: 'USD' } }),
      col('b'),
    ];

    expect(run(items, columns, ['d', 'contains', 'march'])).toEqual([1]);
    expect(run(items, columns, ['d', 'contains', 'pm'])).toEqual([1]);
    expect(run(items, columns, ['p', 'contains', '$9.5'])).toEqual([1]);
    expect(run(items, columns, ['b', 'contains', 'yes'])).toEqual([1]);
  });
});

describe('máscara', () => {
  it('filterMask por trechos dá o mesmo resultado que de uma vez', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ n: i }));
    const predicate = compileFilter(['n', '<', 500], contextFor(items, [col('n')]))!;
    const whole = filterMask(items, predicate);
    const chunked = new Uint8Array(items.length);

    for (let start = 0; start < items.length; start += 128) {
      filterMask(items, predicate, chunked, start, Math.min(items.length, start + 128));
    }

    expect(chunked).toEqual(whole);
    expect(whole.reduce((sum, bit) => sum + bit, 0)).toBe(500);
  });
});

describe('busca e sincronia com a interface', () => {
  it('searchExpression: contains em cada coluna com path, ligadas por or', () => {
    expect(searchExpression('ana', [col('a'), col('b'), { label: 'sem path' }])).toEqual([['a', 'contains', 'ana'], 'or', ['b', 'contains', 'ana']]);
    expect(searchExpression('ana', [col('a')])).toEqual(['a', 'contains', 'ana']);
    expect(searchExpression('  ', [col('a')])).toBeNull();
  });

  it('combineFilters junta com and e ignora vazios', () => {
    expect(combineFilters(null, ['a', '=', 1])).toEqual(['a', '=', 1]);
    expect(combineFilters(['a', '=', 1], ['b', '=', 2])).toEqual([['a', '=', 1], 'and', ['b', '=', 2]]);
    expect(combineFilters()).toBeNull();
  });

  it('splitConjuncts só separa and no topo', () => {
    expect(splitConjuncts(['a', '=', 1])).toEqual([['a', '=', 1]]);
    expect(splitConjuncts([['a', '=', 1], 'and', ['b', '=', 2]])).toHaveLength(2);
    expect(splitConjuncts([['a', '=', 1], 'or', ['b', '=', 2]])).toHaveLength(1);
  });

  it('acha e troca a condição da linha e a do cabeçalho sem mexer no resto', () => {
    const a = col('a');
    const resolve = (field: string) => resolveFilterColumn(field, [a]);
    const start: GridFilterExpression = [['a', 'contains', 'x'], 'and', ['b', '=', 2], 'and', ['a', 'anyof', [1, 2]]];

    expect(findColumnCondition(start, a, 'row', resolve)).toEqual(['contains', 'x']);
    expect(findColumnCondition(start, a, 'header', resolve)).toEqual(['anyof', [1, 2]]);
    expect(hasColumnCondition(start, a, resolve)).toBe(true);
    expect(hasColumnCondition(start, col('c'), resolve)).toBe(false);

    const replaced = replaceColumnCondition(start, a, 'row', ['a', 'startswith', 'y'], resolve);

    expect(replaced).toEqual([['b', '=', 2], 'and', ['a', 'anyof', [1, 2]], 'and', ['a', 'startswith', 'y']]);
    expect(start[0]).toEqual(['a', 'contains', 'x']);
    expect(replaceColumnCondition(start, a, 'all', null, resolve)).toEqual(['b', '=', 2]);
    expect(replaceColumnCondition(['a', '=', 1], a, 'row', null, resolve)).toBeNull();
  });

  it('expressão com or no topo fica intacta ao filtrar outra coluna pela linha', () => {
    const resolve = (field: string) => resolveFilterColumn(field, [col('a'), col('c')]);
    const orExpression: GridFilterExpression = [['a', '=', 1], 'or', ['b', '=', 2]];

    expect(findColumnCondition(orExpression, col('a'), 'row', resolve)).toBeUndefined();
    expect(replaceColumnCondition(orExpression, col('c'), 'row', ['c', '=', 3], resolve)).toEqual([orExpression, 'and', ['c', '=', 3]]);
  });
});

describe('coluna calculada (valueGetter sem path, spec 28)', () => {
  const items = [
    { id: 1, first: 'Ana', last: 'Silva', a: 3, b: 4 },
    { id: 2, first: 'Bruno', last: 'Souza', a: 1, b: 1 },
    { id: 3, first: 'Carla', last: 'Silva', a: 5, b: 0 },
    { id: 4, first: 'Davi', last: null, a: 2, b: 2 },
  ];
  const full: GridColumnDef = { name: 'full', label: 'Full', valueGetter: (row: any) => row.last ? `${row.first} ${row.last}` : null };
  const sum: GridColumnDef = { name: 'sum', label: 'Sum', dataType: 'number', valueGetter: (row: any) => row.a + row.b };
  const columns = [col('first'), full, sum];

  it('filtra pelo name com o valor do getter, em cada família de operação', () => {
    expect(run(items, columns, ['full', 'contains', 'silva'])).toEqual([1, 3]);
    expect(run(items, columns, ['full', 'startswith', 'bru'])).toEqual([2]);
    expect(run(items, columns, ['sum', '>', 3])).toEqual([1, 3, 4]);
    expect(run(items, columns, ['sum', 2])).toEqual([2]);
    expect(run(items, columns, ['sum', 'between', [2, 5]])).toEqual([2, 3, 4]);
    expect(run(items, columns, ['full', 'isblank'])).toEqual([4]);
    expect(run(items, columns, ['full', 'anyof', ['Ana Silva', null]])).toEqual([1, 4]);
    expect(run(items, columns, ['sum', 'noneof', [7, 5]])).toEqual([2, 4]);
  });

  it('campo: path antes de name; name de coluna com path não resolve; sem coluna lê o item', () => {
    const byPath = col('total');
    const named = { ...col('amount'), name: 'price' };
    const computed: GridColumnDef = { name: 'total', valueGetter: () => 1 };
    const computedOther: GridColumnDef = { name: 'calc', valueGetter: () => 2 };
    const list = [computed, byPath, named, computedOther];

    expect(resolveFilterColumn('total', list)).toBe(byPath);
    expect(resolveFilterColumn('calc', list)).toBe(computedOther);
    expect(resolveFilterColumn('price', list)).toBeUndefined();
    expect(run([{ id: 1, price: 9, amount: 1 }, { id: 2, price: 1, amount: 9 }], [named], ['price', '>', 5])).toEqual([1]);
    expect(filterFieldOf(named)).toBe('amount');
    expect(filterFieldOf(computed)).toBe('total');
    expect(filterFieldOf({ label: 'x' })).toBeUndefined();
  });

  it('a busca inclui a calculada pelo name', () => {
    expect(searchExpression('souza', [col('first'), full])).toEqual([['first', 'contains', 'souza'], 'or', ['full', 'contains', 'souza']]);
    expect(run(items, columns, searchExpression('souza', columns))).toEqual([2]);
    expect(run(items, columns, searchExpression('7', columns))).toEqual([1]);
  });

  it('sincronia da interface pelo name, sem pegar a condição de outra coluna na colisão', () => {
    const resolve = (field: string) => resolveFilterColumn(field, columns);
    const start: GridFilterExpression = [['full', 'contains', 'sil'], 'and', ['sum', 'anyof', [7]]];

    expect(findColumnCondition(start, full, 'row', resolve)).toEqual(['contains', 'sil']);
    expect(findColumnCondition(start, sum, 'header', resolve)).toEqual(['anyof', [7]]);
    expect(hasColumnCondition(start, full, resolve)).toBe(true);
    expect(replaceColumnCondition(start, full, 'all', null, resolve)).toEqual(['sum', 'anyof', [7]]);

    // `name` da calculada igual ao `path` de outra coluna: a condição é da outra.
    const clash: GridColumnDef = { name: 'first', valueGetter: () => 'x' };
    const clashResolve = (field: string) => resolveFilterColumn(field, [col('first'), clash]);
    const onFirst: GridFilterExpression = ['first', 'contains', 'a'];

    expect(hasColumnCondition(onFirst, clash, clashResolve)).toBe(false);
    expect(findColumnCondition(onFirst, clash, 'row', clashResolve)).toBeUndefined();
    expect(replaceColumnCondition(onFirst, clash, 'all', null, clashResolve)).toEqual(onFirst);
  });
});

describe('distinctValues (filtro do cabeçalho)', () => {
  const textOf = (item: unknown, column: GridColumnDef) => formatCell(item, column, { language: 'en', dataType: undefined, trueText: 'Yes', falseText: 'No' });

  it('texto: agrupa sem caixa/acento, conta, ordena e separa os vazios', () => {
    const items = [{ c: 'Lima' }, { c: 'lima' }, { c: 'Ávila' }, { c: null }, { c: '' }, { c: 'Bogotá' }];
    const result = distinctValues(items, col('c'), { language: 'en', dataType: 'string', textOf });

    expect(result.values.map(value => [value.text, value.count])).toEqual([['Ávila', 1], ['Bogotá', 1], ['Lima', 2]]);
    expect(result.blanks).toBe(2);
    expect(result.tree).toBeUndefined();
  });

  it('número: ordem numérica', () => {
    const items = [{ n: 10 }, { n: 9 }, { n: 10 }, { n: 100 }];
    const result = distinctValues(items, col('n'), { language: 'en', dataType: 'number', textOf });

    expect(result.values.map(value => [value.value, value.count])).toEqual([[9, 1], [10, 2], [100, 1]]);
  });

  it('data: dias como "aaaa-mm-dd" e árvore ano → mês → dia', () => {
    const items = [{ d: '2024-03-05T10:00:00' }, { d: '2024-03-05T22:00:00' }, { d: '2024-04-01T00:00:00' }, { d: '2023-12-31T00:00:00' }];
    const result = distinctValues(items, col('d', { dataType: 'datetime' }), { language: 'en', dataType: 'datetime', textOf });

    expect(result.values.map(value => value.value)).toEqual(['2023-12-31', '2024-03-05', '2024-04-01']);
    expect(result.tree!.map(year => [year.key, year.count])).toEqual([['2023', 1], ['2024', 3]]);
    expect(result.tree![1].children.map(month => (month as { text: string }).text)).toEqual(['March', 'April']);

    const all = compileFilter(['d', 'anyof', ['2024-03-05']], contextFor(items, [col('d', { dataType: 'datetime' })]))!;

    expect(items.filter(item => all(item))).toHaveLength(2);
  });
});
