import { describe, expect, it } from 'vitest';
import { buildChunk, buildTerrainChunks, chooseStep, chunkGrid, SKIRT_DEPTH } from './lod.js';
import { metersToY } from './projection.js';

const META = { columns: 65, rows: 49 };
const PROJECTION = { width: 6.4, depth: 4.8 };
const HEIGHTS = new Uint16Array(META.columns * META.rows).fill(1000);
const VIEW = { projectionScale: 1000, cellKm: 0.1, finestStep: 1, maxErrorPx: 2 };

describe('chunkGrid', () => {
  it('splits the grid into chunks that share their borders', () => {
    const chunks = chunkGrid(META, HEIGHTS, PROJECTION, [4, 3]);
    expect(chunks).toHaveLength(12);
    expect(chunks[0]).toMatchObject({ col0: 0, row0: 0 });
    expect(chunks[1].col0).toBe(chunks[0].col1);
    expect(chunks.at(-1)).toMatchObject({ col1: 64, row1: 48 });
    expect(chunks[0].radius).toBeGreaterThan(0);
  });
});

describe('chooseStep', () => {
  const chunk = { center: [0, 0, 0], radius: 1 };

  it('uses the full detail up close and the coarsest far away', () => {
    expect(chooseStep(chunk, [0, 0, 1.5], VIEW)).toBe(1);
    expect(chooseStep(chunk, [0, 0, 5000], VIEW)).toBe(16);
  });

  it('never goes finer than the tier allows', () => {
    expect(chooseStep(chunk, [0, 0, 1.5], { ...VIEW, finestStep: 2 })).toBe(2);
  });
});

describe('buildChunk', () => {
  it('has one vertex per sampled point plus a skirt along the border', () => {
    const [chunk] = chunkGrid(META, HEIGHTS, PROJECTION, [4, 3]);
    const geometry = buildChunk(META, HEIGHTS, PROJECTION, chunk, 4);
    const w = Math.ceil((chunk.col1 - chunk.col0) / 4) + 1;
    const h = Math.ceil((chunk.row1 - chunk.row0) / 4) + 1;
    const border = 2 * w + 2 * h - 4;
    expect(geometry.getAttribute('position').count).toBe(w * h + border);
    const ys = geometry.getAttribute('position').array.filter((_, k) => k % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(metersToY(1000) - SKIRT_DEPTH, 5);
    expect(geometry.boundingSphere).not.toBeNull();
  });
});

describe('buildTerrainChunks', () => {
  it('builds an array of chunk geometries for the whole grid', () => {
    const geometries = buildTerrainChunks(META, HEIGHTS, PROJECTION, { step: 4, chunks: [2, 2] });
    expect(geometries).toHaveLength(4);
    expect(geometries[0].getAttribute('position')).toBeDefined();
  });
});
