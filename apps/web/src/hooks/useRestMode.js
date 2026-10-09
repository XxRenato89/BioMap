import { useEffect, useRef } from 'react';

const EVENTS = ['pointerdown', 'wheel', 'keydown'];

/**
 * Modo de reposo: `delayMs` después del último toque, rueda o tecla se
 * llama una vez a `onRest` (la cámara vuelve sola a la vista de inicio).
 * Solo cuenta desde una interacción: si nadie tocó la pantalla, no hace nada.
 *
 * @param {{ delayMs: number, onRest: () => void, enabled?: boolean }} options
 */
export function useRestMode({ delayMs, onRest, enabled = true }) {
  const onRestRef = useRef(onRest);
  useEffect(() => {
    onRestRef.current = onRest;
  }, [onRest]);

  useEffect(() => {
    if (!enabled || delayMs <= 0) return undefined;
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onRestRef.current(), delayMs);
    };
    EVENTS.forEach((type) => window.addEventListener(type, arm, { passive: true }));
    return () => {
      clearTimeout(timer);
      EVENTS.forEach((type) => window.removeEventListener(type, arm));
    };
  }, [delayMs, enabled]);
}
