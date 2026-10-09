import { describe, expect, it } from 'vitest';
import { declutter, visibleKinds } from './labels.js';

const rect = (x, y) => ({ x, y, width: 100, height: 30 });

describe('declutter', () => {
  it('hides the lower-ranked of two overlapping labels', () => {
    const shown = declutter([
      { id: 'village', rect: rect(0, 0), rank: 40 },
      { id: 'volcano', rect: rect(50, 10), rank: 90 },
      { id: 'far', rect: rect(400, 400), rank: 10 },
    ]);
    expect([...shown].sort()).toEqual(['far', 'volcano']);
  });
});

describe('visibleKinds', () => {
  it('shows only the big landmarks from afar and adds smaller ones closer', () => {
    expect(visibleKinds(13_000).has('village')).toBe(false);
    expect(visibleKinds(5_000).has('village')).toBe(true);
    expect(visibleKinds(5_000).has('lake')).toBe(false);
    expect(visibleKinds(1_500).has('lake')).toBe(true);
  });
});
