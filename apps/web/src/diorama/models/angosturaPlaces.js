import { ConeGeometry, Group } from 'three';
import { box, cyl, mat, part, prism, white } from './materials.js';

/*
 * Lugares junto a la Presa Angostura, en low-poly y en metros, según sus fotos
 * de Google Maps (noviembre de 2026): Parque Angostura con su Mirador Huequecura,
 * el Mirador de Los Nogales (Mirador Central), el Centro de Visitantes Colbún y
 * el Santuario y Mirador San Sebastián (Cerro el Calvario).
 */
const wood = () => mat('placeWood', 0x8a5a36);
const woodDark = () => mat('placeWoodDark', 0x5e3c24);
const mesh = () => mat('placeMesh', 0x9aa0a3, { metalness: 0.4, roughness: 0.5 });
const signBlue = () => mat('placeSignBlue', 0x1f4f9c);
/* Lo que los pilotes bajan bajo el piso de apoyo (m). */
const LEG_DEPTH = 6;
const signPanel = () => mat('placeSignPanel', 0xe9eef2);

/**
 * Baranda de madera entre (x0, z0) y (x1, z1): postes, pasamano y travesaño.
 */
function railing(g, x0, z0, x1, z1, y, { height = 1.1, panel = null } = {}) {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const angle = Math.atan2(x1 - x0, z1 - z0);
  const posts = Math.max(1, Math.round(length / 2));
  for (let k = 0; k <= posts; k += 1) {
    const f = k / posts;
    g.add(
      box(0.15, height, 0.15, woodDark(), x0 + (x1 - x0) * f, y + height / 2, z0 + (z1 - z0) * f),
    );
  }
  for (const [h, t] of [
    [height, 0.14],
    [height * 0.5, 0.1],
  ]) {
    const rail = box(0.1, t, length, wood(), (x0 + x1) / 2, y + h, (z0 + z1) / 2);
    rail.rotation.y = angle;
    g.add(rail);
  }
  if (panel) {
    const fill = box(
      0.04,
      height * 0.85,
      length,
      panel,
      (x0 + x1) / 2,
      y + height * 0.47,
      (z0 + z1) / 2,
    );
    fill.rotation.y = angle;
    g.add(fill);
  }
}

/**
 * Plataforma de madera sobre pilotes con baranda en tres lados (abierta en −z).
 */
function deck(g, w, d, h, { panel = null, x = 0, z = 0 } = {}) {
  g.add(box(w, 0.2, d, wood(), x, h, z));
  for (const [px, pz] of [
    [-w / 2 + 0.2, -d / 2 + 0.2],
    [w / 2 - 0.2, -d / 2 + 0.2],
    [-w / 2 + 0.2, d / 2 - 0.2],
    [w / 2 - 0.2, d / 2 - 0.2],
  ])
    /* Pilotes largos: al borde del barranco, los de adelante bajan por la ladera. */
    g.add(box(0.25, h + LEG_DEPTH, 0.25, woodDark(), x + px, (h - LEG_DEPTH) / 2, z + pz));
  const top = h + 0.1;
  railing(g, x - w / 2, z - d / 2, x - w / 2, z + d / 2, top, { panel });
  railing(g, x + w / 2, z - d / 2, x + w / 2, z + d / 2, top, { panel });
  railing(g, x - w / 2, z + d / 2, x + w / 2, z + d / 2, top, { panel });
}

/**
 * Panel informativo en dos postes: el mapa del Angostura del Biobío.
 */
function infoBoard(g, x, z, angle = 0) {
  const board = new Group();
  board.add(box(0.15, 2.2, 0.15, woodDark(), -1.2, 1.1, 0));
  board.add(box(0.15, 2.2, 0.15, woodDark(), 1.2, 1.1, 0));
  board.add(box(2.6, 1.4, 0.08, signPanel(), 0, 1.5, 0));
  board.add(box(1.2, 1, 0.09, mat('placeMap', 0x7fb069), -0.55, 1.5, 0));
  board.add(box(2.6, 0.25, 0.09, signBlue(), 0, 2.3, 0));
  board.position.set(x, 0, z);
  board.rotation.y = angle;
  g.add(board);
}

/**
 * Parque Angostura y su Mirador Huequecura (el mismo lugar en Google Maps):
 * escalera de madera con barandas que sube a una plataforma mirador sobre el
 * embalse, y el panel del parque en la entrada.
 */
export function buildForestTrail() {
  const g = new Group();
  const steps = 5;
  const run = 1.2;
  const rise = 0.35;
  const top = steps * rise;
  deck(g, 5, 4, top);
  /* Escalones que suben hacia la plataforma por su lado abierto (−z). */
  for (let k = 0; k < steps; k += 1) {
    const y = top - k * rise;
    const z = -2 - (k + 0.5) * run;
    g.add(box(1.6, 0.18, run, wood(), 0, y, z));
    g.add(box(0.2, y, 0.2, woodDark(), -0.8, y / 2, z));
    g.add(box(0.2, y, 0.2, woodDark(), 0.8, y / 2, z));
  }
  /* Barandas de la escalera, bajando con ella. */
  const length = Math.hypot(steps * run, steps * rise);
  for (const x of [-0.85, 0.85]) {
    const rail = box(
      0.1,
      0.12,
      length,
      wood(),
      x,
      top - (steps * rise) / 2 + 1.1,
      -2 - (steps * run) / 2,
    );
    rail.rotation.x = -Math.atan2(rise, run);
    g.add(rail);
  }
  infoBoard(g, 3.6, -2.5, -Math.PI / 2);
  return g;
}

/**
 * Mirador de Los Nogales (Mirador Central): plataforma chica con marcos de
 * madera y malla de alambre, y el letrero azul del mirador.
 */
export function buildMeshDeck() {
  const g = new Group();
  deck(g, 4, 3, 0.4, { panel: mesh() });
  g.add(box(0.12, 1.6, 0.12, woodDark(), 2.4, 0.8, -1.8));
  g.add(box(1.2, 0.7, 0.06, signBlue(), 2.4, 1.6, -1.8));
  return g;
}

/**
 * Centro de Visitantes Colbún: pabellones bajos oscuros de techo plano (uno
 * con techo blanco), bandera chilena, reja de alambre y matas de cortadera.
 */
export function buildVisitorPavilions() {
  const g = new Group();
  const dark = mat('placeBlack', 0x2a2c30);
  const glass = mat('placeGlass', 0x5f7f8f, { roughness: 0.2, metalness: 0.3 });
  /* Pabellón largo, pabellón alto con techo blanco y un tercero al fondo. */
  g.add(box(30, 4, 10, dark, -6, 2, 0));
  g.add(box(30.6, 0.4, 10.6, mat('placeRoofDark', 0x3a3d42), -6, 4.2, 0));
  g.add(box(28, 2, 0.1, glass, -6, 2, 5.05));
  g.add(box(12, 6, 10, dark, 15, 3, -1));
  g.add(box(14, 0.5, 12, white(), 16, 6.25, -1));
  g.add(box(10, 3.5, 8, dark, -24, 1.75, -4));
  /* Bandera chilena en su mástil. */
  g.add(cyl(0.08, 0.08, 9, 6, white(), 4, 4.5, 9));
  g.add(box(1.4, 0.45, 0.04, white(), 4.7, 8.6, 9));
  g.add(box(1.4, 0.45, 0.04, mat('placeFlagRed', 0xd52b1e), 4.7, 8.15, 9));
  g.add(box(0.45, 0.45, 0.05, mat('placeFlagBlue', 0x0039a6), 4.22, 8.6, 9.01));
  /* Reja de alambre al frente, junto a la ruta. */
  for (let x = -34; x <= 26; x += 3) g.add(box(0.12, 1.6, 0.12, mesh(), x, 0.8, 14));
  g.add(box(60, 1.3, 0.03, mesh(), -4, 0.9, 14));
  /* Matas de cortadera en el pasto del frente. */
  const plume = new ConeGeometry(0.6, 2.2, 5);
  for (const [x, z] of [
    [-28, 10],
    [-20, 11],
    [-12, 9.5],
    [-4, 11],
    [8, 10],
    [16, 11.5],
    [22, 9.5],
  ])
    g.add(part(plume, mat('placePampas', 0xd9cba3), x, 1.1, z));
  return g;
}

/**
 * Santuario y Mirador San Sebastián (Cerro el Calvario): cruz blanca, ermita
 * de techo rojo sobre una base blanca, cerco bajo de estacas y bancas.
 */
export function buildSanctuary() {
  const g = new Group();
  g.add(box(3.4, 0.4, 3.4, white(), 0, 0.2, 0));
  g.add(box(0.5, 7, 0.5, white(), 0, 3.9, 0));
  g.add(box(3, 0.5, 0.5, white(), 0, 5.6, 0));
  /* Ermita: nicho blanco con techo rojo a dos aguas. */
  g.add(box(1.4, 1.4, 1, white(), 0, 1.1, 1.3));
  g.add(prism(1.8, 1.2, mat('placeRoofRed', 0xb3362a), 0, 1.8, 1.3));
  g.add(box(0.8, 0.9, 0.05, mat('placeNiche', 0x6b2a20), 0, 1.0, 1.82));
  /* Cerco bajo de estacas, blanco y amarillo, alrededor. */
  const picket = [white(), mat('placePicket', 0xe8c547)];
  for (let k = 0; k < 28; k += 1) {
    const a = (k / 28) * Math.PI * 2;
    g.add(box(0.12, 0.8, 0.12, picket[k % 2], Math.sin(a) * 5, 0.4, Math.cos(a) * 5));
  }
  /* Bancas y mesa de madera. */
  for (const [x, z] of [
    [-3.2, 3],
    [3.2, 3],
  ]) {
    g.add(box(2.2, 0.12, 0.45, wood(), x, 0.45, z));
    g.add(box(0.15, 0.45, 0.4, woodDark(), x - 0.9, 0.22, z));
    g.add(box(0.15, 0.45, 0.4, woodDark(), x + 0.9, 0.22, z));
  }
  g.add(box(2, 0.12, 1, wood(), 0, 0.8, -3.4));
  g.add(box(0.15, 0.8, 0.8, woodDark(), -0.8, 0.4, -3.4));
  g.add(box(0.15, 0.8, 0.8, woodDark(), 0.8, 0.4, -3.4));
  return g;
}
