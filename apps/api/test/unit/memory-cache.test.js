import { describe, expect, it, vi } from 'vitest';
import { createMemoryCache } from '../../src/http/memory-cache.js';

describe('createMemoryCache', () => {
  it('calls the loader once and reuses the value within the TTL', async () => {
    const cache = createMemoryCache({ ttlMs: 1000 });
    const loader = vi.fn(async () => 'value');
    expect(await cache.getOrLoad('k', loader)).toBe('value');
    expect(await cache.getOrLoad('k', loader)).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads after the TTL expires', async () => {
    let clock = 0;
    const cache = createMemoryCache({ ttlMs: 1000, now: () => clock });
    const loader = vi.fn(async () => clock);
    await cache.getOrLoad('k', loader);
    clock = 1001;
    expect(await cache.getOrLoad('k', loader)).toBe(1001);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('keeps separate entries per key', async () => {
    const cache = createMemoryCache({ ttlMs: 1000 });
    expect(await cache.getOrLoad('a', async () => 1)).toBe(1);
    expect(await cache.getOrLoad('b', async () => 2)).toBe(2);
  });

  it('runs the loader once for concurrent misses on the same key', async () => {
    const cache = createMemoryCache({ ttlMs: 1000 });
    let resolve;
    const loader = vi.fn(() => new Promise((r) => (resolve = r)));
    const pending = Array.from({ length: 20 }, () => cache.getOrLoad('k', loader));
    await Promise.resolve();
    resolve('shared');
    expect(await Promise.all(pending)).toEqual(Array(20).fill('shared'));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed load', async () => {
    const cache = createMemoryCache({ ttlMs: 1000 });
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('recovered');
    await expect(cache.getOrLoad('k', loader)).rejects.toThrow('db down');
    expect(await cache.getOrLoad('k', loader)).toBe('recovered');
  });

  it('invalidate() clears every entry', async () => {
    const cache = createMemoryCache({ ttlMs: 1000 });
    const loader = vi.fn(async () => 'v');
    await cache.getOrLoad('k', loader);
    cache.invalidate();
    await cache.getOrLoad('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not cache anything when ttlMs is 0', async () => {
    const cache = createMemoryCache({ ttlMs: 0 });
    const loader = vi.fn(async () => 'v');
    await cache.getOrLoad('k', loader);
    await cache.getOrLoad('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
