import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Selector de época: «2000» vacía el embalse y deja ver el valle como era
 * antes de la inundación de 2014 (el relieve SRTM es del año 2000); «Hoy» lo
 * vuelve a llenar. Es una reconstrucción ilustrativa y se dice en pantalla.
 *
 * @param {{ drained: boolean, onChange: (drained: boolean) => void, onClose: () => void }} props
 */
export default function EpochPanel({ drained, onChange, onClose }) {
  const { t } = useTranslation();
  return (
    <section
      className="panel absolute bottom-[124px] left-1/2 z-30 flex w-[780px] -translate-x-1/2 flex-col gap-3 rounded-[34px] px-8 pb-5 pt-5"
      role="dialog"
      aria-label={t('epoch.title')}
      data-obstacle
    >
      <div className="flex items-center justify-between">
        <span className="text-base font-extrabold uppercase tracking-[0.12em] text-muted">
          {t('dock.epoch')}
        </span>
        <button
          type="button"
          className="flex h-14 w-14 items-center justify-center rounded-2xl border-0 bg-transparent text-forest cursor-pointer hover:bg-forest-light/10"
          aria-label={t('settings.close')}
          onClick={onClose}
        >
          <X size={26} aria-hidden="true" />
        </button>
      </div>
      <div className="flex gap-2 rounded-[26px] bg-forest/8 p-2" role="group">
        {[
          [true, t('epoch.year2000'), t('epoch.noReservoir')],
          [false, t('epoch.today'), t('epoch.withReservoir')],
        ].map(([value, name, hint]) => (
          <button
            key={name}
            type="button"
            className={`flex h-[84px] flex-1 flex-col items-center justify-center rounded-[20px] border-0 cursor-pointer transition-colors ${
              drained === value
                ? 'bg-forest-light text-white'
                : 'bg-transparent text-forest hover:bg-forest-light/10'
            }`}
            aria-pressed={drained === value}
            onClick={() => onChange(value)}
          >
            <span className="font-display text-3xl font-extrabold leading-none">{name}</span>
            <span className="mt-1 text-[length:var(--fs-small)] opacity-85">{hint}</span>
          </button>
        ))}
      </div>
      {drained && (
        <p className="m-0 text-[length:var(--fs-small)] leading-snug text-muted" aria-live="polite">
          {t('epoch.note')}
        </p>
      )}
    </section>
  );
}
