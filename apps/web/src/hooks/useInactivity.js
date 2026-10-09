import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Control de inactividad del kiosco.
 * - "clean": nadie tocó la pantalla desde el último reinicio; no corre ningún contador.
 * - "active": hubo interacción; si pasan `timeoutMs` sin otra, se muestra el aviso.
 * - "warning": cuenta regresiva de `warningMs`; al terminar se llama a `onReset`.
 * La hora de la última interacción se guarda en una referencia para no
 * provocar un render por cada evento (rueda del mouse, toques repetidos).
 *
 * @param {{ timeoutMs: number, warningMs: number, onReset: () => void }} options
 */
export function useInactivity({ timeoutMs, warningMs, onReset }) {
  const totalSeconds = Math.ceil(warningMs / 1000);
  const [phase, setPhase] = useState('clean');
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const lastActivity = useRef(0);
  const onResetRef = useRef(onReset);

  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  /*
   * Fase activa: revisa si pasó el tiempo desde la última interacción;
   * si no, vuelve a programarse por el tiempo que falta.
   */
  useEffect(() => {
    if (phase !== 'active') return undefined;
    let timer;
    const check = () => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= timeoutMs) setPhase('warning');
      else timer = setTimeout(check, timeoutMs - idle);
    };
    timer = setTimeout(check, timeoutMs);
    return () => clearTimeout(timer);
  }, [phase, timeoutMs]);

  /*
   * Fase de aviso: cuenta regresiva de un segundo en un segundo.
   */
  useEffect(() => {
    if (phase !== 'warning') return undefined;
    let left = totalSeconds;
    setSecondsLeft(left);
    const interval = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(interval);
        setPhase('clean');
        onResetRef.current();
      } else {
        setSecondsLeft(left);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, totalSeconds]);

  const markActive = useCallback(() => {
    lastActivity.current = Date.now();
    setPhase((current) => (current === 'active' ? current : 'active'));
  }, []);

  const markClean = useCallback(() => setPhase('clean'), []);

  return { phase, secondsLeft, markActive, markClean };
}
