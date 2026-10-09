import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../http/errors.js';

/**
 * Normaliza el parámetro `layers` de la URL.
 * Devuelve null si no se envió (todas las capas). Si se envió, devuelve los slugs
 * en minúsculas, sin espacios, sin vacíos, sin repetidos y ordenados, para que
 * filtros equivalentes compartan la misma entrada de caché.
 *
 * @param {unknown} value
 * @returns {string[] | null}
 */
function parseLayersParam(value) {
  if (value === undefined) return null;
  const parts = (Array.isArray(value) ? value : [value]).filter((v) => typeof v === 'string');
  const slugs = parts
    .flatMap((part) => part.split(','))
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(slugs)].sort();
}

/**
 * Identificador de punto: entero positivo sin ceros a la izquierda y dentro
 * del rango de `integer` de PostgreSQL, para no provocar errores de desborde.
 */
const pointIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/)
  .transform(Number)
  .refine((n) => n <= 2_147_483_647);

/**
 * Construye la URL pública de una imagen, codificando cada segmento de la ruta
 * (espacios, tildes) y quitando barras iniciales sobrantes.
 */
function toMediaUrl(mediaBaseUrl, filePath) {
  const encoded = filePath
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${mediaBaseUrl}/${encoded}`;
}

/**
 * Reemplaza la ruta interna de cada imagen (filePath) por su URL pública.
 */
function withPublicImages(feature, mediaBaseUrl) {
  const { images, ...properties } = feature.properties;
  return {
    ...feature,
    properties: {
      ...properties,
      images: images.map(({ filePath, ...image }) => ({
        url: toMediaUrl(mediaBaseUrl, filePath),
        ...image,
      })),
    },
  };
}

/**
 * Rutas de puntos de interés.
 *
 * @param {{ pointsRepository: object, layersRepository: object,
 *   cache: { getOrLoad: Function }, mediaBaseUrl: string }} deps
 */
export function createPointsRouter({ pointsRepository, layersRepository, cache, mediaBaseUrl }) {
  const router = Router();

  /*
   * GET /api/points: lista liviana de puntos como FeatureCollection.
   * Los slugs se validan contra las capas activas (también en caché).
   */
  router.get('/', async (req, res) => {
    const requested = parseLayersParam(req.query.layers);
    let features;

    if (requested === null) {
      features = await cache.getOrLoad('points:*', () =>
        pointsRepository.findAll({ layerIds: null }),
      );
    } else if (requested.length === 0) {
      features = [];
    } else {
      const layers = await cache.getOrLoad('layers', () => layersRepository.findActive());
      const idBySlug = new Map(layers.map((layer) => [layer.slug, layer.id]));
      const unknown = requested.filter((slug) => !idBySlug.has(slug));
      if (unknown.length > 0) {
        throw new HttpError(
          400,
          'INVALID_LAYER',
          `Unknown or inactive layer(s): ${unknown.join(', ')}`,
        );
      }
      const layerIds = requested.map((slug) => idBySlug.get(slug)).sort((a, b) => a - b);
      features = await cache.getOrLoad(`points:${layerIds.join(',')}`, () =>
        pointsRepository.findAll({ layerIds }),
      );
    }

    res.json({ type: 'FeatureCollection', features });
  });

  /*
   * GET /api/points/:id: ficha completa de un punto (al tocarlo en el mapa).
   * No usa caché: es una sola consulta por índice primario.
   */
  router.get('/:id', async (req, res) => {
    const parsed = pointIdSchema.safeParse(req.params.id);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_ID', 'Point id must be a positive integer');
    }
    const point = await pointsRepository.findById(parsed.data);
    if (!point) {
      throw new HttpError(404, 'POINT_NOT_FOUND', `Point ${parsed.data} not found`);
    }
    res.json(withPublicImages(point, mediaBaseUrl));
  });

  return router;
}
