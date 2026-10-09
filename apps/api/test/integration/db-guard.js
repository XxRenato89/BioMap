/**
 * Protección contra borrar una base que no es de pruebas.
 * resetDatabase elimina el esquema completo, así que solo se permite sobre
 * bases cuyo nombre termina en "_test" (por ejemplo, biomap_test).
 *
 * @param {string} databaseUrl
 */
export function assertTestDatabase(databaseUrl) {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to reset database "${name}": TEST_DATABASE_URL must point to a database whose name ends in _test`,
    );
  }
}
