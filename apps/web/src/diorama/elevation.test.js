import { describe, expect, it } from 'vitest';
import { decodeElevation, sampleHeights, sourceTileFor, tileUrl } from './elevation.js';

/**
 * Imagen RGBA de `size` × `size` cuyos píxeles codifican (en Terrarium) la
 * altura que devuelve `height(x, y)`, en metros enteros.
 */
function terrariumImage(size, height) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = height(x, y) + 32768;
      const i = (y * size + x) * 4;
      pixels[i] = Math.floor(value / 256);
      pixels[i + 1] = value % 256;
      pixels[i + 2] = 0;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

describe('decodeElevation', () => {
  it('decodes Terrarium and Terrain-RGB pixels', () => {
    expect(decodeElevation(128, 0, 0, 'terrarium')).toBe(0);
    expect(decodeElevation(139, 112, 128, 'terrarium')).toBe(2928.5);
    expect(decodeElevation(1, 134, 160, 'mapbox')).toBeCloseTo(0, 5);
    expect(decodeElevation(1, 247, 175, 'mapbox')).toBeCloseTo(2894.3, 5);
  });
});

describe('sourceTileFor', () => {
  it('uses the same tile up to the maximum zoom', () => {
    expect(sourceTileFor(5, 9, 4, 15)).toEqual({
      z: 4,
      x: 5,
      y: 9,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('crops the ancestor tile beyond the maximum zoom', () => {
    expect(sourceTileFor(7, 2, 17, 15)).toEqual({
      z: 15,
      x: 1,
      y: 0,
      scale: 0.25,
      offsetX: 0.75,
      offsetY: 0.5,
    });
  });
});

describe('sampleHeights', () => {
  it('samples the whole tile corner to corner, north row first', () => {
    const pixels = terrariumImage(4, (x, y) => x * 10 + y * 100);
    const heights = sampleHeights(pixels, 4, { scale: 1, offsetX: 0, offsetY: 0 }, 2, 'terrarium');
    expect([...heights]).toEqual([0, 30, 300, 330]);
  });

  it('interpolates between pixels', () => {
    const pixels = terrariumImage(4, (x) => x * 10);
    const heights = sampleHeights(pixels, 4, { scale: 1, offsetX: 0, offsetY: 0 }, 3, 'terrarium');
    expect(heights[1]).toBeCloseTo(15, 5);
  });

  it('samples only the requested part of an ancestor tile', () => {
    const pixels = terrariumImage(5, (x) => x * 10);
    const region = { scale: 0.5, offsetX: 0.5, offsetY: 0 };
    const heights = sampleHeights(pixels, 5, region, 2, 'terrarium');
    expect([...heights.slice(0, 2)]).toEqual([20, 40]);
  });
});

describe('tileUrl', () => {
  it('fills the template', () => {
    expect(tileUrl('/t/{z}/{x}/{y}.png', { z: 3, x: 1, y: 2 })).toBe('/t/3/1/2.png');
  });
});
