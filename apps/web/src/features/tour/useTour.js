import { useCallback, useEffect } from 'react';
import { recordEvent } from '../../api/client.js';
import { triggerConfetti } from '../../components/ConfettiCanvas.jsx';
import { useAvatarStore } from '../../store/avatarStore.js';
import { useUserStore } from '../../store/userStore.js';
import { useViewerStore } from '../../store/viewerStore.js';

/*
 * Cámara del recorrido (m y grados): mientras sigue a la mascota por el
 * camino, y al llegar, de cerca y algo inclinada para ver el relieve que
 * rodea el lugar. Con la ficha abierta, el lugar se corre estas fracciones del
 * ancho (x) y del alto (y) de la pantalla, para quedar a la vista junto a la
 * mascota y la ficha: en el kiosco la ficha va al costado; en el teléfono, abajo.
 */
const ROUTE_RANGE = 2_400;
const POINT_RANGE = 1_000;
const POINT_PITCH = -32;
const SHEET_SHIFT = { x: 0.13, y: 0 };

/**
 * El recorrido por los puntos: elegir uno manda a la mascota por los
 * caminos con la cámara siguiéndola; al llegar se abre la ficha, se cuenta
 * la visita y se celebra. Las paradas del recorrido guiado salen de los datos.
 *
 * @param {{ points: { features: Array<object> }, camera: import('react').RefObject<object>,
 *   sheetShift?: { x: number, y: number } }} options
 */
export function useTour({ points, camera, sheetShift = SHEET_SHIFT }) {
  useEffect(() => useUserStore.getState().setFeatures(points.features), [points]);

  const selectPoint = useCallback(
    (pointId) => {
      const feature = points.features.find((item) => item.properties.id === pointId);
      if (!feature) return;
      useViewerStore.getState().closeAllPoints();
      useAvatarStore.getState().stopSpeaking();
      useAvatarStore.getState().setTargetPoint(feature);
      camera.current?.zoomToRange(ROUTE_RANGE);
    },
    [points, camera],
  );

  const arrive = useCallback(
    (feature) => {
      const id = feature.properties.id;
      useViewerStore.getState().openPoint(id);
      camera.current?.flyTo({
        center: feature.geometry.coordinates,
        range: POINT_RANGE,
        heading: camera.current?.view().heading ?? 0,
        pitch: POINT_PITCH,
        shift: sheetShift.x,
        shiftY: sheetShift.y,
      });
      const user = useUserStore.getState();
      const isNewVisit = !user.visitedPoints.includes(id);
      user.visitPoint(id);
      /* Celebración en cada lugar nuevo, y una mayor al completar el recorrido. */
      recordEvent({ type: 'point_open', pointId: id });
      if (isNewVisit) {
        const completed = useUserStore.getState().tourCompleted();
        triggerConfetti({ grandFinale: completed });
        if (completed) {
          recordEvent({ type: 'tour_complete' });
          /* Tras el confeti, el pasaporte con todos sus sellos. */
          setTimeout(() => useUserStore.getState().setPassportOpen(true), 1800);
        }
      }
    },
    [camera, sheetShift],
  );

  /* Al cerrar la última ficha, la vista vuelve al encuadre general. */
  const closePoint = useCallback(
    (pointId) => {
      useViewerStore.getState().closePoint(pointId);
      useAvatarStore.getState().stopSpeaking();
      if (useViewerStore.getState().selectedPointIds.length === 0) camera.current?.resetView();
    },
    [camera],
  );

  return { selectPoint, arrive, closePoint };
}
