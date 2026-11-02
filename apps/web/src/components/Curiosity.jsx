import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { curiosityFor } from '../data/curiosities.js';

/**
 * «¿Sabías que…?»: un dato curioso del lugar, pequeño y con su fuente, al pie
 * de la ficha. No se muestra si el lugar no tiene uno verificado.
 *
 * @param {{ name: string, className?: string }} props
 */
export default function Curiosity({ name, className = '' }) {
  const { t, i18n } = useTranslation();
  const fact = curiosityFor(name, i18n.language === 'en' ? 'en' : 'es');
  if (!fact) return null;
  return (
    <aside
      className={`flex items-start gap-2.5 rounded-xl bg-forest-light/10 px-3.5 py-2.5 text-forest ${className}`}
    >
      <Lightbulb size={18} aria-hidden="true" className="mt-0.5 flex-none text-forest-light" />
      <p className="m-0 text-sm leading-snug">
        <strong>{t('curiosity.title')}</strong> {fact.text}
        <span className="mt-0.5 block text-xs text-muted">
          {t('curiosity.source')}: {fact.source}
        </span>
      </p>
    </aside>
  );
}
