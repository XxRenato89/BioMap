import { Check, Lightbulb, Mountain, Trees, Waves } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import runSprite from '../../assets/quibar-run.webp';
import { ROTATING_TIPS } from '../../data/curiosities.js';
import { LOAD_STAGES, useLoadProgress } from '../utils/loadProgress.js';

/* Sendero de la pantalla de espera, dibujado en un lienzo de 1000 × 180. */
const TRAIL_WIDTH = 1000;
const TRAIL_HEIGHT = 180;
const TRAIL = [
  ['M', 20, 120],
  ['C', 200, 50, 320, 160, 500, 110],
  ['S', 780, 40, 980, 100],
];
/* Cuadros de la carrera de Quibar en la tira de imágenes (ver render-quibar.mjs). */
const RUN_FRAMES = 12;
const STAGE_ICONS = { terrain: Mountain, water: Waves, forest: Trees, ready: Check };
/* En qué parte del sendero queda la marca de cada etapa (%). */
const STAGE_AT = { terrain: 0, water: 50, forest: 68, ready: 100 };

/** El sendero como `path` SVG a la escala `k` (1 = 1000 px de ancho). */
export function trailPath(k) {
  return TRAIL.map(
    ([command, ...numbers]) => command + numbers.map((n) => Math.round(n * k)).join(' '),
  ).join(' ');
}

/**
 * Pantalla de espera mientras se arma la maqueta: Quibar corre por un sendero
 * y su posición es el avance real de la carga (ver loadProgress.js), con un
 * dato curioso que rota abajo. La usan el kiosco y el teléfono.
 */
export default function Loading() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'es';
  const stage = useLoadProgress((state) => state.stage);
  const progress = useLoadProgress((state) => state.progress);
  const percent = Math.round(progress * 100);
  const [tipIndex, setTipIndex] = useState(0);
  /* El sendero se ajusta al ancho de la pantalla (teléfono o kiosco). */
  const scale = useMemo(() => Math.min(1.1, (window.innerWidth - 32) / TRAIL_WIDTH), []);
  const path = trailPath(scale);
  const runner = Math.round(Math.max(96, 190 * scale));

  useEffect(() => {
    const timer = setInterval(() => setTipIndex((i) => (i + 1) % ROTATING_TIPS.length), 3800);
    return () => clearInterval(timer);
  }, []);

  const tip = ROTATING_TIPS[tipIndex];
  const onTrail = (at) => ({
    offsetPath: `path('${path}')`,
    offsetDistance: `${at}%`,
    offsetRotate: '0deg',
  });

  return (
    <motion.div
      className="absolute inset-0 z-[65] flex flex-col items-center justify-center gap-[3vh] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#1c75bc,#14334d_62%,#0d2438)] px-4 text-cream pointer-events-none select-none"
      role="status"
      aria-label={`${t('load.title')} ${percent} %`}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8 } }}
    >
      <div className="text-center">
        <p className="m-0 font-display font-extrabold leading-none tracking-tight text-white text-[clamp(56px,9vw,150px)]">
          BioMap
        </p>
        <p className="m-0 mt-3 text-[clamp(17px,1.6vw,30px)] text-cream/90">{t(`load.${stage}`)}</p>
      </div>

      <div
        className="relative"
        style={{ width: TRAIL_WIDTH * scale, height: TRAIL_HEIGHT * scale, marginTop: runner }}
        aria-hidden="true"
      >
        <svg className="absolute inset-0 h-full w-full overflow-visible" fill="none">
          <path
            d={path}
            stroke="#fff"
            strokeOpacity="0.8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="2 14"
          />
          <path
            d={path}
            pathLength="100"
            stroke="#eaffb8"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${percent} 100`}
            className="transition-[stroke-dasharray] duration-500 ease-out [filter:drop-shadow(0_0_8px_#d9ff8a)]"
          />
        </svg>
        {LOAD_STAGES.map((name) => {
          const Icon = STAGE_ICONS[name];
          const done = LOAD_STAGES.indexOf(name) < LOAD_STAGES.indexOf(stage) || percent >= 100;
          return (
            <span
              key={name}
              className={`absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border-2 ${done ? 'border-ochre bg-ochre text-forest-dark' : 'border-dashed border-white/70 bg-forest text-white/70'}`}
              style={{ ...onTrail(STAGE_AT[name]), offsetAnchor: '50% -40%' }}
            >
              <Icon size={18} strokeWidth={2.6} />
            </span>
          );
        })}
        {/* Quibar: un cuadro de la tira a la vez; avanza por el sendero con el porcentaje. */}
        <span
          className="absolute left-0 top-0 overflow-hidden transition-[offset-distance] duration-500 ease-out"
          style={{ ...onTrail(percent), offsetAnchor: '50% 86%', width: runner, height: runner }}
        >
          <img
            src={runSprite}
            alt=""
            className="block h-full max-w-none motion-safe:animate-[quibar-run_0.7s_steps(12)_infinite]"
            style={{ width: runner * RUN_FRAMES }}
          />
        </span>
      </div>

      <p className="m-0 font-display font-extrabold tabular-nums text-ochre text-[clamp(30px,3vw,54px)]">
        {percent} %
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={tipIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
          className="flex max-w-[900px] items-start gap-3 rounded-3xl border border-white/20 bg-white/10 px-5 py-4 text-left text-[clamp(15px,1.3vw,24px)] leading-snug"
        >
          <Lightbulb
            className="mt-0.5 h-[1.2em] w-[1.2em] flex-none text-ochre"
            aria-hidden="true"
          />
          <p className="m-0">
            <strong className="text-ochre">{t('curiosity.title')}</strong> {tip[lang] ?? tip.es}
          </p>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
