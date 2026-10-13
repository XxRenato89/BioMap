import { describe, expect, it } from 'vitest';
import { declutter, liftBadges, visibleKinds } from './labels.js';

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

describe('liftBadges', () => {
  const badge = (id, x, rank) => ({ id, rank, rect: { x, y: 100, width: 50, height: 50 } });

  it('leaves badges that do not touch on the ground', () => {
    const lifts = liftBadges([badge('a', 0, 2), badge('b', 200, 1)], { step: 44 });
    expect([...lifts]).toEqual([
      ['a', 0],
      ['b', 0],
    ]);
  });

  it('raises the less important of two touching badges one step at a time', () => {
    const lifts = liftBadges([badge('a', 0, 2), badge('b', 20, 1), badge('c', 10, 0)], {
      step: 60,
    });
    expect(lifts.get('a')).toBe(0);
    expect(lifts.get('b')).toBe(1);
    expect(lifts.get('c')).toBe(2);
  });

  it('drops a badge with no free level left', () => {
    const items = [0, 1, 2, 3, 4].map((k) => badge(`p${k}`, k, 10 - k));
    expect(liftBadges(items, { step: 60, maxLift: 3 }).has('p4')).toBe(false);
  });
});
