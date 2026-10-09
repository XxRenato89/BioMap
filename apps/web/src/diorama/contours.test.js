import { describe, expect, it } from 'vitest';
import { contourSteps } from './resources.js';

describe('contourSteps', () => {
  it('picks a round spacing that gives about 40 fine contours, and majors every five', () => {
    expect(contourSteps(261, 632)).toEqual({ fine: 10, major: 50 });
    expect(contourSteps(52, 3523)).toEqual({ fine: 100, major: 500 });
  });
});
