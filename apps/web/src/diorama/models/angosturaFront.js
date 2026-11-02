import { Box3, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, Shape, Vector3 } from 'three';
import { box, cyl, mat, part } from './materials.js';

/*
 * Frente de la Presa Angostura en low-poly, según las fotos aéreas
 * (presa angostura/represa*.PNG): un vertedero de 6 compuertas radiales azules
 * entre pilas en cuña, con brazos amarillos y salto de esquí sobre una cara
 * manchada que cae a la poza; y, a su lado, la presa de enrocado con talud de
 * grava, calzada y parapeto, que sigue como muro lateral junto a la ruta.
 *
 * Medidas en metros. El muro corre a lo largo de z, la cara aguas arriba está
 * en x = 0 (el embalse hacia +x), y = 0 es el pie y y = FRONT_HEIGHT el coronamiento.
 */
export const FRONT_LENGTH = 290;
export const FRONT_HEIGHT = 50;
const H = FRONT_HEIGHT;
const HALF = FRONT_LENGTH / 2;

/* Vertedero. */
const BAYS = 6;
const BAY = 13;
const PIER = 4;
const SPILL_LENGTH = BAYS * BAY + (BAYS + 1) * PIER;
/* Donde empieza la presa de enrocado (z de diseño, con el vertedero en z negativo). */
export const EMBANKMENT_FROM = -HALF + SPILL_LENGTH + 3;
/* Parte del largo del frente que ocupa el vertedero (desde el estribo norte). */
export const SPILLWAY_SHARE = SPILL_LENGTH / FRONT_LENGTH;
const SILL = H - 16;
const LIP_X = -36;
const LIP_Y = H - 23;
const TRUNNION = { x: -13, y: H - 6 };
/* Largo del estribo norte, más allá del vertedero, hasta meterse en el cerro. */
const ABUTMENT = 60;

/* Ancho de la calzada del coronamiento (m). */
export const FRONT_ROAD = 12;

/* Caja del cuerpo del muro, para encajarlo en la planta (sin edificios ni postes). */
export const FRONT_BOX = new Box3(new Vector3(LIP_X, 0, -HALF), new Vector3(0, H, HALF));

const colors = {
  concrete: () => mat('angosturaConcrete', 0xd9d5cb),
  stain: () => mat('angosturaStain', 0x8f8270),
  streak: () => mat('angosturaStreak', 0x6e5f4a),
  algae: () => mat('angosturaAlgae', 0x6f7d33),
  asphalt: () => mat('angosturaAsphalt', 0x4b4d52),
  curb: () => mat('angosturaCurb', 0xf1efe8),
  gate: () => mat('angosturaGate', 0x2f72c0, { side: DoubleSide, metalness: 0.3, roughness: 0.5 }),
  hoist: () => mat('angosturaHoist', 0x3a82cf),
  arm: () => mat('angosturaArm', 0xe8b923, { roughness: 0.5 }),
  roof: () => mat('angosturaRoof', 0x84bde0),
  wall: () => mat('angosturaWall', 0xf3f1ea),
  lamp: () => mat('angosturaLamp', 0x6d7276),
  intake: () => mat('angosturaIntake', 0xdedad0, { side: DoubleSide }),
};

/**
 * Prisma con la sección `profile` ([x, y]) extruida entre z0 y z1.
 */
function prismZ(profile, z0, z1, material) {
  const [from, to] = z0 < z1 ? [z0, z1] : [z1, z0];
  const shape = new Shape(profile.map(([x, y]) => ({ x, y })));
  const geometry = new ExtrudeGeometry(shape, { depth: to - from, bevelEnabled: false });
  geometry.translate(0, 0, from);
  return part(geometry, material);
}

/**
 * Viga tendida de (x0, y0) a (x1, y1) en el plano z.
 */
function beam(x0, y0, x1, y1, z, thick, wide, material) {
  const mesh = box(
    Math.hypot(x1 - x0, y1 - y0),
    thick,
    wide,
    material,
    (x0 + x1) / 2,
    (y0 + y1) / 2,
    z,
  );
  mesh.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  return mesh;
}

/**
 * Frente de la presa. `spillwayEnd` dice en qué extremo (−1: z negativo,
 * 1: z positivo) va el vertedero, el que se apoya en el cerro del norte.
 *
 * @param {{ spillwayEnd?: -1 | 1 }} [options]
 * @returns {Group}
 */
export function buildAngosturaFront({ spillwayEnd = -1 } = {}) {
  const g = new Group();
  /* Se diseña con el vertedero en z negativo y se espeja z si hace falta. */
  const Z = (z) => (spillwayEnd < 0 ? z : -z);
  const add = (mesh) => {
    mesh.position.z = Z(mesh.position.z);
    g.add(mesh);
  };
  const prism = (profile, z0, z1, material) => g.add(prismZ(profile, Z(z0), Z(z1), material));

  const spillFrom = -HALF;
  const spillTo = -HALF + SPILL_LENGTH;
  const spillMid = (spillFrom + spillTo) / 2;
  const bayCenter = (k) => spillFrom + PIER + BAY / 2 + k * (BAY + PIER);
  const pierCenter = (k) => spillFrom + PIER / 2 + k * (BAY + PIER);

  /* --- Vertedero --- */
  /* Cuerpo: umbral, rápida corta y salto de esquí; abajo, la cara vertical manchada. */
  prism(
    [
      [0, 0],
      [0, SILL],
      [-4, SILL + 1.5],
      [-9, SILL - 1],
      [-30, LIP_Y - 3],
      [-34, LIP_Y - 1],
      [LIP_X, LIP_Y],
      [LIP_X, 0],
    ],
    spillFrom,
    spillTo,
    colors.concrete(),
  );
  add(box(0.6, LIP_Y - 2, SPILL_LENGTH, colors.stain(), LIP_X - 0.3, (LIP_Y - 2) / 2, spillMid));
  /* Compuerta radial: arco de cilindro alrededor del muñón, del umbral a la pasarela. */
  const gateFoot = { x: -1, y: SILL + 1 };
  const gateTop = { x: -1, y: H + 0.5 };
  const radius = Math.hypot(gateFoot.x - TRUNNION.x, gateFoot.y - TRUNNION.y);
  const from = Math.atan2(gateFoot.y - TRUNNION.y, gateFoot.x - TRUNNION.x);
  const to = Math.atan2(gateTop.y - TRUNNION.y, gateTop.x - TRUNNION.x);
  for (let k = 0; k < BAYS; k += 1) {
    const z = bayCenter(k);
    /* Fondo de la rápida con algas, y la chorreadura que deja el agua bajo el salto. */
    add(beam(-9, SILL - 0.6, -30, LIP_Y - 2.6, z, 0.5, BAY, colors.algae()));
    add(box(0.4, LIP_Y - 8, BAY - 4, colors.streak(), LIP_X - 0.7, (LIP_Y - 8) / 2 + 4, z));
    const arc = new CylinderGeometry(
      radius,
      radius,
      BAY - 0.6,
      6,
      1,
      true,
      from + Math.PI / 2,
      to - from,
    );
    arc.rotateX(Math.PI / 2);
    add(part(arc, colors.gate(), TRUNNION.x, TRUNNION.y, z));
    /* Brazos amarillos del muñón a los bordes de la compuerta, a cada lado del vano. */
    for (const side of [-1, 1]) {
      const zs = z + side * (BAY / 2 - 1.2);
      for (const angle of [from, to])
        add(
          beam(
            TRUNNION.x,
            TRUNNION.y,
            TRUNNION.x + radius * Math.cos(angle),
            TRUNNION.y + radius * Math.sin(angle),
            zs,
            0.9,
            0.9,
            colors.arm(),
          ),
        );
    }
    /* Caseta azul del mecanismo sobre la pasarela. */
    add(box(5, 3.2, BAY - 3, colors.hoist(), 0, H + 4.1, z));
  }
  /* Pilas en cuña: altas sobre el umbral, bajan hasta el salto. */
  for (let k = 0; k <= BAYS; k += 1) {
    const width = k === 0 || k === BAYS ? PIER + 2 : PIER;
    const pier = prismZ(
      [
        [3, SILL - 4],
        [3, H + 2.5],
        [-12, H + 2.5],
        [LIP_X - 1, LIP_Y + 2],
        [LIP_X - 1, LIP_Y - 4],
      ],
      0,
      width,
      colors.concrete(),
    );
    pier.position.z = Z(pierCenter(k)) - width / 2;
    g.add(pier);
  }
  /* Pasarela del coronamiento sobre las pilas, con calzada. */
  add(box(10, 1.5, SPILL_LENGTH, colors.concrete(), -3, H + 1.75, spillMid));
  add(box(10, 0.4, SPILL_LENGTH, colors.asphalt(), -3, H + 2.7, spillMid));
  /* Muro guía entre el vertedero y la presa de enrocado. */
  add(box(-LIP_X + 4, H + 1, 3, colors.concrete(), LIP_X / 2 + 2, (H + 1) / 2, spillTo + 1.5));
  /*
   * Estribo norte: el muro sigue más allá del vertedero hasta empotrarse en el
   * cerro (la planta de OSM termina antes y el embalse se asomaba por el costado).
   */
  prism(
    [
      [0, 0],
      [0, H + 2.5],
      [-16, H + 2.5],
      [-16 - H * 0.6, 0],
    ],
    spillFrom - ABUTMENT,
    spillFrom,
    colors.concrete(),
  );
  add(box(12, 0.4, ABUTMENT, colors.asphalt(), -7, H + 2.7, spillFrom - ABUTMENT / 2));
  add(box(0.8, 1.6, ABUTMENT, colors.curb(), 0.4, H + 3.3, spillFrom - ABUTMENT / 2));
  /* Casa de control de techo celeste, en el estribo del cerro. */
  add(box(18, 8, 14, colors.wall(), -6, H + 4, spillFrom - 9));
  add(box(19.5, 1.4, 15.5, colors.roof(), -6, H + 8.7, spillFrom - 9));

  /*
   * --- Presa de enrocado ---
   * Su cuerpo (losas, calzada y talud de grava) lo levanta `buildEmbankment`
   * junto con el muro lateral, desde EMBANKMENT_FROM: así sus taludes siguen
   * el relieve y no tapan los caminos del pie.
   */
  /* Torre de toma en arco, dentro del embalse junto al vertedero. */
  const intake = new CylinderGeometry(11, 11, H + 3, 14, 1, true, 0, Math.PI);
  add(part(intake, colors.intake(), 22, (H + 3) / 2, spillTo + 22));
  add(box(22, 1, 2.5, colors.concrete(), 11, H + 2, spillTo + 11));

  /* Postes de luz a lo largo del coronamiento. */
  for (let z = -HALF + 8; z < HALF; z += 20) {
    const deck = z < spillTo ? H + 2.9 : H + 0.4;
    add(cyl(0.25, 0.25, 7, 5, colors.lamp(), z < spillTo ? 1.5 : 0.4, deck + 3.5, z));
  }

  return g;
}
