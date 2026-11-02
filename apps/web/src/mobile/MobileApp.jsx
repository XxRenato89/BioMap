import { Languages, Layers, Minus, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Compass from '../components/Compass.jsx';
import ConfettiCanvas from '../components/ConfettiCanvas.jsx';
import SkipWalkButton from '../components/SkipWalkButton.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { config } from '../config.js';
import Avatar from '../diorama/components/Avatar.jsx';
import DioramaCanvas from '../diorama/components/DioramaCanvas.jsx';
import DioramaView from '../diorama/components/DioramaView.jsx';
import { PoiMarkers } from '../diorama/components/PoiMarkers.jsx';
import { isInside } from '../diorama/utils/cameraMath.js';
import AvatarNarrator from '../features/avatar/AvatarNarrator.jsx';
import { useTour } from '../features/tour/useTour.js';
import { useLayersQuery, usePointsQuery } from '../hooks/useApi.js';
import { useDaylight } from '../hooks/useDaylight.js';
import { useVisibleLayers } from '../hooks/useLayers.js';
import { useUserStore } from '../store/userStore.js';
import { useViewerStore } from '../store/viewerStore.js';
import { publishMainView } from '../store/viewsStore.js';
import LayersSheet from './LayersSheet.jsx';
import PlaceSearch from './PlaceSearch.jsx';
import PlaceSheet from './PlaceSheet.jsx';

const timing = { refreshMs: config.refreshMs, retryMs: config.retryMs };

/* En vertical cabe menos territorio a lo ancho: se parte más lejos y centrado entre la central y Playa Quilaco, para ver todo el recorrido. */
const PHONE_HOME = { ...config.initialView, center: [-71.807, -37.727], range: 9_800 };
/* Con la ficha abajo, el lugar sube a la parte alta de la pantalla. */
const SHEET_SHIFT = { x: 0, y: 0.2 };

/**
 * BioMap Mobile: la misma maqueta 3D, la misma mascota y el mismo recorrido
 * que el kiosco, con una interfaz pensada para el teléfono: buscador arriba,
 * capas y zoom a mano, y la ficha del lugar como una hoja que sube desde abajo.
 * Al tocar un lugar, Quibar camina hasta él y se abre su ficha. Si el código
 * QR trae `?point=ID`, abre directo ese lugar.
 */
export default function MobileApp() {
  const { t, i18n } = useTranslation();
  const { layers, failing: layersFailing } = useLayersQuery(timing);
  const { points, failing: pointsFailing } = usePointsQuery(timing);
  const visibleLayerIds = useVisibleLayers(layers);
  const selectedPointIds = useViewerStore((state) => state.selectedPointIds);
  const hiddenLayerIds = useViewerStore((state) => state.hiddenLayerIds);
  const tour = useUserStore((state) => state.tour);
  const visitedPoints = useUserStore((state) => state.visitedPoints);
  const sky = useDaylight().sky.map((color) => `#${color.getHexString()}`);
  const mainRef = useRef(null);
  const viewerRef = useRef(null);
  const [panel, setPanel] = useState(null);

  const { selectPoint, arrive, closePoint } = useTour({
    points,
    camera: mainRef,
    sheetShift: SHEET_SHIFT,
  });

  const layerById = useMemo(() => new Map(layers.map((layer) => [layer.id, layer])), [layers]);
  const onMap = useMemo(
    () =>
      points.features.filter(
        (feature) =>
          layerById.has(feature.properties.layerId) &&
          isInside(feature.geometry.coordinates, config.maxBounds),
      ),
    [points, layerById],
  );
  const counts = useMemo(() => {
    const total = new Map();
    points.features.forEach(({ properties }) =>
      total.set(properties.layerId, (total.get(properties.layerId) ?? 0) + 1),
    );
    return total;
  }, [points]);

  /* Un lugar por vez: la ficha abierta es la última. */
  const selectedId = selectedPointIds.at(-1) ?? null;
  const selected = points.features.find((f) => f.properties.id === selectedId) ?? null;
  const step = selected ? tour.indexOf(Number(selected.properties.id)) + 1 : 0;
  const next =
    step > 0 && step < tour.length
      ? (points.features.find((f) => Number(f.properties.id) === tour[step]) ?? null)
      : null;

  /* El idioma sigue al de la interfaz, y el teléfono no hereda el estado de otra visita. */
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  useEffect(() => () => useViewerStore.getState().resetAll(), []);

  /* Código QR con `?point=ID`: abre ese lugar apenas la maqueta está lista. */
  const linked = useRef(false);
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('point'));
    const feature = points.features.find((f) => f.properties.id === id);
    if (linked.current || !feature) return undefined;
    const timer = setInterval(() => {
      if (!mainRef.current?.flyTo) return;
      linked.current = true;
      clearInterval(timer);
      arrive(feature);
    }, 500);
    return () => clearInterval(timer);
  }, [points, arrive]);

  const pick = (id) => {
    setPanel(null);
    selectPoint(id);
  };

  const messages = layersFailing || pointsFailing ? [t('status.offline')] : [];
  const iconButton =
    'flex h-14 w-14 flex-none items-center justify-center rounded-full border-0 bg-cream text-forest shadow-[0_4px_14px_rgba(20,51,77,0.3)]';

  return (
    <main
      ref={viewerRef}
      className="fixed inset-0 overflow-hidden select-none"
      style={{ background: `linear-gradient(180deg, ${sky[0]}, ${sky[1]} 45%, ${sky[2]})` }}
    >
      <DioramaCanvas eventSource={viewerRef} />
      <DioramaView
        ref={mainRef}
        id="main"
        config={config}
        homeView={PHONE_HOME}
        fog={[16, 38]}
        fogColor={sky[2]}
        label={t('mapLabel')}
        onView={publishMainView}
        onTiltChange={() => {}}
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

      <div className="pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto">
        <header className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
          <button
            type="button"
            className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-full border-0 bg-cream px-5 text-left text-forest shadow-[0_4px_14px_rgba(20,51,77,0.3)]"
            aria-label={t('search.label')}
            onClick={() => setPanel('search')}
          >
            <span className="font-display text-xl font-extrabold tracking-wide">BioMap</span>
            <span className="h-6 w-px bg-forest/20" aria-hidden="true" />
            <Search size={20} aria-hidden="true" className="flex-none" />
            <span className="truncate text-lg text-muted">{t('search.placeholder')}</span>
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={t('a11y.languageLabel')}
            onClick={() => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')}
          >
            <Languages size={22} aria-hidden="true" />
          </button>
        </header>

        {messages.length > 0 && (
          <div className="absolute inset-x-3 top-[84px] flex justify-center">
            <StatusPill messages={messages} />
          </div>
        )}

        <div className="absolute right-3 top-[88px]">
          <Compass onResetNorth={() => mainRef.current?.resetNorth()} />
        </div>

        {!selected && !panel && (
          <>
            <button
              type="button"
              className="absolute bottom-[max(20px,env(safe-area-inset-bottom))] left-3 flex h-14 items-center gap-2 rounded-full border-0 bg-forest-light px-6 text-lg font-bold text-white shadow-[0_4px_14px_rgba(20,51,77,0.35)]"
              onClick={() => setPanel('layers')}
            >
              <Layers size={22} aria-hidden="true" />
              {t('m.layers')}
            </button>
            <div className="absolute bottom-[max(20px,env(safe-area-inset-bottom))] right-3 flex flex-col overflow-hidden rounded-2xl bg-cream text-forest shadow-[0_4px_14px_rgba(20,51,77,0.3)]">
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center border-0 border-b border-forest/15 bg-transparent"
                aria-label={t('controls.zoomIn')}
                onClick={() => mainRef.current?.zoomBy(0.55)}
              >
                <Plus size={24} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center border-0 bg-transparent"
                aria-label={t('controls.zoomOut')}
                onClick={() => mainRef.current?.zoomBy(1.8)}
              >
                <Minus size={24} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>

      {selected && !panel && (
        <PlaceSheet
          key={selected.properties.id}
          feature={selected}
          layer={layerById.get(selected.properties.layerId)}
          step={step}
          total={tour.length}
          visited={visitedPoints.some((v) => Number(v) === Number(selected.properties.id))}
          next={next}
          onNext={pick}
          onClose={() => closePoint(selected.properties.id)}
        />
      )}
      {panel === 'layers' && (
        <LayersSheet
          layers={layers}
          hidden={hiddenLayerIds}
          counts={counts}
          onToggle={useViewerStore.getState().toggleLayer}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'search' && (
        <PlaceSearch
          features={onMap}
          layers={layerById}
          onPick={pick}
          onClose={() => setPanel(null)}
        />
      )}

      <AvatarNarrator />
      <SkipWalkButton />
      <ConfettiCanvas />
    </main>
  );
}
