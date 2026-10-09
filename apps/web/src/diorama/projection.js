/**
 * Sistema de coordenadas de la maqueta: 1 unidad = 1 km. El centro de la
 * maqueta está en el origen, X apunta al este, Z al sur e Y hacia arriba.
 * Todo va a escala 1:1: las alturas son las reales (sin exagerar), igual
 * que el ancho de las presas y el alto de los árboles. Si se quisiera
 * realzar la cordillera, basta subir este factor y volver a hornear la
 * superficie (las normales y el sombreado dependen de él).
 */
export const VERTICAL_EXAGGERATION = 1;

const KM_PER_DEGREE = 111.32;

/**
 * Crea las conversiones entre longitud/latitud y la maqueta.
 *
 * @param {[[number, number], [number, number]]} bounds [[oeste, sur], [este, norte]]
 */
export function createProjection([[west, south], [east, north]]) {
  const middleLat = ((north + south) / 2) * (Math.PI / 180);
  const width = (east - west) * KM_PER_DEGREE * Math.cos(middleLat);
  const depth = (north - south) * KM_PER_DEGREE;
  return {
    width,
    depth,
    /**
     * Posición horizontal (x, z) de un punto [lng, lat].
     */
    toWorld([lng, lat]) {
      return {
        x: ((lng - west) / (east - west) - 0.5) * width,
        z: (0.5 - (lat - south) / (north - south)) * depth,
      };
    },
    /**
     * Punto [lng, lat] de una posición (x, z) de la maqueta.
     */
    toLngLat(x, z) {
      return [
        west + (x / width + 0.5) * (east - west),
        south + (0.5 - z / depth) * (north - south),
      ];
    },
  };
}

/**
 * Altura en unidades de maqueta para una altura real en metros.
 *
 * @param {number} meters
 */
export function metersToY(meters) {
  return (meters / 1000) * VERTICAL_EXAGGERATION;
}

/**
 * Lector del mapa de alturas: altura (en unidades de maqueta) en cualquier
 * punto (x, z), con interpolación bilineal.
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint16Array} heights Metros, fila por fila de norte a sur.
 * @param {{ width: number, depth: number }} projection
 */
export function createHeightSampler(meta, heights, projection) {
  const { columns, rows } = meta;
  const at = (col, row) => heights[row * columns + col];
  return (x, z) => {
    const fx = Math.min(Math.max((x / projection.width + 0.5) * (columns - 1), 0), columns - 1);
    const fz = Math.min(Math.max((z / projection.depth + 0.5) * (rows - 1), 0), rows - 1);
    const c0 = Math.floor(fx);
    const r0 = Math.floor(fz);
    const c1 = Math.min(c0 + 1, columns - 1);
    const r1 = Math.min(r0 + 1, rows - 1);
    const tx = fx - c0;
    const tz = fz - r0;
    const top = at(c0, r0) * (1 - tx) + at(c1, r0) * tx;
    const bottom = at(c0, r1) * (1 - tx) + at(c1, r1) * tx;
    return metersToY(top * (1 - tz) + bottom * tz);
  };
}
