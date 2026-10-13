import { useCallback, useEffect } from 'react';
import { triggerConfetti } from '../../components/ConfettiCanvas.jsx';
import { useAvatarStore } from '../../store/avatarStore.js';
import { tourFrom, useUserStore } from '../../store/userStore.js';
import { useViewerStore } from '../../store/viewerStore.js';

/*
 * Cámara del recorrido (m y grados): mientras sigue a la mascota por el
 * camino, y al llegar, de cerca y algo inclinada para ver el relieve que
 * rodea el lugar. Con la ficha abierta, el lugar se corre esta fracción del
 * ancho de pantalla, para quedar a la vista junto a la mascota y la ficha.
 */
const ROUTE_RANGE = 2_400;
const POINT_RANGE = 1_000;
const POINT_PITCH = -32;
const SHEET_SHIFT = 0.13;

/**
 * El recorrido por los puntos: elegir uno manda a la mascota por los
 * caminos con la cámara siguiéndola; al llegar se abre la ficha, se cuenta
 * la visita y se celebra. Las paradas del recorrido guiado salen de los datos.
 *
 * @param {{ points: { features: Array<object> }, camera: import('react').RefObject<object> }} options
 */
export function useTour({ points, camera }) {
  useEffect(() => useUserStore.getState().setTour(tourFrom(points.features)), [points]);

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
        shift: SHEET_SHIFT,
      });
      const user = useUserStore.getState();
      const isNewVisit = !user.visitedPoints.includes(id);
      user.visitPoint(id);
      /* Celebración en cada lugar nuevo, y una mayor al completar el recorrido. */
      if (isNewVisit) triggerConfetti({ grandFinale: useUserStore.getState().tourCompleted() });
    },
    [camera],
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
