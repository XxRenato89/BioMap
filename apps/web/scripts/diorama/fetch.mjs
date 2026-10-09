/**
 * Identificación de las descargas (Overpass rechaza pedidos anónimos).
 */
export const USER_AGENT = 'BioMap-build/0.1 (proyecto de título, maqueta offline)';

/**
 * Descarga con reintentos: hasta `tries` intentos, esperando un poco más
 * después de cada fallo. Si todos fallan, lanza el último error.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [tries]
 */
export async function fetchWithRetry(url, options = {}, tries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { 'User-Agent': USER_AGENT, ...options.headers },
      });
      if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${url} → ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < tries) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError;
}

/**
 * Ejecuta `task` sobre cada elemento, con a lo más `limit` a la vez.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} task
 * @returns {Promise<R[]>}
 */
export async function pool(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
