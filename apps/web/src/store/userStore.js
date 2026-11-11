import { create } from 'zustand';

/*
 * Recorridos temáticos. Las paradas van por nombre del lugar, no por id: los ids
 * cambian según el orden en que se cargó la base. «general» no tiene lista: sus
 * paradas salen del campo `tour_stop` de los datos (ver tourFrom).
 */
export const AVAILABLE_TOURS = [
  {
    id: 'general',
    title: 'Ruta Esencial',
    description: 'Los puntos icónicos del Parque y la historia del Embalse Angostura.',
    duration: '45 min',
    distance: '3.2 km',
  },
  {
    id: 'nature',
    title: 'Naturaleza y Senderos',
    description: 'Recorre el bosque nativo, flora autóctona y miradores panorámicos.',
    stopNames: [
      'Arboretum',
      'Cerro el Calvario',
      'Sendero y Mirador Huequecura',
      'Camping Los Notros',
    ],
    duration: '1h 15m',
    distance: '4.8 km',
  },
  {
    id: 'energy',
    title: 'Energía y Cañón del Biobío',
    description: 'Descubre las obras de ingeniería, miradores y el cañón del río Biobío.',
    stopNames: [
      'Central Hidroeléctrica Angostura',
      'Mirador Central Angostura',
      'Puente Piulo Oriente',
      'Puente El Piulo',
    ],
    duration: '50 min',
    distance: '3.8 km',
  },
];

/**
 * Ids de las paradas de un recorrido según los puntos cargados. Los nombres
 * que no existen en los datos se omiten.
 *
 * @param {string} tourId
 * @param {Array<{ properties: { id: number, name: string, tourStop?: number | null } }>} features
 * @returns {number[]}
 */
export function stopsFor(tourId, features) {
  const tour = AVAILABLE_TOURS.find((item) => item.id === tourId) ?? AVAILABLE_TOURS[0];
  if (!tour.stopNames) return tourFrom(features);
  const idByName = new Map(features.map((f) => [f.properties.name, Number(f.properties.id)]));
  return tour.stopNames.map((name) => idByName.get(name)).filter((id) => id !== undefined);
}

const SECRET_EXPIRY_MS = 90 * 60 * 1000; // 90 minutos de vigencia antes de volver a ocultarse

/**
 * Recorrido guiado de la visita actual y gestión de secretos.
 */
export const useUserStore = create((set, get) => ({
  /** Ids de los puntos del recorrido actual, en orden. */
  tour: [],
  /** Puntos cargados, para traducir los nombres de las paradas a ids. */
  features: [],
  visitedPoints: [],
  activeTourId: 'general',
  discoveredSecrets: {}, // { [poiId]: timestamp }
  /** Pasaporte de sellos a la vista (se abre solo al completar el recorrido). */
  passportOpen: false,
  setPassportOpen: (passportOpen) => set({ passportOpen }),

  setActiveTour: (tourId) =>
    set({ activeTourId: tourId, tour: stopsFor(tourId, get().features), visitedPoints: [] }),

  /** Puntos nuevos de la API: recalcula las paradas del recorrido activo. */
  setFeatures: (features) => set({ features, tour: stopsFor(get().activeTourId, features) }),

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

  /** Kiosco limpio para el próximo visitante: sin visitas y con la ruta general. */
  resetProgress: () =>
    set({
      visitedPoints: [],
      passportOpen: false,
      discoveredSecrets: {},
      activeTourId: 'general',
      tour: stopsFor('general', get().features),
    }),
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
