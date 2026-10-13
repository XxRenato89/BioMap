import { describe, expect, it } from 'vitest';
import { Pathfinder, waterTest } from './pathfinder.js';

/*
 * Un río de norte a sur entre lng -71.8005 y -71.7995 (~90 m de ancho), con
 * caminos en ambas orillas que llegan hasta la ribera.
 */
const RIVER = [
  {
    outer: [
      [-71.8005, -37.69],
      [-71.7995, -37.69],
      [-71.7995, -37.72],
      [-71.8005, -37.72],
    ],
  },
];
const WEST = {
  line: [
    [-71.81, -37.7],
    [-71.8006, -37.7],
  ],
};
const EAST = {
  line: [
    [-71.7994, -37.7],
    [-71.79, -37.7],
  ],
};
const crossing = (extra = {}) => ({
  line: [
    [-71.8006, -37.7],
    [-71.7994, -37.7],
  ],
  ...extra,
});

describe('Pathfinder', () => {
  it('finds a path along a road, ending exactly at the requested points', () => {
    const pf = new Pathfinder([
      {
        line: [
          [-71.8, -37.7],
          [-71.801, -37.701],
          [-71.802, -37.702],
        ],
      },
    ]);
    const path = pf.findPath([-71.8, -37.7], [-71.802, -37.702]);
    expect(path[0]).toEqual([-71.8, -37.7]);
    expect(path.at(-1)).toEqual([-71.802, -37.702]);
  });

  it('crosses a river only over a bridge', () => {
    const water = RIVER;
    const withBridge = new Pathfinder([WEST, EAST, crossing({ bridge: true })], { water });
    expect(withBridge.findPath([-71.81, -37.7], [-71.79, -37.7])).not.toBeNull();

    const roadNoBridge = new Pathfinder([WEST, EAST, crossing()], { water });
    expect(roadNoBridge.findPath([-71.81, -37.7], [-71.79, -37.7])).toBeNull();
  });

  it('never snaps a point to a road across the water', () => {
    const pf = new Pathfinder([EAST], { water: RIVER });
    /* El punto está en la orilla oeste; el único camino, en la este. */
    expect(pf.findPath([-71.8007, -37.7], [-71.79, -37.7])).toBeNull();
  });

  it('joins road ends a few metres apart', () => {
    const pf = new Pathfinder([
      {
        line: [
          [-71.8, -37.7],
          [-71.79, -37.7],
        ],
      },
      {
        line: [
          [-71.79005, -37.7],
          [-71.78, -37.7],
        ],
      },
    ]);
    expect(pf.findPath([-71.8, -37.7], [-71.78, -37.7])).not.toBeNull();
  });

  it('returns null when the roads are not connected', () => {
    const pf = new Pathfinder([
      {
        line: [
          [-71.8, -37.7],
          [-71.801, -37.701],
        ],
      },
      {
        line: [
          [-71.85, -37.75],
          [-71.851, -37.751],
        ],
      },
    ]);
    expect(pf.findPath([-71.8, -37.7], [-71.851, -37.751])).toBeNull();
  });

  it('tells water from land, holes included', () => {
    const inWater = waterTest([
      {
        ...RIVER[0],
        holes: [
          [
            [-71.8002, -37.7],
            [-71.7998, -37.7],
            [-71.7998, -37.701],
            [-71.8002, -37.701],
          ],
        ],
      },
    ]);
    expect(inWater([-71.8, -37.695])).toBe(true);
    expect(inWater([-71.8, -37.7005])).toBe(false);
    expect(inWater([-71.81, -37.695])).toBe(false);
  });
});
