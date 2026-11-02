import { Check, Clock, MapPin, Navigation, Play, Route, Trees, X, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { AVAILABLE_TOURS, useUserStore } from '../../store/userStore.js';

const TOUR_ICONS = { general: Route, nature: Trees, energy: Zap };

/**
 * Recorridos temáticos en una tarjeta que sube desde la barra inferior, sin
 * tapar la maqueta: una columna por ruta con su avance y el botón para partir.
 *
 * @param {{ onClose: () => void, onSelectTour?: (id: string) => void }} props
 */
export default function TourSheet({ onClose, onSelectTour }) {
  const { t } = useTranslation();
  const { activeTourId, setActiveTour, visitedPoints } = useUserStore();

  const handleSelect = (tourId) => {
    setActiveTour(tourId);
    onSelectTour?.(tourId);
    onClose();
  };

  return (
    <motion.section
      className="panel absolute bottom-[124px] left-1/2 z-30 flex w-[min(1040px,calc(100vw-48px))] -translate-x-1/2 flex-col gap-4 rounded-[34px] px-8 pb-6 pt-5"
      role="dialog"
      aria-labelledby="tour-sheet-title"
      data-obstacle
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2
            id="tour-sheet-title"
            className="m-0 font-display text-[length:var(--fs-lead)] font-extrabold text-forest"
          >
            {t('tours.title')}
          </h2>
          <p className="m-0 text-[length:var(--fs-small)] text-muted">{t('tours.subtitle')}</p>
        </div>
        <button
          type="button"
          className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl border-0 bg-transparent text-forest cursor-pointer hover:bg-forest-light/10"
          aria-label={t('tours.close')}
          onClick={onClose}
        >
          <X size={26} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {AVAILABLE_TOURS.map((item) => {
          const isActive = activeTourId === item.id;
          const total = item.stops.length;
          const done = item.stops.filter((s) => visitedPoints.includes(s)).length;
          const Icon = TOUR_ICONS[item.id] ?? Route;
          return (
            <article
              key={item.id}
              className={`flex flex-col gap-3 rounded-[24px] border-2 p-5 ${
                isActive ? 'border-forest-light bg-forest-light/10' : 'border-forest/10 bg-white/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-forest text-cream">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <h3 className="m-0 flex-1 text-[length:var(--fs-body)] font-extrabold leading-tight text-forest">
                  {item.title}
                </h3>
                {isActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest-light px-2.5 py-1 text-xs font-bold text-white">
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                    {t('tours.active')}
                  </span>
                )}
              </div>
              <p className="m-0 flex-1 text-[length:var(--fs-small)] leading-snug text-ink/80">
                {item.description}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--fs-small)] font-semibold text-muted">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={16} aria-hidden="true" />
                  {t('tours.stops', { count: total })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={16} aria-hidden="true" />
                  {item.duration}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Navigation size={16} aria-hidden="true" />
                  {item.distance}
                </span>
              </div>
              <div
                className="h-2 rounded-full bg-forest/10 overflow-hidden"
                role="progressbar"
                aria-valuenow={done}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label={t('tours.visited', { done, total })}
              >
                <div
                  className="h-full rounded-full bg-forest-light"
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-xl font-bold text-[length:var(--fs-body)] cursor-pointer active:translate-y-px ${
                  isActive ? 'border-[3px] border-forest text-forest' : 'bg-forest text-cream'
                }`}
              >
                <Play size={20} aria-hidden="true" />
                {isActive ? t('tours.resume') : t('tours.start')}
              </button>
            </article>
          );
        })}
      </div>
    </motion.section>
  );
}
