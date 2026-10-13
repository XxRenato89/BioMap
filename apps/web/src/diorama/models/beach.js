import { Group, SphereGeometry } from 'three';
import { box, cone, cyl, mat, part, sand, stone, white, wood } from './materials.js';

/**
 * Playa como las del embalse (foto de Trompelhueno, Wikimedia Commons):
 * arena con quinchos de paja sobre bases de piedra, reposeras de madera en el
 * pasto, una torre de salvavidas, un bote y la línea de boyas rojas.
 *
 * @returns {Group}
 */
export function buildBeach() {
  const g = new Group();
  g.add(box(9, 0.14, 4.5, sand(), 0, 0.07, 0));
  g.add(box(9, 0.1, 1.4, mat('beachGrass', 0x7d9a4f), 0, 0.06, -2.9));
  const thatch = mat('thatch2', 0xc9a45c, { flatShading: true });
  [-3.3, -1.1, 1.1, 3.3].forEach((x, k) => {
    const z = k % 2 ? -0.9 : -0.5;
    g.add(box(0.7, 0.35, 0.7, stone(), x, 0.3, z));
    g.add(cyl(0.06, 0.06, 1.9, 6, wood(), x, 1.3, z));
    g.add(cone(1.1, 0.5, 12, thatch, x, 2.45, z));
  });
  /* Reposeras de madera en el pasto, de cara al agua. */
  [-3.6, -2.6, -1.6, -0.4, 0.6, 2.2].forEach((x) => {
    const chair = box(0.45, 0.08, 1.1, wood(), x, 0.38, -2.7);
    chair.rotation.x = -0.25;
    g.add(chair);
  });
  /* Torre de salvavidas: patas, plataforma, baranda y techo. */
  const tower = new Group();
  [
    [-0.45, -0.45],
    [0.45, -0.45],
    [-0.45, 0.45],
    [0.45, 0.45],
  ].forEach(([x, z]) => tower.add(cyl(0.05, 0.06, 2, 5, wood(), x, 1, z)));
  tower.add(box(1.2, 0.1, 1.2, white(), 0, 2.05, 0));
  tower.add(box(1.2, 0.4, 0.05, mat('lifeguard', 0xd94b3b), 0, 2.3, 0.6));
  tower.add(box(1.4, 0.06, 1.4, mat('lifeguard', 0xd94b3b), 0, 3.0, 0));
  [-0.55, 0.55].forEach((x) => tower.add(cyl(0.03, 0.03, 0.9, 4, white(), x, 2.5, -0.55)));
  tower.position.set(3.4, 0.14, 0.4);
  g.add(tower);
  /* Bote: medio casco con bancada. */
  const hull = part(
    new SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    mat('boat', 0x3b6e8f),
    0,
    0.5,
    0,
  );
  hull.scale.set(2.2, 0.7, 1);
  const boat = new Group();
  boat.add(hull);
  boat.add(box(0.12, 0.05, 1.1, wood(), 0, 0.48, 0));
  boat.position.set(-1.5, 0.1, 1.9);
  boat.rotation.y = 0.3;
  g.add(boat);
  /* Línea de boyas que marca la zona de baño. */
  for (let k = 0; k < 9; k += 1) {
    g.add(cyl(0.16, 0.16, 0.22, 8, mat('buoy', 0xe4572e), -4 + k, 0.05, 3.6));
  }
  return g;
}
