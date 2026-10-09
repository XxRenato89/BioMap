import { useEffect, useMemo } from 'react';
import { useViewerStore } from '../store/viewerStore.js';

/**
 * Capas visibles: todas las de la API menos las ocultas por el visitante.
 * Se guardan las capas OCULTAS y las visibles se calculan en el mismo render:
 * así una capa nueva aparece encendida de inmediato, sin un render intermedio
 * con todo apagado. Si una capa oculta desaparece de la API, se olvida su
 * estado y vuelve encendida si reaparece.
 *
 * @param {Array<{ id: number }>} layers
 * @returns {Set<number>}
 */
export function useVisibleLayers(layers) {
  const hiddenLayerIds = useViewerStore((state) => state.hiddenLayerIds);
  const pruneHiddenLayers = useViewerStore((state) => state.pruneHiddenLayers);

  useEffect(() => {
    pruneHiddenLayers(new Set(layers.map((layer) => layer.id)));
  }, [layers, pruneHiddenLayers]);

  return useMemo(
    () => new Set(layers.map((layer) => layer.id).filter((id) => !hiddenLayerIds.has(id))),
    [layers, hiddenLayerIds],
  );
}
