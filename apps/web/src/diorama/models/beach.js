import { Group } from 'three';
import { box, cone, cyl, grassPad, mat, prism, sand, stone, thatch, wood } from './materials.js';

const towel = (key, color) => mat(key, color, { roughness: 0.95 });

/**
 * Playa pública: franja de arena hacia el agua (+z), quitasoles de paja,
 * toallas, un kayak varado y la bandera del salvavidas.
 *
 * @returns {Group}
 */
export function buildBeach() {
  const g = new Group();
  g.add(box(7.5, 0.12, 5, sand(), 0, 0.06, 0));
  /* Quitasoles con su toalla al lado. */
  [
    [-2.4, -0.6, 0xd9534f],
    [0.2, -1.1, 0x2c7fb8],
    [2.5, -0.4, 0xf2c14e],
  ].forEach(([x, z, color], index) => {
    g.add(cyl(0.05, 0.05, 1.5, 6, wood(), x, 0.87, z));
    g.add(cone(0.95, 0.42, 10, thatch(), x, 1.8, z));
    g.add(box(0.55, 0.03, 1.1, towel(`towel${index}`, color), x + 0.75, 0.14, z + 0.35));
  });
  /* Kayak varado junto a la orilla. */
  const kayak = cyl(0.22, 0.22, 1.9, 8, mat('kayakRed', 0xc8442f), -0.8, 0.3, 1.7);
  kayak.rotation.z = Math.PI / 2;
  kayak.scale.set(1, 1, 0.7);
  g.add(kayak);
  /* Torre baja del salvavidas con su bandera. */
  g.add(box(0.9, 0.9, 0.9, wood(), 3, 0.57, 1.3));
  g.add(cyl(0.04, 0.04, 1.6, 6, wood(), 3.35, 1.8, 1.65));
  g.add(box(0.5, 0.3, 0.03, mat('flagGreen', 0x4f9d3a), 3.62, 2.42, 1.65));
  return g;
}

/**
 * Camping de interior (sin playa ni muelle): carpas de colores en un claro,
 * mesa de picnic y fogón de piedras.
 *
 * @returns {Group}
 */
export function buildCampsite() {
  const g = new Group();
  g.add(box(7, 0.12, 5.5, grassPad(), 0, 0.06, 0));
  [
    [-2.1, -1.2, 0xe07a2f, 0.3],
    [0.4, -1.6, 0x2c7fb8, -0.2],
    [2.3, -0.7, 0x7a9a3a, 0.5],
  ].forEach(([x, z, color, turn], index) => {
    const tent = prism(1.7, 2.1, mat(`tent${index}`, color), x, 0.12, z);
    tent.rotation.y = turn;
    g.add(tent);
  });
  /* Mesa de picnic con sus dos bancas. */
  g.add(box(1.5, 0.08, 0.7, wood(), -1.6, 0.78, 1.5));
  [1.05, 1.95].forEach((z) => g.add(box(1.5, 0.06, 0.25, wood(), -1.6, 0.5, z)));
  [-2.2, -1.0].forEach((x) => g.add(box(0.08, 0.66, 1.1, wood(), x, 0.45, 1.5)));
  /* Fogón: anillo de piedras y fuego. */
  for (let k = 0; k < 8; k += 1) {
    const angle = (k / 8) * Math.PI * 2;
    const [x, z] = [1.4 + Math.cos(angle) * 0.5, 1.5 + Math.sin(angle) * 0.5];
    g.add(box(0.22, 0.2, 0.22, stone(), x, 0.22, z));
  }
  g.add(cone(0.28, 0.5, 6, mat('ember', 0xe0662a), 1.4, 0.37, 1.5));
  return g;
}
