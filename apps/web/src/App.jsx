import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibilityBar from './components/AccessibilityBar.jsx';
import Compass from './components/Compass.jsx';
import HeaderCard from './components/HeaderCard.jsx';
import InactivityWarning from './components/InactivityWarning.jsx';
import LayerPanel from './components/LayerPanel.jsx';
import MapControls from './components/MapControls.jsx';
import QrCard from './components/QrCard.jsx';
import StatusPill from './components/StatusPill.jsx';
import ZoomLevels from './components/ZoomLevels.jsx';
import { config } from './config.js';
import AttractOverlay from './features/attract/AttractOverlay.jsx';
import { useAttractMode } from './features/attract/useAttractMode.js';
import PointSheets from './features/point/PointSheets.jsx';
import { isInside } from './diorama/cameraMath.js';
import DioramaCanvas from './diorama/DioramaCanvas.jsx';
import DioramaView from './diorama/DioramaView.jsx';
import { PoiMarkers } from './diorama/PoiMarkers.jsx';
import Avatar from './diorama/Avatar.jsx';
import AvatarNarrator from './features/avatar/AvatarNarrator.jsx';
import { useLayersQuery, usePointsQuery } from './hooks/useApi.js';
import { useInactivity } from './hooks/useInactivity.js';
import { useRestMode } from './hooks/useRestMode.js';
import { useVisibleLayers } from './hooks/useLayers.js';
import { TEXT_SCALES, useViewerStore } from './store/viewerStore.js';
import { useAvatarStore } from './store/avatarStore.js';
import { publishMainView } from './store/viewsStore.js';

const INTERACTION_EVENTS = ['pointerdown', 'wheel', 'keydown'];

/**
 * Cuenta cuántos puntos tiene cada capa.
 */
function countByLayer(features) {
  const counts = new Map();
  features.forEach(({ properties: { layerId } }) =>
    counts.set(layerId, (counts.get(layerId) ?? 0) + 1),
  );
  return counts;
}

/**
 * Cámara al abrir un punto: de cerca y algo inclinada, para ver el relieve
 * que lo rodea, manteniendo el rumbo con que se miraba.
 */
const POINT_RANGE = 1_000;
const POINT_PITCH = -32;

/**
 * Visor táctil de BioMap: una maqueta 3D del territorio sobre relieve real.
 * Al tocar un punto, la cámara vuela hasta él y se abre su ficha. También
 * tiene modo atracción y reinicio por inactividad.
 *
 * @param {{ mapConfig?: ReturnType<import('./config.js').buildConfig> }} props
 */
export default function App({ mapConfig = config }) {
  const { t, i18n } = useTranslation();
  const timing = useMemo(
    () => ({ refreshMs: mapConfig.refreshMs, retryMs: mapConfig.retryMs }),
    [mapConfig.refreshMs, mapConfig.retryMs],
  );
  const { layers, failing: layersFailing } = useLayersQuery(timing);
  const { points, failing: pointsFailing } = usePointsQuery(timing);
  const visibleLayerIds = useVisibleLayers(layers);
  const counts = useMemo(() => countByLayer(points.features), [points]);

  const selectedPointIds = useViewerStore((state) => state.selectedPointIds);
  const pitched = useViewerStore((state) => state.pitched);
  const textScale = useViewerStore((state) => state.textScale);
  const contrast = useViewerStore((state) => state.contrast);
  const lang = useViewerStore((state) => state.lang);
  const attract = useViewerStore((state) => state.attract);
  const contours = useViewerStore((state) => state.contours);
  const actions = useViewerStore.getState();

  const mainRef = useRef(null);
  const viewerRef = useRef(null);
  const [attractStop, setAttractStop] = useState(null);

  /*
   * Vista de inicio: la maqueta completa con zoom lejos para apreciar
   * toda la cuenca y al avatar recorriendo los puntos.
   */
  const homeView = useMemo(
    () => ({
      ...mapConfig.initialView,
      range: 16_000,
      pitch: -34,
    }),
    [mapConfig.initialView],
  );

  const effectiveConfig = useMemo(
    () => ({
      ...mapConfig,
      maxRange: 18_000,
      zoomLevels: {
        region: 13_000,
        zone: 4_500,
        detail: 1_200,
      },
    }),
    [mapConfig],
  );

  useEffect(() => {
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  }, [i18n, lang]);

  /*
   * Reinicio por inactividad: todo vuelve al estado inicial para el próximo visitante.
   */
  const resetAll = useCallback(() => {
    mainRef.current?.resetView();
    useViewerStore.getState().resetAll();
  }, []);

  const { phase, secondsLeft, markActive, markClean } = useInactivity({
    timeoutMs: mapConfig.idleTimeoutMs,
    warningMs: mapConfig.idleWarningMs,
    onReset: resetAll,
  });

  /*
   * Cualquier toque, rueda o tecla, en cualquier vista, cuenta como interacción:
   * el aviso general solo aparece cuando nadie está usando la pantalla.
   */
  useEffect(() => {
    INTERACTION_EVENTS.forEach((type) =>
      window.addEventListener(type, markActive, { passive: true }),
    );
    return () => INTERACTION_EVENTS.forEach((type) => window.removeEventListener(type, markActive));
  }, [markActive]);

  /*
   * Modo de reposo: tras unos segundos sin uso, la ficha se cierra y la
   * cámara vuelve sola a la vista de inicio.
   */
  const rest = useCallback(() => {
    useViewerStore.getState().closeAllPoints();
    mainRef.current?.resetView();
  }, []);
  useRestMode({ delayMs: mapConfig.restDelayMs, onRest: rest, enabled: !attract });

  /*
   * Modo atracción: tras un rato sin uso, la cámara general recorre los puntos sola.
   */
  const startAttract = useCallback(() => useViewerStore.getState().setAttract(true), []);
  useAttractMode({
    idle: phase === 'clean' && !attract && selectedPointIds.length === 0,
    delayMs: mapConfig.attractDelayMs,
    onStart: startAttract,
  });
  /* Puntos que caen dentro de la maqueta (los de afuera no tienen dónde ir). */
  const onMap = useMemo(
    () =>
      points.features.filter((feature) =>
        isInside(feature.geometry.coordinates, mapConfig.maxBounds),
      ),
    [points, mapConfig.maxBounds],
  );
  const attractStops = useMemo(
    () =>
      onMap.length > 0
        ? onMap.map((feature) => ({
            center: feature.geometry.coordinates,
            name: feature.properties.name,
          }))
        : [{ center: mapConfig.initialView.center, range: mapConfig.initialView.range }],
    [onMap, mapConfig.initialView],
  );
  useEffect(() => {
    if (!attract) return undefined;
    const stop = mainRef.current?.startAttract(attractStops, (next) =>
      setAttractStop(next.name ?? null),
    );
    return () => {
      stop?.();
      setAttractStop(null);
    };
  }, [attract, attractStops]);

  const exitAttract = () => {
    useViewerStore.getState().setAttract(false);
    mainRef.current?.resetView();
    markActive();
  };

  /*
   * Abre la ficha de un punto: el avatar corre hacia él para dar su explicación,
   * y la cámara se orienta hacia el lugar.
   */
  const selectPoint = useCallback(
    (pointId) => {
      const feature = points.features.find((item) => item.properties.id === pointId);
      if (!feature) return;

      useViewerStore.getState().openPoint(pointId);
      useAvatarStore.getState().setTargetPoint(feature);

      const heading = mainRef.current?.view().heading ?? mapConfig.initialView.heading;
      mainRef.current?.flyTo({
        center: feature.geometry.coordinates,
        range: POINT_RANGE,
        heading,
        pitch: POINT_PITCH,
      });
    },
    [points, mapConfig.initialView.heading],
  );

  /*
   * Cierra una ficha; al cerrar la última, la vista vuelve al encuadre general
   * y el avatar reanuda su patrulla autónoma.
   */
  const closePoint = (pointId) => {
    actions.closePoint(pointId);
    useAvatarStore.getState().stopSpeaking();
    if (useViewerStore.getState().selectedPointIds.length === 0) mainRef.current?.resetView();
  };

  const handleReset = () => {
    mainRef.current?.resetView();
    useAvatarStore.getState().stopSpeaking();
    actions.resetExploration();
    markClean();
  };

  const handleResetNow = () => {
    resetAll();
    useAvatarStore.getState().stopSpeaking();
    markClean();
  };

  const togglePitch = () => {
    actions.setPitched(!pitched);
    mainRef.current?.setTilted(!pitched);
  };

  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const openSheets = selectedPointIds
    .map((id) => points.features.find((feature) => feature.properties.id === id))
    .filter((feature) => feature && layerById.has(feature.properties.layerId))
    .map((feature) => ({ feature, layer: layerById.get(feature.properties.layerId) }));

  const messages = [];
  if (layersFailing || pointsFailing) messages.push(t('status.offline'));

  return (
    <main
      ref={viewerRef}
      className="viewer"
      data-contrast={contrast ? 'high' : undefined}
      data-text-scale={textScale}
      style={{ '--text-scale': TEXT_SCALES[textScale] }}
    >
      <DioramaCanvas eventSource={viewerRef} />
      <DioramaView
        ref={mainRef}
        id="main"
        config={effectiveConfig}
        homeView={homeView}
        shadows
        fog={[16, 38]}
        label={t('mapLabel')}
        onView={publishMainView}
        onTiltChange={actions.setPitched}
      >
        <Avatar points={points} />
        <PoiMarkers
          points={points}
          layers={layers}
          visibleLayerIds={visibleLayerIds}
          selectedIds={selectedPointIds}
          viewId="main"
          onSelectPoint={selectPoint}
        />
      </DioramaView>

      <div className="hud">
        <div className="hud__left">
          <div className="hud__stack" data-obstacle>
            <HeaderCard />
            <LayerPanel
              layers={layers}
              visibleLayerIds={visibleLayerIds}
              counts={counts}
              onToggle={actions.toggleLayer}
            />
          </div>
          <div data-obstacle>
            <QrCard
              url={mapConfig.publicUrl || window.location.origin}
              wifi={mapConfig.kioskWifi}
            />
          </div>
        </div>

        <div className="hud__top">
          <StatusPill messages={messages} />
        </div>

        <div className="hud__right">
          <div className="hud__stack hud__stack--end" data-obstacle>
            <AccessibilityBar
              textScale={textScale}
              contrast={contrast}
              onTextScale={actions.cycleTextScale}
              onContrast={actions.toggleContrast}
              onLanguage={() => actions.setLang(lang === 'es' ? 'en' : 'es')}
            />
            <Compass onResetNorth={() => mainRef.current?.resetNorth()} />
          </div>
          <div data-obstacle>
            <MapControls
              onZoomIn={() => mainRef.current?.zoomBy(0.55)}
              onZoomOut={() => mainRef.current?.zoomBy(1.8)}
              pitched={pitched}
              onTogglePitch={togglePitch}
              contours={contours}
              onToggleContours={actions.toggleContours}
              onReset={handleReset}
            />
          </div>
        </div>

        <div className="hud__bottom" data-obstacle>
          <ZoomLevels
            levels={effectiveConfig.zoomLevels}
            onPick={(range) => mainRef.current?.zoomToRange(range)}
            restSeconds={Math.round(mapConfig.restDelayMs / 1000)}
          />
        </div>
      </div>

      <PointSheets open={openSheets} onClose={closePoint} />
      <AvatarNarrator />

      <p className="attribution">{t('attribution')}</p>

      {attract && <AttractOverlay stopName={attractStop} onExplore={exitAttract} />}
      {phase === 'warning' && (
        <InactivityWarning
          secondsLeft={secondsLeft}
          totalSeconds={Math.ceil(mapConfig.idleWarningMs / 1000)}
          onKeepExploring={markActive}
          onResetNow={handleResetNow}
        />
      )}
    </main>
  );
}
