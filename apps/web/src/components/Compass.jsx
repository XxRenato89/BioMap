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
  /* Solo aparece cuando el mapa está girado: con el norte arriba no hace falta. */
  const turned = ((heading % 360) + 360) % 360;
  if (turned < 2 || turned > 358) return null;
  return (
    <button
      type="button"
      className="glass-light flex items-center justify-center w-16 h-16 rounded-full border border-white/70 shadow-soft cursor-pointer transition-transform duration-150 active:scale-95 hover:bg-white"
      aria-label={t('compass')}
      onClick={onResetNorth}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 60 60"
        aria-hidden="true"
        className="transition-transform duration-200 ease-out"
        style={{ transform: `rotate(${-heading}deg)` }}
      >
        <path d="M30 6 L38 32 L30 28 L22 32 Z" fill="#8dc63f" />
        <path d="M30 54 L22 28 L30 32 L38 28 Z" fill="#b6c4d0" />
        <text
          x="30"
          y="21"
          textAnchor="middle"
          fill="#14334d"
          fontWeight="800"
          fontSize="11"
          fontFamily="sans-serif"
        >
          N
        </text>
      </svg>
    </button>
  );
}
