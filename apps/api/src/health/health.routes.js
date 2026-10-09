import { Router } from 'express';

/**
 * Ruta de salud para el monitoreo del mini PC.
 * Responde 200 si la base de datos contesta y 503 si no; nunca usa caché.
 *
 * @param {{ db: { query(sql: string): Promise<unknown> } }} deps
 */
export function createHealthRouter({ db }) {
  const router = Router();
  router.get('/', async (_req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });
  return router;
}
