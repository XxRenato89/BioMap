import { SAMPLE_LAYERS } from '../../seeds/sample-data.js';

/**
 * Capas para el modo sin base de datos (USE_MOCKS): las mismas de las
 * semillas, con los ids que tendrían en una base recién cargada.
 */
export function createLayersMockRepository() {
  const layers = SAMPLE_LAYERS.map((layer, index) => ({
    id: index + 1,
    slug: layer.slug,
    name: layer.name,
    color: layer.color,
    icon: layer.icon ?? null,
    sortOrder: layer.sortOrder,
  }));
  return {
    async findActive() {
      return [...layers].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    },
  };
}
