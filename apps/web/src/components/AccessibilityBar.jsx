import { Contrast, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Ajustes de lectura: texto más grande, alto contraste e idioma.
 *
 * @param {{ textScale: number, contrast: boolean, onTextScale: () => void,
 *   onContrast: () => void, onLanguage: () => void }} props
 */
export default function AccessibilityBar({
  textScale,
  contrast,
  onTextScale,
  onContrast,
  onLanguage,
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        className={`glass-light inline-flex items-center justify-center font-extrabold text-base px-4 py-2.5 rounded-2xl border border-white/70 shadow-soft transition-all duration-150 active:scale-95 hover:bg-white ${
          textScale > 0 ? 'bg-forest text-white' : 'text-ink'
        }`}
        aria-label={t('a11y.textBigger')}
        onClick={onTextScale}
      >
        Aa+
      </button>
      <button
        type="button"
        className={`glass-light inline-flex items-center gap-2 font-bold text-base px-4 py-2.5 rounded-2xl border border-white/70 shadow-soft transition-all duration-150 active:scale-95 hover:bg-white ${
          contrast ? 'bg-forest text-white' : 'text-ink'
        }`}
        aria-pressed={contrast}
        onClick={onContrast}
      >
        <Contrast size={20} strokeWidth={2.2} aria-hidden="true" />
        <span>{t('a11y.contrast')}</span>
      </button>
      <button
        type="button"
        className="glass-light inline-flex items-center gap-2 font-bold text-base px-4 py-2.5 rounded-2xl border border-white/70 shadow-soft text-ink transition-all duration-150 active:scale-95 hover:bg-white"
        aria-label={t('a11y.languageLabel')}
        onClick={onLanguage}
      >
        <Languages size={20} strokeWidth={2.2} aria-hidden="true" />
        <span>{t('a11y.language')}</span>
      </button>
    </div>
  );
}
