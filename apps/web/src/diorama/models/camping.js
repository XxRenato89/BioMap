import { CylinderGeometry, Group, IcosahedronGeometry, TorusGeometry } from 'three';
import { box, cone, cyl, mat, part, prism, sand, stone, thatch, trunk, wood } from './materials.js';

/* Colores de las fotos: kayaks azul, amarillo y rojo; baranda roja del paseo. */
const KAYAKS = [0x1f5fbf, 0xf2c230, 0xd8402f];
const railRed = () => mat('campRail', 0xc0392b);

/**
 * Quitasol de paja sobre su poste, como los de las playas de los campings.
 */
function umbrella(g, x, z) {
  g.add(cyl(0.05, 0.05, 1.2, 5, wood(), x, 0.75, z));
  g.add(cone(0.75, 0.38, 9, thatch(), x, 1.42, z));
}

/**
 * Reposera de madera tendida, mirando al agua (+z).
 */
function lounger(g, x, z) {
  const chair = new Group();
  chair.add(box(0.42, 0.06, 1.0, wood(), 0, 0.28, 0));
  const back = box(0.42, 0.06, 0.5, wood(), 0, 0.45, -0.55);
  back.rotation.x = -0.7;
  chair.add(back);
  [-0.17, 0.17].forEach((dx) =>
    chair.add(box(0.05, 0.26, 0.9, mat('loungerLeg', 0x5e3c24), dx, 0.13, 0)),
  );
  chair.position.set(x, 0.16, z);
  g.add(chair);
}

/**
 * Kayak de colores varado en la arena, con su remo rojo al lado.
 */
function kayak(g, x, z, color, turn) {
  const k = new Group();
  const hull = part(new CylinderGeometry(0.22, 0.22, 2.2, 8), mat(`kayak${color}`, color));
  hull.rotation.x = Math.PI / 2;
  hull.scale.set(1, 1, 0.55);
  k.add(hull);
  [-1, 1].forEach((side) => {
    const tip = cone(0.22, 0.5, 8, mat(`kayak${color}`, color), 0, 0, side * 1.35);
    tip.rotation.x = side * (Math.PI / 2);
    tip.scale.set(1, 1, 0.55);
    k.add(tip);
  });
  k.add(box(0.26, 0.04, 0.5, mat('cockpit', 0x22262a), 0, 0.1, 0));
  k.add(box(0.05, 0.03, 1.8, mat('paddleShaft', 0x2a2a2a), 0.45, -0.08, 0));
  k.add(box(0.18, 0.02, 0.32, mat('paddleBlade', 0xe8432e), 0.45, -0.08, 0.95));
  k.scale.setScalar(0.75);
  k.position.set(x, 0.28, z);
  k.rotation.y = turn;
  g.add(k);
}

/**
 * Camping a orillas del embalse según sus fotos (Los Notros, Trompelhueno):
 * playa de arena con quitasoles de paja y reposeras, kayaks de colores en la
 * orilla, un paseo con baranda roja hasta la punta, un árbol solitario y,
 * atrás en el pasto, carpas, un quincho, mesa de picnic y fogata. La playa
 * queda hacia +z (el modelo se gira para mirar al agua).
 *
 * @returns {Group}
 */
export function buildCamping() {
  const g = new Group();
  g.add(cyl(4.2, 4.4, 0.16, 20, mat('pad2', 0x9da56d), 0, 0.08, 0));
  /* Media luna de arena hacia el agua. */
  const beach = part(
    new CylinderGeometry(4.25, 4.45, 0.18, 20, 1, false, -Math.PI / 2, Math.PI),
    sand(),
    0,
    0.1,
    0.2,
  );
  g.add(beach);

  /* Quitasoles con dos reposeras cada uno, en fila frente al agua. */
  [-2.4, -0.8, 0.8, 2.4].forEach((x) => {
    umbrella(g, x, 1.3);
    lounger(g, x - 0.3, 1.75);
    lounger(g, x + 0.3, 1.75);
  });

  /* Kayaks varados a lo largo de la orilla. */
  [
    [-1.2, 3.55],
    [1.3, 3.5],
    [0.1, 2.95],
  ].forEach(([x, z], k) => kayak(g, x, z, KAYAKS[k], Math.PI / 2 + 0.08 * (k - 1)));

  /* Paseo de gravilla con baranda roja hasta la punta de la playa. */
  g.add(box(0.9, 0.04, 5.2, mat('walkway', 0xbdb6a6), 3.3, 0.2, 0));
  for (let z = -2.4; z <= 2.41; z += 0.6) g.add(box(0.07, 0.75, 0.07, railRed(), 3.8, 0.55, z));
  g.add(box(0.06, 0.06, 4.9, railRed(), 3.8, 0.92, 0));
  g.add(box(0.05, 0.05, 4.9, railRed(), 3.8, 0.6, 0));

  /* Árbol solitario en la arena, como en la punta de Los Notros. */
  g.add(cyl(0.12, 0.18, 1.6, 6, trunk(), -3.3, 0.95, 1.3));
  [
    [0, 2.0, 0, 0.9],
    [0.5, 1.8, 0.2, 0.7],
    [-0.4, 2.3, -0.2, 0.65],
  ].forEach(([dx, y, dz, r]) =>
    g.add(part(new IcosahedronGeometry(r, 0), mat('campTree', 0x3f6b35), -3.3 + dx, y, 1.3 + dz)),
  );

  /* Carpas en el pasto, atrás. */
  [
    [-2.6, -2.6, 0, 0xe0702e],
    [-0.9, -2.9, 0.25, 0x2e7dd1],
    [0.8, -2.6, -0.2, 0x5aa04a],
  ].forEach(([x, z, turn, color]) => {
    const tent = new Group();
    tent.add(prism(1.5, 2, mat(`tent${color}`, color)));
    tent.add(prism(0.7, 0.04, mat('tentDoor', 0x2d2a26), 0, 0, 1.0));
    tent.position.set(x, 0.16, z);
    tent.rotation.y = turn;
    g.add(tent);
  });

  /* Quincho de madera oscura. */
  const [qx, qz] = [2.2, -2.2];
  [-0.55, 0.55].forEach((dx) =>
    [-0.4, 0.4].forEach((dz) => g.add(cyl(0.05, 0.05, 0.9, 4, wood(), qx + dx, 0.6, qz + dz))),
  );
  g.add(box(1.4, 0.12, 1.1, mat('quincho', 0x3d2b1f), qx, 1.1, qz));

  /* Mesa de picnic con bancas. */
  const table = new Group();
  table.add(box(1.6, 0.08, 0.7, wood(), 0, 0.75, 0));
  table.add(box(1.6, 0.06, 0.28, wood(), 0, 0.42, 0.62));
  table.add(box(1.6, 0.06, 0.28, wood(), 0, 0.42, -0.62));
  [-0.65, 0.65].forEach((x) => table.add(box(0.08, 0.75, 1.5, wood(), x, 0.38, 0)));
  table.position.set(-0.4, 0.16, -0.9);
  table.rotation.y = 0.4;
  g.add(table);

  /* Fogata: anillo de piedras, troncos cruzados y llama. */
  const ring = part(new TorusGeometry(0.42, 0.11, 6, 12), stone(), 1.6, 0.26, -0.6);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  [0, 1.2, 2.4].forEach((turn) => {
    const log = cyl(0.06, 0.06, 0.7, 5, mat('log', 0x5a3d26), 1.6, 0.32, -0.6);
    log.rotation.set(Math.PI / 2, turn, 0.3);
    g.add(log);
  });
  g.add(
    cone(
      0.18,
      0.6,
      6,
      mat('fire', 0xffa640, { emissive: 0xff7a1a, emissiveIntensity: 0.9 }),
      1.6,
      0.62,
      -0.6,
    ),
  );
  return g;
}
