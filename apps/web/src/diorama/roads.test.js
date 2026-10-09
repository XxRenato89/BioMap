import { describe, expect, it } from 'vitest';
import { createProjection } from './projection.js';
import { buildBridges, buildRoads, ROAD_CLASS } from './roads.js';

const PROJECTION = createProjection([
  [-72, -37.8],
  [-71.9, -37.72],
]);
/* Un valle: orillas a 0,4 km y el fondo del río a 0,3 km en el centro. */
const valley = (x) => (Math.abs(x) < 0.05 ? 0.3 : 0.4);
const heightAt = (x) => valley(x);
const WIDTHS = { secondary: 8, track: 3 };
const crossing = [
  [-71.951, -37.76],
  [-71.949, -37.76],
];

describe('buildRoads', () => {
  it('gives every vertex its side, width, style and distance along the road', () => {
    const geometry = buildRoads([{ kind: 'track', line: crossing }], WIDTHS, heightAt, PROJECTION);
    expect(geometry.getAttribute('roadKind').array[0]).toBe(ROAD_CLASS.track);
    expect(geometry.getAttribute('roadHalf').array[0]).toBeCloseTo(0.0015, 6);
    const along = geometry.getAttribute('roadAlong').array;
    expect(along.at(-1)).toBeGreaterThan(150);
  });

  it('carries a bridge deck straight between its banks instead of dipping into the river', () => {
    const geometry = buildRoads(
      [{ kind: 'secondary', line: crossing, bridge: true }],
      WIDTHS,
      heightAt,
      PROJECTION,
    );
    const ys = geometry.getAttribute('position').array.filter((_, k) => k % 3 === 1);
    expect(Math.min(...ys)).toBeGreaterThan(0.4);
  });
});

describe('buildBridges', () => {
  it('builds a deck with parapets and piers that reach the river bed', () => {
    const geometry = buildBridges(
      [{ kind: 'secondary', line: crossing, bridge: true }],
      WIDTHS,
      heightAt,
      PROJECTION,
    );
    const ys = geometry.getAttribute('position').array.filter((_, k) => k % 3 === 1);
    expect(Math.max(...ys)).toBeGreaterThan(0.4 + 0.0015);
    expect(Math.min(...ys)).toBeLessThan(0.3);
  });

  it('ignores roads that are not bridges', () => {
    const geometry = buildBridges(
      [{ kind: 'secondary', line: crossing }],
      WIDTHS,
      heightAt,
      PROJECTION,
    );
    expect(geometry.getAttribute('position').count).toBe(0);
  });
});
