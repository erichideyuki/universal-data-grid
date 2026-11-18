import { describe, expect, it } from 'vitest';

import type { GridLoadOptions } from './data-source.js';
import { keyReader, keyText, normalizeRemoteOperations } from './data-source.js';
import { LocalDataSource } from './local-source.js';

const options = (patch: Partial<GridLoadOptions> = {}): GridLoadOptions => ({
  sort: [],
  filter: null,
  filterValue: null,
  searchText: '',
  group: [],
  groupPath: null,
  requireTotalCount: false,
  requireGroupCount: false,
  totalSummary: [],
  groupSummary: [],
  ...patch,
});

const items = [
  { id: 1, country: 'Brazil', city: 'São Paulo', population: 12 },
  { id: 2, country: 'Brazil', city: 'Rio', population: 6 },
  { id: 3, country: 'Chile', city: 'Santiago', population: 7 },
  { id: 4, country: 'Argentina', city: 'Córdoba', population: 1 },
  { id: 5, country: 'Argentina', city: 'Buenos Aires', population: 3 },
];

describe('LocalDataSource', () => {
  const source = new LocalDataSource(items);

  it('filters, sorts and pages with the total count', () => {
    const result = source.query(options({
      filter: ['population', '>', 2],
      sort: [{ path: 'population', order: 'desc' }],
      skip: 1,
      take: 2,
      requireTotalCount: true,
    }));

    expect(result.totalCount).toBe(4);
    expect(result.data.map(item => (item as typeof items[0]).id)).toEqual([3, 2]);
  });

  it('returns the groups of the first level with counts and summaries', () => {
    const result = source.query(options({
      group: [{ path: 'country', order: 'asc', expanded: false }],
      requireGroupCount: true,
      groupSummary: [{ path: 'population', type: 'sum' }],
      totalSummary: [{ path: 'population', type: 'sum' }],
    }));

    expect(result.groupCount).toBe(3);
    expect(result.summary).toEqual([29]);
    expect(result.data).toEqual([
      { key: 'Argentina', count: 2, items: null, summary: [4] },
      { key: 'Brazil', count: 2, items: null, summary: [18] },
      { key: 'Chile', count: 1, items: null, summary: [7] },
    ]);
  });

  it('returns the rows of a group by groupPath (exact equality)', () => {
    const result = source.query(options({
      group: [{ path: 'country', order: 'asc', expanded: false }],
      groupPath: ['Brazil'],
      sort: [{ path: 'city', order: 'asc' }],
    }));

    expect(result.data.map(item => (item as typeof items[0]).city)).toEqual(['Rio', 'São Paulo']);
    expect(source.query(options({ group: [{ path: 'country', order: 'asc', expanded: false }], groupPath: ['brazil'] })).data).toEqual([]);
  });

  it('honors an aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => source.load(options(), controller.signal)).toThrow();
  });
});

describe('remote operations', () => {
  it('normalizes dependencies', () => {
    expect(normalizeRemoteOperations(false).flags.paging).toBe(false);
    expect(normalizeRemoteOperations(true).flags).toEqual({ filtering: true, sorting: true, paging: true, grouping: true, summary: true });

    const paging = normalizeRemoteOperations({ paging: true });
    expect(paging.flags).toEqual({ filtering: true, sorting: true, paging: true, grouping: true, summary: true });
    expect(paging.forced).toEqual(['grouping', 'filtering', 'sorting', 'summary']);

    expect(normalizeRemoteOperations({ sorting: true, summary: true }).flags).toEqual({
      filtering: false, sorting: true, paging: false, grouping: false, summary: false,
    });
  });
});

describe('keys', () => {
  it('reads keyExpr paths and functions', () => {
    expect(keyReader('id')({ id: 7 })).toBe(7);
    expect(keyReader('a.b')({ a: { b: 'x' } })).toBe('x');
    expect(keyReader(item => (item as { id: number }).id * 2)({ id: 2 })).toBe(4);

    const item = {};
    expect(keyReader(null)(item)).toBe(item);
    expect(keyText(1)).not.toBe(keyText('1'));
  });
});
