import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TEXT_SCALES } from '../store/viewerStore.js';

/* Botón de un grupo de opciones: la elegida va en azul. */
function Option({ active, onClick, children, label, size }) {
  return (
    <button
      type="button"
      className={`h-14 min-w-14 rounded-[18px] border-0 px-4 font-bold text-[length:var(--fs-small)] cursor-pointer transition-colors ${
        active
          ? 'bg-forest-light text-white'
          : 'bg-transparent text-forest hover:bg-forest-light/10'
      }`}
      style={size ? { fontSize: size } : undefined}
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* Una fila: el nombre del ajuste y sus opciones. */
function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="whitespace-nowrap font-bold text-[length:var(--fs-button)]">{label}</span>
      <div className="flex gap-1.5 rounded-[22px] bg-forest/8 p-1.5">{children}</div>
    </div>
  );
}

/**
 * Ajustes del visor: idioma, tamaño del texto, contraste, vista del mapa y
 * créditos de las fuentes. Todo lo que antes ocupaba la esquina superior.
 *
 * @param {{ lang: string, textScale: number, contrast: boolean, pitched: boolean,
 *   contours: boolean, onLang: (lang: string) => void, onTextScale: (index: number) => void,
 *   onContrast: (on: boolean) => void, onPitch: () => void, onContours: () => void,
 *   onClose: () => void }} props
 */
export default function SettingsPanel({
  lang,
  textScale,
  contrast,
  pitched,
  contours,
  onLang,
  onTextScale,
  onContrast,
  onPitch,
  onContours,
  onClose,
}) {
  const { t } = useTranslation();
  return (
    <section
      className="panel absolute bottom-[124px] right-10 z-30 flex w-[620px] flex-col gap-4 rounded-[30px] p-6"
      role="dialog"
      aria-label={t('settings.title')}
      data-obstacle
    >
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-extrabold">{t('settings.title')}</h2>
        <button
          type="button"
          className="flex h-16 w-16 items-center justify-center rounded-[20px] border-0 bg-transparent text-forest cursor-pointer hover:bg-forest-light/10"
          aria-label={t('settings.close')}
          onClick={onClose}
        >
          <X size={28} aria-hidden="true" />
        </button>
      </div>
      <Row label={t('settings.language')}>
        <Option active={lang === 'es'} onClick={() => onLang('es')}>
          Español
        </Option>
        <Option active={lang === 'en'} onClick={() => onLang('en')}>
          English
        </Option>
      </Row>
      <Row label={t('settings.textSize')}>
        {TEXT_SCALES.map((scale, index) => (
          <Option
            key={scale}
            active={textScale === index}
            label={t('settings.textSizeN', { n: index + 1 })}
            size={20 + index * 6}
            onClick={() => onTextScale(index)}
          >
            A
          </Option>
        ))}
      </Row>
      <Row label={t('a11y.contrast')}>
        <Option active={!contrast} onClick={() => onContrast(false)}>
          {t('settings.no')}
        </Option>
        <Option active={contrast} onClick={() => onContrast(true)}>
          {t('settings.yes')}
        </Option>
      </Row>
      <Row label={t('settings.view')}>
        <Option active={pitched} onClick={pitched ? undefined : onPitch}>
          3D
        </Option>
        <Option active={!pitched} onClick={pitched ? onPitch : undefined}>
          {t('settings.flat')}
        </Option>
        <Option active={contours} onClick={onContours}>
          {t('controls.contours')}
        </Option>
      </Row>
      <p className="m-0 border-t border-forest/15 pt-4 text-base leading-snug text-muted">
        {t('attribution')}
      </p>
    </section>
  );
}
