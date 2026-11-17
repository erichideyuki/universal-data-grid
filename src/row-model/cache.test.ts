import { describe, expect, it } from 'vitest';

import { _collatorCacheSize, COLLATOR_CACHE_LIMIT, createComparer } from './compare.js';
import { _formatterCacheSize, FORMATTER_CACHE_LIMIT, getDateTimeFormat, getNumberFormat } from './format.js';
import { LruCache } from './lru.js';

describe('caches de módulo têm limite (spec 14)', () => {
  it('LruCache descarta a entrada usada há mais tempo', () => {
    const cache = new LruCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);

    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('formatadores Intl: idiomas e opções sem fim não crescem o cache', () => {
    for (let n = 0; n < 1000; n++) {
      getNumberFormat('en', { minimumFractionDigits: n % 20, maximumFractionDigits: 20, minimumIntegerDigits: 1 + (n % 21) });
      getDateTimeFormat(`x-private-${n}`, { year: 'numeric' });
    }

    expect(_formatterCacheSize()).toBeLessThanOrEqual(FORMATTER_CACHE_LIMIT);
  });

  it('collators: idiomas sem fim não crescem o cache', () => {
    for (let n = 0; n < 500; n++) {
      createComparer(`x-private-${n}`)('a', 'b');
    }

    expect(_collatorCacheSize()).toBeLessThanOrEqual(COLLATOR_CACHE_LIMIT);
  });
});
