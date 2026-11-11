import { useTranslation } from 'react-i18next';
import { factsFor } from '../data/curiosities.js';

/**
 * Cifras clave de un lugar, grandes y de un vistazo (potencia, superficie,
 * año…). Solo datos con fuente: un lugar sin cifras verificadas no muestra nada.
 *
 * @param {{ name: string, className?: string }} props
 */
export default function Facts({ name, className = '' }) {
  const { i18n } = useTranslation();
  const facts = factsFor(name, i18n.language === 'en' ? 'en' : 'es');
  if (facts.length === 0) return null;
  return (
    <dl className={`m-0 grid grid-cols-3 gap-2 ${className}`}>
      {facts.map(({ value, label }) => (
        <div key={label} className="rounded-2xl border border-cream-shade bg-white px-3 py-2">
          <dt className="sr-only">{label}</dt>
          <dd className="m-0">
            <span className="block font-display text-[1.5em] font-extrabold leading-tight text-forest-light">
              {value}
            </span>
            <span className="block text-[0.8em] leading-tight text-muted" aria-hidden="true">
              {label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
