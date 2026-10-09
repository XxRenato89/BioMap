import { create } from 'zustand';

/**
 * Posición en pantalla (px, relativa al visor) de la punta del pin de cada
 * punto con su ficha abierta, para dejar cada ficha al lado de su pin. La
 * publica PoiMarkers en cada cuadro: { [id]: { x, y } }.
 */
export const useAnchorStore = create(() => ({ anchors: {} }));

/**
 * Publica las posiciones de los pines abiertos. Solo avisa si alguno apareció,
 * desapareció o se movió al menos medio píxel.
 *
 * @param {Record<number, { x: number, y: number }>} anchors
 */
export function publishAnchors(anchors) {
  const current = useAnchorStore.getState().anchors;
  const ids = Object.keys(anchors);
  const same =
    ids.length === Object.keys(current).length &&
    ids.every(
      (id) =>
        current[id] &&
        Math.abs(current[id].x - anchors[id].x) < 0.5 &&
        Math.abs(current[id].y - anchors[id].y) < 0.5,
    );
  if (!same) useAnchorStore.setState({ anchors });
}
