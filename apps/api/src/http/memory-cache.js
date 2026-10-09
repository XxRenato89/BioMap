/**
 * Caché en memoria con tiempo de expiración (TTL).
 * Guarda la promesa y no solo el valor: si llegan muchas peticiones a la vez
 * y la entrada no existe, todas esperan la misma carga en lugar de consultar
 * la base de datos una vez cada una. Si la carga falla, la entrada se elimina
 * para que la siguiente petición vuelva a intentarlo.
 *
 * @param {{ ttlMs: number, now?: () => number }} options
 */
export function createMemoryCache({ ttlMs, now = () => Date.now() }) {
  const store = new Map();

  return {
    /**
     * Devuelve el valor de la clave o lo carga con `loader` si no existe o expiró.
     *
     * @template T
     * @param {string} key
     * @param {() => Promise<T>} loader
     * @returns {Promise<T>}
     */
    getOrLoad(key, loader) {
      const hit = store.get(key);
      if (hit && hit.expiresAt > now()) return hit.promise;

      const promise = Promise.resolve().then(loader);
      if (ttlMs > 0) {
        store.set(key, { promise, expiresAt: now() + ttlMs });
        promise.catch(() => {
          if (store.get(key)?.promise === promise) store.delete(key);
        });
      }
      return promise;
    },

    /**
     * Borra todas las entradas. Lo usarán las rutas de escritura del panel.
     */
    invalidate() {
      store.clear();
    },
  };
}
