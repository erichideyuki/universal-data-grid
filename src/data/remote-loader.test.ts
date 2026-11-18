import { describe, expect, it, vi } from 'vitest';

import type { GridColumnDef } from '../grid-column-def.js';
import { MISSING } from '../row-model/types.js';
import type { GridLoadOptions, GridLoadResult } from './data-source.js';
import { LocalDataSource } from './local-source.js';
import { flattenRemote, type LoaderQuery, RemoteLoader } from './remote-loader.js';

const items = Array.from({ length: 95 }, (_, id) => ({ id, group: id % 3 === 0 ? 'a' : 'b', value: id }));

const query = (patch: Partial<LoaderQuery> = {}): LoaderQuery => ({
  sort: [],
  filter: null,
  filterValue: null,
  searchText: '',
  group: [],
  totalSummary: [],
  groupSummary: [],
  blockSize: 20,
  infinite: false,
  ...patch,
});

interface Call {
  options: GridLoadOptions;
  signal: AbortSignal;
  resolve(result?: GridLoadResult): void;
  reject(error: unknown): void;
}

/** Fonte manual: cada pedido fica esperando até o teste responder. */
const manualHost = () => {
  const source = new LocalDataSource(items);
  const calls: Call[] = [];
  const changed = vi.fn();
  const host = {
    request: (options: GridLoadOptions, signal: AbortSignal) => new Promise<GridLoadResult>((resolve, reject) => {
      calls.push({ options, signal, resolve: result => resolve(result ?? source.query(options)), reject });
    }),
    changed,
  };

  return { host, calls, changed };
};

const tick = () => new Promise(resolve => setTimeout(resolve));

describe('RemoteLoader', () => {
  it('loads the first block with the total and shows nothing before it answers', async () => {
    const { host, calls } = manualHost();
    const loader = new RemoteLoader(host);

    loader.reset(query({ totalSummary: [{ path: 'value', type: 'sum' }] }));

    expect(loader.loading).toBe(true);
    expect(loader.current).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].options).toMatchObject({ skip: 0, take: 20, requireTotalCount: true });
    expect(Object.isFrozen(calls[0].options)).toBe(true);

    calls[0].resolve();
    await tick();

    expect(loader.loading).toBe(false);
    expect(loader.current?.totalCount).toBe(95);
    expect(loader.current?.summary).toEqual([items.reduce((sum, item) => sum + item.value, 0)]);
  });

  it('marks missing blocks and fetches them on flush (skeleton until then)', async () => {
    const { host, calls } = manualHost();
    const loader = new RemoteLoader(host);

    loader.reset(query());
    calls[0].resolve();
    await tick();

    const rows = flattenRemote(loader.current!, [], () => true, item => String((item as { id: number }).id), summary => summary);

    expect(rows.length).toBe(95);
    expect(rows.at(5)).toMatchObject({ item: items[5] });
    expect(rows.at(45)).toMatchObject({ skeleton: true });

    loader.flush();
    expect(calls).toHaveLength(2);
    expect(calls[1].options).toMatchObject({ skip: 40, take: 20, requireTotalCount: false, totalSummary: [] });

    calls[1].resolve();
    await tick();
    expect(loader.current!.root.peek(45)).toBe(items[45]);
  });

  it('aborts pending requests on a new query and drops late answers', async () => {
    const { host, calls } = manualHost();
    const loader = new RemoteLoader(host);

    loader.reset(query());
    loader.reset(query({ sort: [{ path: 'value', order: 'desc' }] }));

    expect(calls[0].signal.aborted).toBe(true);

    // A fonte ignora o signal e responde depois: descartado.
    calls[0].resolve();
    await tick();
    expect(loader.current).toBeUndefined();

    calls[1].resolve();
    await tick();
    expect(loader.current!.root.peek(0)).toBe(items[94]);
  });

  it('keeps the shown generation until the new one answers', async () => {
    const { host, calls } = manualHost();
    const loader = new RemoteLoader(host);

    loader.reset(query());
    calls[0].resolve();
    await tick();
    const first = loader.current;

    loader.reset(query({ filter: ['group', '=', 'a'] }));
    expect(loader.current).toBe(first);
    expect(loader.loading).toBe(true);

    calls[1].resolve();
    await tick();
    expect(loader.current).not.toBe(first);
    expect(loader.current!.totalCount).toBe(32);
  });

  it('reports errors and retries', async () => {
    const { host, calls } = manualHost();
    const loader = new RemoteLoader(host);

    loader.reset(query());
    calls[0].reject(new Error('boom'));
    await tick();

    expect(loader.error?.error).toEqual(new Error('boom'));
    expect(loader.loading).toBe(false);

    loader.retry();
    expect(calls).toHaveLength(2);
    calls[1].resolve();
    await tick();
    expect(loader.error).toBeUndefined();
    expect(loader.current?.totalCount).toBe(95);
  });

  it('grows in infinite mode until a short block', async () => {
    const { host, calls } = manualHost();
    const loader = new RemoteLoader(host);

    loader.reset(query({ infinite: true, blockSize: 40 }));
    expect(calls[0].options.requireTotalCount).toBe(false);
    calls[0].resolve();
    await tick();

    const root = loader.current!.root;
    expect(root.length).toBe(80);
    expect(root.get(50)).toBe(MISSING);
    loader.flush();
    calls[1].resolve();
    await tick();
    expect(root.length).toBe(120);
    root.get(85);
    loader.flush();
    calls[2].resolve();
    await tick();
    expect(root.length).toBe(95);
    expect(loader.current!.totalCount).toBe(95);
  });

  it('loads groups lazily: levels, then rows by groupPath', async () => {
    const { host, calls } = manualHost();
    const loader = new RemoteLoader(host);
    const column: GridColumnDef = { path: 'group' };

    loader.reset(query({ group: [{ path: 'group', order: 'asc', expanded: false }], groupSummary: [{ path: 'value', type: 'count' }] }));
    expect(calls[0].options).toMatchObject({ requireGroupCount: true, requireTotalCount: true, groupPath: null });
    expect(calls[0].options.skip).toBeUndefined();
    calls[0].resolve();
    await tick();

    const flat = () => flattenRemote(loader.current!, [column], () => true, item => String((item as { id: number }).id), summary => summary);
    let rows = flat();

    expect(loader.current!.totalCount).toBe(95);
    expect(rows.at(0)).toMatchObject({ isGroup: true, value: 'a', itemCount: 32, summaries: [32] });
    expect(rows.at(1)).toMatchObject({ skeleton: true });

    loader.flush();
    expect(calls[1].options).toMatchObject({ groupPath: ['a'], skip: 0, take: 20, requireTotalCount: false });
    calls[1].resolve();
    await tick();

    rows = flat();
    expect(rows.at(1)).toMatchObject({ item: items[0] });
    expect(rows.length).toBe(2 + 95);
  });

  it('does not call the source when the host cancels', async () => {
    const changed = vi.fn();
    const loader = new RemoteLoader({ request: () => null, changed });

    loader.reset(query());
    expect(loader.loading).toBe(false);
    expect(loader.current).toBeUndefined();
    await loader.whenSettled();
  });

  it('updates cached items in place by key and disposes everything', async () => {
    const { host, calls } = manualHost();
    const loader = new RemoteLoader(host);

    loader.reset(query());
    calls[0].resolve();
    await tick();

    const updated = { ...items[3], value: -1 };
    expect(loader.current!.updateItems(item => (item as { id: number }).id, new Map([[3, updated]]))).toBe(1);
    expect(loader.current!.root.peek(3)).toBe(updated);

    loader.current!.root.get(60);
    loader.flush();
    const pending = calls.at(-1)!;
    loader.dispose();
    expect(pending.signal.aborted).toBe(true);
    expect(loader.pending).toBe(0);
    expect(loader.current).toBeUndefined();
  });
});
