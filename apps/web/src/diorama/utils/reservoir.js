/*
 * Embalse Angostura: su espejo de agua es horizontal, a la cota de operación
 * (~326 m; varía alrededor de un metro). El relieve SRTM es anterior al
 * embalse y los polígonos de OpenStreetMap no siempre calzan con él, así que
 * estos datos corrigen ambos.
 *
 * - `surface`: dónde el agua se fuerza a la cota. Su borde oeste queda al
 *   este de la presa: aguas abajo, el río va más bajo y no debe subir.
 * - `bed`: dónde el fondo bajo el agua se hunde bajo la cota, para que el
 *   terreno nunca asome sobre el espejo. Incluye la zona de la presa.
 */
export const RESERVOIR = {
  level: 326,
  bedDepth: 5,
  /* Vaciado: queda solo un hilo de agua en lo más hondo del cañón, como el río de antes (m). */
  drainedLevel: 295,
  surface: { west: -71.808, east: -71.745, south: -37.778, north: -37.695 },
  bed: { west: -71.815, east: -71.745, south: -37.778, north: -37.695 },
};

/**
 * ¿Está [lng, lat] dentro de unos límites { west, east, south, north }?
 */
export function within([lng, lat], { west, east, south, north }) {
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

/**
 * Cuánto se vació el embalse (0 lleno, 1 vacío), compartido por los shaders
 * del agua y del terreno. Lo anima la escena según `drained` del visor.
 */
export const reservoirDrain = { value: 0 };
