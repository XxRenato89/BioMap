/**
 * Cálculos de cámara sin Cesium, para poder probarlos en Node.
 * La "distancia" (range) es la distancia de la cámara al punto que mira.
 */

/**
 * Distancia equivalente al nivel de zoom 0 de un mapa web: con ella, cada
 * nivel de zoom es la mitad de distancia que el anterior.
 */
const RANGE_AT_ZOOM_0 = 40_000_000;

/**
 * Nivel de zoom de mapa web equivalente a una distancia de cámara.
 *
 * @param {number} range Metros.
 */
export function zoomForRange(range) {
  return Math.log2(RANGE_AT_ZOOM_0 / Math.max(range, 1));
}

/**
 * Distancia de cámara equivalente a un nivel de zoom de mapa web.
 *
 * @param {number} zoom
 */
export function rangeForZoom(zoom) {
  return RANGE_AT_ZOOM_0 / 2 ** zoom;
}

/**
 * Nivel «Región · Zona · Detalle» más cercano a una distancia, comparando en
 * escala logarítmica (como se percibe el acercamiento).
 *
 * @param {number} range
 * @param {{ region: number, zone: number, detail: number }} levels
 */
export function levelForRange(range, levels) {
  const log = Math.log(range);
  if (log > (Math.log(levels.region) + Math.log(levels.zone)) / 2) return 'region';
  if (log > (Math.log(levels.zone) + Math.log(levels.detail)) / 2) return 'zone';
  return 'detail';
}

/**
 * Indica si un punto [lng, lat] está dentro de los límites [[oeste, sur], [este, norte]].
 */
export function isInside([lng, lat], [[west, south], [east, north]]) {
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

/**
 * Lleva un punto [lng, lat] al borde más cercano de los límites, si está afuera.
 */
export function clampToBounds([lng, lat], [[west, south], [east, north]]) {
  return [Math.min(Math.max(lng, west), east), Math.min(Math.max(lat, south), north)];
}

/**
 * Ángulo en grados llevado al rango [0, 360).
 */
export function normalizeHeading(degrees) {
  return ((degrees % 360) + 360) % 360;
}
