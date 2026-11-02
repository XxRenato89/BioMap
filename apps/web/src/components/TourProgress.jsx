import { useTranslation } from 'react-i18next';
import { useUserStore } from '../store/userStore.js';

/**
 * Avance del recorrido guiado: cuántas paradas lleva la visita y cuáles.
 * No se muestra si los datos no definen un recorrido.
 */
export default function TourProgress() {
  const { t } = useTranslation();
  const tour = useUserStore((state) => state.tour);
  const visitedPoints = useUserStore((state) => state.visitedPoints);
  if (tour.length === 0) return null;

  const visited = (stop) => visitedPoints.some((v) => Number(v) === stop);
  const visitedCount = tour.filter(visited).length;

  return (
    <div className="mt-4 pt-3.5 border-t border-cream/15">
      <div className="flex justify-between items-center text-sm font-bold mb-2 text-cream">
        <span>{t('tour.progress')}</span>
        <span className="font-extrabold text-[#8dc63f] bg-[#8dc63f]/15 px-2.5 py-0.5 rounded-full text-sm tabular-nums">
          {visitedCount} / {tour.length}
        </span>
      </div>
      <div
        className="h-2.5 rounded-full bg-cream/15 overflow-hidden"
        role="progressbar"
        aria-valuenow={visitedCount}
        aria-valuemin={0}
        aria-valuemax={tour.length}
        aria-label={t('tour.progress')}
      >
        <div
          className="h-full bg-ochre rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${(visitedCount / tour.length) * 100}%` }}
        />
      </div>
      <div className="flex justify-between mt-2.5 px-1" aria-hidden="true">
        {tour.map((stop) => (
          <span
            key={stop}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${
              visited(stop) ? 'bg-ochre border-cream scale-125' : 'bg-cream/20 border-cream/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
