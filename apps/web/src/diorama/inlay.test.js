import { describe, expect, it } from 'vitest';
import { densifyRing, inlayWater, shoreDistance, shoreLevels } from './inlay.js';

const GRID = { bounds: { west: 0, south: 0, east: 0.01, north: 0.01 }, columns: 11, rows: 11 };
const square = (level) => [
  [0.003, 0.003, level],
  [0.007, 0.003, level],
  [0.007, 0.007, level],
  [0.003, 0.007, level],
  [0.003, 0.003, level],
];

describe('densifyRing', () => {
  it('splits long edges so no step is longer than asked', () => {
    const ring = densifyRing(
      [
        [0, 0],
        [0.01, 0],
      ],
      0.1,
    );
    expect(ring.length).toBeGreaterThan(10);
    expect(ring.at(-1)).toEqual([0.01, 0]);
  });
});

describe('shoreLevels', () => {
  it('ignores the few shore points that the coarse relief puts too high', () => {
    const points = Array.from({ length: 20 }, (_, k) => [k * 0.0001, 0]);
    const levels = shoreLevels(points, ([lng]) => (lng > 0.0015 ? 360 : 318), { neighbors: 20 });
    expect(levels.every((level) => level === 318)).toBe(true);
  });
});

describe('inlayWater', () => {
  it('carves the bed under the water level and raises low banks above it', () => {
    const heights = new Uint16Array(121).fill(300);
    heights[5 * 11 + 5] = 340; // un cerro seco del cañón, bajo el agua
    heights[5 * 11 + 2] = 290; // orilla más baja que el agua, junto a ella
    heights[5 * 11 + 1] = 290; // y una celda más allá
    const { carved, mask } = inlayWater(GRID, heights, [{ outer: square(318), holes: [] }], {
      carve: 2,
      bank: 1,
      bankCells: 2,
    });
    expect(carved).toBeGreaterThan(0);
    expect(mask[5 * 11 + 5]).toBe(1);
    expect(heights[5 * 11 + 5]).toBe(316);
    expect(heights[5 * 11 + 2]).toBe(319);
    /* Rampa: a dos celdas del agua queda a medio camino entre el terreno y la orilla. */
    expect(heights[5 * 11 + 1]).toBe(305);
    expect(heights[0]).toBe(300);
  });
});

describe('shoreDistance', () => {
  it('grows from the shore towards the middle of the water', () => {
    const mask = new Uint8Array(7 * 7);
    for (let r = 1; r < 6; r += 1) for (let c = 1; c < 6; c += 1) mask[r * 7 + c] = 1;
    const meters = shoreDistance(mask, 7, 7, 10);
    expect(meters[0]).toBe(0);
    expect(meters[1 * 7 + 1]).toBe(10);
    expect(meters[3 * 7 + 3]).toBe(30);
  });
});
