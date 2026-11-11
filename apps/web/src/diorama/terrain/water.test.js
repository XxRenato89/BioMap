import { describe, expect, it } from 'vitest';
import { bakeRipples, blendShore } from './water.js';

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

describe('bakeRipples', () => {
  const size = 32;
  const pixels = bakeRipples(size);
  const at = (x, y) => pixels[(y * size + x) * 4];

  it('is the same on every load and uses the whole range around flat (128)', () => {
    expect(pixels).toEqual(bakeRipples(size));
    const reds = Array.from({ length: size * size }, (_, i) => pixels[i * 4]);
    expect(Math.min(...reds)).toBeLessThan(40);
    expect(Math.max(...reds)).toBeGreaterThan(215);
    const mean = reds.reduce((sum, value) => sum + value, 0) / reds.length;
    expect(Math.abs(mean - 128)).toBeLessThan(3);
  });

  it('tiles without a seam: the jump across the edge is like any other step', () => {
    let inside = 0;
    let seam = 0;
    for (let y = 0; y < size; y += 1) {
      seam += Math.abs(at(0, y) - at(size - 1, y));
      inside += Math.abs(at(size / 2, y) - at(size / 2 - 1, y));
    }
    expect(seam).toBeLessThan(inside * 2);
  });
});
