import { describe, expect, it } from 'vitest';
import { cliffEdge, placeModels, shoreSpot } from './placement.js';

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

describe('cliffEdge', () => {
  it('finds the brink between a point and the nearest water, facing the water', () => {
    /* Meseta plana hasta x = 0.1, barranco hasta el agua en x ≥ 0.15. */
    const heightAt = (x) => (x < 0.1 ? 0.4 : 0.4 - (x - 0.1) * 2);
    const isWater = (x) => x >= 0.15;
    const edge = cliffEdge(0, 0, { heightAt, isWater });
    expect(edge.x).toBeGreaterThan(0.09);
    expect(edge.x).toBeLessThan(0.11);
    expect(Math.sin(edge.angle)).toBeCloseTo(1);
    expect(cliffEdge(0, 0, { heightAt, isWater: () => false })).toBeNull();
  });
});

describe('shoreSpot', () => {
  /* Agua al este de x = 1 (plano). */
  const ground = { heightAt: () => 0, isWater: (x) => x > 1 };

  it('moves a shore model from its inland point to the water, facing it', () => {
    const spot = shoreSpot(0.8, 0, 0.1, ground);
    expect(spot.angle).toBeCloseTo(Math.PI / 2, 5);
    /* Su centro queda a 0,7 radios de la orilla, en tierra. */
    expect(spot.x).toBeCloseTo(1 - 0.07, 1);
    expect(ground.isWater(spot.x, spot.z)).toBe(false);
  });

  it('returns null with no water nearby', () => {
    expect(shoreSpot(0, 0, 0.1, { heightAt: () => 0, isWater: () => false })).toBeNull();
  });
});
