import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

const RADIUS = 74;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Aviso previo al reinicio automático por inactividad, con un anillo que se
 * vacía al ritmo de la cuenta regresiva.
 *
 * @param {{ secondsLeft: number, totalSeconds: number, onKeepExploring: () => void,
 *   onResetNow: () => void }} props
 */
export default function InactivityWarning({
  secondsLeft,
  totalSeconds,
  onKeepExploring,
  onResetNow,
}) {
  const { t } = useTranslation();
  const remaining = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="flex flex-col items-center gap-6 w-full max-w-xl p-10 md:p-12 rounded-3xl bg-white text-ink text-center shadow-[0_25px_60px_rgba(0,0,0,0.35)] border border-white/40"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="inactivity-title"
        aria-describedby="inactivity-text"
      >
        <div className="relative w-40 h-40 flex items-center justify-center" aria-hidden="true">
          <svg width="160" height="160" viewBox="0 0 168 168" className="absolute inset-0">
            <circle cx="84" cy="84" r={RADIUS} fill="none" stroke="#e3eae1" strokeWidth="14" />
            <circle
              cx="84"
              cy="84"
              r={RADIUS}
              fill="none"
              stroke="#13241d"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - remaining)}
              transform="rotate(-90 84 84)"
              className="transition-[stroke-dashoffset] duration-1000 linear"
            />
          </svg>
          <div className="flex flex-col items-center">
            <span className="font-display font-extrabold text-5xl text-ink leading-none">
              {secondsLeft}
            </span>
            <span className="text-xs font-bold text-muted uppercase tracking-wider mt-1">
              {t('idle.seconds')}
            </span>
          </div>
        </div>
        <h2
          id="inactivity-title"
          className="font-display text-3xl font-extrabold text-ink tracking-tight m-0"
        >
          {t('idle.title')}
        </h2>
        <p id="inactivity-text" className="text-lg text-muted-strong leading-relaxed m-0 max-w-md">
          {t('idle.text')}
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-2 w-full">
          <button
            type="button"
            className="flex-1 min-w-[200px] py-4 px-6 rounded-2xl bg-forest text-white font-display font-bold text-lg hover:bg-[#2c6b4d] shadow-lg active:scale-95 transition-all cursor-pointer"
            onClick={onKeepExploring}
          >
            {t('idle.keep')}
          </button>
          <button
            type="button"
            className="flex-1 min-w-[200px] py-4 px-6 rounded-2xl bg-transparent border-2 border-forest text-forest font-display font-bold text-lg hover:bg-forest/5 active:scale-95 transition-all cursor-pointer"
            onClick={onResetNow}
          >
            {t('idle.resetNow')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
