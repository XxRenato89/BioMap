import { Group } from 'three';
import { box, cyl, mat, prism, wood } from './materials.js';

/**
 * Inicio de sendero de un parque: arco de troncos con su letrero, un panel
 * con techito y los postes que marcan la huella.
 *
 * @returns {Group}
 */
export function buildTrailhead() {
  const g = new Group();
  g.add(box(4, 0.1, 5, mat('trail', 0xb59a6e), 0, 0.05, 0));
  /* Arco de entrada. */
  [-1.1, 1.1].forEach((x) => g.add(cyl(0.16, 0.18, 2.8, 7, wood(), x, 1.45, 1.2)));
  g.add(box(2.8, 0.22, 0.26, wood(), 0, 2.85, 1.2));
  g.add(box(1.8, 0.5, 0.08, mat('signGreen', 0x2f5d43), 0, 2.4, 1.32));
  /* Panel informativo con techo. */
  g.add(cyl(0.06, 0.06, 1.6, 5, wood(), 1.9, 0.8, -0.6));
  g.add(cyl(0.06, 0.06, 1.6, 5, wood(), 2.9, 0.8, -0.6));
  g.add(box(1.1, 0.75, 0.05, mat('panel', 0xe9dfc4), 2.4, 1.25, -0.6));
  const roof = prism(1.4, 0.5, mat('roofRed', 0x9b3d2c), 2.4, 1.6, -0.6);
  roof.rotation.y = Math.PI / 2;
  g.add(roof);
  /* Balizas del sendero. */
  [
    [-0.6, -1],
    [0.4, -2],
    [-0.2, -3.2],
  ].forEach(([x, z]) => {
    g.add(cyl(0.07, 0.07, 0.9, 5, wood(), x, 0.45, z));
    g.add(box(0.16, 0.16, 0.16, mat('trailMark', 0xe0813a), x, 0.95, z));
  });
  return g;
}
