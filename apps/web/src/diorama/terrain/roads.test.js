import { describe, expect, it } from 'vitest';
import { createProjection, metersToY } from '../utils/projection.js';
import {
  bridgeReservoirCrossings,
  buildBridges,
  buildRoads,
  ROAD_CLASS,
  surfaceSampler,
} from './roads.js';

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

describe('bridges over the Angostura reservoir', () => {
  /* Embalse de prueba: una franja de agua dentro de los límites del embalse. */
  const RESERVOIR_PROJECTION = createProjection([
    [-71.81, -37.75],
    [-71.78, -37.72],
  ]);
  const inWater = ([lng]) => lng > -71.796 && lng < -71.794;
  /* Relieve anterior al embalse: el fondo y las orillas quedan bajo la cota de 326 m. */
  const lowGround = () => metersToY(311);
  const road = {
    kind: 'secondary',
    line: [
      [-71.8, -37.735],
      [-71.79, -37.735],
    ],
  };

  it('turns a road stretch over the reservoir into a bridge, keeping the original ends', () => {
    const parts = bridgeReservoirCrossings([road], inWater);
    expect(parts.map((part) => Boolean(part.bridge))).toEqual([false, true, false]);
    expect(parts[0].line[0]).toEqual(road.line[0]);
    expect(parts.at(-1).line.at(-1)).toEqual(road.line[1]);
  });

  it('keeps the deck above the water even when the old ground is below it', () => {
    const [, bridge] = bridgeReservoirCrossings([road], inWater);
    const surfaceAt = surfaceSampler([bridge], lowGround, RESERVOIR_PROJECTION, inWater);
    const { x, z } = RESERVOIR_PROJECTION.toWorld([-71.795, -37.735]);
    expect(surfaceAt(x, z)).toBeGreaterThan(metersToY(326));
  });

  it('rests points on open water at the water level, not on the reservoir bed', () => {
    const surfaceAt = surfaceSampler([], lowGround, RESERVOIR_PROJECTION, inWater);
    const { x, z } = RESERVOIR_PROJECTION.toWorld([-71.795, -37.73]);
    expect(surfaceAt(x, z)).toBeCloseTo(metersToY(326), 6);
  });
});
