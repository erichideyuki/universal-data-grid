import { afterEach, describe, expect, it } from 'vitest';

import { type GridState, parseGridState, STATE_LIMITS, STATE_MIGRATIONS } from './grid-state.js';
import { readWebStorage, resolveStorage, writeWebStorage } from './storage.js';

const valid: GridState = {
  version: 1,
  columns: [
    { name: 'country', width: 180, visible: true, fixed: 'start', groupIndex: 0, sortOrder: 'desc', sortIndex: 0 },
    { name: 'year', width: null, visible: false, fixed: null, groupIndex: null, sortOrder: null, sortIndex: null },
  ],
  filterValue: [['year', '>', 2000], 'and', ['!', ['country', 'anyof', ['A', 'B']]]],
  searchText: 'bra',
  groupExpansion: { all: true, levels: [null, false], expanded: [['Brazil', 2020]], collapsed: [['Chile'], [null], [true]] },
  selectedKeys: [1, 'a'],
  rowExpansion: { expanded: [3], collapsed: [] },
  pageIndex: 2,
  pageSize: 50,
};

const errorOf = (input: unknown): string => {
  const result = parseGridState(input);
  return 'error' in result ? result.error : '';
};

describe('parseGridState', () => {
  afterEach(() => STATE_MIGRATIONS.clear());

  it('aceita o estado completo e devolve uma cópia igual (ida e volta pelo JSON)', () => {
    const result = parseGridState(JSON.parse(JSON.stringify(valid)));

    expect(result).toEqual({ state: valid });
    expect((result as { state: GridState }).state.columns).not.toBe(valid.columns);
  });

  it('só a versão é obrigatória; campos de coluna ausentes ficam ausentes', () => {
    expect(parseGridState({ version: 1 })).toEqual({ state: { version: 1 } });
    expect(parseGridState({ version: 1, columns: [{ name: 'a' }] })).toEqual({ state: { version: 1, columns: [{ name: 'a' }] } });
  });

  it('ignora campos desconhecidos e não copia chaves perigosas', () => {
    const input = JSON.parse('{"version":1,"__proto__":{"polluted":1},"constructor":{"x":1},"extra":5,"columns":[{"name":"a","__proto__":{"polluted":2}}]}') as unknown;
    const result = parseGridState(input) as { state: GridState };

    expect(result.state).toEqual({ version: 1, columns: [{ name: 'a' }] });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(result.state)).toBe(Object.prototype);
  });

  it.each([
    ['não é objeto', 'texto'],
    ['array', [1]],
    ['null', null],
    ['sem versão', {}],
    ['versão futura', { version: 2 }],
    ['versão texto', { version: '1' }],
    ['columns não é array', { version: 1, columns: 'a' }],
    ['coluna sem name', { version: 1, columns: [{ width: 10 }] }],
    ['name vazio', { version: 1, columns: [{ name: '' }] }],
    ['largura negativa', { version: 1, columns: [{ name: 'a', width: -1 }] }],
    ['largura infinita', { version: 1, columns: [{ name: 'a', width: 1e9 }] }],
    ['fixed inválido', { version: 1, columns: [{ name: 'a', fixed: 'left' }] }],
    ['visible texto', { version: 1, columns: [{ name: 'a', visible: 'false' }] }],
    ['groupIndex fracionário', { version: 1, columns: [{ name: 'a', groupIndex: 0.5 }] }],
    ['sortOrder inválido', { version: 1, columns: [{ name: 'a', sortOrder: 'up' }] }],
    ['filtro com objeto', { version: 1, filterValue: [['a', '=', { $gt: 1 }]] }],
    ['filtro não array', { version: 1, filterValue: 'a > 1' }],
    ['busca não texto', { version: 1, searchText: 5 }],
    ['chave objeto', { version: 1, selectedKeys: [{ id: 1 }] }],
    ['chave NaN', { version: 1, selectedKeys: [Number.NaN] }],
    ['caminho de grupo vazio', { version: 1, groupExpansion: { all: null, levels: [], expanded: [[]], collapsed: [] } }],
    ['caminho de grupo com objeto', { version: 1, groupExpansion: { all: null, levels: [], expanded: [[{}]], collapsed: [] } }],
    ['nível texto', { version: 1, groupExpansion: { all: null, levels: ['yes'], expanded: [], collapsed: [] } }],
    ['página negativa', { version: 1, pageIndex: -1 }],
    ['tamanho zero', { version: 1, pageSize: 0 }],
    ['tamanho enorme', { version: 1, pageSize: STATE_LIMITS.pageSize + 1 }],
  ])('recusa estado inválido: %s', (_, input) => {
    expect(errorOf(input)).not.toBe('');
  });

  it('recusa estado grande demais (colunas, chaves, profundidade do filtro)', () => {
    expect(errorOf({ version: 1, columns: Array.from({ length: STATE_LIMITS.columns + 1 }, (_, i) => ({ name: `c${i}` })) })).toMatch(/columns/);
    expect(errorOf({ version: 1, selectedKeys: new Array(STATE_LIMITS.keys + 1).fill(1) })).toMatch(/selectedKeys/);

    let deep: unknown = ['a', '=', 1];

    for (let i = 0; i < STATE_LIMITS.filterDepth + 2; i++) {
      deep = ['!', deep];
    }

    expect(errorOf({ version: 1, filterValue: deep })).toMatch(/filterValue/);
    expect(errorOf({ version: 1, searchText: 'x'.repeat(STATE_LIMITS.textLength + 1) })).toMatch(/searchText/);
  });

  it('getter hostil não escapa: recusa sem lançar', () => {
    const hostile = { version: 1, get columns(): never {
      throw new Error('boom');
    } };

    expect(errorOf(hostile)).toBe('the state could not be read');
  });

  it('coluna repetida: vale a primeira', () => {
    const result = parseGridState({ version: 1, columns: [{ name: 'a', width: 10 }, { name: 'a', width: 20 }] }) as { state: GridState };

    expect(result.state.columns).toEqual([{ name: 'a', width: 10 }]);
  });

  it('datas no filtro viram ISO (estado montado à mão)', () => {
    const date = new Date(Date.UTC(2020, 0, 2));
    const result = parseGridState({ version: 1, filterValue: ['d', '>', date] }) as { state: GridState };

    expect(result.state.filterValue).toEqual(['d', '>', '2020-01-02T00:00:00.000Z']);
  });

  it('versão antiga é migrada pela tabela; sem migração, descartada', () => {
    expect(errorOf({ version: 0, sort: 'x' })).toMatch(/unknown state version 0/);

    // Migração de exemplo (v0 → v1): renomeia campos.
    STATE_MIGRATIONS.set(0, old => ({ version: 1, searchText: old.search }));

    expect(parseGridState({ version: 0, search: 'abc' })).toEqual({ state: { version: 1, searchText: 'abc' } });

    // A migração ainda passa pela validação.
    expect(errorOf({ version: 0, search: 42 })).toMatch(/searchText/);
  });

  it('migração que não avança a versão é recusada (sem laço infinito)', () => {
    STATE_MIGRATIONS.set(0, old => old);

    expect(errorOf({ version: 0 })).toBe('migration failed');
  });
});

describe('storage', () => {
  it('resolve a configuração e avisa a inválida', () => {
    const warnings: string[] = [];
    const warn = (message: string) => warnings.push(message);
    const custom = { load: () => null, save: () => undefined };

    expect(resolveStorage(null, 'k', warn)).toBeUndefined();
    expect(resolveStorage('local', 'k', warn)).toEqual({ kind: 'local', key: 'k' });
    expect(resolveStorage('session', '', warn)).toBeUndefined();
    expect(resolveStorage('cookie', 'k', warn)).toBeUndefined();
    expect(resolveStorage({ load: () => null }, 'k', warn)).toBeUndefined();
    expect(resolveStorage(custom, undefined, warn)).toEqual({ kind: 'custom', storage: custom });
    expect(warnings).toHaveLength(3);
  });

  it('sem storage (Node) não lança', () => {
    expect(readWebStorage('local', 'k')).toEqual({ value: null });
    expect(writeWebStorage('session', 'k', '{}')).toBeUndefined();
  });
});
