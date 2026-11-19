import type { GridDataSource } from '@universal-material/data-grid';

// The reference implementation of the data source contract over an array (filter, sort, group,
// summaries, paging). It is not part of the package — copy it as a starting point for a server.
import { LocalDataSource } from '../../../src/data/local-source.js';

export interface FakeServerOptions {
  /** Network latency in ms (default 400). */
  latency?: number;
  /** Fails one request in `failEvery` (0: never). */
  failEvery?: number;
  /** Called with every request, for the demo logs. */
  onRequest?: (options: unknown) => void;
}

/**
 * A pretend server: answers the grid's `load(options)` with `LocalDataSource` after a delay,
 * honoring the abort signal like `fetch` does. In your app, `load` calls your API instead.
 */
export const fakeServer = <T>(rows: readonly T[], { latency = 400, failEvery = 0, onRequest }: FakeServerOptions = {}): GridDataSource<T> => {
  const local = new LocalDataSource(rows);
  let calls = 0;

  return {
    load: (options, signal) => new Promise((resolve, reject) => {
      onRequest?.(options);
      const fail = failEvery > 0 && ++calls % failEvery === 0;
      const timer = setTimeout(() => (fail ? reject(new Error('The server is unavailable (simulated)')) : resolve(local.query(options))), latency);

      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
      }, { once: true });
    }),
  };
};
