import { describe, expect, it } from 'vitest';
import { buildDamWall, plantationSpecies, plantForest, plantFringe, treeKind } from './builders.js';
import { LANDCOVER } from './landcover.js';
import { createHeightSampler, createProjection } from './projection.js';

const META = { columns: 64, rows: 48 };
const PROJECTION = createProjection([
  [-72, -37.8],
  [-71.9, -37.72],
]);
const HEIGHTS = new Uint16Array(META.columns * META.rows).fill(400);
const cover = (cls) => ({ data: new Uint8Array(32 * 24).fill(cls), columns: 32, rows: 24 });

describe('treeKind', () => {
  it.each([
    [500, 10, 'plantation'],
    [1200, 10, 'native'],
    [500, 30, 'native'],
  ])('a tree at %i m on a %i° slope is %s', (meters, slope, kind) => {
    expect(treeKind(meters, slope)).toBe(kind);
  });
});

describe('plantForest', () => {
  const area = { center: [0, 0], radius: 0.6, spacing: 0.03, max: 5000 };

  it('plants nothing outside tree or shrub cover', () => {
    const forest = plantForest(META, HEIGHTS, PROJECTION, cover(LANDCOVER.grassland), area);
    expect(forest.native.count + forest.pine.count + forest.eucalyptus.count).toBe(0);
  });

  it('plants real-size trees on tree cover, always in the same place', () => {
    const first = plantForest(META, HEIGHTS, PROJECTION, cover(LANDCOVER.tree), area);
    const planted = first.pine.count + first.eucalyptus.count;
    expect(planted).toBeGreaterThan(100);
    /* Terreno plano a 400 m: todo es plantación (pino o eucalipto), nada de nativo. */
    expect(first.native.count).toBe(0);
    /* La escala vertical de la matriz (índice 5) es el alto en km: árboles de menos de 45 m. */
    expect(first.pine.matrices[5]).toBeLessThan(0.045);
    const again = plantForest(META, HEIGHTS, PROJECTION, cover(LANDCOVER.tree), area);
    expect(Array.from(again.pine.matrices.slice(0, 16))).toEqual(
      Array.from(first.pine.matrices.slice(0, 16)),
    );
  });

  it('never plants on blocked cells (water)', () => {
    const forest = plantForest(META, HEIGHTS, PROJECTION, cover(LANDCOVER.tree), {
      ...area,
      blocked: () => true,
    });
    expect(forest.native.count + forest.pine.count + forest.eucalyptus.count).toBe(0);
  });

  it('groups plantations into stands of a single species', () => {
    const near = [0, 0.01, 0.02].map((dx) => plantationSpecies(dx, 0));
    expect(new Set(near).size).toBe(1);
  });
});

describe('buildDamWall', () => {
  it('builds a wall whose crest is at least as high as both ends of the line', () => {
    const valley = new Uint16Array(META.columns * META.rows);
    for (let row = 0; row < META.rows; row += 1)
      for (let col = 0; col < META.columns; col += 1)
        valley[row * META.columns + col] = 300 + Math.abs(col - 32) * 20;
    const heightAt = createHeightSampler(META, valley, PROJECTION);
    const line = [
      [-71.99, -37.76],
      [-71.91, -37.76],
    ];
    const geometry = buildDamWall(line, heightAt, PROJECTION);
    const ys = geometry.getAttribute('position').array.filter((_, k) => k % 3 === 1);
    const ends = line.map((point) => {
      const { x, z } = PROJECTION.toWorld(point);
      return heightAt(x, z);
    });
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(Math.max(...ends));
    expect(Math.min(...ys)).toBeLessThan(Math.min(...ends));
    expect(geometry.getAttribute('normal')).toBeDefined();
  });

  it('raises a closed dam outline to its real height above the riverbed', () => {
    const heightAt = createHeightSampler(META, HEIGHTS, PROJECTION);
    const ring = [
      [-71.97, -37.77],
      [-71.95, -37.77],
      [-71.95, -37.76],
      [-71.97, -37.76],
      [-71.97, -37.77],
    ];
    const geometry = buildDamWall(ring, heightAt, PROJECTION, 155);
    const ys = geometry.getAttribute('position').array.filter((_, k) => k % 3 === 1);
    /* Coronamiento a 155 m sobre el cauce, más la baranda de 1,1 m. */
    expect(Math.max(...ys)).toBeCloseTo(0.4 + 0.155 + 0.0011, 5);
  });
});

describe('plantFringe', () => {
  it('plants only outside the zone, thinner the farther from it', () => {
    const zone = { width: 2, depth: 2 };
    const forest = plantFringe(
      zone,
      () => 0.4,
      () => LANDCOVER.tree,
      {
        band: 1,
        spacing: 0.02,
        max: 50_000,
      },
    );
    const xs = [];
    for (const kind of Object.keys(forest)) {
      const { matrices, count } = forest[kind];
      for (let k = 0; k < count; k += 1) xs.push([matrices[k * 16 + 12], matrices[k * 16 + 14]]);
    }
    expect(xs.length).toBeGreaterThan(100);
    expect(xs.every(([x, z]) => Math.abs(x) > 1 || Math.abs(z) > 1)).toBe(true);
    const near = xs.filter(([x]) => x > 1 && x < 1.3).length;
    const far = xs.filter(([x]) => x > 1.7 && x < 2).length;
    expect(near).toBeGreaterThan(far * 2);
  });
});
