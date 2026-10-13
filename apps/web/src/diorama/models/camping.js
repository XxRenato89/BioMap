import { Group, TorusGeometry } from 'three';
import { box, cone, cyl, mat, part, prism, stone, wood } from './materials.js';

/**
 * Camping: carpas de dos aguas con su puerta y vientos, una mesa de picnic y
 * una fogata con troncos, sobre un claro de pasto.
 *
 * @returns {Group}
 */
export function buildCamping() {
  const g = new Group();
  g.add(cyl(4.2, 4.4, 0.16, 20, mat('pad2', 0x9da56d), 0, 0.08, 0));
  [
    [-2.1, 0.9, 0.5, 0xe0813a],
    [1.6, 1.8, -0.4, 0x3a82b8],
    [-0.6, -2.3, 1.3, 0x5fae6a],
    [2.4, -1.4, 2.2, 0xe5c14a],
  ].forEach(([x, z, turn, color]) => {
    const tent = new Group();
    tent.add(prism(1.5, 2, mat(`tent${color}`, color)));
    /* Puerta oscura en la cara del frente, y vientos tensados hasta las estacas. */
    tent.add(prism(0.7, 0.04, mat('tentDoor', 0x2d2a26), 0, 0, 1.0));
    [-1, 1].forEach((side) => {
      const rope = cyl(0.015, 0.015, 1.3, 4, mat('rope', 0xf0ece0), side * 1.05, 0.5, 0);
      rope.rotation.z = side * 1.0;
      tent.add(rope);
    });
    tent.position.set(x, 0.16, z);
    tent.rotation.y = turn;
    g.add(tent);
  });
  /* Mesa de picnic con bancas. */
  const table = new Group();
  table.add(box(1.6, 0.08, 0.7, wood(), 0, 0.75, 0));
  table.add(box(1.6, 0.06, 0.28, wood(), 0, 0.42, 0.62));
  table.add(box(1.6, 0.06, 0.28, wood(), 0, 0.42, -0.62));
  [-0.65, 0.65].forEach((x) => table.add(box(0.08, 0.75, 1.5, wood(), x, 0.38, 0)));
  table.position.set(-2.6, 0.16, -1.4);
  table.rotation.y = 0.6;
  g.add(table);
  /* Fogata: anillo de piedras, troncos cruzados y llama. */
  const ring = part(new TorusGeometry(0.42, 0.11, 6, 12), stone(), 0.4, 0.26, 0.2);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  [0, 1.2, 2.4].forEach((turn) => {
    const log = cyl(0.06, 0.06, 0.7, 5, mat('log', 0x5a3d26), 0.4, 0.32, 0.2);
    log.rotation.set(Math.PI / 2, turn, 0.3);
    g.add(log);
  });
  g.add(
    cone(
      0.18,
      0.6,
      6,
      mat('fire', 0xffa640, { emissive: 0xff7a1a, emissiveIntensity: 0.9 }),
      0.4,
      0.62,
      0.2,
    ),
  );
  return g;
}
