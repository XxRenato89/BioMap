import { Group, TorusGeometry } from 'three';
import { box, cone, cyl, mat, part, prism, stone, wood } from './materials.js';

/**
 * Camping como los de la maqueta del Centro de Visitantes: filas de carpas
 * naranjas con vientos, quinchos de madera oscura, una cancha de fútbol, una
 * mesa de picnic y una fogata, sobre un claro de pasto.
 *
 * @returns {Group}
 */
export function buildCamping() {
  const g = new Group();
  g.add(cyl(4.2, 4.4, 0.16, 20, mat('pad2', 0x9da56d), 0, 0.08, 0));
  /* Dos filas de carpas naranjas a lo largo del camino interior. */
  [-2.6, -1.3, 0, 1.3]
    .flatMap((x) => [
      [x, -2.4, 0, 0xe0702e],
      [x + 0.4, 2.6, Math.PI, 0xe0702e],
    ])
    .forEach(([x, z, turn, color]) => {
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
  /* Quinchos (techo de madera sobre pilares) y la cancha de fútbol. */
  [
    [2.4, -2.0],
    [2.6, 0.2],
  ].forEach(([x, z]) => {
    [-0.55, 0.55].forEach((dx) =>
      [-0.4, 0.4].forEach((dz) => g.add(cyl(0.05, 0.05, 0.9, 4, wood(), x + dx, 0.6, z + dz))),
    );
    g.add(box(1.4, 0.12, 1.1, mat('quincho', 0x3d2b1f), x, 1.1, z));
  });
  g.add(box(1.6, 0.03, 1.1, mat('pitch', 0x6fbf6a), -1.0, 0.18, 0.4));
  g.add(box(0.04, 0.035, 1.1, mat('pitchLine', 0xf4f4ee), -1.0, 0.19, 0.4));
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
