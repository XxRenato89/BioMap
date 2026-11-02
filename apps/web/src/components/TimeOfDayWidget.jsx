import { Clock, Moon, Sun, Sunset } from 'lucide-react';
import { useViewerStore } from '../store/viewerStore.js';

const OPTIONS = [
  { id: 'auto', label: 'Hora actual', icon: Clock },
  { id: 'day', label: 'Día', icon: Sun },
  { id: 'sunset', label: 'Atardecer', icon: Sunset },
  { id: 'night', label: 'Noche', icon: Moon },
];

export default function TimeOfDayWidget({ className = '' }) {
  const timeOfDay = useViewerStore((state) => state.timeOfDay);
  const setTimeOfDay = useViewerStore((state) => state.setTimeOfDay);

  return (
    <div
      className={`flex items-center gap-1 rounded-2xl bg-cream/90 backdrop-blur-md p-1 border-2 border-forest/15 shadow-lg ${className}`}
      role="group"
      aria-label="Momento del día"
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = (timeOfDay ?? 'auto') === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTimeOfDay(id)}
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
              active
                ? 'bg-forest text-cream shadow-sm scale-105'
                : 'text-forest/70 hover:text-forest hover:bg-forest/10'
            }`}
            title={label}
            aria-label={label}
            aria-pressed={active}
          >
            <Icon size={18} strokeWidth={2.5} />
          </button>
        );
      })}
    </div>
  );
}
