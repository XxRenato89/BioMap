import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';

/**
 * Carpeta de migraciones, resuelta desde este archivo para que funcione
 * sin importar desde qué directorio se ejecute el proceso.
 */
const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

/**
 * Aplica todas las migraciones pendientes. Se usa desde el script de CLI
 * y desde los tests de integración.
 *
 * @param {string} databaseUrl
 * @param {{ log?: (message: string) => void }} [options]
 */
export function migrate(databaseUrl, { log = () => {} } = {}) {
  return runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    checkOrder: true,
    log,
  });
}
