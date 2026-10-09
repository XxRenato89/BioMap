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
    <div className="a11y-bar">
      <button
        type="button"
        className="chip-button glass-light chip-button--text"
        aria-label={t('a11y.textBigger')}
        data-level={textScale}
        onClick={onTextScale}
      >
        Aa+
      </button>
      <button
        type="button"
        className="chip-button glass-light"
        aria-pressed={contrast}
        onClick={onContrast}
      >
        <Contrast size={24} strokeWidth={2.2} aria-hidden="true" />
        {t('a11y.contrast')}
      </button>
      <button
        type="button"
        className="chip-button glass-light"
        aria-label={t('a11y.languageLabel')}
        onClick={onLanguage}
      >
        <Languages size={24} strokeWidth={2.2} aria-hidden="true" />
        {t('a11y.language')}
      </button>
    </div>
  );
}
