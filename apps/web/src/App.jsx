import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibilityBar from './components/AccessibilityBar.jsx';
import BioBook from './components/BioBook.jsx';
import Compass from './components/Compass.jsx';
import ConfettiCanvas from './components/ConfettiCanvas.jsx';
import HeaderCard from './components/HeaderCard.jsx';
import InactivityWarning from './components/InactivityWarning.jsx';
import LayerPanel from './components/LayerPanel.jsx';
import MapControls from './components/MapControls.jsx';
import SkipWalkButton from './components/SkipWalkButton.jsx';
import StatusPill from './components/StatusPill.jsx';
import ZoomLevels from './components/ZoomLevels.jsx';
import { config } from './config.js';
import AttractOverlay from './features/attract/AttractOverlay.jsx';
import { useAttractMode } from './features/attract/useAttractMode.js';
import PointSheets from './features/point/PointSheets.jsx';
import ReservoirToggle from './features/reservoir/ReservoirToggle.jsx';
import { useTour } from './features/tour/useTour.js';
import { isInside } from './diorama/utils/cameraMath.js';
import DioramaCanvas from './diorama/components/DioramaCanvas.jsx';
import DioramaView from './diorama/components/DioramaView.jsx';
import { PoiMarkers } from './diorama/components/PoiMarkers.jsx';
import Avatar from './diorama/components/Avatar.jsx';
import AvatarNarrator from './features/avatar/AvatarNarrator.jsx';
import { useLayersQuery, usePointsQuery } from './hooks/useApi.js';
import { useDaylight } from './hooks/useDaylight.js';
import { useInactivity } from './hooks/useInactivity.js';
import { useRestMode } from './hooks/useRestMode.js';
import { useVisibleLayers } from './hooks/useLayers.js';
import { TEXT_SCALES, useViewerStore } from './store/viewerStore.js';
import { useAvatarStore } from './store/avatarStore.js';
import { useUserStore } from './store/userStore.js';
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
 * Visor táctil de BioMap: una maqueta 3D del territorio sobre relieve real.
 * Al tocar un punto, la mascota camina hasta él y se abre su ficha (ver
 * useTour). También tiene modo atracción, reposo y reinicio por inactividad.
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
  const drained = useViewerStore((state) => state.drained);
  const actions = useViewerStore.getState();

  const sky = useDaylight().sky.map((color) => `#${color.getHexString()}`);
  const mainRef = useRef(null);
  const viewerRef = useRef(null);
  const [attractStop, setAttractStop] = useState(null);

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
    useUserStore.getState().resetProgress();
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

  const { selectPoint, arrive, closePoint } = useTour({ points, camera: mainRef });

  const exitAttract = () => {
    useViewerStore.getState().setAttract(false);
    mainRef.current?.resetView();
    markActive();
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
      className="relative w-full h-full overflow-hidden select-none transition-[background] duration-[3000ms]"
      data-contrast={contrast ? 'high' : undefined}
      data-text-scale={textScale}
      data-sheet-open={openSheets.length > 0 ? 'true' : undefined}
      data-attract={attract || undefined}
      style={{
        '--text-scale': TEXT_SCALES[textScale],
        /* Cielo del momento del día; su horizonte es también el color de la bruma. */
        background: `linear-gradient(180deg, ${sky[0]}, ${sky[1]} 45%, ${sky[2]})`,
      }}
    >
      <DioramaCanvas eventSource={viewerRef} />
      <DioramaView
        ref={mainRef}
        id="main"
        config={mapConfig}
        homeView={mapConfig.initialView}
        shadows
        fog={[16, 38]}
        fogColor={sky[2]}
        label={t('mapLabel')}
        onView={publishMainView}
        onTiltChange={actions.setPitched}
      >
        <Avatar points={points} onArrivedAtPoint={arrive} />
        <PoiMarkers
          points={points}
          layers={layers}
          visibleLayerIds={visibleLayerIds}
          selectedIds={selectedPointIds}
          viewId="main"
          onSelectPoint={selectPoint}
        />
      </DioramaView>

      <div
        className={`absolute inset-0 pointer-events-none z-10 [&>*]:pointer-events-auto transition-opacity duration-700 ${attract ? 'opacity-0' : ''}`}
        aria-hidden={attract || undefined}
      >
        <div className="absolute top-6 left-6 flex flex-col gap-3.5 max-w-[380px]">
          <div className="flex flex-col gap-3" data-obstacle>
            <HeaderCard />
            <LayerPanel
              layers={layers}
              visibleLayerIds={visibleLayerIds}
              counts={counts}
              onToggle={actions.toggleLayer}
            />
          </div>
          <div data-obstacle>
            <BioBook
              url={mapConfig.publicUrl || window.location.origin}
              wifi={mapConfig.kioskWifi}
              selectedPoint={
                openSheets.length > 0 ? openSheets[openSheets.length - 1].feature : null
              }
            />
          </div>
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
          <StatusPill messages={messages} />
        </div>

        <div className="absolute top-6 right-6 flex flex-col items-end gap-3.5">
          <div className="flex flex-col items-end gap-3" data-obstacle>
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

        {/* «Bajo el embalse»: el diferenciador de BioMap (ver ReservoirToggle). */}
        {openSheets.length === 0 && (
          <div className="absolute bottom-16 right-6" data-obstacle>
            <ReservoirToggle
              drained={drained}
              onToggle={() => {
                if (!drained) mainRef.current?.resetView();
                actions.toggleDrained();
              }}
            />
          </div>
        )}

        {/* Con una ficha abierta, ese espacio es de la mascota que la presenta. */}
        {openSheets.length === 0 && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2"
            data-obstacle
          >
            <ZoomLevels
              levels={mapConfig.zoomLevels}
              onPick={(range) => mainRef.current?.zoomToRange(range)}
              restSeconds={Math.round(mapConfig.restDelayMs / 1000)}
            />
          </div>
        )}
      </div>

      <PointSheets
        open={openSheets}
        onClose={closePoint}
        onSelectPoint={selectPoint}
        allPoints={points.features}
      />
      <AvatarNarrator />
      <SkipWalkButton />
      <ConfettiCanvas />

      <p className="absolute bottom-2 left-6 text-xs text-white/50 pointer-events-none">
        {t('attribution')}
      </p>

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
