import { ArrowRight, Check, Globe, Rotate3d, Smartphone, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Curiosity from '../../components/Curiosity.jsx';
import ImageGallery from '../../components/ImageGallery.jsx';
import LayerShape from '../../components/LayerShape.jsx';
import { getPoiIcon } from '../../map/poiIcon.jsx';
import { usePointDetail } from '../../hooks/useApi.js';
import { layerName } from '../../i18n/index.js';
import { useUserStore } from '../../store/userStore.js';
import PanoramaViewer from './PanoramaViewer.jsx';

const NO_IMAGES = [];

/**
 * Cabecera sin foto (aún no hay fotos o no cargaron): el color y el icono de
 * la capa, para que la ficha nunca se vea rota.
 */
function PhotoPlaceholder({ layer, name, label }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-3 text-cream"
      style={{ background: `linear-gradient(160deg, #1c75bc, #14334d 85%)` }}
    >
      <span className="flex items-center justify-center w-20 h-20 rounded-full bg-cream/15 border-2 border-cream/40 [&>svg]:w-10 [&>svg]:h-10">
        {getPoiIcon(layer, name)}
      </span>
      <span className="text-[length:var(--fs-small)] font-bold text-cream/85">{label}</span>
    </div>
  );
}

/**
 * Ficha de un punto de interés, acoplada al costado derecho: foto o 360°
 * arriba, pestañas Historia / Fotos / 360° y el paso siguiente del recorrido.
 *
 * @param {{ feature: object, layer: object, onClose: () => void,
 *   onSelectNextPoint?: (id: number) => void, allPoints?: Array<object>,
 *   onChange?: () => void, onOpen3d?: () => void,
 *   ref?: import('react').Ref<HTMLElement> }} props
 */
export default function PointSheet({
  feature,
  layer,
  onClose,
  onSelectNextPoint,
  allPoints = [],
  onChange,
  onOpen3d,
  ref,
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('story');
  const [photo, setPhoto] = useState(0);
  const [broken, setBroken] = useState(() => new Set());
  const detail = usePointDetail(feature.properties.id);
  const images = detail.data?.properties.images ?? NO_IMAGES;
  const photos = images.filter((image) => image.kind !== 'panorama' && !broken.has(image.url));
  const panorama = images.find((image) => image.kind === 'panorama');
  const { id, name } = feature.properties;
  const titleId = `point-sheet-title-${id}`;
  const isVisited = useUserStore((state) =>
    state.visitedPoints?.some((v) => Number(v) === Number(id)),
  );

  const tour = useUserStore((state) => state.tour);
  const step = tour.indexOf(Number(id));
  const next =
    step === -1
      ? null
      : allPoints.find((f) => Number(f.properties.id) === tour[(step + 1) % tour.length]);

  let description = detail.data?.properties.description;
  if (detail.isPending) description = t('card.loading');
  else if (detail.isError) description = t('card.error');

  const pick = (value) => {
    setTab(value);
    onChange?.();
  };
  const tabs = [
    ['story', t('sheet.tabStory')],
    ['photos', t('sheet.tabPhotos', { count: photos.length })],
    ...(panorama ? [['360', t('sheet.tab360')]] : []),
  ];

  return (
    <motion.aside
      ref={ref}
      className="fixed top-6 right-10 bottom-[124px] z-50 flex flex-col w-[min(560px,calc(100vw-48px))] rounded-[20px] bg-cream text-ink overflow-hidden pointer-events-auto shadow-[0_4px_0_var(--color-cream-shade),0_24px_60px_rgba(0,0,0,0.45)]"
      role="dialog"
      aria-labelledby={titleId}
      initial={{ x: 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      <div className="relative flex-[0_0_40%] bg-forest overflow-hidden">
        {tab === '360' && panorama ? (
          <PanoramaViewer url={panorama.url} label={t('sheet.panorama', { name })} />
        ) : photos.length > 0 ? (
          <ImageGallery
            images={photos}
            selectedIndex={Math.min(photo, photos.length - 1)}
            onSelect={(index) => {
              setPhoto(index);
              onChange?.();
            }}
            onImageError={(url) => setBroken((prev) => new Set(prev).add(url))}
          />
        ) : (
          <PhotoPlaceholder layer={layer} name={name} label={t('card.noPhoto')} />
        )}
        <button
          type="button"
          className="absolute top-4 right-4 z-20 flex items-center gap-2 min-h-14 px-5 rounded-xl bg-cream text-ink font-bold text-[length:var(--fs-small)] shadow-[0_3px_0_var(--color-cream-shade)] cursor-pointer active:translate-y-px"
          onClick={onClose}
          aria-label={t('card.close', { name })}
        >
          <X size={22} strokeWidth={3} aria-hidden="true" />
          <span aria-hidden="true">{t('sheet.close')}</span>
        </button>
        {onOpen3d && (
          <button
            type="button"
            className="absolute bottom-4 left-4 z-20 flex items-center gap-2 min-h-14 px-5 rounded-xl bg-forest text-cream font-bold text-[length:var(--fs-body)] shadow-[0_3px_0_rgba(0,0,0,0.35)] cursor-pointer active:translate-y-px"
            onClick={onOpen3d}
          >
            <Rotate3d size={24} aria-hidden="true" />
            {t('visor.open')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 pt-6 pb-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 text-[length:var(--fs-small)] font-bold">
          <span className="inline-flex items-center gap-2 text-forest-light">
            <LayerShape layer={layer} size="lg" />
            {layerName(t, layer)}
          </span>
          <span className="inline-flex items-center gap-2 text-muted">
            {isVisited && (
              <span className="inline-flex items-center gap-1 text-forest-light">
                <Check size={18} strokeWidth={3} aria-hidden="true" />
                {t('sheet.visited')}
              </span>
            )}
            {step !== -1 && t('sheet.step', { n: step + 1, total: tour.length })}
          </span>
        </div>

        <h2
          id={titleId}
          className="m-0 font-display font-extrabold text-[length:var(--fs-card-title)] leading-[1.08] text-balance"
        >
          {name}
        </h2>

        <div
          className="flex gap-1 p-1 rounded-xl bg-cream-shade"
          role="tablist"
          aria-label={t('sheet.tabs')}
        >
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={`flex-1 min-h-14 rounded-lg font-bold text-[length:var(--fs-body)] cursor-pointer transition-colors ${
                tab === value ? 'bg-forest text-cream' : 'text-ink hover:bg-cream/60'
              }`}
              onClick={() => pick(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'story' && (
          <>
            <p className="m-0 text-[length:var(--fs-lead)] leading-relaxed">{description}</p>
            <Curiosity name={name} />
          </>
        )}
        {tab === 'photos' &&
          (photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((image, index) => (
                <button
                  key={image.url}
                  type="button"
                  className={`aspect-[4/3] rounded-lg overflow-hidden border-4 cursor-pointer ${
                    index === photo ? 'border-ochre' : 'border-transparent'
                  }`}
                  onClick={() => {
                    setPhoto(index);
                    onChange?.();
                  }}
                  aria-label={t('card.photoOf', { n: index + 1, total: photos.length })}
                  aria-pressed={index === photo}
                >
                  <img src={image.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <p className="m-0 text-[length:var(--fs-body)] text-muted">{t('sheet.noPhotos')}</p>
          ))}
        {tab === '360' && (
          <p className="m-0 text-[length:var(--fs-body)] text-muted">{t('sheet.panoramaHint')}</p>
        )}
      </div>

      <footer className="flex-none flex gap-3 px-8 pt-3 pb-7">
        {panorama && tab !== '360' ? (
          <button
            type="button"
            className="flex-1 whitespace-nowrap inline-flex items-center justify-center gap-2 min-h-16 px-4 rounded-xl border-[3px] border-forest text-forest font-bold text-[length:var(--fs-body)] cursor-pointer"
            onClick={() => pick('360')}
          >
            <Globe size={22} aria-hidden="true" />
            {t('sheet.view360')}
          </button>
        ) : (
          <button
            type="button"
            className="flex-1 whitespace-nowrap inline-flex items-center justify-center gap-2 min-h-16 px-4 rounded-xl border-[3px] border-forest text-forest font-bold text-[length:var(--fs-body)] cursor-pointer"
            onClick={() => window.dispatchEvent(new CustomEvent('biomap:open-mobile'))}
          >
            <Smartphone size={22} aria-hidden="true" />
            {t('mobile.name')}
          </button>
        )}
        {next && (
          <button
            type="button"
            className="flex-[1.6] min-w-0 inline-flex items-center justify-center gap-2 min-h-16 px-5 rounded-xl bg-ochre text-[#1b1206] font-bold text-[length:var(--fs-body)] shadow-[0_3px_0_var(--color-ochre-deep)] cursor-pointer active:translate-y-px"
            onClick={() => onSelectNextPoint?.(next.properties.id)}
          >
            <span className="truncate">{t('sheet.next', { name: next.properties.name })}</span>
            <ArrowRight size={22} strokeWidth={2.6} aria-hidden="true" className="flex-none" />
          </button>
        )}
      </footer>
    </motion.aside>
  );
}
