import { useEffect, useMemo, useState } from 'react';
import { daylightAt, kioskHour } from '../diorama/utils/daylight.js';

/* La luz se actualiza cada 5 minutos: el cambio es lento y casi imperceptible. */
const REFRESH_MS = 5 * 60_000;

/**
 * Luz de la maqueta para la hora actual del kiosco (ver daylight.js).
 */
export function useDaylight() {
  const [hour, setHour] = useState(() => kioskHour());
  useEffect(() => {
    const timer = setInterval(() => setHour(kioskHour()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  return useMemo(() => daylightAt(hour), [hour]);
}
