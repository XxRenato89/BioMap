import { create } from 'zustand';

/**
 * Qué está mirando la cámara de la maqueta. La brújula y el selector de
 * nivel la siguen.
 */
export const useViewsStore = create(() => ({ main: null }));

/**
 * Publica el estado de la cámara de la maqueta.
 *
 * @param {{ center: [number, number], range: number, heading: number, pitch: number }} view
 */
export function publishMainView(view) {
  useViewsStore.setState({ main: view });
}
