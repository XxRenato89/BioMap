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
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="warning-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="inactivity-title"
        aria-describedby="inactivity-text"
      >
        <div className="countdown" aria-hidden="true">
          <svg width="168" height="168" viewBox="0 0 168 168">
            <circle cx="84" cy="84" r={RADIUS} className="countdown__track" />
            <circle
              cx="84"
              cy="84"
              r={RADIUS}
              className="countdown__bar"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - remaining)}
              transform="rotate(-90 84 84)"
            />
          </svg>
          <span className="countdown__number">{secondsLeft}</span>
          <span className="countdown__unit">{t('idle.seconds')}</span>
        </div>
        <h2 id="inactivity-title">{t('idle.title')}</h2>
        <p id="inactivity-text">{t('idle.text')}</p>
        <div className="warning-card__actions">
          <button type="button" className="primary-button" onClick={onKeepExploring}>
            {t('idle.keep')}
          </button>
          <button type="button" className="secondary-button" onClick={onResetNow}>
            {t('idle.resetNow')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
