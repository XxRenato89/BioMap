import { Group } from 'three';
import { box, concreteDark, cyl, dark, stone, wood } from './materials.js';

/**
 * Puente colgante de madera con torres de piedra y cables.
 *
 * @returns {Group}
 */
export function buildBridge() {
  const g = new Group();
  const half = 7;
  const y = 1.5;
  g.add(box(half * 2, 0.2, 1.2, wood(), 0, y, 0));
  [-1, 1].forEach((side) => {
    g.add(box(1.5, 3.2, 1.9, stone(), side * half, y - 1.5 + 1.6, 0));
    [-0.55, 0.55].forEach((o) =>
      g.add(box(0.3, 2.9, 0.3, concreteDark(), side * (half - 1), y + 1.45, o)),
    );
    g.add(box(0.3, 0.3, 1.4, concreteDark(), side * (half - 1), y + 2.85, 0));
  });
  [-0.55, 0.55].forEach((o) => {
    for (let k = 0; k <= 12; k += 1) {
      const t = k / 12;
      const x = (t * 2 - 1) * (half - 1);
      const sag = y + 2.85 - 4.3 * (1 - Math.pow(2 * t - 1, 2));
      g.add(cyl(0.05, 0.05, 1.2, 4, dark(), x, sag, o));
    }
  });
  return g;
}
