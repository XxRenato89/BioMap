import { describe, expect, it } from 'vitest';
import { TREE_KINDS, TREE_MODELS } from './trees.js';

const triangles = (geometry) => geometry.getAttribute('position').count / 3;

describe('TREE_MODELS', () => {
  it.each(TREE_KINDS)(
    '%s: both models stand on the ground, 1 unit tall, with foliage marks',
    (kind) => {
      for (const geometry of Object.values(TREE_MODELS[kind])) {
        geometry.computeBoundingBox();
        expect(geometry.boundingBox.max.y).toBeCloseTo(1, 5);
        expect(geometry.boundingBox.min.y).toBeCloseTo(0, 5);
        const foliage = geometry.getAttribute('foliage').array;
        expect(foliage).toContain(0);
        expect(foliage).toContain(1);
        expect(geometry.getAttribute('color').itemSize).toBe(3);
      }
    },
  );

  it.each(TREE_KINDS)('%s: the close-up model is richer but stays within budget', (kind) => {
    const { detailed, simple } = TREE_MODELS[kind];
    expect(triangles(detailed)).toBeGreaterThan(triangles(simple) * 2);
    expect(triangles(detailed)).toBeLessThan(400);
    expect(triangles(simple)).toBeLessThanOrEqual(48);
  });
});
