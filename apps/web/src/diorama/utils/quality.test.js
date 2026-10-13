import { describe, expect, it } from 'vitest';
import { loadTier, parseQuality, saveTier, stepTier, TIERS } from './quality.js';

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
};
const brokenStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

describe('quality tiers', () => {
  it('parses a pinned tier from the environment', () => {
    expect(parseQuality('high')).toBe('high');
    expect(parseQuality('ultra')).toBeNull();
    expect(parseQuality(undefined)).toBeNull();
  });

  it('steps between tiers without leaving the range', () => {
    expect(stepTier('medium', 1)).toBe('high');
    expect(stepTier('medium', -1)).toBe('low');
    expect(stepTier('low', -1)).toBe('low');
    expect(stepTier('high', 1)).toBe('high');
  });

  it('remembers the tier per device', () => {
    const storage = memoryStorage();
    expect(loadTier(storage)).toBe('medium');
    saveTier(storage, 'low');
    expect(loadTier(storage)).toBe('low');
  });

  it('falls back to medium when storage is unavailable or holds garbage', () => {
    expect(loadTier(brokenStorage)).toBe('medium');
    expect(() => saveTier(brokenStorage, 'high')).not.toThrow();
    expect(loadTier(null)).toBe('medium');
    const storage = memoryStorage();
    storage.setItem('biomap.quality', 'ultra');
    expect(loadTier(storage)).toBe('medium');
  });

  it('gives sharper still frames than moving ones in every tier', () => {
    for (const tier of Object.values(TIERS)) expect(tier.dprStill).toBeGreaterThan(tier.dprMoving);
  });
});
