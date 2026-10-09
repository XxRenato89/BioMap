/**
 * Crea la función de apagado ordenado.
 * Deja de aceptar conexiones, espera las peticiones en curso, cierra el pool
 * de la base de datos y termina el proceso. Si algo se cuelga, fuerza la salida
 * cuando se cumple el tiempo máximo. Las señales repetidas se ignoran.
 *
 * @param {{ server: { close: Function, closeIdleConnections?: Function },
 *   pool: { end: Function }, logger: { info: Function, error: Function },
 *   timeoutMs?: number, exit?: (code: number) => void }} deps
 * @returns {(signal: string) => void}
 */
export function createGracefulShutdown({
  server,
  pool,
  logger,
  timeoutMs = 10_000,
  exit = (code) => process.exit(code),
}) {
  let started = false;

  return function shutdown(signal) {
    if (started) return;
    started = true;
    logger.info({ signal }, 'Shutting down');

    const timer = setTimeout(() => {
      logger.error({ timeoutMs }, 'Forced shutdown after timeout');
      exit(1);
    }, timeoutMs);
    timer.unref?.();

    server.close(async (error) => {
      let code = error ? 1 : 0;
      try {
        await pool.end();
      } catch (poolError) {
        logger.error({ err: poolError }, 'Error closing the database pool');
        code = 1;
      }
      clearTimeout(timer);
      exit(code);
    });
    server.closeIdleConnections?.();
  };
}
