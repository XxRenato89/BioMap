import { describe, expect, it } from 'vitest';
import { placeModels } from './placement.js';

const flat = { heightAt: () => 0, isWater: () => false };

describe('placeModels', () => {
  it('keeps a model on its point when the ground is flat and free', () => {
    const spots = placeModels([{ id: 1, x: 0, z: 0, radius: 0.1 }], flat);
    expect(spots.get(1)).toEqual({ x: 0, y: 0, z: 0, scale: 1 });
  });

  it('moves a model off the water and rests it on the lowest ground of its footprint', () => {
    const ground = { heightAt: (x) => x * 0.05, isWater: (x) => x < 0.05 };
    const spot = placeModels([{ id: 1, x: 0, z: 0, radius: 0.1 }], ground).get(1);
    expect(spot.x - 0.1 * 0.95 * spot.scale).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(spot.y).toBeCloseTo((spot.x - 0.1 * 0.95 * spot.scale) * 0.05, 6);
  });

  it('never lets two models overlap', () => {
    const items = [
      { id: 1, x: 0, z: 0, radius: 0.2 },
      { id: 2, x: 0.25, z: 0, radius: 0.15 },
      { id: 3, x: 0, z: 0.25, radius: 0.1 },
    ];
    const spots = [...placeModels(items, flat).entries()];
    expect(spots).toHaveLength(3);
    for (const [idA, a] of spots) {
      for (const [idB, b] of spots) {
        if (idA >= idB) continue;
        const ra = items.find((i) => i.id === idA).radius * a.scale;
        const rb = items.find((i) => i.id === idB).radius * b.scale;
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(ra + rb - 1e-9);
      }
    }
  });

  it('leaves out a model with nowhere to stand', () => {
    const steep = { heightAt: (x) => x * 10, isWater: () => false };
    expect(placeModels([{ id: 1, x: 0, z: 0, radius: 0.1 }], steep).size).toBe(0);
  });
});
