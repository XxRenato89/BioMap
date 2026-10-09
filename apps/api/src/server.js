import pino from 'pino';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createMemoryCache } from './http/memory-cache.js';
import { createGracefulShutdown } from './http/shutdown.js';
import { createLayersRepository } from './layers/layers.repository.js';
import { createPointsRepository } from './points/points.repository.js';

/**
 * Punto de entrada del proceso: lee la configuración, crea las dependencias
 * reales, abre el puerto y registra el apagado ordenado.
 * Si la configuración es inválida, termina con un mensaje claro.
 */
let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const logger = pino({ level: config.logLevel });
const pool = createPool({
  databaseUrl: config.databaseUrl,
  max: config.dbPoolMax,
  statementTimeoutMs: config.dbStatementTimeoutMs,
});
pool.on('error', (error) => logger.error({ err: error }, 'Unexpected idle database client error'));

const app = createApp({
  db: pool,
  repositories: {
    layers: createLayersRepository(pool),
    points: createPointsRepository(pool),
  },
  cache: createMemoryCache({ ttlMs: config.cacheTtlSeconds * 1000 }),
  logger,
  mediaDir: config.mediaDir,
  mediaBaseUrl: config.mediaBaseUrl,
  exposeStack: config.nodeEnv === 'development',
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'BioMap API listening');
});

const shutdown = createGracefulShutdown({ server, pool, logger });
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
