import { Group } from 'three';
import { box, concreteDark, cyl, dark, glass, mat, teal, white } from './materials.js';

/**
 * Centro de visitantes con estacionamiento y bandera.
 *
 * @returns {Group}
 */
export function buildVisitorCenter() {
  const g = new Group();
  g.add(box(5.4, 0.8, 3.8, concreteDark(), 0, 0.4, 0));
  g.add(box(4.5, 1.3, 2.6, white(), 0, 1.45, -0.2));
  const roof = box(5.2, 0.2, 3.3, teal(), 0, 2.2, -0.2);
  roof.rotation.z = -0.07;
  g.add(roof);
  g.add(box(3.7, 0.8, 0.05, glass(), 0, 1.45, 1.12));
  g.add(box(1.1, 1.2, 0.9, mat('wood2', 0xb98b5a), 1.9, 1.4, 1.1));
  g.add(box(3.4, 0.04, 2.2, dark(), -3.4, 0.82, 2.4));
  [
    [-4.1, 2.1, 0xc0392b],
    [-3.2, 2.7, 0x2c6aa0],
    [-2.6, 2.1, 0xe0b341],
  ].forEach(([x, z, c]) => g.add(box(0.9, 0.34, 0.42, mat(`car${c}`, c), x, 1.02, z)));
  g.add(cyl(0.04, 0.04, 2.6, 6, white(), 2.5, 2.1, 2.2));
  g.add(box(0.8, 0.5, 0.03, mat('flag', 0xef7b5d), 2.9, 3.1, 2.2));
  return g;
}
