import { describe, expect, it } from 'vitest';
import { isOccluded } from './occlusion.js';

const SIZE = { width: 100, depth: 100 };
/* Una cordillera de 8 unidades de alto a lo largo de x = 0. */
const ridge = (x) => (Math.abs(x) < 2 ? 8 : 0);

describe('isOccluded', () => {
  it('is true when a ridge stands between the camera and the point', () => {
    expect(isOccluded({ x: -30, y: 3, z: 0 }, { x: 30, y: 0.3, z: 0 }, ridge, SIZE)).toBe(true);
  });

  it('is false when the camera looks over the ridge', () => {
    expect(isOccluded({ x: -30, y: 60, z: 0 }, { x: 30, y: 0.3, z: 0 }, ridge, SIZE)).toBe(false);
  });

  it('ignores terrain outside the diorama', () => {
    const wall = () => 50;
    expect(isOccluded({ x: -500, y: 3, z: 0 }, { x: -51, y: 0.3, z: 0 }, wall, SIZE)).toBe(false);
  });
});
