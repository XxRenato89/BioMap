import { describe, expect, it } from 'vitest';
import {
  clampToBounds,
  fitView,
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

describe('fitView', () => {
  const base = { pitch: -48, heading: 0 };
  it('centers on the points and backs off more on a narrow screen', () => {
    const coords = [
      [-71.81, -37.73],
      [-71.79, -37.72],
    ];
    const wide = fitView(coords, { aspect: 1.6, fov: 32, base });
    const narrow = fitView(coords, { aspect: 0.45, fov: 32, base });
    expect(wide.center[0]).toBeCloseTo(-71.8);
    expect(wide.center[1]).toBeCloseTo(-37.725);
    expect(narrow.range).toBeGreaterThan(wide.range);
    expect(narrow.pitch).toBe(-48);
  });

  it('turns the map so a diagonal row of points runs up the screen', () => {
    const coords = [
      [-71.82, -37.74],
      [-71.78, -37.708],
    ];
    const view = fitView(coords, { aspect: 0.45, fov: 32, base, headings: [0, 45, 90, 135] });
    expect(view.heading).toBe(45);
    expect(view.center[0]).toBeCloseTo(-71.8);
    expect(view.center[1]).toBeCloseTo(-37.724);
  });
});
