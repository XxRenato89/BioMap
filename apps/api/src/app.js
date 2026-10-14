import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { createHealthRouter } from './health/health.routes.js';
import { createErrorHandler, notFoundHandler } from './http/error-handlers.js';
import { createLayersRouter } from './layers/layers.routes.js';
import { createPointsRouter } from './points/points.routes.js';

/**
 * Agrega `Cache-Control: no-cache` a las respuestas JSON: el navegador debe
 * revalidar siempre, pero con el ETag recibe un 304 vacío si nada cambió.
 */
function noCache(_req, res, next) {
  res.set('Cache-Control', 'no-cache');
  next();
}

/**
 * Construye la aplicación Express sin abrir ningún puerto.
 * Todas las dependencias se inyectan, para poder probarla con objetos falsos.
 *
 * @param {object} deps
 * @param {{ query: Function }} deps.db
 * @param {{ layers?: object, points?: object }} [deps.repositories]
 * @param {{ getOrLoad: Function, invalidate: Function }} [deps.cache]
 * @param {import('pino').Logger} [deps.logger]
 * @param {string} [deps.mediaDir]
 * @param {string} [deps.mediaBaseUrl]
 * @param {string} [deps.webDir] Build del visor que se sirve en la raíz (kiosco).
 * @param {boolean} [deps.exposeStack]
 */
export function createApp({
  db,
  repositories = {},
  cache,
  logger,
  mediaDir,
  mediaBaseUrl = '/media',
  webDir,
  exposeStack = false,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        /* El visor usa imágenes blob: (visor 360°) y data: (código QR). */
        directives: { 'img-src': ["'self'", 'data:', 'blob:'] },
      },
    }),
  );
  app.use(compression());
  if (logger) app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use(noCache);
  api.use('/health', createHealthRouter({ db }));
  api.use('/layers', createLayersRouter({ layersRepository: repositories.layers, cache }));
  api.use(
    '/points',
    createPointsRouter({
      pointsRepository: repositories.points,
      layersRepository: repositories.layers,
      cache,
      mediaBaseUrl,
    }),
  );
  app.use('/api', api);

  /*
   * Imágenes estáticas. En producción las sirve el proxy inverso; aquí quedan
   * para desarrollo. Llevan caché larga porque cada archivo tendrá un nombre único.
   */
  if (mediaDir) {
    app.use(mediaBaseUrl, express.static(mediaDir, { immutable: true, maxAge: '365d' }));
  }

  /*
   * El visor ya compilado (kiosco): archivos estáticos y, para cualquier otra
   * ruta que no sea de la API, su index.html.
   */
  if (webDir) {
    app.use(express.static(webDir, { index: 'index.html', maxAge: '1h' }));
    app.get(/^\/(?!api\/|media\/).*/, (_req, res) => res.sendFile('index.html', { root: webDir }));
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler({ exposeStack, logger }));
  return app;
}
