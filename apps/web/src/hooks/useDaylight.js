import { useEffect, useMemo, useState } from 'react';
import { daylightAt, kioskHour } from '../diorama/utils/daylight.js';
import { useViewerStore } from '../store/viewerStore.js';

/* La luz se actualiza cada 5 minutos: el cambio es lento y casi imperceptible. */
const REFRESH_MS = 5 * 60_000;

/**
 * Luz de la maqueta para la hora actual o modo manual seleccionado (Día, Atardecer, Noche).
 */
export function useDaylight() {
  const timeOfDay = useViewerStore((state) => state.timeOfDay);
  const [hour, setHour] = useState(() => kioskHour());

  useEffect(() => {
    const timer = setInterval(() => setHour(kioskHour()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const effectiveHour = useMemo(() => {
    if (timeOfDay === 'day') return 12;
    if (timeOfDay === 'sunset') return 19.2;
    if (timeOfDay === 'night') return 21;
    return hour;
  }, [timeOfDay, hour]);

  return useMemo(() => daylightAt(effectiveHour), [effectiveHour]);
}
