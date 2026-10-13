import { landcoverTint, LANDCOVER } from './landcover.js';
import { valueNoise } from '../utils/noise.js';
import { metersToY } from '../utils/projection.js';

/*
 * Horneado de la superficie de la maqueta: funciones puras que corren en el
 * script de build (Node) sobre la grilla de alturas completa. El visor solo
 * carga las imágenes que salen de aquí.
 */

/**
 * Normal del relieve exagerado (el mismo que se ve) en una celda, con
 * diferencias centrales.
 *
 * @returns {[number, number, number]}
 */
export function gridNormal(heights, columns, rows, col, row, cellX, cellZ) {
  const at = (c, r) =>
    metersToY(
      heights[Math.min(Math.max(r, 0), rows - 1) * columns + Math.min(Math.max(c, 0), columns - 1)],
    );
  const dx = (at(col + 1, row) - at(col - 1, row)) / (2 * cellX);
  const dz = (at(col, row + 1) - at(col, row - 1)) / (2 * cellZ);
  const length = Math.hypot(dx, 1, dz);
  return [-dx / length, 1 / length, -dz / length];
}

/*
 * Luces del sombreado: la principal desde el noroeste a 45° (la misma que el
 * foco de la escena) y dos de relleno desde el oeste y el norte, para que
 * ninguna ladera quede plana.
 */
const LIGHTS = [
  [0.6, [-0.5, Math.SQRT1_2, -0.5]],
  [0.2, [-Math.SQRT1_2, Math.SQRT1_2, 0]],
  [0.2, [0, Math.SQRT1_2, -Math.SQRT1_2]],
];

/**
 * Sombreado de laderas (0 a 1). En terreno plano vale √½ ≈ 0,707.
 *
 * @param {Uint16Array} heights Metros, fila por fila de norte a sur.
 * @param {number} columns
 * @param {number} rows
 * @param {number} cellX Lado de una celda hacia el este (km).
 * @param {number} cellZ Lado de una celda hacia el sur (km).
 */
export function hillshade(heights, columns, rows, cellX, cellZ) {
  const shade = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const n = gridNormal(heights, columns, rows, col, row, cellX, cellZ);
      let value = 0;
      for (const [weight, [lx, ly, lz]] of LIGHTS)
        value += weight * Math.max(0, n[0] * lx + n[1] * ly + n[2] * lz);
      shade[row * columns + col] = value;
    }
  }
  return shade;
}

/**
 * Oclusión ambiental por horizonte (1 = cielo abierto, menos = encajonado):
 * desde cada celda se busca, en varias direcciones, el ángulo más alto del
 * relieve que la rodea. Oscurece quebradas y fondos de valle. Se calcula en
 * una grilla `scale` veces más gruesa y se interpola, porque es lo más caro.
 *
 * @param {Uint16Array} heights
 * @param {number} columns
 * @param {number} rows
 * @param {number} cellX
 * @param {number} cellZ
 * @param {{ radiusKm: number, directions: number, scale: number }} options
 */
export function ambientOcclusion(heights, columns, rows, cellX, cellZ, options) {
  const { radiusKm, directions, scale } = options;
  const coarseColumns = Math.ceil(columns / scale);
  const coarseRows = Math.ceil(rows / scale);
  const coarse = new Float32Array(coarseColumns * coarseRows);
  for (let r = 0; r < coarseRows; r += 1)
    for (let c = 0; c < coarseColumns; c += 1)
      coarse[r * coarseColumns + c] = metersToY(
        heights[Math.min(r * scale, rows - 1) * columns + Math.min(c * scale, columns - 1)],
      );

  const stepKm = Math.min(cellX, cellZ) * scale;
  const steps = Math.max(1, Math.ceil(radiusKm / stepKm));
  const dirs = Array.from({ length: directions }, (_, k) => {
    const angle = (k / directions) * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const open = new Float32Array(coarseColumns * coarseRows);
  for (let r = 0; r < coarseRows; r += 1) {
    for (let c = 0; c < coarseColumns; c += 1) {
      const y0 = coarse[r * coarseColumns + c];
      let occlusion = 0;
      for (const [dx, dz] of dirs) {
        let maxTan = 0;
        for (let t = 1; t <= steps; t += 1) {
          const sc = Math.round(c + (dx * t * stepKm) / (cellX * scale));
          const sr = Math.round(r + (dz * t * stepKm) / (cellZ * scale));
          if (sc < 0 || sr < 0 || sc >= coarseColumns || sr >= coarseRows) break;
          maxTan = Math.max(maxTan, (coarse[sr * coarseColumns + sc] - y0) / (t * stepKm));
        }
        occlusion += maxTan / Math.hypot(1, maxTan);
      }
      open[r * coarseColumns + c] = 1 - occlusion / directions;
    }
  }

  const ao = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    const fr = Math.min(row / scale, coarseRows - 1);
    const r0 = Math.floor(fr);
    const r1 = Math.min(r0 + 1, coarseRows - 1);
    const tr = fr - r0;
    for (let col = 0; col < columns; col += 1) {
      const fc = Math.min(col / scale, coarseColumns - 1);
      const c0 = Math.floor(fc);
      const c1 = Math.min(c0 + 1, coarseColumns - 1);
      const tc = fc - c0;
      const top = open[r0 * coarseColumns + c0] * (1 - tc) + open[r0 * coarseColumns + c1] * tc;
      const bottom = open[r1 * coarseColumns + c0] * (1 - tc) + open[r1 * coarseColumns + c1] * tc;
      ao[row * columns + col] = top * (1 - tr) + bottom * tr;
    }
  }
  return ao;
}

const hex = (value) => [(value >> 16) & 255, (value >> 8) & 255, value & 255];

/*
 * Paleta por altura (m): valle, lomajes, bosque, matorral de altura, roca y
 * nieve. Da la base sobre la que se tiñe la cobertura de suelo.
 */
const ELEVATION_RAMP = [
  [0, hex(0xa9c27a)],
  [250, hex(0x93b467)],
  [600, hex(0x5f8f47)],
  [1100, hex(0x3d6b3a)],
  [1600, hex(0x56693f)],
  [1950, hex(0x7d7a5f)],
  [2300, hex(0x8f8a80)],
  [2650, hex(0xc9c8c4)],
  [2900, hex(0xf4f6f7)],
];
const ROCK = hex(0x7b7166);
const RIVERBED = hex(0x2e5e74);
const FIELD = hex(0xa9b56e);
const FLAT_SHADE = Math.SQRT1_2;

/**
 * Luz que se hornea sobre una foto satelital: el sombreado de laderas y la
 * oclusión del relieve, suaves para no tapar la foto. 1 = terreno plano abierto.
 *
 * @param {number} shade Sombreado de `hillshade`.
 * @param {number} ao Oclusión de `ambientOcclusion`.
 */
export function satelliteLight(shade, ao) {
  return Math.min(Math.max(0.45 + (0.55 * shade) / FLAT_SHADE, 0.35), 1.25) * (0.6 + 0.4 * ao);
}

/*
 * Paleta de maqueta física por cobertura de suelo (como las maquetas
 * impresas: bosque verde, pradera clara, cultivos pajizos, suelo crema).
 */
const MODEL_PALETTE = {
  [LANDCOVER.tree]: hex(0x4a7c3a),
  [LANDCOVER.shrubland]: hex(0x7d9a52),
  [LANDCOVER.grassland]: hex(0xb3c98a),
  [LANDCOVER.cropland]: hex(0xd9cf96),
  [LANDCOVER.builtUp]: hex(0xe3d3bd),
  [LANDCOVER.bare]: hex(0xe9dfcc),
  [LANDCOVER.snow]: hex(0xf7f7f5),
  [LANDCOVER.water]: hex(0x3b9fd9),
  [LANDCOVER.wetland]: hex(0x7fae96),
  [LANDCOVER.moss]: hex(0xa7b48a),
};
const CREAM = hex(0xf5f0ef);

/*
 * Cuánto se acerca la foto a la paleta de maqueta (0 = foto pura).
 */
const MODEL_BLEND = 0.38;

/**
 * Color de la superficie que fusiona la foto satelital con una maqueta
 * física: la foto se aclara un poco (levanta sombras), se desatura y se
 * tiñe hacia el color de su cobertura de suelo, y encima va la luz del relieve.
 *
 * @param {number[]} rgb Color de la foto (0 a 255).
 * @param {number} cls Clase de cobertura (landcover.js).
 * @param {number} light Luz horneada (`satelliteLight`).
 * @param {number} [blend] Cuánto se acerca a la paleta (0 = foto pura).
 * @returns {number[]} Color final (0 a 255).
 */
export function fuseColor(rgb, cls, light, blend = MODEL_BLEND) {
  const lifted = rgb.map((channel) => 255 * (channel / 255) ** 0.82);
  const luma = 0.299 * lifted[0] + 0.587 * lifted[1] + 0.114 * lifted[2];
  const photo = lifted.map((channel) => luma + (channel - luma) * 0.82);
  const style = MODEL_PALETTE[cls] ?? CREAM;
  return mix(photo, style, cls === LANDCOVER.water ? Math.max(blend, 0.6) : blend).map((channel) =>
    Math.min(255, Math.max(0, Math.round(channel * light))),
  );
}

function rampColor(meters) {
  for (let i = 1; i < ELEVATION_RAMP.length; i += 1) {
    const [top, color] = ELEVATION_RAMP[i];
    if (meters <= top) {
      const [bottom, previous] = ELEVATION_RAMP[i - 1];
      const t = (meters - bottom) / (top - bottom);
      return previous.map((channel, k) => channel + (color[k] - channel) * t);
    }
  }
  return ELEVATION_RAMP.at(-1)[1];
}

const mix = (a, b, t) => a.map((channel, k) => channel + (b[k] - channel) * t);

/**
 * Cuánto pesa la cobertura de suelo frente a la paleta por altura: plena en
 * valles y lomajes, nada en la alta cordillera (que conserva roca y nieve).
 */
function coverWeight(meters) {
  if (meters < 1500) return 0.72;
  if (meters > 2200) return 0;
  return (0.72 * (2200 - meters)) / 700;
}

/**
 * Hornea las dos imágenes RGB de la superficie, a la resolución del relieve:
 * - color: paleta por altura teñida por la cobertura de suelo, roca en
 *   pendientes fuertes, nieve en cumbres, lechos de agua, y sobre todo eso el
 *   sombreado de laderas y la oclusión ambiental (la luz ya viene pintada);
 * - normales en espacio de objeto, para la nitidez de crestas y quebradas
 *   aunque la malla lejana tenga menos vértices.
 *
 * @param {{ columns: number, rows: number, widthKm: number, depthKm: number }} meta
 * @param {Uint16Array} heights
 * @param {{ data: Uint8Array, columns: number, rows: number } | null} cover
 * @param {{ ao?: { radiusKm: number, directions: number, scale: number } }} [options]
 */
export function bakeSurface(meta, heights, cover, options = {}) {
  const { columns, rows } = meta;
  const cellX = meta.widthKm / (columns - 1);
  const cellZ = meta.depthKm / (rows - 1);
  const shade = hillshade(heights, columns, rows, cellX, cellZ);
  const ao = ambientOcclusion(
    heights,
    columns,
    rows,
    cellX,
    cellZ,
    options.ao ?? { radiusKm: 1.5, directions: 8, scale: 4 },
  );
  const color = new Uint8Array(columns * rows * 3);
  const normal = new Uint8Array(columns * rows * 3);
  for (let row = 0; row < rows; row += 1) {
    const coverRow = cover ? Math.min(Math.floor((row / rows) * cover.rows), cover.rows - 1) : 0;
    for (let col = 0; col < columns; col += 1) {
      const i = row * columns + col;
      const meters = heights[i];
      const n = gridNormal(heights, columns, rows, col, row, cellX, cellZ);
      const o = i * 3;

      if (options.satellite) {
        const satR = options.satellite[o];
        const satG = options.satellite[o + 1];
        const satB = options.satellite[o + 2];
        const satLight = satelliteLight(shade[i], ao[i]);
        color[o] = Math.min(255, Math.round(satR * satLight));
        color[o + 1] = Math.min(255, Math.round(satG * satLight));
        color[o + 2] = Math.min(255, Math.round(satB * satLight));
        for (let k = 0; k < 3; k += 1) {
          normal[o + k] = Math.round((n[k] * 0.5 + 0.5) * 255);
        }
        continue;
      }

      const cls = cover
        ? cover.data[
            coverRow * cover.columns +
              Math.min(Math.floor((col / columns) * cover.columns), cover.columns - 1)
          ]
        : LANDCOVER.unknown;

      let rgb = rampColor(meters);
      let tint = landcoverTint(cls);
      if (tint && cls === LANDCOVER.cropland && valueNoise(col / 7, row / 7) > 0.55) tint = FIELD;
      if (tint) rgb = mix(rgb, tint, coverWeight(meters));
      const steep = Math.min(Math.max((0.9 - n[1]) / 0.25, 0), 1);
      const snowy = meters > 2350 && n[1] > 0.72;
      rgb = mix(rgb, ROCK, steep * (snowy ? 0.3 : 1));
      if (snowy) rgb = mix(rgb, [246, 246, 246], Math.min((meters - 2350) / 500, 1));
      if (cls === LANDCOVER.water) rgb = RIVERBED;

      const light =
        Math.min(Math.max(0.42 + (0.58 * shade[i]) / FLAT_SHADE, 0.3), 1.25) *
        (0.45 + 0.55 * ao[i]);
      const grain =
        0.93 + valueNoise(col / 18, row / 18) * 0.1 + valueNoise(col / 3, row / 3) * 0.04;
      for (let k = 0; k < 3; k += 1) {
        color[o + k] = Math.min(Math.round(rgb[k] * light * grain), 255);
        normal[o + k] = Math.round((n[k] * 0.5 + 0.5) * 255);
      }
    }
  }
  return { color, normal };
}
