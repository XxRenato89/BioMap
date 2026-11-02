import { ArrowRight, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Curiosity from '../components/Curiosity.jsx';
import { usePointDetail } from '../hooks/useApi.js';
import { layerName } from '../i18n/index.js';

/**
 * Ficha de un lugar en el teléfono: una hoja que sube desde abajo con sus
 * fotos (se deslizan de lado), su historia y el paso siguiente del recorrido.
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
  const photos = (detail.data?.properties.images ?? []).filter(
    (image) => image.kind !== 'panorama' && !broken.has(image.url),
  );

  let description = detail.data?.properties.description;
  if (detail.isPending) description = t('card.loading');
  else if (detail.isError) description = t('card.error');

  return (
    <section
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[64%] flex-col rounded-t-[28px] bg-cream text-forest shadow-[0_-8px_30px_rgba(20,51,77,0.35)]"
      role="dialog"
      aria-labelledby="m-place-title"
    >
      <div
        className="mx-auto mt-3 h-1.5 w-10 flex-none rounded-full bg-forest/20"
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3 px-5 pt-3">
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
        {photos.length > 0 && (
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
        <p className="m-0 mt-2 text-[19px] leading-relaxed">{description}</p>
        <Curiosity name={name} className="mt-3" />
        {visited && (
          <p className="m-0 mt-3 flex items-center gap-1.5 text-base font-bold text-forest-light">
            <Check size={18} strokeWidth={3} aria-hidden="true" />
            {t('sheet.visited')}
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
