import { DodecahedronGeometry, Group } from 'three';
import { box, cyl, mat, metal, part, seeded, stone, wood } from './materials.js';

/**
 * Puente colgante peatonal del río Huequecura (fotos de Google Maps): una
 * pasarela angosta de tablones, casi plana, tendida entre dos peñones de roca.
 * Sin torres altas: postes de acero con tirantes, cables de pasamanos y malla
 * de alambre a los costados; en cada acceso, baranda de tubo y un letrero.
 *
 * @returns {Group}
 */
export function buildBridge() {
  const g = new Group();
  const half = 7;
  const deckY = 1.5;
  const sag = 0.35;
  const width = 0.5;
  const steps = 28;
  const yAt = (x) => deckY - sag * (1 - (x / half) ** 2);

  /* Peñones de roca en cada orilla. */
  const rock = mat('bridgeRock', 0x7a6f64, { flatShading: true });
  const random = seeded(15);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k += 1) {
      const r = 0.8 + random() * 0.7;
      g.add(
        part(
          new DodecahedronGeometry(r),
          k % 2 ? rock : stone(),
          side * (half + 0.4 + random() * 1.2),
          deckY - 0.5 - random() * 0.6,
          (random() - 0.5) * 2,
        ),
      );
    }
  }

  /* Tablones y cables, por tramos que siguen la flecha. */
  const plank = mat('bridgePlank', 0xb89a74);
  const net = mat('bridgeNet', 0xb9c0c2, { transparent: true, opacity: 0.35 });
  for (let k = 0; k < steps; k += 1) {
    const x0 = -half + (k / steps) * 2 * half;
    const x1 = -half + ((k + 1) / steps) * 2 * half;
    const [y0, y1] = [yAt(x0), yAt(x1)];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const tilt = Math.atan2(y1 - y0, x1 - x0);
    const deck = box(len, 0.06, width, plank, (x0 + x1) / 2, (y0 + y1) / 2, 0);
    deck.rotation.z = tilt;
    g.add(deck);
    for (const side of [-1, 1]) {
      const z = (side * width) / 2;
      const rail = box(len, 0.025, 0.025, metal(), (x0 + x1) / 2, (y0 + y1) / 2 + 0.55, z);
      rail.rotation.z = tilt;
      g.add(rail);
      const panel = box(len, 0.5, 0.01, net, (x0 + x1) / 2, (y0 + y1) / 2 + 0.28, z);
      panel.rotation.z = tilt;
      g.add(panel);
      /* Poste con tirante hacia afuera cada dos tramos. */
      if (k % 2 === 0) {
        g.add(cyl(0.018, 0.018, 0.6, 4, metal(), x0, y0 + 0.3, z));
        const brace = cyl(0.012, 0.012, 0.45, 4, metal(), x0, y0 + 0.2, z + side * 0.12);
        brace.rotation.x = side * 0.55;
        g.add(brace);
      }
    }
  }

  /* Accesos: postes de anclaje, baranda de tubo y letrero de madera. */
  const pipe = mat('bridgePipe', 0x8c4b32);
  for (const side of [-1, 1]) {
    const x = side * half;
    for (const z of [-width / 2 - 0.1, width / 2 + 0.1])
      g.add(cyl(0.05, 0.06, 1.1, 6, metal(), x, deckY + 0.55, z));
    for (const z of [-0.9, 0.9]) {
      g.add(box(1.4, 0.04, 0.04, pipe, x + side * 0.9, deckY + 0.5, z));
      g.add(cyl(0.025, 0.025, 0.5, 4, metal(), x + side * 1.6, deckY + 0.25, z));
    }
    g.add(box(0.06, 0.5, 0.7, wood(), x + side * 1.3, deckY + 0.6, 1.3));
    g.add(cyl(0.03, 0.03, 0.5, 4, wood(), x + side * 1.3, deckY + 0.1, 1.3));
  }
  return g;
}
