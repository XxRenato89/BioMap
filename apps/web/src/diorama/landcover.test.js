import { describe, expect, it } from 'vitest';
import { LANDCOVER, landcoverTint, reclassify } from './landcover.js';

describe('landcover', () => {
  it.each([
    [10, LANDCOVER.tree],
    [40, LANDCOVER.cropland],
    [80, LANDCOVER.water],
    [95, LANDCOVER.tree],
    [100, LANDCOVER.moss],
    [0, LANDCOVER.unknown],
    [255, LANDCOVER.unknown],
  ])('reclassifies WorldCover code %i', (code, cls) => {
    expect(reclassify(code)).toBe(cls);
  });

  it('gives every known class a tint and none to unknown or water', () => {
    expect(landcoverTint(LANDCOVER.unknown)).toBeNull();
    expect(landcoverTint(LANDCOVER.water)).toBeNull();
    for (const cls of [1, 2, 3, 4, 5, 6, 7, 9, 11]) {
      expect(landcoverTint(cls)).toHaveLength(3);
    }
  });
});
