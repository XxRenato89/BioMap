import { describe, expect, it } from 'vitest';
import { BOAT_ROUTE } from './QuibarBoat.jsx';
import waterPolygons from '../../data/water.json';
import { waterTest } from '../utils/pathfinder.js';

describe('QuibarBoat', () => {
  it('has a valid navigation route in water', () => {
    expect(BOAT_ROUTE.length).toBeGreaterThanOrEqual(4);
    const inWater = waterTest(waterPolygons);
    for (const waypoint of BOAT_ROUTE) {
      expect(inWater(waypoint)).toBe(true);
    }
  });
});
