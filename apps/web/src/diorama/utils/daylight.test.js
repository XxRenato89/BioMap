import { describe, expect, it } from 'vitest';
import { daylightAt, kioskHour } from './daylight.js';

describe('daylight', () => {
  it('puts the sun high at noon and low at dusk, always above the horizon', () => {
    const noon = daylightAt(12);
    const dusk = daylightAt(20.5);
    expect(noon.sun[1]).toBeGreaterThan(dusk.sun[1]);
    for (let hour = 0; hour <= 24; hour += 0.5) expect(daylightAt(hour).sun[1]).toBeGreaterThan(0);
  });

  it('changes smoothly between key hours', () => {
    const before = daylightAt(13.99).sunIntensity;
    const after = daylightAt(14.01).sunIntensity;
    expect(Math.abs(before - after)).toBeLessThan(0.01);
  });

  it('uses the clock, a ?hora= override, and a soft afternoon outside opening hours', () => {
    expect(kioskHour(new Date(2026, 9, 13, 10, 30), '')).toBeCloseTo(10.5);
    expect(kioskHour(new Date(2026, 9, 13, 10, 30), '?hora=19')).toBe(19);
    expect(kioskHour(new Date(2026, 9, 13, 2, 0), '')).toBe(17);
  });
});
