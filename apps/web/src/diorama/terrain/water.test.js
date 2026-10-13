import { describe, expect, it } from 'vitest';
import { blendShore } from './water.js';

describe('blendShore', () => {
  /* Una fila: agua a 326 m en las 3 primeras celdas y tierra después. */
  const meta = { columns: 16, rows: 1 };
  const shore = new Uint8Array(16).fill(0, 3).fill(1, 0, 3);
  const levels = new Float32Array(16).fill(326, 0, 3);

  it('raises land left below the water up to its level at the shore', () => {
    const heights = new Uint16Array(16).fill(316);
    blendShore(meta, heights, shore, levels, 10);
    expect(heights[3]).toBe(326);
    expect(heights[13]).toBe(316);
  });

  it('lowers a bank that stood like a wall, gently', () => {
    const heights = new Uint16Array(16).fill(346);
    blendShore(meta, heights, shore, levels, 10);
    expect(heights[3]).toBe(326);
    for (let k = 4; k < 14; k += 1) expect(heights[k]).toBeGreaterThanOrEqual(heights[k - 1]);
    expect(heights[14]).toBe(346);
  });
});
