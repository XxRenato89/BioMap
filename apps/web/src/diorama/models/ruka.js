import { Group } from 'three';
import { box, cone, cyl, dark, thatch, wood } from './materials.js';

/**
 * Ruka mapuche: base de madera y techo de paja cónico.
 */
function ruka(g, ox, oz, s) {
  g.add(cyl(0.78 * s, 0.82 * s, 0.55 * s, 10, wood(), ox, 0.27 * s, oz));
  g.add(cone(1.05 * s, 1.05 * s, 10, thatch(), ox, 1.05 * s, oz));
  g.add(box(0.3 * s, 0.42 * s, 0.05, dark(), ox, 0.24 * s, oz + 0.8 * s));
}

/**
 * Conjunto de rukas tradicionales.
 *
 * @returns {Group}
 */
export function buildRuka() {
  const g = new Group();
  ruka(g, 0, 0, 1.4);
  ruka(g, -2.6, 1.8, 1.1);
  ruka(g, 2.4, 2.1, 1.0);
  return g;
}
