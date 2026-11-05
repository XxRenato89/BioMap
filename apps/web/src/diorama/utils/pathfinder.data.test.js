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

  /* Sobre el agua solo se camina por puentes: nunca a nado ni por caminos sumergidos. */
  const inWater = waterTest(water);
  const bridges = roads.filter((road) => road.bridge).map((road) => road.line);
  const nearBridge = (p) =>
    bridges.some((line) =>
      line.some((q, k) => {
        if (k === 0) return false;
        const [a, b] = [line[k - 1], q];
        const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
        const t = Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)),
        );
        return distanceKm(p, [a[0] + dx * t, a[1] + dy * t]) < 0.015;
      }),
    );
  it.each(points.map((p) => [p.properties.name, p]))(
    'walks to %s and back without crossing water off a bridge',
    (_, point) => {
      /* Como en el visor: la vuelta parte donde terminó la ida (en tierra), no del pin. */
      const there = pf.findPath(home.geometry.coordinates, point.geometry.coordinates);
      const back = pf.findPath(there.at(-1), home.geometry.coordinates);
      const path = [...there, ...back];
      const wet = [];
      for (let k = 1; k < path.length; k += 1) {
        const [a, b] = [path[k - 1], path[k]];
        if (distanceKm(a, b) === 0) continue;
        const parts = Math.max(1, Math.ceil(distanceKm(a, b) / 0.005));
        for (let i = 0; i < parts; i += 1) {
          const t = (i + 0.5) / parts;
          const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          if (inWater(p) && !nearBridge(p)) wet.push(p);
        }
      }
      /* Hasta ~10 m de ida y ~10 m de vuelta (muestras de 5 m): el pie de una playa. */
      expect(wet.length).toBeLessThanOrEqual(4);
    },
  );
});
