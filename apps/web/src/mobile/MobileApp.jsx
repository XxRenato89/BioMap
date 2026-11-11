import { Home, Languages, Minus, Plus, Search } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Compass from '../components/Compass.jsx';
import ConfettiCanvas from '../components/ConfettiCanvas.jsx';
import PassportCard, { StampRow } from '../components/Passport.jsx';
import SkipWalkButton from '../components/SkipWalkButton.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { config } from '../config.js';
import Avatar from '../diorama/components/Avatar.jsx';
import DioramaCanvas from '../diorama/components/DioramaCanvas.jsx';
import DioramaView from '../diorama/components/DioramaView.jsx';
import { PoiMarkers } from '../diorama/components/PoiMarkers.jsx';
import { fitView, isInside } from '../diorama/utils/cameraMath.js';
import AvatarNarrator from '../features/avatar/AvatarNarrator.jsx';
import { useTour } from '../features/tour/useTour.js';
import { useLayersQuery, usePointsQuery } from '../hooks/useApi.js';
import { useDaylight } from '../hooks/useDaylight.js';
import { useVisibleLayers } from '../hooks/useLayers.js';
import { useUserStore } from '../store/userStore.js';
import { useViewerStore } from '../store/viewerStore.js';
import { publishMainView } from '../store/viewsStore.js';
import PlaceSearch from './PlaceSearch.jsx';
import PlaceSheet from './PlaceSheet.jsx';

const timing = { refreshMs: config.refreshMs, retryMs: config.retryMs };

/* En vertical cabe menos territorio a lo ancho: se parte más lejos y centrado entre la central y Playa Quilaco, para ver todo el recorrido. */
const PHONE_HOME = { ...config.initialView, center: [-71.807, -37.727], range: 9_800 };
/* Pines y placas más chicos que en el kiosco: caben más nombres sin taparse. */
const PIN_SCALE = 0.8;
/* Debe coincidir con la cámara de DioramaView. */
const FOV = 32;
/* Rumbos que prueba el inicio: en vertical, girar el mapa a lo largo de los lugares deja verlos más de cerca. */
const HEADINGS = [-45, -30, -15, 0, 15, 30, 45];
/* Con la ficha abajo, el lugar sube a la parte alta de la pantalla. */
const SHEET_SHIFT = { x: 0, y: 0.2 };

/**
 * BioMap Mobile: la misma maqueta 3D, la misma mascota y el mismo recorrido
 * que el kiosco, con una interfaz pensada para el teléfono: buscador arriba,
 * el recorrido y el zoom a mano, y la ficha del lugar como una hoja que sube
 * desde abajo.
 * Al tocar un lugar, Quibar camina hasta él y se abre su ficha. Si el código
 * QR trae `?point=ID`, abre directo ese lugar.
 */
export default function MobileApp() {
  const { t, i18n } = useTranslation();
  const { layers, failing: layersFailing } = useLayersQuery(timing);
  const { points, failing: pointsFailing } = usePointsQuery(timing);
  const visibleLayerIds = useVisibleLayers(layers);
  const selectedPointIds = useViewerStore((state) => state.selectedPointIds);
  const tour = useUserStore((state) => state.tour);
  const visitedPoints = useUserStore((state) => state.visitedPoints);
  const sky = useDaylight().sky.map((color) => `#${color.getHexString()}`);
  const mainRef = useRef(null);
  const viewerRef = useRef(null);
  const [panel, setPanel] = useState(null);
  const passportOpen = useUserStore((state) => state.passportOpen);
  const setPassportOpen = useUserStore((state) => state.setPassportOpen);
  /* Proporción de la pantalla: cambia al girar el teléfono y con ella el encuadre de inicio. */
  const [aspect, setAspect] = useState(() => window.innerWidth / window.innerHeight);
  useEffect(() => {
    const onResize = () => setAspect(window.innerWidth / window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  /* Inicio: el encuadre justo para ver todos los lugares en esta pantalla. */
  const home = useMemo(
    () =>
      onMap.length > 1
        ? fitView(
            onMap.map((f) => f.geometry.coordinates),
            {
              aspect,
              fov: FOV,
              base: PHONE_HOME,
              headings: HEADINGS,
              maxRange: config.maxRange,
            },
          )
        : PHONE_HOME,
    [onMap, aspect],
  );
  /* Al girar el teléfono, la vista general se vuelve a encuadrar (si no hay una ficha abierta). */
  const lastAspect = useRef(aspect);
  useEffect(() => {
    if (lastAspect.current === aspect) return;
    lastAspect.current = aspect;
    if (useViewerStore.getState().selectedPointIds.length === 0) mainRef.current?.resetView();
  }, [aspect]);
  /* Toque en un grupo de pines: la cámara se acerca y los pines se separan solos. */
  const openCluster = (feature) => {
    const view = mainRef.current?.view();
    if (!feature || !view) return;
    mainRef.current.flyTo({
      ...view,
      center: feature.geometry.coordinates,
      range: view.range * 0.45,
    });
  };
  /* Los lugares llegan después de la maqueta: la primera vez, la cámara va al nuevo inicio. */
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || onMap.length < 2) return;
    fitted.current = true;
    const hasPointLink = new URLSearchParams(window.location.search).has('point');
    if (!hasPointLink && useViewerStore.getState().selectedPointIds.length === 0)
      mainRef.current?.resetView();
  }, [onMap]);

  /* Un lugar por vez: la ficha abierta es la última. */
  const selectedId = selectedPointIds.at(-1) ?? null;
  const selected = points.features.find((f) => f.properties.id === selectedId) ?? null;
  const step = selected ? tour.indexOf(Number(selected.properties.id)) + 1 : 0;
  const next =
    step > 0 && step < tour.length
      ? (points.features.find((f) => Number(f.properties.id) === tour[step]) ?? null)
      : null;
  /* Barra de abajo: cuántas paradas lleva y cuál sigue (la primera sin visitar). */
  const isVisited = (id) => visitedPoints.some((v) => Number(v) === id);
  const done = tour.filter(isVisited).length;
  const pendingId = tour.find((id) => !isVisited(id));
  const pending = points.features.find((f) => Number(f.properties.id) === pendingId) ?? null;

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
        homeView={home}
        fog={[16, 38]}
        fogColor={sky[2]}
        label={t('mapLabel')}
        onView={publishMainView}
        onTiltChange={() => {}}
      >
        <Avatar points={points} onArrivedAtPoint={arrive} marker />
        <PoiMarkers
          points={points}
          layers={layers}
          visibleLayerIds={visibleLayerIds}
          selectedIds={selectedPointIds}
          viewId="main"
          onSelectPoint={selectPoint}
          onOpenCluster={openCluster}
          pinScale={PIN_SCALE}
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
            <span className="flex flex-col items-center leading-none">
              <Languages size={16} aria-hidden="true" />
              <span className="mt-0.5 text-sm font-extrabold uppercase">
                {i18n.language.slice(0, 2)}
              </span>
            </span>
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
            <div className="absolute inset-x-3 bottom-[max(16px,env(safe-area-inset-bottom))] flex items-center gap-2 rounded-[28px] bg-cream p-2 text-forest shadow-[0_6px_20px_rgba(20,51,77,0.35)]">
              {tour.length > 0 && (
                <button
                  type="button"
                  className="flex h-14 min-w-0 flex-1 items-center gap-2 rounded-[22px] border-0 bg-forest px-4 text-left text-white"
                  onClick={() => (pending ? pick(pending.properties.id) : setPassportOpen(true))}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-wide opacity-85">
                      {t('passport.name')} ·{' '}
                      <span className="tabular-nums">
                        {done}/{tour.length}
                      </span>
                    </span>
                    <span className="block truncate text-base font-extrabold">
                      {pending ? t('m.next', { name: pending.properties.name }) : t('m.tourDone')}
                    </span>
                  </span>
                  <StampRow size={26} />
                </button>
              )}
              <button
                type="button"
                className="flex h-14 w-14 flex-none items-center justify-center rounded-[22px] border-0 bg-transparent text-forest"
                aria-label={t('controls.reset')}
                onClick={() => mainRef.current?.resetView()}
              >
                <Home size={24} aria-hidden="true" />
              </button>
            </div>
            <div className="absolute bottom-[calc(max(16px,env(safe-area-inset-bottom))+88px)] right-3 flex flex-col overflow-hidden rounded-2xl bg-cream text-forest shadow-[0_4px_14px_rgba(20,51,77,0.3)]">
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
      <AnimatePresence>
        {passportOpen && (
          <PassportCard
            onClose={() => setPassportOpen(false)}
            onGo={(id) => {
              setPassportOpen(false);
              pick(id);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
