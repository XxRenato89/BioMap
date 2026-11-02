import { Check, Clock, Compass, MapPin, Navigation, Route, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { AVAILABLE_TOURS, useUserStore } from '../../store/userStore.js';

export default function TourModal({ onClose, onSelectTour }) {
  const { t } = useTranslation();
  const { activeTourId, setActiveTour, visitedPoints, tour } = useUserStore();

  const handleSelect = (tourId) => {
    setActiveTour(tourId);
    onSelectTour?.(tourId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
    >
      <motion.div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-cream border-2 border-forest/15 shadow-2xl text-forest"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-forest/10 px-6 py-5 bg-forest/[0.03]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-forest text-cream shadow-sm">
              <Route size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h2 id="tour-modal-title" className="m-0 text-xl font-extrabold tracking-tight">
                Recorridos Temáticos
              </h2>
              <p className="m-0 text-xs text-forest/70 font-medium">
                Selecciona una ruta guiada para explorar el Parque Angostura con Quibar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-forest/5 hover:bg-forest/15 text-forest transition-colors"
            aria-label="Cerrar modal"
          >
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        {/* Tour List */}
        <div className="p-6 grid gap-4 max-h-[70vh] overflow-y-auto">
          {AVAILABLE_TOURS.map((item) => {
            const isActive = activeTourId === item.id;
            const completedCount = item.stops.filter((s) => visitedPoints.includes(s)).length;
            const totalStops = item.stops.length;

            return (
              <div
                key={item.id}
                className={`relative rounded-2xl border-2 p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isActive
                    ? 'border-forest bg-forest/5 shadow-md'
                    : 'border-forest/10 hover:border-forest/30 bg-white/60'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-extrabold text-lg tracking-tight">{item.title}</span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-forest px-2.5 py-0.5 text-xs font-bold text-cream">
                        <Check size={12} strokeWidth={3} />
                        Activa
                      </span>
                    )}
                  </div>
                  <p className="m-0 text-sm text-forest/75 mb-3 leading-snug">
                    {item.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-forest/65">
                    <span className="flex items-center gap-1">
                      <MapPin size={14} className="text-forest" />
                      {totalStops} paradas ({completedCount}/{totalStops} visitadas)
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} className="text-forest" />
                      {item.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Navigation size={14} className="text-forest" />
                      {item.distance}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`flex-none px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                    isActive
                      ? 'bg-forest/15 text-forest hover:bg-forest/25'
                      : 'bg-forest text-cream hover:bg-forest-light'
                  }`}
                >
                  {isActive ? 'Continuar Ruta' : 'Iniciar Recorrido'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="px-6 py-4 border-t border-forest/10 bg-forest/[0.02] flex items-center justify-between text-xs text-forest/70">
          <span className="flex items-center gap-1.5">
            <Compass size={15} />
            Quibar recorrerá los senderos hacia cada parada seleccionada.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold underline hover:text-forest"
          >
            Volver a la maqueta
          </button>
        </div>
      </motion.div>
    </div>
  );
}
