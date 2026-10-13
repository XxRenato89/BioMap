import { create } from 'zustand';

/**
 * Recorrido guiado de la visita actual. Las paradas vienen de los datos
 * (`tourStop` de cada punto, ver `tourFrom`); se visitan en orden y cada una
 * desbloquea la siguiente. El progreso vive solo durante la visita: el
 * reinicio por inactividad lo borra para el próximo visitante (no se guarda
 * en el navegador, que en un kiosco es compartido).
 */
export const useUserStore = create((set, get) => ({
  /** Ids de los puntos del recorrido, en orden. */
  tour: [],
  visitedPoints: [],

  setTour: (tour) => set({ tour }),

  /**
   * Marca un punto como visitado.
   */
  visitPoint: (poiId) => {
    const { visitedPoints } = get();
    if (!visitedPoints.includes(poiId)) set({ visitedPoints: [...visitedPoints, poiId] });
  },

  /**
   * Estado de un punto: 'visitado', 'disponible' o 'bloqueado' (parada del
   * recorrido cuya anterior aún no se visita). Los puntos fuera del
   * recorrido siempre están disponibles.
   */
  getPoiState: (poiId) => {
    const { visitedPoints, tour } = get();
    const id = Number(poiId);
    if (visitedPoints.some((v) => Number(v) === id)) return 'visitado';
    const index = tour.indexOf(id);
    if (index <= 0) return 'disponible';
    return visitedPoints.some((v) => Number(v) === tour[index - 1]) ? 'disponible' : 'bloqueado';
  },

  /** ¿Ya se visitaron todas las paradas? */
  tourCompleted: () => {
    const { visitedPoints, tour } = get();
    return tour.length > 0 && tour.every((stop) => visitedPoints.some((v) => Number(v) === stop));
  },

  resetProgress: () => set({ visitedPoints: [] }),
}));

/**
 * Paradas del recorrido a partir de los puntos: los que tienen `tourStop`,
 * ordenados por ella.
 *
 * @param {Array<{ properties: { id: number, tourStop?: number | null } }>} features
 * @returns {number[]}
 */
export function tourFrom(features) {
  return features
    .filter((feature) => feature.properties.tourStop)
    .sort((a, b) => a.properties.tourStop - b.properties.tourStop)
    .map((feature) => Number(feature.properties.id));
}
