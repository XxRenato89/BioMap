import { useTranslation } from 'react-i18next';
import { useViewsStore } from '../store/viewsStore.js';

/**
 * Brújula que gira con la vista general. Al tocarla, el mapa vuelve a tener el norte arriba.
 *
 * @param {{ onResetNorth: () => void }} props
 */
export default function Compass({ onResetNorth }) {
  const { t } = useTranslation();
  const heading = useViewsStore((state) => Math.round(state.main?.heading ?? 0));
  return (
    <button
      type="button"
      className="compass glass-light"
      aria-label={t('compass')}
      onClick={onResetNorth}
    >
      <svg
        width="60"
        height="60"
        viewBox="0 0 60 60"
        aria-hidden="true"
        style={{ transform: `rotate(${-heading}deg)` }}
      >
        <path d="M30 6 L38 32 L30 28 L22 32 Z" className="compass__north" />
        <path d="M30 54 L22 28 L30 32 L38 28 Z" className="compass__south" />
        <text x="30" y="21" textAnchor="middle" className="compass__letter">
          N
        </text>
      </svg>
    </button>
  );
}
