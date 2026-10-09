import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El contenedor debe reemplazar el shell por el proceso de Node (exec) para que
 * SIGTERM llegue a la API y se ejecute el apagado ordenado.
 */
describe('API Dockerfile', () => {
  it('execs the server so it receives SIGTERM', () => {
    const dockerfile = readFileSync(new URL('../../Dockerfile', import.meta.url), 'utf8');
    expect(dockerfile).toMatch(/exec node src\/server\.js/);
  });
});
