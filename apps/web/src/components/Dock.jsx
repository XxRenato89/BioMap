import { Clock, Home, Minus, MoreHorizontal, Plus, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../store/userStore.js';
import { StampRow } from './Passport.jsx';

/* Botón de la barra: icono y texto, de 68 px de alto para dedos grandes. */
const BUTTON =
  'inline-flex items-center gap-2.5 h-[68px] px-5 rounded-[22px] border-0 bg-transparent text-forest font-bold text-[length:var(--fs-button)] leading-none cursor-pointer hover:bg-forest-light/10 active:scale-95 aria-pressed:bg-forest-light aria-pressed:text-white';

/**
 * Barra inferior continua con todos los controles del visor, al alcance de
 * niños y de quien usa silla de ruedas: inicio y BioMap Mobile a la izquierda,
 * época y zoom al centro, avance del recorrido y ajustes a la derecha.
 *
 * @param {{ panel: string | null, epochLabel: string, onHome: () => void,
 *   onPanel: (name: string) => void, onZoomIn: () => void, onZoomOut: () => void }} props
 */
export default function Dock({ panel, epochLabel, onHome, onPanel, onZoomIn, onZoomOut }) {
  const { t } = useTranslation();
  const tour = useUserStore((state) => state.tour);
  const visitedPoints = useUserStore((state) => state.visitedPoints);
  const done = tour.filter((stop) => visitedPoints.some((v) => Number(v) === stop)).length;

  return (
    <nav
      className="panel absolute inset-x-0 bottom-0 z-20 flex h-[104px] items-center justify-between gap-4 rounded-none border-x-0 border-b-0 px-9"
      aria-label={t('dock.label')}
      data-obstacle
    >
      <div className="flex items-center gap-1.5">
        <button type="button" className={BUTTON} onClick={onHome}>
          <Home size={28} aria-hidden="true" />
          {t('dock.home')}
        </button>
        <button
          type="button"
          className={`${BUTTON} text-left`}
          aria-pressed={panel === 'mobile'}
          onClick={() => onPanel('mobile')}
        >
          <Smartphone size={34} aria-hidden="true" />
          <span>
            <span className="block text-[length:var(--fs-small)] font-extrabold leading-tight">
              {t('mobile.name')}
            </span>
            <span className="block text-[length:calc(var(--fs-small)*0.85)] font-normal opacity-80 leading-tight">
              {t('mobile.tagline')}
            </span>
          </span>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={BUTTON}
          aria-pressed={panel === 'epoch'}
          onClick={() => onPanel('epoch')}
        >
          <Clock size={28} aria-hidden="true" />
          <span>{t('dock.epoch')}</span>
          <strong>{epochLabel}</strong>
        </button>
        <span className="mx-1.5 h-9 w-px bg-forest/20" aria-hidden="true" />
        <div className="relative flex items-center p-1 rounded-2xl border-2 border-forest/35 bg-cream/90 shadow-sm gap-1">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-forest text-cream text-[10px] font-black uppercase tracking-widest shadow-sm pointer-events-none select-none">
            ZOOM
          </span>
          <button
            type="button"
            className={`${BUTTON} !px-0 w-[76px] justify-center hover:bg-forest/10 rounded-xl transition-all`}
            aria-label={t('controls.zoomOut')}
            onClick={onZoomOut}
          >
            <Minus size={28} strokeWidth={2.8} aria-hidden="true" />
          </button>
          <span className="h-6 w-px bg-forest/20" aria-hidden="true" />
          <button
            type="button"
            className={`${BUTTON} !px-0 w-[76px] justify-center hover:bg-forest/10 rounded-xl transition-all`}
            aria-label={t('controls.zoomIn')}
            onClick={onZoomIn}
          >
            <Plus size={28} strokeWidth={2.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {tour.length > 0 && (
          <button
            type="button"
            className={`${BUTTON} text-left`}
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={tour.length}
            aria-label={t('tour.progress')}
            aria-pressed={panel === 'tour'}
            onClick={() => onPanel('tour')}
          >
            <span>
              <span className="block text-[length:var(--fs-small)] font-extrabold leading-tight">
                {t('passport.name')}
              </span>
              <span className="block text-[length:calc(var(--fs-small)*0.85)] font-normal opacity-80 leading-tight tabular-nums">
                {t('passport.count', { done, total: tour.length })}
              </span>
            </span>
            {/* Un sello por parada: se llena al visitarla. */}
            <StampRow />
          </button>
        )}
        <button
          type="button"
          className={BUTTON}
          aria-pressed={panel === 'settings'}
          onClick={() => onPanel('settings')}
        >
          <MoreHorizontal size={28} aria-hidden="true" />
          {t('dock.settings')}
        </button>
      </div>
    </nav>
  );
}
