import { ArrowRight, Globe, Image, X } from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Curiosity from '../components/Curiosity.jsx';
import Facts from '../components/Facts.jsx';
import { StampBadge } from '../components/Passport.jsx';
import { usePointDetail } from '../hooks/useApi.js';
import { layerName } from '../i18n/index.js';

/* El visor 360° pesa: se baja recién cuando alguien lo abre. */
const PanoramaViewer = lazy(() => import('../features/point/PanoramaViewer.jsx'));
/* Arrastre del tirador (px) que cuenta como gesto: abajo cierra o achica, arriba agranda. */
const DRAG_PX = 60;

/**
 * Ficha de un lugar en el teléfono: una hoja que sube desde abajo con sus
 * fotos (se deslizan de lado), su foto 360° si tiene, sus cifras, su historia
 * y el paso siguiente del recorrido. Se agranda o se cierra arrastrando su tirador.
 *
 * @param {{ feature: object, layer: object | undefined, step: number, total: number,
 *   visited: boolean, next: object | null, onNext: (id: number) => void,
 *   onClose: () => void }} props
 */
export default function PlaceSheet({
  feature,
  layer,
  step,
  total,
  visited,
  next,
  onNext,
  onClose,
}) {
  const { t } = useTranslation();
  const { id, name } = feature.properties;
  const detail = usePointDetail(id);
  const [broken, setBroken] = useState(() => new Set());
  const images = detail.data?.properties.images ?? [];
  const photos = images.filter((image) => image.kind !== 'panorama' && !broken.has(image.url));
  const panorama = images.find((image) => image.kind === 'panorama');
  const [show360, setShow360] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dragFrom = useRef(null);
  const endDrag = (event) => {
    if (dragFrom.current === null) return;
    const moved = event.clientY - dragFrom.current;
    dragFrom.current = null;
    if (moved < -DRAG_PX) setExpanded(true);
    else if (moved > DRAG_PX) expanded ? setExpanded(false) : onClose();
  };

  let description = detail.data?.properties.description;
  if (detail.isPending) description = t('card.loading');
  else if (detail.isError) description = t('card.error');

  return (
    <section
      className={`absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-[28px] bg-cream text-forest shadow-[0_-8px_30px_rgba(20,51,77,0.35)] transition-[max-height] duration-300 ${expanded ? 'max-h-[92%]' : 'max-h-[64%]'}`}
      role="dialog"
      aria-labelledby="m-place-title"
    >
      {/* Tirador: zona amplia para el dedo, aunque la barra sea delgada. */}
      <div
        className="flex h-8 flex-none touch-none items-center justify-center"
        aria-hidden="true"
        onPointerDown={(event) => {
          dragFrom.current = event.clientY;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={endDrag}
        onPointerCancel={() => (dragFrom.current = null)}
      >
        <span className="h-1.5 w-10 rounded-full bg-forest/25" />
      </div>
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <p className="m-0 text-sm font-bold uppercase tracking-wider text-muted">
            {step > 0
              ? t('sheet.step', { n: step, total })
              : layer
                ? layerName(t, layer)
                : t('m.place')}
          </p>
          <h2 id="m-place-title" className="m-0 mt-0.5 text-[26px] leading-tight font-extrabold">
            {name}
          </h2>
        </div>
        <button
          type="button"
          className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl border-0 bg-transparent text-forest"
          aria-label={t('card.close', { name })}
          onClick={onClose}
        >
          <X size={24} aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-y-auto px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        {show360 && panorama && (
          <div className="relative h-56 overflow-hidden rounded-2xl bg-forest">
            <Suspense fallback={null}>
              <PanoramaViewer url={panorama.url} label={t('sheet.panorama', { name })} />
            </Suspense>
          </div>
        )}
        {!show360 && photos.length > 0 && (
          <ul className="m-0 -mx-5 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
            {photos.map((photo, index) => (
              <li key={photo.url} className="w-[86%] flex-none snap-center">
                <img
                  className="h-44 w-full rounded-2xl bg-forest/10 object-cover"
                  src={photo.url}
                  alt={photo.altText ?? name}
                  loading="lazy"
                  onError={() => setBroken((prev) => new Set(prev).add(photo.url))}
                />
                {photo.credit && (
                  <p className="m-0 mt-1 text-xs leading-snug text-muted">
                    {t('card.credit', { credit: photo.credit })} ·{' '}
                    {t('card.photoOf', { n: index + 1, total: photos.length })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {panorama && (
          <button
            type="button"
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-forest bg-transparent px-4 text-base font-bold text-forest"
            aria-pressed={show360}
            onClick={() => setShow360((on) => !on)}
          >
            {show360 ? (
              <Image size={20} aria-hidden="true" />
            ) : (
              <Globe size={20} aria-hidden="true" />
            )}
            {show360 ? t('sheet.viewPhotos') : t('sheet.view360')}
          </button>
        )}
        <Facts name={name} className="mt-3 text-[15px]" />
        <p className="m-0 mt-2 text-[19px] leading-relaxed">{description}</p>
        <Curiosity name={name} className="mt-3" />
        {visited && (
          <p className="m-0 mt-4">
            <StampBadge className="text-base" />
          </p>
        )}
        {next && (
          <button
            type="button"
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-0 bg-forest-light px-4 text-lg font-bold text-white"
            onClick={() => onNext(next.properties.id)}
          >
            <span className="truncate">{t('sheet.next', { name: next.properties.name })}</span>
            <ArrowRight size={22} aria-hidden="true" className="flex-none" />
          </button>
        )}
      </div>
    </section>
  );
}
