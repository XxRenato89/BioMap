import { Group, IcosahedronGeometry } from 'three';
import { cyl, mat, part, seeded, trunk } from './materials.js';

/**
 * Araucaria: tronco alto y copa en paraguas.
 */
function araucaria(g, x, z, s) {
  g.add(cyl(0.13 * s, 0.2 * s, 2.7 * s, 6, trunk(), x, 1.3 * s, z));
  g.add(cyl(1.15 * s, 0.25 * s, 0.55 * s, 9, mat('arau', 0x2f5b3b), x, 2.85 * s, z));
  g.add(cyl(0.8 * s, 0.2 * s, 0.4 * s, 9, mat('arau', 0x2f5b3b), x, 2.2 * s, z));
}

/**
 * Bosquete de araucarias milenarias.
 *
 * @returns {Group}
 */
export function buildAraucarias() {
  const g = new Group();
  [
    [0, 0, 1.25],
    [-2.1, 1.3, 0.95],
    [1.9, 1.6, 1],
    [-0.6, -2.2, 0.8],
    [2.5, -1.4, 0.85],
  ].forEach(([x, z, s]) => araucaria(g, x, z, s));
  return g;
}

/**
 * Lengas de otoño: copas rojas y naranjas.
 *
 * @returns {Group}
 */
export function buildLengas() {
  const g = new Group();
  const random = seeded(23);
  const colors = [0xd0602e, 0xe38b2c, 0xb8432b, 0xe8a23a];
  for (let k = 0; k < 11; k += 1) {
    const a = random() * 6.28;
    const r = random() * 3.4;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const s = 0.8 + random() * 0.7;
    const c = colors[k % 4];
    g.add(cyl(0.09 * s, 0.14 * s, 1.6 * s, 5, mat('lengaTrunk', 0x5b4634), x, 0.8 * s, z));
    g.add(part(new IcosahedronGeometry(0.9 * s, 0), mat(`lenga${c}`, c), x, 2 * s, z));
    g.add(
      part(
        new IcosahedronGeometry(0.62 * s, 0),
        mat(`lenga${c}`, c),
        x + 0.3 * s,
        2.7 * s,
        z + 0.1 * s,
      ),
    );
  }
  return g;
}
