import { Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Dispara una ráfaga de confeti con física de partículas.
 * @param {{ x?: number, y?: number, count?: number, grandFinale?: boolean }} [options]
 */
export function triggerConfetti(options = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('biomap:confetti', { detail: options }));
  }
}

/**
 * Canvas de alto rendimiento a 60fps para celebración con partículas físicas de confeti.
 */
export default function ConfettiCanvas() {
  const canvasRef = useRef(null);
  const [congrats, setCongrats] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let parts = [];
    let raf = null;

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);

    const step = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dpr = window.devicePixelRatio || 1;

      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28 * dpr;
        p.vx *= 0.99;
        p.rot += p.vr;
        p.life -= 0.014;

        ctx.save();
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.w / 3, p.w, p.w * 0.6);
        ctx.restore();
      });

      parts = parts.filter((p) => p.life > 0);

      if (parts.length > 0) {
        raf = requestAnimationFrame(step);
      } else {
        raf = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    const handleConfetti = (e) => {
      const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (isReduced) return;

      const {
        x = window.innerWidth * 0.5,
        y = window.innerHeight * 0.45,
        count = 48,
        grandFinale = false,
      } = e.detail || {};

      const dpr = window.devicePixelRatio || 1;
      const ox = x * dpr;
      const oy = y * dpr;
      const cols = ['#ff9a3c', '#ffd27a', '#6cc58a', '#7cc5d6', '#ffffff', '#e76f51', '#2a9d8f'];
      const total = grandFinale ? count * 2.8 : count;

      for (let i = 0; i < total; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * (grandFinale ? 2.8 : 2.2);
        const v = (5 + Math.random() * (grandFinale ? 11 : 7)) * dpr;
        parts.push({
          x: ox,
          y: oy,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          w: (6 + Math.random() * 6) * dpr,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.4,
          c: cols[i % cols.length],
          life: 1 + Math.random() * (grandFinale ? 0.4 : 0.2),
        });
      }

      if (grandFinale) {
        setCongrats(true);
        setTimeout(() => setCongrats(false), 5500);
      }

      if (!raf) {
        raf = requestAnimationFrame(step);
      }
    };

    window.addEventListener('biomap:confetti', handleConfetti);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('biomap:confetti', handleConfetti);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-[100]"
        aria-hidden="true"
      />
      {congrats && (
        <div
          className="fixed top-8 left-1/2 -translate-x-1/2 z-[105] pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-4 px-6 py-4 rounded-3xl glass-dark border-2 border-white/30 shadow-[0_16px_40px_rgba(0,0,0,0.45)] max-w-lg pointer-events-auto">
            <Trophy
              size={40}
              strokeWidth={2.2}
              className="flex-none text-ochre"
              aria-hidden="true"
            />
            <div>
              <h3 className="m-0 text-lg font-extrabold text-white">
                ¡Felicitaciones! Recorrido 100% completado
              </h3>
              <p className="mt-1 text-sm text-mint leading-snug">
                Has visitado todos los hitos de la cuenca. Abre el Bio-Book para llevarte tu guía
                digital.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
