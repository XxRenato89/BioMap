import { create } from 'zustand';

/**
 * Niveles de calidad de la maqueta. El equipo del tótem no se conoce, así que
 * se parte en «medium» y se sube o baja según los cuadros por segundo reales.
 * - dprMoving / dprStill: densidad de dibujo mientras la cámara se mueve y
 *   cuando se detiene (el cuadro quieto se dibuja nítido para la pantalla 4K);
 * - finestStep / maxErrorPx / vertexBudget: detalle máximo del relieve;
 * - forest: bosque a escala real en toda la maqueta (separación entre árboles
 *   en km y árboles como máximo) y, cerca de la cámara, radio (km) y cantidad
 *   máxima de árboles con el modelo detallado; shadows: sombras dinámicas.
 */
export const TIERS = {
  low: {
    dprMoving: 1,
    dprStill: 1.5,
    finestStep: 2,
    maxErrorPx: 3,
    vertexBudget: 1_500_000,
    forest: { spacing: 0.03, max: 40_000, nearRadius: 0.6, nearMax: 6_000 },
    shadows: false,
  },
  medium: {
    dprMoving: 1,
    dprStill: 2,
    finestStep: 1,
    maxErrorPx: 2,
    vertexBudget: 3_000_000,
    forest: { spacing: 0.02, max: 100_000, nearRadius: 1, nearMax: 15_000 },
    shadows: false,
  },
  high: {
    dprMoving: 1.5,
    dprStill: 2,
    finestStep: 1,
    maxErrorPx: 1.5,
    vertexBudget: 6_000_000,
    forest: { spacing: 0.015, max: 180_000, nearRadius: 1.5, nearMax: 30_000 },
    shadows: true,
  },
};

const ORDER = ['low', 'medium', 'high'];
const DEFAULT_TIER = 'medium';
const STORAGE_KEY = 'biomap.quality';

/**
 * Nivel fijado por configuración (VITE_QUALITY), o null si no hay uno válido.
 *
 * @param {string | undefined} value
 */
export function parseQuality(value) {
  return ORDER.includes(value) ? value : null;
}

/**
 * Nivel vecino: `direction` +1 sube, −1 baja; se queda en los extremos.
 *
 * @param {string} name
 * @param {1 | -1} direction
 */
export function stepTier(name, direction) {
  const index = Math.min(Math.max(ORDER.indexOf(name) + direction, 0), ORDER.length - 1);
  return ORDER[index];
}

/**
 * Nivel recordado en este equipo; «medium» si no hay o no se puede leer.
 *
 * @param {Storage | null} storage
 */
export function loadTier(storage) {
  try {
    return parseQuality(storage?.getItem(STORAGE_KEY) ?? undefined) ?? DEFAULT_TIER;
  } catch {
    return DEFAULT_TIER;
  }
}

/**
 * Recuerda el nivel en este equipo (si el navegador lo permite).
 *
 * @param {Storage | null} storage
 * @param {string} name
 */
export function saveTier(storage, name) {
  try {
    storage?.setItem(STORAGE_KEY, name);
  } catch {
    /* Sin almacenamiento (modo privado): se vuelve a medir en cada inicio. */
  }
}

/**
 * Almacenamiento local del navegador, o null si no está disponible.
 */
export function browserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const pinned = parseQuality(import.meta.env?.VITE_QUALITY);

/**
 * Estado del dibujo: nivel de calidad, si está fijado por configuración, si
 * la cámara se está moviendo (define la densidad de dibujo) y las cifras del
 * panel de diagnóstico (?debug).
 */
export const useRenderStore = create((set, get) => ({
  tier: pinned ?? loadTier(browserStorage()),
  pinned: pinned !== null,
  moving: false,
  stats: null,
  setMoving: (moving) => {
    if (get().moving !== moving) set({ moving });
  },
  /*
   * Sube o baja un nivel según el rendimiento medido (salvo que esté fijado).
   */
  stepTier: (direction) => {
    const { tier, pinned: isPinned } = get();
    if (isPinned) return;
    const next = stepTier(tier, direction);
    if (next === tier) return;
    saveTier(browserStorage(), next);
    set({ tier: next });
  },
  setStats: (stats) => set({ stats }),
}));
