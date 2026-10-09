import pg from 'pg';

/**
 * Crea el pool de conexiones a PostgreSQL.
 * statement_timeout corta cualquier consulta lenta para que no bloquee
 * al resto de los visitantes; los demás tiempos evitan conexiones colgadas.
 *
 * @param {{ databaseUrl: string, max: number, statementTimeoutMs: number }} options
 */
export function createPool({ databaseUrl, max, statementTimeoutMs }) {
  return new pg.Pool({
    connectionString: databaseUrl,
    max,
    statement_timeout: statementTimeoutMs,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
