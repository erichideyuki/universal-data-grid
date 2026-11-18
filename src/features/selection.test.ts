import { describe, expect, it } from 'vitest';

import { countSelected, normalizeSelectionMode, SelectionModel } from './selection.js';

describe('SelectionModel', () => {
  it('replace/add/remove devolvem added, removed e o array anterior congelado', () => {
    const model = new SelectionModel();
    const a = {};
    const b = {};
    const c = {};

    const first = model.replace([a, b])!;
    expect(first.added).toEqual([a, b]);
    expect(first.removed).toEqual([]);
    expect(first.previous).toEqual([]);
    expect(Object.isFrozen(first.selectedKeys)).toBe(true);

    const second = model.add([b, c])!;
    expect(second.added).toEqual([c]);
    expect(second.previous).toBe(first.selectedKeys);
    expect(model.keys).toEqual([a, b, c]);

    const third = model.remove([a, {}])!;
    expect(third.removed).toEqual([a]);
    expect(model.keys).toEqual([b, c]);
  });

  it('sem mudança devolve undefined e mantém a mesma instância de keys', () => {
    const model = new SelectionModel();
    const a = {};

    model.replace([a]);
    const keys = model.keys;
    const version = model.version;

    expect(model.add([a])).toBeUndefined();
    expect(model.remove([{}])).toBeUndefined();
    expect(model.replace([a])).toBeUndefined();
    expect(model.keys).toBe(keys);
    expect(model.version).toBe(version);
  });

  it('countSelected conta só as chaves presentes', () => {
    const model = new SelectionModel();
    const items = [{}, {}, {}];

    model.replace([items[0], items[2], {}]);
    expect(countSelected(model, items)).toBe(2);
  });

  it('normalizeSelectionMode cai em none', () => {
    expect(normalizeSelectionMode('multiple')).toBe('multiple');
    expect(normalizeSelectionMode('bogus')).toBe('none');
  });
});
