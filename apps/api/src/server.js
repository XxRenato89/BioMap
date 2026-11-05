import { randomBytes } from 'node:crypto';
import pino from 'pino';
import { createAdminRepository } from './admin/admin.repository.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createMemoryCache } from './http/memory-cache.js';
import { createGracefulShutdown } from './http/shutdown.js';
import { createLayersRepository } from './layers/layers.repository.js';
import { createLayersMockRepository } from './layers/layers.mock.js';
import { createPointsRepository } from './points/points.repository.js';
import { createPointsMockRepository } from './points/points.mock.js';

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

// Conditional database pool creation
const pool = config.useMocks
  ? null
  : createPool({
      databaseUrl: config.databaseUrl,
      max: config.dbPoolMax,
      statementTimeoutMs: config.dbStatementTimeoutMs,
    });

if (pool) {
  pool.on('error', (error) =>
    logger.error({ err: error }, 'Unexpected idle database client error'),
  );
}

const app = createApp({
  // Sin base de datos en modo mock: el health check responde "up".
  db: pool ?? { query: async () => {} },
  repositories: {
    layers: config.useMocks ? createLayersMockRepository() : createLayersRepository(pool),
    points: config.useMocks ? createPointsMockRepository() : createPointsRepository(pool),
  },
  cache: createMemoryCache({ ttlMs: config.cacheTtlSeconds * 1000 }),
  logger,
  mediaDir: config.mediaDir,
  webDir: config.webDir,
  mediaBaseUrl: config.mediaBaseUrl,
  exposeStack: config.nodeEnv === 'development',
  admin: pool && {
    adminRepository: createAdminRepository(pool),
    /* Sin SESSION_SECRET (desarrollo): una por proceso, las sesiones mueren al reiniciar. */
    sessionSecret: config.sessionSecret ?? randomBytes(32).toString('hex'),
    passwordMaxAgeDays: config.passwordMaxAgeDays,
    mapBounds: config.mapBounds,
  },
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, mocks: config.useMocks }, 'BioMap API listening');
});

const shutdown = createGracefulShutdown({ server, pool, logger });
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
