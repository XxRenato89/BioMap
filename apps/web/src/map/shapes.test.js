import { describe, expect, it } from 'vitest';
import { layerShape } from './shapes.js';

describe('shapes', () => {
  it.each([
    ['history', 'circle'],
    ['ecology', 'square'],
    ['tourism', 'diamond'],
    ['energy', 'circle'],
  ])('gives the %s layer a %s', (slug, shape) => {
    expect(layerShape({ slug })).toBe(shape);
  });
});
