import { CylinderGeometry, Group } from 'three';
import { box, cone, cyl, mat, part, stone, white, wood } from './materials.js';

/**
 * Playa del embalse según las fotos de Google Maps de Playa Quilaco y Santa
 * Bárbara: arena volcánica gris en media luna, una fila de quitasoles de paja
 * sobre bases de piedra, una cerca de troncos hacia el estacionamiento, un
 * muelle flotante de módulos blancos, kayaks y la línea curva de boyas
 * naranjas y blancas que marca la zona de baño. El agua queda hacia +z.
 *
 * @returns {Group}
 */
export function buildBeach() {
  const g = new Group();
  const graySand = mat('graySand', 0x8f877b);
  const wetSand = mat('wetSand', 0x6d675e);

  /* Media luna de arena: medio disco hacia tierra; el borde recto es la orilla mojada. */
  const half = () => new CylinderGeometry(5, 5, 0.14, 24, 1, false, Math.PI / 2, Math.PI);
  const crescent = part(half(), graySand, 0, 0.07, 0);
  crescent.scale.z = 0.8;
  g.add(crescent);
  g.add(box(10, 0.1, 0.8, wetSand, 0, 0.04, 0.3));
  g.add(box(11, 0.1, 1.6, mat('beachGrass', 0x7d9a4f), 0, 0.05, -4.6));

  /* Quitasoles de paja en fila, al fondo de la arena. */
  const thatch = mat('thatch2', 0xc9a45c, { flatShading: true });
  [-3.6, -2.2, -0.8, 0.6, 2, 3.4].forEach((x, k) => {
    const z = -2.6 + (k % 2) * 0.3 + Math.abs(x) * 0.12;
    g.add(box(0.5, 0.3, 0.5, stone(), x, 0.25, z));
    g.add(cyl(0.05, 0.05, 1.6, 6, wood(), x, 1.1, z));
    g.add(cone(0.85, 0.4, 12, thatch, x, 2.05, z));
  });

  /* Cerca de troncos hacia el estacionamiento. */
  for (let k = 0; k <= 10; k += 1) g.add(cyl(0.06, 0.07, 0.6, 5, wood(), -5 + k, 0.3, -4.2));
  [0.25, 0.5].forEach((y) => g.add(box(10, 0.06, 0.06, wood(), 0, y, -4.2)));

  /* Muelle flotante de módulos blancos, adentro del agua. */
  for (let k = 0; k < 4; k += 1) g.add(box(0.9, 0.12, 0.9, white(), 2.6, 0.06, 1 + k * 0.95));

  /* Kayaks en la orilla. */
  [
    [-2.6, 0x2e9e5b],
    [-2, 0xe8b923],
    [-1.4, 0xd94b3b],
  ].forEach(([x, color]) => {
    const kayak = cyl(0.12, 0.12, 1.4, 6, mat(`kayak${color}`, color), x, 0.2, -0.8);
    kayak.rotation.x = Math.PI / 2;
    kayak.scale.set(1, 1, 0.5);
    g.add(kayak);
  });

  /* Línea de boyas en arco, naranjas y blancas alternadas. */
  const orange = mat('buoy', 0xe4572e);
  for (let k = 0; k <= 16; k += 1) {
    const angle = Math.PI * (0.15 + (0.7 * k) / 16);
    g.add(
      cyl(
        0.15,
        0.15,
        0.2,
        8,
        k % 2 ? white() : orange,
        Math.cos(angle) * 5.5,
        0.05,
        1 + Math.sin(angle) * 4.5,
      ),
    );
  }
  return g;
}
