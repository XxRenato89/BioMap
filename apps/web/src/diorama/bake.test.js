import { describe, expect, it } from 'vitest';
import { ambientOcclusion, bakeSurface, hillshade } from './bake.js';

const N = 24;
const CELL = 0.03;
const grid = (height) => {
  const heights = new Uint16Array(N * N);
  for (let row = 0; row < N; row += 1)
    for (let col = 0; col < N; col += 1) heights[row * N + col] = height(col, row);
  return heights;
};
const center = (values) => values[(N / 2) * N + N / 2];

describe('hillshade', () => {
  it('is uniform on flat ground', () => {
    const shade = hillshade(
      grid(() => 500),
      N,
      N,
      CELL,
      CELL,
    );
    expect(Math.max(...shade) - Math.min(...shade)).toBeLessThan(1e-6);
  });

  it('lights slopes facing north-west more than slopes facing south-east', () => {
    /* Sube hacia el sureste: la ladera mira al noroeste, hacia la luz. */
    const towardLight = hillshade(
      grid((c, r) => 300 + (c + r) * 20),
      N,
      N,
      CELL,
      CELL,
    );
    const awayFromLight = hillshade(
      grid((c, r) => 1500 - (c + r) * 20),
      N,
      N,
      CELL,
      CELL,
    );
    expect(center(towardLight)).toBeGreaterThan(center(awayFromLight));
  });
});

describe('ambientOcclusion', () => {
  const options = { radiusKm: 0.3, directions: 8, scale: 2 };

  it('is fully open on flat ground', () => {
    const ao = ambientOcclusion(
      grid(() => 500),
      N,
      N,
      CELL,
      CELL,
      options,
    );
    expect(Math.min(...ao)).toBeCloseTo(1, 5);
  });

  it('darkens the bottom of a pit', () => {
    const pit = grid((c, r) => 400 + Math.hypot(c - N / 2, r - N / 2) * 60);
    const ao = ambientOcclusion(pit, N, N, CELL, CELL, options);
    expect(center(ao)).toBeLessThan(0.9);
  });
});

describe('bakeSurface', () => {
  it('returns RGB colour and normal images of the grid size', () => {
    const meta = { columns: N, rows: N, widthKm: CELL * (N - 1), depthKm: CELL * (N - 1) };
    const { color, normal } = bakeSurface(
      meta,
      grid(() => 500),
      null,
      {
        ao: { radiusKm: 0.3, directions: 4, scale: 2 },
      },
    );
    expect(color).toHaveLength(N * N * 3);
    expect(normal).toHaveLength(N * N * 3);
    /* En terreno plano la normal apunta hacia arriba: (0, 1, 0) → (128, 255, 128). */
    expect([...normal.slice(0, 3)]).toEqual([128, 255, 128]);
  });
});
