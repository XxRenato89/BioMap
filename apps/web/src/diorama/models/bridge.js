import { DodecahedronGeometry, Group } from 'three';
import { box, mat, part, seeded, stone, wood } from './materials.js';

/* Largo del tablero entre orillas y su altura (unidades del modelo): para tenderlo entre dos orillas. */
export const BRIDGE_SPAN = 14;
export const BRIDGE_DECK = 1.5;

/* Alto de las torres sobre el tablero y cuánto baja el cable principal al centro. */
const TOWER = 2.6;
const CABLE_LOW = 0.55;
/* Tramos del tablero: cada uno lleva su barandilla, su cable y sus péndolas. */
const STEPS = 14;

/**
 * Puente colgante peatonal del río Huequecura, a escala de maqueta: una torre
 * de dos patas en cada orilla, dos cables principales que cuelgan entre ellas
 * y bajan a sus anclajes, péndolas verticales y un tablero de tablones con una
 * leve flecha. Las piezas van más gruesas que en la realidad (y las torres más
 * altas: el puente real casi no las tiene) para que se lea como puente
 * colgante desde la vista general; uno a escala real no se distinguía.
 *
 * @returns {Group}
 */
export function buildBridge() {
  const g = new Group();
  const half = BRIDGE_SPAN / 2;
  const width = 0.7;
  const side = width / 2 + 0.06;
  const top = BRIDGE_DECK + TOWER;
  const deckAt = (x) => BRIDGE_DECK - 0.25 * (1 - (x / half) ** 2);
  const cableAt = (x) => BRIDGE_DECK + CABLE_LOW + (TOWER - CABLE_LOW) * (x / half) ** 2;

  const plank = mat('bridgePlank', 0xb89a74);
  const beam = mat('bridgeBeam', 0x6f5338);
  const steel = mat('bridgeTower', 0x9a4a2e);
  const cable = mat('bridgeCable', 0x3a3f42);

  /* Barra recta entre dos puntos del plano x-y, a un lado del puente. */
  const bar = (x0, y0, x1, y1, z, thick, material) => {
    const piece = box(
      Math.hypot(x1 - x0, y1 - y0),
      thick,
      thick,
      material,
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      z,
    );
    piece.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    g.add(piece);
  };

  /* Peñones de roca en cada orilla: ahí se apoyan las torres. */
  const rock = mat('bridgeRock', 0x7a6f64, { flatShading: true });
  const random = seeded(15);
  for (const end of [-1, 1]) {
    for (let k = 0; k < 4; k += 1) {
      const r = 0.8 + random() * 0.7;
      g.add(
        part(
          new DodecahedronGeometry(r),
          k % 2 ? rock : stone(),
          end * (half + 0.4 + random() * 1.2),
          BRIDGE_DECK - 0.5 - random() * 0.6,
          (random() - 0.5) * 2,
        ),
      );
    }
  }

  /* Tablero con largueros, barandilla, cable principal y péndolas. */
  for (let k = 0; k < STEPS; k += 1) {
    const x0 = -half + (k / STEPS) * BRIDGE_SPAN;
    const x1 = -half + ((k + 1) / STEPS) * BRIDGE_SPAN;
    const [y0, y1] = [deckAt(x0), deckAt(x1)];
    const deck = box(
      Math.hypot(x1 - x0, y1 - y0),
      0.09,
      width,
      plank,
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      0,
    );
    deck.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    g.add(deck);
    for (const z of [-side, side]) {
      bar(x0, y0 - 0.04, x1, y1 - 0.04, z, 0.1, beam);
      bar(x0, y0 + 0.5, x1, y1 + 0.5, z, 0.05, cable);
      bar(x0, cableAt(x0), x1, cableAt(x1), z, 0.08, cable);
      /* Péndola del cable al tablero (las de los extremos son las torres). */
      if (k > 0) g.add(box(0.04, cableAt(x0) - y0, 0.04, cable, x0, (cableAt(x0) + y0) / 2, z));
    }
  }

  /* Torres, cables de anclaje y letrero de cada acceso. */
  for (const end of [-1, 1]) {
    const x = end * half;
    const foot = BRIDGE_DECK - 0.9;
    for (const z of [-side, side]) {
      g.add(box(0.2, top - foot, 0.2, steel, x, (top + foot) / 2, z));
      bar(x, top, x + end * 2.4, BRIDGE_DECK - 0.1, z, 0.08, cable);
      g.add(box(0.4, 0.35, 0.4, stone(), x + end * 2.4, BRIDGE_DECK - 0.2, z));
    }
    /* Travesaños: arriba y a media altura, con una cruz entre ellos. */
    g.add(box(0.16, 0.16, side * 2 + 0.2, steel, x, top - 0.1, 0));
    g.add(box(0.14, 0.14, side * 2 + 0.2, steel, x, BRIDGE_DECK + TOWER * 0.55, 0));
    g.add(box(0.06, 0.5, 0.7, wood(), x + end * 1.3, BRIDGE_DECK + 0.6, 1.3));
    g.add(box(0.06, 0.5, 0.06, wood(), x + end * 1.3, BRIDGE_DECK + 0.15, 1.3));
  }
  return g;
}
