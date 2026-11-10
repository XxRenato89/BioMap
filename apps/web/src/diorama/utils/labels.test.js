import { describe, expect, it } from 'vitest';
import { clusterPins, declutter, fanOffsets, visibleKinds } from './labels.js';

const rect = (x, y) => ({ x, y, width: 100, height: 30 });

describe('declutter', () => {
  it('hides the lower-ranked of two overlapping labels', () => {
    const shown = declutter([
      { id: 'village', rect: rect(0, 0), rank: 40 },
      { id: 'volcano', rect: rect(50, 10), rank: 90 },
      { id: 'far', rect: rect(400, 400), rank: 10 },
    ]);
    expect([...shown.keys()].sort()).toEqual(['far', 'volcano']);
  });

  it('hides labels that would cover another pin or leave the screen', () => {
    const shown = declutter(
      [
        { id: 'under-pin', rect: rect(0, 0), rank: 2 },
        { id: 'off-screen', rect: rect(250, 200), rank: 1 },
        { id: 'free', rect: rect(0, 200), rank: 0 },
      ],
      { obstacles: [{ x: 60, y: 10, width: 40, height: 40 }], width: 300 },
    );
    expect([...shown.keys()]).toEqual(['free']);
  });

  it('moves a label to its spare side when the main one is taken', () => {
    const shown = declutter([
      { id: 'big', rect: rect(100, 0), rank: 2 },
      { id: 'flip', rect: rect(120, 0), alt: rect(0, 40), rank: 1 },
    ]);
    expect(shown.get('big')).toBe('main');
    expect(shown.get('flip')).toBe('alt');
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

describe('clusterPins', () => {
  const pin = (id, x, rank, solo) => ({ id, x, y: 100, rank, solo });

  it('groups pins that overlap on screen under the highest-ranked one', () => {
    const groups = clusterPins([pin('a', 0, 1), pin('b', 30, 2), pin('c', 300, 3)], 60);
    expect(groups.get('b')).toEqual(['b', 'a']);
    expect(groups.get('c')).toEqual(['c']);
    expect(groups.has('a')).toBe(false);
  });

  it('never groups the selected pin', () => {
    const groups = clusterPins([pin('a', 0, 9, true), pin('b', 20, 1), pin('c', 30, 0)], 60);
    expect(groups.get('a')).toEqual(['a']);
    expect(groups.get('b')).toEqual(['b', 'c']);
  });
});

describe('fanOffsets', () => {
  it('spreads pins in a circle with room between neighbours, the first on top', () => {
    const fan = fanOffsets(4, 60);
    expect(fan).toHaveLength(4);
    expect(fan[0].dx).toBeCloseTo(0);
    expect(fan[0].dy).toBeLessThan(0);
    for (let k = 0; k < 4; k += 1) {
      const [a, b] = [fan[k], fan[(k + 1) % 4]];
      expect(Math.hypot(a.dx - b.dx, a.dy - b.dy)).toBeGreaterThanOrEqual(60 - 1e-9);
    }
    expect(fanOffsets(1, 60)).toEqual([{ dx: 0, dy: 0 }]);
  });
});
