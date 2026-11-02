import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Compass from './components/Compass.jsx';
import ConfettiCanvas from './components/ConfettiCanvas.jsx';
import Dock from './components/Dock.jsx';
import EpochPanel from './components/EpochPanel.jsx';
import InactivityWarning from './components/InactivityWarning.jsx';
import MobilePanel from './components/MobilePanel.jsx';
import SearchBar from './components/SearchBar.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import SkipWalkButton from './components/SkipWalkButton.jsx';
import StatusPill from './components/StatusPill.jsx';
import TimeOfDayWidget from './components/TimeOfDayWidget.jsx';
import { config } from './config.js';
import AttractOverlay from './features/attract/AttractOverlay.jsx';
import { useAttractMode } from './features/attract/useAttractMode.js';
import PointSheets from './features/point/PointSheets.jsx';
import Visor3D from './features/point/Visor3D.jsx';
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
import { AVAILABLE_TOURS, useUserStore } from './store/userStore.js';
import { publishMainView } from './store/viewsStore.js';
import TourSheet from './features/tour/TourSheet.jsx';

const INTERACTION_EVENTS = ['pointerdown', 'wheel', 'keydown'];

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
  /* Panel abierto sobre la barra inferior: 'mobile', 'epoch', 'settings' o ninguno. */
  const [panel, setPanel] = useState(null);
  const togglePanel = useCallback((name) => setPanel((open) => (open === name ? null : name)), []);
  const closePanel = useCallback(() => setPanel(null), []);
  /* Visor 3D abierto sobre un lugar: { name, center, kind, spinning }. */
  const [visor, setVisor] = useState(null);

  useEffect(() => {
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  }, [i18n, lang]);

  /*
   * Reinicio por inactividad: todo vuelve al estado inicial para el próximo visitante.
   */
  const resetAll = useCallback(() => {
    mainRef.current?.resetView();
    setPanel(null);
    setVisor(null);
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
    setPanel(null);
    setVisor(null);
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

  /* La ficha de un lugar también abre BioMap Mobile, con el código de ese lugar. */
  useEffect(() => {
    const open = () => setPanel('mobile');
    window.addEventListener('biomap:open-mobile', open);
    return () => window.removeEventListener('biomap:open-mobile', open);
  }, []);
  /* Al elegir un lugar, el panel abierto se cierra para dejar ver el mapa. */
  const pickPoint = (id) => {
    setPanel(null);
    selectPoint(id);
  };

  const exitAttract = () => {
    useViewerStore.getState().setAttract(false);
    mainRef.current?.resetView();
    markActive();
  };

  const handleReset = () => {
    setPanel(null);
    setVisor(null);
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

  const openVisor = (feature, kind = 'ground') => {
    setPanel(null);
    setVisor({
      name: feature.properties.name,
      center: feature.geometry.coordinates,
      kind,
      spinning: kind === 'drone',
    });
    mainRef.current?.enterVisor(feature.geometry.coordinates, kind);
  };
  const closeVisor = () => {
    setVisor(null);
    mainRef.current?.exitVisor();
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
        className={`absolute inset-0 pointer-events-none z-10 [&>*]:pointer-events-auto transition-opacity duration-700 ${attract || visor ? 'opacity-0 invisible' : ''}`}
        aria-hidden={attract || visor ? true : undefined}
      >
        <div className="absolute top-7 left-10">
          <SearchBar points={onMap} onPick={pickPoint} />
        </div>

        {messages.length > 0 && (
          <div className="absolute top-7 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <StatusPill messages={messages} />
          </div>
        )}

        <div className="absolute top-7 right-10 flex items-center gap-3">
          <TimeOfDayWidget />
          <Compass onResetNorth={() => mainRef.current?.resetNorth()} />
        </div>

        {panel === 'mobile' && (
          <MobilePanel
            url={mapConfig.publicUrl || window.location.origin}
            wifi={mapConfig.kioskWifi}
            selectedPoint={openSheets.length > 0 ? openSheets[openSheets.length - 1].feature : null}
            onClose={closePanel}
          />
        )}
        {panel === 'epoch' && (
          <EpochPanel
            drained={drained}
            onChange={(next) => {
              if (next === drained) return;
              if (next) mainRef.current?.resetView();
              actions.toggleDrained();
            }}
            onClose={closePanel}
          />
        )}
        {panel === 'tour' && (
          <TourSheet
            onClose={closePanel}
            onSelectTour={(tourId) => {
              const activeTour = AVAILABLE_TOURS.find((t) => t.id === tourId);
              if (activeTour?.stops?.[0]) {
                selectPoint(activeTour.stops[0]);
              }
            }}
          />
        )}
        {panel === 'settings' && (
          <SettingsPanel
            lang={lang}
            textScale={textScale}
            contrast={contrast}
            pitched={pitched}
            contours={contours}
            onLang={actions.setLang}
            onTextScale={actions.setTextScale}
            onContrast={(on) => on !== contrast && actions.toggleContrast()}
            onPitch={togglePitch}
            onContours={actions.toggleContours}
            onClose={closePanel}
          />
        )}

        <Dock
          panel={panel}
          epochLabel={drained ? t('epoch.year2000') : t('epoch.today')}
          onHome={handleReset}
          onPanel={togglePanel}
          onZoomIn={() => mainRef.current?.zoomBy(0.55)}
          onZoomOut={() => mainRef.current?.zoomBy(1.8)}
        />
      </div>

      {visor && (
        <Visor3D
          name={visor.name}
          kind={visor.kind}
          spinning={visor.spinning}
          onKind={(kind) => {
            setVisor({ ...visor, kind, spinning: kind === 'drone' });
            mainRef.current?.enterVisor(visor.center, kind);
          }}
          onSpin={() => {
            mainRef.current?.setSpin(!visor.spinning);
            setVisor({ ...visor, spinning: !visor.spinning });
          }}
          onExit={closeVisor}
          onResetNorth={() => mainRef.current?.resetNorth()}
        />
      )}
      <PointSheets
        open={visor ? [] : openSheets}
        onOpen3d={openVisor}
        onClose={closePoint}
        onSelectPoint={selectPoint}
        allPoints={points.features}
      />
      <AvatarNarrator />
      <SkipWalkButton />
      <ConfettiCanvas />

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
