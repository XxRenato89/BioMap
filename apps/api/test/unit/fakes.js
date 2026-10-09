import { createApp } from '../../src/app.js';
import { createMemoryCache } from '../../src/http/memory-cache.js';

/**
 * Capas de ejemplo con los mismos identificadores que usan todos los tests.
 */
export const LAYERS = [
  { id: 1, slug: 'history', name: 'Historia', color: '#b45309', icon: 'landmark', sortOrder: 1 },
  {
    id: 2,
    slug: 'ecology',
    name: 'Ecología y Biodiversidad',
    color: '#15803d',
    icon: 'leaf',
    sortOrder: 2,
  },
  { id: 3, slug: 'tourism', name: 'Turismo', color: '#1d4ed8', icon: 'binoculars', sortOrder: 3 },
];

/**
 * Base de datos falsa para tests unitarios: responde a cualquier consulta
 * o falla siempre, según la opción `fail`.
 */
export function fakeDb({ fail = false } = {}) {
  return {
    async query() {
      if (fail) throw new Error('connection refused');
      return { rows: [{ '?column?': 1 }] };
    },
  };
}

/**
 * Repositorio de capas falso que cuenta cuántas veces se consultó,
 * para verificar que la caché evita consultas repetidas.
 */
export function fakeLayersRepository(layers = LAYERS, { fail = false } = {}) {
  const calls = { findActive: 0 };
  return {
    calls,
    async findActive() {
      calls.findActive += 1;
      if (fail) throw new Error('db down');
      return layers;
    },
  };
}

/**
 * Crea un Feature de lista con coordenadas cercanas a Angostura.
 */
export function pointFeature(id, layer) {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-71.8 - id / 1000, -37.7] },
    properties: { id, name: `Punto ${id}`, layerId: layer.id, layerSlug: layer.slug },
  };
}

/**
 * Repositorio de puntos falso. findAll filtra por layerIds igual que el real,
 * y registra los argumentos de cada llamada para verificarlos en los tests.
 */
export function fakePointsRepository({ points = [], details = {} } = {}) {
  const calls = { findAll: [], findById: [] };
  return {
    calls,
    async findAll(options) {
      calls.findAll.push(options);
      const { layerIds } = options;
      return layerIds === null
        ? points
        : points.filter((feature) => layerIds.includes(feature.properties.layerId));
    },
    async findById(id) {
      calls.findById.push(id);
      return details[id] ?? null;
    },
  };
}

/**
 * Construye la app con dependencias falsas. Cada test puede reemplazar
 * cualquier dependencia mediante `overrides`.
 */
export function buildTestApp(overrides = {}) {
  return createApp({
    db: fakeDb(),
    repositories: { layers: fakeLayersRepository(), points: fakePointsRepository() },
    cache: createMemoryCache({ ttlMs: 60_000 }),
    mediaBaseUrl: '/media',
    ...overrides,
  });
}
