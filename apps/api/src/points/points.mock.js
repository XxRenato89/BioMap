import { SAMPLE_IMAGES, SAMPLE_LAYERS, SAMPLE_POINTS } from '../../seeds/sample-data.js';
import { toFeature } from './points.repository.js';

/**
 * Puntos para el modo sin base de datos (USE_MOCKS): los mismos de las
 * semillas, con los ids que tendrían en una base recién cargada, así el modo
 * de prueba y la base real nunca divergen.
 */
export function createPointsMockRepository() {
  const layerId = new Map(SAMPLE_LAYERS.map((layer, index) => [layer.slug, index + 1]));
  const rows = SAMPLE_POINTS.map((point, index) => ({
    id: index + 1,
    name: point.name,
    description: point.description,
    layer_id: layerId.get(point.layerSlug),
    layer_slug: point.layerSlug,
    tour_stop: point.tourStop ?? null,
    is_secret: point.secret ?? false,
    lng: point.lng,
    lat: point.lat,
    images: SAMPLE_IMAGES.filter((image) => image.pointName === point.name)
      .sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.sortOrder - b.sortOrder)
      .map(({ filePath, altText, credit, isMain, kind }) => ({
        filePath,
        altText,
        credit,
        isMain,
        kind,
      })),
  }));
  return {
    async findAll({ layerIds } = {}) {
      return rows
        .filter((row) => !layerIds || layerIds.includes(row.layer_id))
        .map((row) => toFeature(row));
    },

    async findById(id) {
      const row = rows.find((point) => point.id === id);
      return row ? toFeature(row, { description: row.description, images: row.images }) : null;
    },
  };
}
