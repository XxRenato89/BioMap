import staticLayers from '../../public/mock/layers.json';
import staticPoints from '../../public/mock/points.json';
import staticDetails from '../../public/mock/points-detail.json';

/**
 * Pide un recurso JSON a la API. 'cache: no-cache' obliga al navegador a
 * revalidar con el ETag: si nada cambió, recibe un 304 vacío y reutiliza su copia.
 * Solo si no hay red (la API no responde: fetch lanza TypeError) usa los datos
 * estáticos incluidos en el build. Una respuesta de error (404 de un punto
 * borrado, 500 de la base) se propaga, para que el visor avise y no muestre
 * contenido viejo.
 */
async function getJson(path, fetchImpl = fetch, fallbackData = null) {
  let response;
  try {
    response = await fetchImpl(path, {
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (fallbackData !== null && err instanceof TypeError) {
      console.warn(`[BioMap] Sin conexión a ${path}. Usando datos estáticos locales.`);
      return fallbackData;
    }
    throw err;
  }
  if (!response.ok) throw new Error(`GET ${path} failed with ${response.status}`);
  return response.json();
}

/**
 * Capas tematicas activas.
 */
export function fetchLayers(fetchImpl = fetch) {
  return getJson('/api/layers', fetchImpl, staticLayers);
}

/**
 * Todos los puntos visibles como GeoJSON FeatureCollection.
 */
export function fetchPoints(fetchImpl = fetch) {
  return getJson('/api/points', fetchImpl, staticPoints);
}

/**
 * Ficha completa de un punto: descripcion e imagenes con su URL publica.
 */
export function fetchPoint(id, fetchImpl = fetch) {
  const fallback =
    staticDetails[String(id)] || staticPoints.features?.find((f) => f.id === Number(id)) || null;
  return getJson(`/api/points/${encodeURIComponent(id)}`, fetchImpl, fallback);
}

/**
 * Registra una visita para las estadísticas del panel (sin datos personales).
 * Nunca falla: sin API (demo estática) simplemente no se cuenta.
 *
 * @param {{ type: 'point_open' | 'tour_complete', pointId?: number }} event
 */
export function recordEvent(event, fetchImpl = fetch) {
  return fetchImpl('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {});
}
