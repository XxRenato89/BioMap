/**
 * Clases de cobertura de suelo de la maqueta, tomadas de ESA WorldCover 2021
 * (código WorldCover / 10). Se guardan como un byte por celda en landcover.bin.
 */
export const LANDCOVER = {
  unknown: 0,
  tree: 1,
  shrubland: 2,
  grassland: 3,
  cropland: 4,
  builtUp: 5,
  bare: 6,
  snow: 7,
  water: 8,
  wetland: 9,
  moss: 11,
};

/**
 * Clase de la maqueta para un código WorldCover (10, 20, … 100). El manglar
 * (95) no existe en la zona y se trata como bosque.
 *
 * @param {number} code
 */
export function reclassify(code) {
  if (code === 95) return LANDCOVER.tree;
  if (code === 100) return LANDCOVER.moss;
  if (code % 10 !== 0 || code < 10 || code > 90) return LANDCOVER.unknown;
  return code / 10;
}

const hex = (value) => [(value >> 16) & 255, (value >> 8) & 255, value & 255];

/*
 * Paleta «naturaleza clara»: bosque verde profundo, matorral oliva, pradera
 * verde claro, cultivos paja, urbano gris cálido, suelo desnudo ocre y nieve.
 */
const TINTS = {
  [LANDCOVER.tree]: hex(0x4b7a3c),
  [LANDCOVER.shrubland]: hex(0x8d9a5c),
  [LANDCOVER.grassland]: hex(0xa9c27b),
  [LANDCOVER.cropland]: hex(0xc4bd7e),
  [LANDCOVER.builtUp]: hex(0xb4a99a),
  [LANDCOVER.bare]: hex(0xa79a82),
  [LANDCOVER.snow]: hex(0xf2f4f5),
  [LANDCOVER.wetland]: hex(0x7d9e7b),
  [LANDCOVER.moss]: hex(0x9aa58a),
};

/**
 * Color [r, g, b] (0–255) de una clase, o null si no tiñe (agua o sin dato).
 *
 * @param {number} cls
 */
export function landcoverTint(cls) {
  return TINTS[cls] ?? null;
}
