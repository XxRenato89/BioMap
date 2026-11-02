import { CylinderGeometry, Group, Shape, ExtrudeGeometry } from 'three';
import { box, cyl, mat, part } from './materials.js';

/**
 * Casco de lancha visto desde arriba: popa recta y proa en punta (en metros,
 * eslora `length`, manga `beam`), extruido a `depth` de alto.
 */
function hull(length, beam, depth, material, y) {
  const half = beam / 2;
  const shape = new Shape();
  shape.moveTo(-half, -length / 2);
  shape.lineTo(half, -length / 2);
  shape.lineTo(half, length * 0.18);
  shape.quadraticCurveTo(half, length * 0.4, 0, length / 2);
  shape.quadraticCurveTo(-half, length * 0.4, -half, length * 0.18);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2).rotateY(Math.PI);
  return part(geometry, material, 0, y, 0);
}

/**
 * Lancha de paseo del embalse (los paseos de ~30 min que ofrecen los
 * operadores locales): casco blanco con franja azul, toldo sobre cuatro
 * pilares, bancas con pasajeros, motor fuera de borda y bandera de Quibar.
 * En metros, mirando a +z.
 *
 * @returns {Group}
 */
export function buildLaunch() {
  const g = new Group();
  const white = mat('launchWhite', 0xf6f7f8);
  g.add(hull(8, 2.6, 0.9, white, 0));
  g.add(hull(8.05, 2.65, 0.25, mat('launchStripe', 0x1c75bc), 0.55));
  g.add(hull(7.4, 2.2, 0.06, mat('launchDeck', 0xc29b61), 0.9));

  /* Toldo sobre cuatro pilares. */
  [-1, 1].forEach((sx) =>
    [-1.6, 1.4].forEach((z) =>
      g.add(cyl(0.04, 0.04, 1.7, 5, mat('launchPost', 0xb0b6ba), sx * 1.0, 1.8, z)),
    ),
  );
  g.add(box(2.3, 0.08, 3.6, mat('launchCanopy', 0x1c75bc), 0, 2.68, -0.1));
  g.add(box(2.35, 0.2, 0.06, white, 0, 2.6, 1.72));

  /* Bancas con pasajeros (chalecos naranjos). */
  const vest = mat('launchVest', 0xf28c28);
  const skin = mat('launchSkin', 0xd9a77c);
  [-1.1, 0.2].forEach((z) => {
    g.add(box(2.0, 0.12, 0.45, mat('launchSeat', 0x8a5b37), 0, 1.25, z));
    [-0.6, 0.6].forEach((x) => {
      g.add(box(0.42, 0.55, 0.32, vest, x, 1.6, z));
      g.add(part(new CylinderGeometry(0.14, 0.14, 0.26, 7), skin, x, 2.0, z));
    });
  });

  /* Puesto del conductor y parabrisas. */
  g.add(box(0.8, 0.8, 0.6, white, 0.55, 1.3, 1.9));
  g.add(
    box(
      1.8,
      0.45,
      0.05,
      mat('launchGlass', 0x7cc4e4, { roughness: 0.1, metalness: 0.3 }),
      0,
      1.55,
      2.3,
    ),
  );

  /* Motor fuera de borda en la popa. */
  g.add(box(0.5, 0.7, 0.45, mat('launchMotor', 0x2a2e33), 0, 1.0, -4.15));
  g.add(box(0.14, 0.9, 0.14, mat('launchMotor', 0x2a2e33), 0, 0.35, -4.2));

  /* Bandera naranja de Quibar en la popa. */
  g.add(cyl(0.03, 0.03, 1.4, 4, mat('launchPost', 0xb0b6ba), 0.9, 1.6, -3.7));
  g.add(box(0.05, 0.4, 0.6, mat('launchFlag', 0xd97706), 0.9, 2.1, -3.95));

  /* Estela blanca detrás. */
  const wake = box(
    1.6,
    0.02,
    5,
    mat('launchWake', 0xffffff, { transparent: true, opacity: 0.55 }),
    0,
    0.05,
    -6.6,
  );
  g.add(wake);
  return g;
}
