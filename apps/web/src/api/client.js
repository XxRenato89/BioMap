/**
 * Pide un recurso JSON a la API. `cache: 'no-cache'` obliga al navegador a
 * revalidar con el ETag: si nada cambió, recibe un 304 vacío y reutiliza su copia.
 */
async function getJson(path, fetchImpl) {
  const response = await fetchImpl(path, {
    cache: 'no-cache',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`GET ${path} failed with ${response.status}`);
  return response.json();
}

/**
 * Capas temáticas activas.
 */
export function fetchLayers(fetchImpl = fetch) {
  return getJson('/api/layers', fetchImpl);
}

/**
 * Todos los puntos visibles como GeoJSON FeatureCollection.
 */
export function fetchPoints(fetchImpl = fetch) {
  return getJson('/api/points', fetchImpl);
}

/**
 * Ficha completa de un punto: descripción e imágenes con su URL pública.
 */
export function fetchPoint(id, fetchImpl = fetch) {
  return getJson(`/api/points/${encodeURIComponent(id)}`, fetchImpl);
}
