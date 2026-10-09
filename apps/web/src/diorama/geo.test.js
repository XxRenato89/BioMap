import { describe, expect, it } from 'vitest';
import { clipPolygonToBounds } from './geo.js';

const BOUNDS = [
  [-72.6, -38.1],
  [-71.2, -37.3],
];
const square = (west, south, east, north) => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];

describe('clipPolygonToBounds', () => {
  it('keeps a polygon that is fully inside unchanged', () => {
    const outer = square(-72, -37.8, -71.8, -37.6);
    expect(clipPolygonToBounds({ outer, holes: [] }, BOUNDS)).toEqual({ outer, holes: [] });
  });

  it('drops a polygon that is fully outside', () => {
    expect(
      clipPolygonToBounds({ outer: square(-70, -37, -69, -36), holes: [] }, BOUNDS),
    ).toBeNull();
  });

  it('cuts a polygon that crosses the east edge and keeps the ring closed', () => {
    const { outer } = clipPolygonToBounds(
      { outer: square(-71.5, -37.8, -70.9, -37.6), holes: [] },
      BOUNDS,
    );
    expect(outer.every(([lng]) => lng <= -71.2 + 1e-9)).toBe(true);
    expect(outer[0]).toEqual(outer.at(-1));
    expect(outer.length).toBeGreaterThanOrEqual(5);
  });

  it('cuts a polygon over a corner and drops holes left outside', () => {
    const polygon = {
      outer: square(-71.4, -37.4, -71, -37.1),
      holes: [square(-71.1, -37.25, -71.05, -37.2)],
    };
    const clipped = clipPolygonToBounds(polygon, BOUNDS);
    expect(clipped.holes).toEqual([]);
    expect(clipped.outer.every(([lng, lat]) => lng <= -71.2 + 1e-9 && lat <= -37.3 + 1e-9)).toBe(
      true,
    );
  });
});
