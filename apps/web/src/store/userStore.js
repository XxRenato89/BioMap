import { create } from 'zustand';

export const AVAILABLE_TOURS = [
  {
    id: 'general',
    title: 'Ruta Esencial',
    description: 'Los puntos icónicos del Parque y la historia del Embalse Angostura.',
    stops: [12, 1, 6, 10], // Centro de Visitantes -> Central -> Parque -> Sendero Huequecura
    duration: '45 min',
    distance: '3.2 km',
  },
  {
    id: 'nature',
    title: 'Naturaleza y Senderos',
    description: 'Recorre el bosque nativo, flora autóctona y miradores panorámicos.',
    stops: [7, 8, 10, 13], // Arboretum -> Cerro El Calvario -> Mirador Huequecura -> Los Notros
    duration: '1h 15m',
    distance: '4.8 km',
  },
  {
    id: 'energy',
    title: 'Energía y Cañón del Biobío',
    description: 'Descubre las obras de ingeniería, miradores y el cañón del río Biobío.',
    stops: [1, 11, 17, 3], // Central -> Mirador Central -> Mirador El Piulo -> Puente El Piulo
    duration: '50 min',
    distance: '3.8 km',
  },
];

const SECRET_EXPIRY_MS = 90 * 60 * 1000; // 90 minutos de vigencia antes de volver a ocultarse

/**
 * Recorrido guiado de la visita actual y gestión de secretos.
 */
export const useUserStore = create((set, get) => ({
  /** Ids de los puntos del recorrido actual, en orden. */
  tour: [1, 6, 10, 12],
  visitedPoints: [],
  activeTourId: 'general',
  discoveredSecrets: {}, // { [poiId]: timestamp }

  setActiveTour: (tourId) => {
    const tourObj = AVAILABLE_TOURS.find((t) => t.id === tourId) ?? AVAILABLE_TOURS[0];
    set({
      activeTourId: tourId,
      tour: tourObj.stops,
      visitedPoints: [],
    });
  },

  discoverSecret: (poiId) => {
    const id = Number(poiId);
    set((state) => ({
      discoveredSecrets: {
        ...state.discoveredSecrets,
        [id]: Date.now(),
      },
    }));
  },

  isSecretDiscovered: (poiId) => {
    const id = Number(poiId);
    const ts = get().discoveredSecrets[id];
    if (!ts) return false;
    return Date.now() - ts < SECRET_EXPIRY_MS;
  },

  setTour: (tour) => set({ tour }),

  /**
   * Marca un punto como visitado.
   */
  visitPoint: (poiId) => {
    const { visitedPoints } = get();
    if (!visitedPoints.includes(poiId)) set({ visitedPoints: [...visitedPoints, poiId] });
  },

  /**
   * Estado de un punto: 'visitado', 'disponible' o 'bloqueado'.
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

  resetProgress: () => set({ visitedPoints: [], discoveredSecrets: {} }),
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
