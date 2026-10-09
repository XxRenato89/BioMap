/**
 * Valores por defecto del visor. Los límites del territorio son provisionales
 * (pendientes con el cliente) y deben coincidir con los del relieve de la
 * maqueta (public/diorama/terrain.json). Todo se puede cambiar por variables VITE_*.
 */
const DEFAULT_BOUNDS = [
  [-71.855, -37.7672],
  [-71.75374, -37.672],
];

/**
 * Convierte un texto en número; si falta o no es válido, usa el valor por defecto.
 */
function toNumber(value, fallback) {
  const number = Number(value);
  return value === undefined || value === '' || Number.isNaN(number) ? fallback : number;
}

/**
 * Lee límites con el formato "oeste,sur,este,norte"; si el formato no es válido, devuelve null.
 */
function toBounds(value) {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null;
  const [west, south, east, north] = parts;
  return [
    [west, south],
    [east, north],
  ];
}

/**
 * Construye la configuración del visor a partir de las variables de entorno.
 *
 * @param {Record<string, string | undefined>} env
 */
export function buildConfig(env) {
  return {
    /*
     * Vista inicial: la zona de Angostura completa, con el norte arriba, como
     * al acercarse a la vitrina. `range` es la distancia de la cámara al
     * centro (m) y `pitch` su inclinación (grados).
     */
    initialView: { center: [-71.8044, -37.7196], range: 13_000, heading: 0, pitch: -40 },
    maxBounds: toBounds(env.VITE_MAP_BOUNDS) ?? DEFAULT_BOUNDS,
    minRange: 120,
    maxRange: 18_000,
    /*
     * Niveles «Región · Zona · Detalle» como distancia de la cámara (m).
     */
    zoomLevels: { region: 13_000, zone: 4_500, detail: 1_200 },
    /*
     * Modo de reposo: la cámara vuelve sola a la vista de inicio tras este
     * tiempo sin uso. El reinicio completo (idioma, capas) llega después, con aviso.
     */
    restDelayMs: toNumber(env.VITE_REST_S, 45) * 1000,
    idleTimeoutMs: toNumber(env.VITE_IDLE_TIMEOUT_S, 120) * 1000,
    idleWarningMs: toNumber(env.VITE_IDLE_WARNING_S, 10) * 1000,
    attractDelayMs: toNumber(env.VITE_ATTRACT_DELAY_S, 60) * 1000,
    refreshMs: toNumber(env.VITE_REFRESH_S, 60) * 1000,
    retryMs: 10_000,
    publicUrl: env.VITE_PUBLIC_URL || '',
    kioskWifi: env.VITE_KIOSK_WIFI || 'BioMap-Angostura',
  };
}

export const config = buildConfig(import.meta.env);
