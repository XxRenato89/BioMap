import { useEffect } from 'react';

/**
 * Activa el modo atracción cuando el visor lleva `delayMs` sin uso en estado
 * limpio (nadie lo tocó desde el último reinicio). Cualquier interacción pasa
 * el visor a "activo" y cancela la espera.
 *
 * @param {{ idle: boolean, delayMs: number, onStart: () => void }} options
 */
export function useAttractMode({ idle, delayMs, onStart }) {
  useEffect(() => {
    if (!idle || delayMs <= 0) return undefined;
    const timer = setTimeout(onStart, delayMs);
    return () => clearTimeout(timer);
  }, [idle, delayMs, onStart]);
}
