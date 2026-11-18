import { describe, expect, it } from 'vitest';

import type { GridColumnDef } from '../grid-column-def.js';
import { createComparer } from './compare.js';
import { flattenRows } from './flatten.js';
import { buildGroups } from './group.js';
import { getValueByPath } from './value.js';

const compare = createComparer('en');
const byColumn = () => compare;
const col = (path?: string, label = path): GridColumnDef => ({ path, label });

describe('getValueByPath', () => {
  it('lê caminhos aninhados e tolera ausências (B7)', () => {
    expect(getValueByPath({ a: { b: 1 } }, 'a.b')).toBe(1);
    expect(getValueByPath({ a: null }, 'a.b')).toBeUndefined();
    expect(getValueByPath({ a: 1 }, undefined)).toBeUndefined();
    expect(getValueByPath({ a: 1 }, '')).toBeUndefined();
  });

  it('preserva 0, false e string vazia', () => {
    expect(getValueByPath({ a: 0 }, 'a')).toBe(0);
    expect(getValueByPath({ a: false }, 'a')).toBe(false);
    expect(getValueByPath({ a: '' }, 'a')).toBe('');
  });
});

describe('createComparer (B8)', () => {
  const sort = (values: unknown[]) => [...values].sort(compare);

  it('números em ordem numérica', () => {
    expect(sort([9, 10, 100, 2])).toEqual([2, 9, 10, 100]);
  });

  it('textos com números em ordem natural', () => {
    expect(sort(['item 10', 'item 2', 'item 1'])).toEqual(['item 1', 'item 2', 'item 10']);
  });

  it('datas pelo tempo', () => {
    const a = new Date(2020, 0, 1);
    const b = new Date(2019, 0, 1);
    expect(sort([a, b])).toEqual([b, a]);
  });

  it('vazios primeiro', () => {
    // Array#sort põe `undefined` no fim sem chamar o comparador; por isso o
    // undefined é conferido direto.
    expect(sort([2, null, 1, Number.NaN])).toEqual([null, Number.NaN, 1, 2]);
    expect(compare(undefined, 1)).toBeLessThan(0);
    expect(compare(undefined, null)).toBe(0);
  });

  it('textos diferentes nunca empatam', () => {
    expect(compare('a', 'A')).not.toBe(0);
    expect(compare('a', 'a')).toBe(0);
  });

  it('idioma inválido não lança', () => {
    expect(() => createComparer('not a language!')).not.toThrow();
  });
});

describe('buildGroups', () => {
  it('não muta items e não depende da ordem de entrada (B4, B5)', () => {
    const items = Object.freeze([
      { a: 'x', b: 'p' },
      { a: 'y', b: 'p' },
      { a: 'x', b: 'q' },
      { a: 'x', b: 'p' },
    ]);

    const groups = buildGroups(items, [col('a'), col('b')], byColumn);

    expect(groups.map(g => g.value)).toEqual(['x', 'y']);
    expect(groups[0].children.map(g => [g.value, g.items.length])).toEqual([['p', 2], ['q', 1]]);
  });

  it('itens vazios ou sem colunas de grupo', () => {
    expect(buildGroups([], [col('a')], byColumn)).toEqual([]);
    expect(buildGroups([{ a: 1 }], [], byColumn)).toEqual([]);
  });

  it('coluna sem path agrupa tudo como vazio (B7)', () => {
    const groups = buildGroups([{ a: 1 }, { a: 2 }], [col(undefined, 'Actions')], byColumn);
    expect(groups).toHaveLength(1);
    expect(groups[0].value).toBeUndefined();
    expect(groups[0].items).toHaveLength(2);
  });

  it('1 e "1" são grupos diferentes; chaves estáveis e únicas', () => {
    const groups = buildGroups([{ a: 1 }, { a: '1' }], [col('a')], byColumn);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map(g => g.key)).size).toBe(2);
    expect(buildGroups([{ a: 1 }], [col('a')], byColumn)[0].key).toBe(groups[0].key);
  });
});

describe('flattenRows', () => {
  const keyOf = (item: any) => String(item.id);

  it('sem grupos: uma linha por item, com índice para a listra', () => {
    const rows = flattenRows([{ id: 1 }, { id: 2 }], [], () => true, keyOf).slice();
    expect(rows.map(r => [r.key, !r.isGroup && !r.isFooter && r.index])).toEqual([['d:1', 0], ['d:2', 1]]);
  });

  it('respeita a expansão por chave e reinicia o índice em cada grupo', () => {
    const items = [{ id: 1, g: 'a' }, { id: 2, g: 'b' }, { id: 3, g: 'b' }];
    const groups = buildGroups(items, [col('g')], byColumn);
    const expanded = new Set([groups[1].key]);

    const rows = flattenRows(items, groups, key => expanded.has(key), keyOf).slice();

    expect(rows.map(r => r.isGroup ? `G${r.value}` : r.isFooter ? 'F' : `${r.item.id}/${r.index}`))
      .toEqual(['Ga', 'Gb', '2/0', '3/1']);
  });

  it('o mesmo item duas vezes recebe chaves distintas na fatia', () => {
    const item = { id: 1 };
    const rows = flattenRows([item, item, { id: 2 }], [], () => true, keyOf);
    expect(rows.slice().map(r => r.key)).toEqual(['d:1', 'd:1#1', 'd:2']);
    expect(rows.slice(1).map(r => r.key)).toEqual(['d:1', 'd:2']);
  });

  it('não cria uma linha por item: at() monta a linha pedida', () => {
    const items = Array.from({ length: 100_000 }, (_, id) => ({ id, g: id % 3 }));
    const groups = buildGroups(items, [col('g')], byColumn);
    const rows = flattenRows(items, groups, () => true, keyOf);
    const last = rows.at(rows.length - 1);

    expect(rows.length).toBe(100_003);
    expect(rows.at(0).isGroup).toBe(true);
    expect(last.isGroup || last.isFooter || [last.item.id, last.index]).toEqual([99_998, 33_332]);
    expect(rows.at(33_335).isGroup).toBe(true);
  });
});
