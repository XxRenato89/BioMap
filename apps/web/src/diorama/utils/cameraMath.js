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

/**
 * Vista que deja todos los puntos [lng, lat] en pantalla: centro en el medio
 * de los puntos y la distancia justa para su ancho y su fondo, con `margin`
 * extra para los pines y la interfaz. La inclinación acorta el fondo. Prueba
 * cada rumbo de `headings` y se queda con el que los muestra más de cerca
 * (en un teléfono vertical conviene girar el mapa a lo largo de los puntos).
 *
 * @param {Array<[number, number]>} coords
 * @param {{ aspect: number, fov: number, base: { pitch: number, heading?: number },
 *   headings?: number[], margin?: number, minRange?: number, maxRange?: number }} options
 */
export function fitView(
  coords,
  {
    aspect,
    fov,
    base,
    headings = [base.heading ?? 0],
    margin = 1.3,
    minRange = 1_000,
    maxRange = 12_000,
  },
) {
  const lat0 = coords.reduce((sum, [, lat]) => sum + lat, 0) / coords.length;
  const lng0 = coords.reduce((sum, [lng]) => sum + lng, 0) / coords.length;
  const mPerLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  /* Metros al este (x) y al sur (z), como la maqueta. */
  const local = coords.map(([lng, lat]) => [(lng - lng0) * mPerLng, (lat0 - lat) * 111_320]);
  const tan = Math.tan((fov * Math.PI) / 360);
  const tilt = Math.sin((Math.abs(base.pitch) * Math.PI) / 180);

  let best = null;
  for (const heading of headings) {
    const h = (heading * Math.PI) / 180;
    const [c, s] = [Math.cos(h), Math.sin(h)];
    /* u: hacia la derecha de la pantalla; v: hacia el fondo. */
    const us = local.map(([x, z]) => x * c + z * s);
    const vs = local.map(([x, z]) => x * s - z * c);
    const [uMin, uMax, vMin, vMax] = [
      Math.min(...us),
      Math.max(...us),
      Math.min(...vs),
      Math.max(...vs),
    ];
    const range = Math.max(
      ((uMax - uMin) * margin) / (2 * tan * aspect),
      ((vMax - vMin) * margin * tilt) / (2 * tan),
    );
    if (best && range >= best.range) continue;
    const [u, v] = [(uMin + uMax) / 2, (vMin + vMax) / 2];
    const [x, z] = [u * c + v * s, u * s - v * c];
    best = { heading, range, center: [lng0 + x / mPerLng, lat0 - z / 111_320] };
  }
  return { ...base, ...best, range: Math.min(Math.max(best.range, minRange), maxRange) };
}
