import { Color } from 'three';
import { gridNormal } from '../terrain/bake.js';
import { LANDCOVER } from '../terrain/landcover.js';
import { valueNoise } from '../utils/noise.js';
import { createHeightSampler, VERTICAL_EXAGGERATION } from '../utils/projection.js';
import { TREE_KINDS } from '../terrain/trees.js';
import landcoverLocal from '../../data/landcover_local.json' with { type: 'json' };

export function isNativeLocation(lng, lat) {
  if (!landcoverLocal?.nativeZones) return false;
  return landcoverLocal.nativeZones.some(
    ({ bounds: b }) => lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north,
  );
}

/**
 * Tipo de árbol según el lugar. WorldCover no distingue plantaciones de
 * bosque nativo: en la zona, las plantaciones (pino, eucalipto) ocupan los
 * lomajes bajos y suaves, y el bosque nativo la precordillera y las laderas fuertes.
 *
 * @param {number} meters Altura del terreno.
 * @param {number} slopeDeg Pendiente en grados.
 * @param {boolean} [isNative=false]
 * @returns {'plantation' | 'native'}
 */
export function treeKind(meters, slopeDeg, isNative = false) {
  if (isNative) return 'native';
  return meters < 900 && slopeDeg < 20 ? 'plantation' : 'native';
}

/**
 * Especie de una plantación: las plantaciones se ordenan en rodales parejos
 * de pino o de eucalipto (manchas de ~400 m), no mezcladas árbol a árbol.
 *
 * @param {number} x Posición en la maqueta (km).
 * @param {number} z
 * @returns {'pine' | 'eucalyptus'}
 */
export function plantationSpecies(x, z) {
  return valueNoise(x / 0.4 + 31.7, z / 0.4 - 12.3) < 0.55 ? 'pine' : 'eucalyptus';
}

/**
 * Especie de un árbol nativo: rodales mezclados de roble, coigüe y peumo o
 * quillay; el bosque esclerófilo (peumo, quillay) abunda en las partes bajas.
 * Dentro de cada rodal van manchas chicas de otras especies: canelo y
 * olivillo entre los robles, y raulí en las partes altas, con el coigüe.
 * Las especies tienen fuente (docs/referencias.md); dónde crece cada una es
 * una aproximación por altura, no un inventario.
 *
 * @param {number} x Posición en la maqueta (km).
 * @param {number} z
 * @param {number} meters Altura del terreno.
 * @returns {'native' | 'coigue' | 'peumo' | 'rauli' | 'canelo' | 'olivillo'}
 */
export function nativeSpecies(x, z, meters) {
  const stand = valueNoise(x / 0.25 - 7.1, z / 0.25 + 3.9);
  /* Manchas de ~100 m dentro del rodal. */
  const patch = valueNoise(x / 0.1 + 41.3, z / 0.1 - 19.7);
  const low = Math.min(Math.max((420 - meters) / 160, 0), 1);
  const high = meters > 480;
  if (stand < 0.25 + 0.25 * low) return 'peumo';
  if (stand > 0.72) return high && patch > 0.5 ? 'rauli' : 'coigue';
  if (patch < 0.24) return 'canelo';
  if (patch > 0.76) return 'olivillo';
  if (high && patch > 0.58) return 'rauli';
  return 'native';
}

/*
 * Altura real de los árboles (m): robles de 15 a 28 m, coigües de 20 a 35 m,
 * peumos y quillayes de 8 a 15 m, raulíes de 22 a 35 m, canelos de 10 a 20 m,
 * olivillos de 15 a 25 m, pinos radiata de 22 a 32 m y eucaliptos, los más
 * altos, de 25 a 40 m.
 */
export const TREE_HEIGHT = {
  native: [15, 28],
  coigue: [20, 35],
  peumo: [8, 15],
  rauli: [22, 35],
  canelo: [10, 20],
  olivillo: [15, 25],
  pine: [22, 32],
  eucalyptus: [25, 40],
};

/*
 * Probabilidad de plantar según la cobertura de suelo: bosque casi lleno,
 * matorral ralo y nada en el resto.
 */
export const COVER_CHANCE = { [LANDCOVER.tree]: 0.92, [LANDCOVER.shrubland]: 0.18 };

/**
 * Número pseudoaleatorio en [0, 1) fijo para una celda (i, j) y un canal:
 * cada árbol queda siempre en el mismo lugar aunque el bosque se vuelva a plantar.
 */
function cellRandom(i, j, channel) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(channel, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Agrega un árbol a su conjunto: tamaño real (con `scale`), giro y tono
 * propios según la especie, siempre los mismos para la celda (i, j).
 */
function emitTree(target, kind, x, ground, z, meters, i, j, scale, color) {
  const [low, high] = TREE_HEIGHT[kind];
  const size = ((low + (high - low) * cellRandom(i, j, 4)) * scale) / 1000;
  const tall = size * (0.92 + cellRandom(i, j, 5) * 0.16);
  const angle = cellRandom(i, j, 6) * Math.PI * 2;
  /* Copa más angosta o más ancha que el modelo: dos árboles de la misma especie no se ven iguales. */
  const wide = size * (0.82 + cellRandom(i, j, 12) * 0.4);
  const cos = Math.cos(angle) * wide;
  const sin = Math.sin(angle) * wide;
  /* Leve inclinación propia (hasta ~5°): un bosque real no crece a plomo. */
  const leanX = (cellRandom(i, j, 10) - 0.5) * 0.18 * tall;
  const leanZ = (cellRandom(i, j, 11) - 0.5) * 0.18 * tall;
  target.matrices.set(
    [cos, 0, -sin, 0, leanX, tall, leanZ, 0, sin, 0, cos, 0, x, ground - 0.001, z, 1],
    target.count * 16,
  );
  const r = cellRandom(i, j, 7);
  if (kind === 'pine') {
    color.setHSL(0.3 + r * 0.03, 0.42, 0.15 + cellRandom(i, j, 8) * 0.04);
  } else if (kind === 'eucalyptus') {
    /* Verde oliva grisáceo, apenas más claro que el pino (antes se veía blanquecino). */
    color.setHSL(
      0.27 + r * 0.04,
      0.3 + cellRandom(i, j, 8) * 0.08,
      0.2 + cellRandom(i, j, 9) * 0.05,
    );
  } else if (kind === 'coigue') {
    /* Siempreverde, verde oscuro y brillante. */
    color.setHSL(0.31 + r * 0.03, 0.46, 0.13 + cellRandom(i, j, 8) * 0.04);
  } else if (kind === 'peumo') {
    /* Esclerófilo: verde oliva oscuro, algo grisáceo. */
    color.setHSL(0.22 + r * 0.04, 0.32, 0.16 + cellRandom(i, j, 8) * 0.04);
  } else if (kind === 'rauli') {
    /* Caducifolio: verde fresco y claro. */
    color.setHSL(0.24 + r * 0.05, 0.42, 0.22 + cellRandom(i, j, 8) * 0.06);
  } else if (kind === 'canelo') {
    /* Hoja clara y algo azulada. */
    color.setHSL(0.33 + r * 0.03, 0.34, 0.26 + cellRandom(i, j, 8) * 0.05);
  } else if (kind === 'olivillo') {
    /* Verde oscuro y opaco, tirando a gris. */
    color.setHSL(0.29 + r * 0.03, 0.3, 0.14 + cellRandom(i, j, 8) * 0.04);
  } else {
    /* Roble: verde más claro y variado; algo más oscuro en altura. */
    const altitude = Math.min(Math.max((meters - 600) / 1400, 0), 1);
    color.setHSL(
      0.25 + r * 0.08,
      0.36 + cellRandom(i, j, 8) * 0.16,
      0.2 + cellRandom(i, j, 9) * 0.08 - altitude * 0.05,
    );
  }
  target.colors.set([color.r, color.g, color.b], target.count * 3);
  target.count += 1;
}

/**
 * Bosque a escala real alrededor de un punto: una grilla de celdas de
 * `spacing` km dentro de `radius`, con a lo más un árbol por celda según la
 * cobertura de suelo de WorldCover (nunca en pendientes muy fuertes).
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint16Array} heights
 * @param {{ width: number, depth: number }} projection
 * @param {{ data: Uint8Array, columns: number, rows: number }} cover
 * @param {{ center: [number, number], radius: number, spacing: number, max: number,
 *   fade?: boolean, blocked?: (cell: number) => boolean }} area
 * @returns {{ native: TreeSet, pine: TreeSet, eucalyptus: TreeSet }}
 *
 * @typedef {{ matrices: Float32Array, colors: Float32Array, count: number }} TreeSet
 */
export function plantForest(
  meta,
  heights,
  projection,
  cover,
  { center, radius, spacing, max, fade = true, blocked },
) {
  const { columns, rows } = meta;
  const cellX = projection.width / (columns - 1);
  const cellZ = projection.depth / (rows - 1);
  const heightAt = createHeightSampler(meta, heights, projection);
  const slot = () => ({
    matrices: new Float32Array(max * 16),
    colors: new Float32Array(max * 3),
    count: 0,
  });
  const kinds = Object.fromEntries(TREE_KINDS.map((kind) => [kind, slot()]));
  const color = new Color();
  const [cx, cz] = center;
  const i0 = Math.floor((cx - radius) / spacing);
  const i1 = Math.ceil((cx + radius) / spacing);
  const j0 = Math.floor((cz - radius) / spacing);
  const j1 = Math.ceil((cz + radius) / spacing);
  let planted = 0;
  for (let j = j0; j <= j1 && planted < max; j += 1) {
    for (let i = i0; i <= i1 && planted < max; i += 1) {
      const x = (i + cellRandom(i, j, 1)) * spacing;
      const z = (j + cellRandom(i, j, 2)) * spacing;
      const distance = Math.hypot(x - cx, z - cz);
      if (distance > radius) continue;
      const u = x / projection.width + 0.5;
      const v = z / projection.depth + 0.5;
      if (u <= 0 || u >= 1 || v <= 0 || v >= 1) continue;
      const cls =
        cover.data[Math.floor(v * cover.rows) * cover.columns + Math.floor(u * cover.columns)];
      if (cellRandom(i, j, 3) >= (COVER_CHANCE[cls] ?? 0)) continue;
      const col = Math.min(columns - 2, Math.max(1, Math.round(u * (columns - 1))));
      const row = Math.min(rows - 2, Math.max(1, Math.round(v * (rows - 1))));
      const n = gridNormal(heights, columns, rows, col, row, cellX, cellZ);
      const slopeDeg = (Math.acos(n[1]) * 180) / Math.PI;
      if (slopeDeg > 42 || blocked?.(row * columns + col)) continue;
      const meters = heights[row * columns + col];
      const [lng, lat] = projection.toLngLat ? projection.toLngLat(x, z) : [0, 0];
      const inNativeZone = isNativeLocation(lng, lat);
      const kind =
        inNativeZone || treeKind(meters, slopeDeg) === 'native'
          ? nativeSpecies(x, z, meters)
          : plantationSpecies(x, z);
      const edge = fade ? Math.min(Math.max((radius - distance) / (radius * 0.25), 0), 1) : 1;
      emitTree(kinds[kind], kind, x, heightAt(x, z), z, meters, i, j, 0.35 + 0.65 * edge, color);
      planted += 1;
    }
  }
  return kinds;
}

/**
 * Bosque del borde: fuera de la zona, en una franja de `band` km.
 *
 * @param {{ width: number, depth: number }} zone Tamaño de la zona (km).
 * @param {(x: number, z: number) => number} groundAt Altura del paisaje (unidades).
 * @param {(x: number, z: number) => number} coverAt Clase de cobertura en (x, z).
 * @param {{ band: number, spacing: number, max: number }} options
 * @returns {{ native: TreeSet, pine: TreeSet, eucalyptus: TreeSet }}
 */
export function plantFringe(zone, groundAt, coverAt, { band, spacing, max }) {
  const slot = () => ({
    matrices: new Float32Array(max * 16),
    colors: new Float32Array(max * 3),
    count: 0,
  });
  const kinds = Object.fromEntries(TREE_KINDS.map((kind) => [kind, slot()]));
  const color = new Color();
  const halfW = zone.width / 2;
  const halfD = zone.depth / 2;
  const i0 = Math.floor((-halfW - band) / spacing);
  const i1 = Math.ceil((halfW + band) / spacing);
  const j0 = Math.floor((-halfD - band) / spacing);
  const j1 = Math.ceil((halfD + band) / spacing);
  const probe = 0.03;
  let planted = 0;
  for (let j = j0; j <= j1 && planted < max; j += 1) {
    for (let i = i0; i <= i1 && planted < max; i += 1) {
      const x = (i + cellRandom(i, j, 1)) * spacing;
      const z = (j + cellRandom(i, j, 2)) * spacing;
      const distance = Math.hypot(
        Math.max(Math.abs(x) - halfW, 0),
        Math.max(Math.abs(z) - halfD, 0),
      );
      if (distance <= 0 || distance > band) continue;
      const fade = (1 - distance / band) ** 1.5;
      if (cellRandom(i, j, 3) >= (COVER_CHANCE[coverAt(x, z)] ?? 0) * fade) continue;
      const ground = groundAt(x, z);
      const slope =
        Math.hypot(
          groundAt(x + probe, z) - groundAt(x - probe, z),
          groundAt(x, z + probe) - groundAt(x, z - probe),
        ) /
        (2 * probe);
      const slopeDeg = (Math.atan(slope) * 180) / Math.PI;
      if (slopeDeg > 42) continue;
      const meters = (ground * 1000) / VERTICAL_EXAGGERATION;
      const kind =
        treeKind(meters, slopeDeg) === 'plantation'
          ? plantationSpecies(x, z)
          : nativeSpecies(x, z, meters);
      emitTree(kinds[kind], kind, x, ground, z, meters, i, j, 0.6 + 0.4 * fade, color);
      planted += 1;
    }
  }
  return kinds;
}

/* Probabilidad de una roca por celda: suelo desnudo, laderas fuertes y algo en el pasto. */
const ROCK_CHANCE = {
  [LANDCOVER.bare]: 0.5,
  [LANDCOVER.grassland]: 0.05,
  [LANDCOVER.shrubland]: 0.08,
};
const STEEP_DEG = 30;

/**
 * Rocas sueltas y afloramientos: en suelo desnudo y en laderas de más de
 * STEEP_DEG grados, agrupadas, achatadas, giradas y de 3 a 10 m, siempre las mismas por celda.
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint16Array} heights
 * @param {{ width: number, depth: number }} projection
 * @param {{ data: Uint8Array, columns: number, rows: number }} cover
 * @param {{ spacing: number, max: number, blocked?: (cell: number) => boolean }} options
 * @returns {TreeSet}
 */
export function plantRocks(meta, heights, projection, cover, { spacing, max, blocked }) {
  const { columns, rows } = meta;
  const cellX = projection.width / (columns - 1);
  const cellZ = projection.depth / (rows - 1);
  const heightAt = createHeightSampler(meta, heights, projection);
  const rocks = {
    matrices: new Float32Array(max * 16),
    colors: new Float32Array(max * 3),
    count: 0,
  };
  const color = new Color();
  const i0 = Math.floor(-projection.width / 2 / spacing);
  const j0 = Math.floor(-projection.depth / 2 / spacing);
  for (let j = j0; j <= -j0 && rocks.count < max; j += 1) {
    for (let i = i0; i <= -i0 && rocks.count < max; i += 1) {
      const x = (i + cellRandom(i, j, 11)) * spacing;
      const z = (j + cellRandom(i, j, 12)) * spacing;
      const u = x / projection.width + 0.5;
      const v = z / projection.depth + 0.5;
      if (u <= 0 || u >= 1 || v <= 0 || v >= 1) continue;
      const col = Math.min(columns - 2, Math.max(1, Math.round(u * (columns - 1))));
      const row = Math.min(rows - 2, Math.max(1, Math.round(v * (rows - 1))));
      if (blocked?.(row * columns + col)) continue;
      const n = gridNormal(heights, columns, rows, col, row, cellX, cellZ);
      const slopeDeg = (Math.acos(n[1]) * 180) / Math.PI;
      const cls =
        cover.data[Math.floor(v * cover.rows) * cover.columns + Math.floor(u * cover.columns)];
      /* Agrupadas en pedregales, no repartidas parejo. */
      const cluster = 0.3 + 1.4 * valueNoise(x / 0.12 + 7.1, z / 0.12 - 3.4);
      const chance = Math.max(ROCK_CHANCE[cls] ?? 0, slopeDeg > STEEP_DEG ? 0.35 : 0) * cluster;
      if (cellRandom(i, j, 13) >= chance) continue;
      const size = (3 + cellRandom(i, j, 14) * 7) / 1000;
      const flat = size * (0.45 + cellRandom(i, j, 15) * 0.35);
      const angle = cellRandom(i, j, 16) * Math.PI * 2;
      const cos = Math.cos(angle) * size;
      const sin = Math.sin(angle) * size;
      rocks.matrices.set(
        [cos, 0, -sin, 0, 0, flat, 0, 0, sin, 0, cos, 0, x, heightAt(x, z) - flat * 0.3, z, 1],
        rocks.count * 16,
      );
      color.setHSL(
        0.08 + cellRandom(i, j, 17) * 0.04,
        0.06 + cellRandom(i, j, 18) * 0.08,
        0.24 + cellRandom(i, j, 19) * 0.1,
      );
      rocks.colors.set([color.r, color.g, color.b], rocks.count * 3);
      rocks.count += 1;
    }
  }
  return rocks;
}
