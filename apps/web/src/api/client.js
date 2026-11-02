import staticLayers from '../../public/mock/layers.json';
import staticPoints from '../../public/mock/points.json';
import staticDetails from '../../public/mock/points-detail.json';

/**
 * Pide un recurso JSON a la API. 'cache: no-cache' obliga al navegador a
 * revalidar con el ETag: si nada cambio, recibe un 304 vacio y reutiliza su copia.
 * Si la API no esta disponible (ej. entorno de demostracion sin base de datos),
 * recurre de forma transparente al fallback estatico local.
 */
async function getJson(path, fetchImpl = fetch, fallbackData = null) {
  try {
    const response = await fetchImpl(path, {
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      if (fallbackData !== null && fetchImpl === fetch) {
        console.warn(`[BioMap] API ${path} no disponible (${response.status}). Usando fallback estatico local.`);
        return fallbackData;
      }
      throw new Error(`GET ${path} failed with ${response.status}`);
    }
    return response.json();
  } catch (err) {
    if (fallbackData !== null && (fetchImpl === fetch || err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('NetworkError'))) {
      console.warn(`[BioMap] Sin conexion a ${path}. Usando datos estaticos locales.`);
      return fallbackData;
    }
    throw err;
  }
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
  const fallback = staticDetails[String(id)] || staticPoints.features?.find((f) => f.id === Number(id)) || null;
  return getJson(`/api/points/${encodeURIComponent(id)}`, fetchImpl, fallback);
}
