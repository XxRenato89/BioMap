import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRESA_ANGOSTURA_COORDINATES as ANGOSTURA } from '../../data/damCoordinates.js';
import { bridgeReservoirCrossings } from '../terrain/roads.js';
import { distanceKm, Pathfinder, waterTest } from './pathfinder.js';

/*
 * Con los caminos, el agua y los puntos reales: la mascota llega a todos los
 * lugares desde el Centro de Visitantes, y de vuelta, sin quedar atrapada.
 */
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const landmarks = read('../../../public/diorama/landmarks.json');
const water = read('../../../public/diorama/water.json');
const points = read('../../../public/mock/points.json').features;

describe('mascot routes over the real diorama data', () => {
  const roads = bridgeReservoirCrossings(
    [...landmarks.roads, { kind: 'service', line: ANGOSTURA.powerhouseRoad }],
    waterTest(water),
  );
  const pf = new Pathfinder(roads, { water });
  const home = points.find((p) => p.properties.name.includes('Centro de Visitantes'));

  it.each(points.map((p) => [p.properties.name, p]))('reaches %s and comes back', (_, point) => {
    const there = pf.findPath(home.geometry.coordinates, point.geometry.coordinates);
    expect(there).not.toBeNull();
    /* Termina en el lugar o en el camino más cercano: nunca a campo traviesa. */
    const stop = there.at(-1);
    expect(distanceKm(there.at(-2), stop)).toBeLessThanOrEqual(0.15);
    expect(pf.findPath(stop, home.geometry.coordinates)).not.toBeNull();
  });
});
