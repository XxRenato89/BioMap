import { describe, expect, it } from 'vitest';
import {
  clampToBounds,
  isInside,
  levelForRange,
  normalizeHeading,
  rangeForZoom,
  zoomForRange,
} from './cameraMath.js';

const BOUNDS = [
  [-72.6, -38.1],
  [-71.2, -37.3],
];
const LEVELS = { region: 95_000, zone: 30_000, detail: 7_000 };

describe('cameraMath', () => {
  it('converts between camera distance and web-map zoom', () => {
    expect(zoomForRange(rangeForZoom(11))).toBeCloseTo(11, 10);
    expect(rangeForZoom(1)).toBe(rangeForZoom(0) / 2);
    expect(zoomForRange(0)).toBeGreaterThan(20);
  });

  it('picks the nearest named level', () => {
    expect(levelForRange(120_000, LEVELS)).toBe('region');
    expect(levelForRange(40_000, LEVELS)).toBe('zone');
    expect(levelForRange(12_000, LEVELS)).toBe('detail');
    expect(levelForRange(2_000, LEVELS)).toBe('detail');
  });

  it('checks and clamps points against the territory bounds', () => {
    expect(isInside([-71.83, -37.68], BOUNDS)).toBe(true);
    expect(isInside([-70, -37.68], BOUNDS)).toBe(false);
    expect(clampToBounds([-70, -39], BOUNDS)).toEqual([-71.2, -38.1]);
    expect(clampToBounds([-71.83, -37.68], BOUNDS)).toEqual([-71.83, -37.68]);
  });

  it('normalizes headings', () => {
    expect(normalizeHeading(-30)).toBe(330);
    expect(normalizeHeading(400)).toBe(40);
  });
});
