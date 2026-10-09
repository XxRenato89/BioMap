import { Router } from 'express';

/**
 * Ruta GET /api/layers. Las capas casi nunca cambian, así que se sirven
 * desde la caché bajo la clave 'layers' (compartida con la ruta de puntos).
 *
 * @param {{ layersRepository: { findActive: Function }, cache: { getOrLoad: Function } }} deps
 */
export function createLayersRouter({ layersRepository, cache }) {
  const router = Router();
  router.get('/', async (_req, res) => {
    const layers = await cache.getOrLoad('layers', () => layersRepository.findActive());
    res.json(layers);
  });
  return router;
}
