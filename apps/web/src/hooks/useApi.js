import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { fetchLayers, fetchPoint, fetchPoints } from '../api/client.js';

const EMPTY_POINTS = { type: 'FeatureCollection', features: [] };
const NO_LAYERS = [];

/**
 * Cargadores de datos. Se inyectan por contexto para probar el visor sin red.
 */
export const ApiContext = createContext({
  loadLayers: () => fetchLayers(),
  loadPoints: () => fetchPoints(),
  loadPoint: (id) => fetchPoint(id),
});

/**
 * Opciones comunes del sondeo. React Query conserva la misma referencia cuando
 * la respuesta no cambió (structuralSharing), así que el mapa no redibuja nada
 * en cada actualización. Mientras no haya datos reintenta cada `retryMs` sin fin.
 */
function pollingOptions({ refreshMs, retryMs }) {
  return { refetchInterval: refreshMs, retry: true, retryDelay: retryMs, staleTime: refreshMs };
}

/**
 * Un recurso falla solo si todavía no hay datos: si una actualización falla,
 * se siguen mostrando los últimos datos buenos sin avisar.
 */
function failing(query) {
  return !query.data && (query.isError || query.failureCount > 0);
}

/**
 * Capas temáticas activas, actualizadas periódicamente.
 *
 * @param {{ refreshMs: number, retryMs: number }} timing
 */
export function useLayersQuery(timing) {
  const { loadLayers } = useContext(ApiContext);
  const query = useQuery({ queryKey: ['layers'], queryFn: loadLayers, ...pollingOptions(timing) });
  return { layers: query.data ?? NO_LAYERS, failing: failing(query) };
}

/**
 * Puntos de interés como FeatureCollection, actualizados periódicamente.
 *
 * @param {{ refreshMs: number, retryMs: number }} timing
 */
export function usePointsQuery(timing) {
  const { loadPoints } = useContext(ApiContext);
  const query = useQuery({ queryKey: ['points'], queryFn: loadPoints, ...pollingOptions(timing) });
  return { points: query.data ?? EMPTY_POINTS, failing: failing(query) };
}

/**
 * Ficha completa de un punto (descripción e imágenes). Se pide al abrirla;
 * con `id` nulo (ventana libre) no se pide nada.
 *
 * @param {number | null} id
 */
export function usePointDetail(id) {
  const { loadPoint } = useContext(ApiContext);
  return useQuery({
    queryKey: ['point', id],
    queryFn: () => loadPoint(id),
    enabled: id != null,
    retry: 2,
  });
}
