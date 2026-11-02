import { ArrowLeft, Footprints, Hand, Orbit, Rotate3d } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import Compass from '../../components/Compass.jsx';

/**
 * Controles del visor 3D de un lugar, sobre la maqueta: volver a la ficha,
 * vista a pie (mirar en 360° desde el suelo) o en dron, y giro automático.
 *
 * @param {{ name: string, kind: 'ground' | 'drone', spinning: boolean,
 *   onKind: (kind: 'ground' | 'drone') => void, onSpin: () => void,
 *   onExit: () => void, onResetNorth: () => void }} props
 */
export default function Visor3D({ name, kind, spinning, onKind, onSpin, onExit, onResetNorth }) {
  const { t } = useTranslation();
  const modes = [
    ['ground', Footprints, t('visor.ground')],
    ['drone', Orbit, t('visor.drone')],
  ];

  return (
    <div className="absolute inset-0 z-40 pointer-events-none [&>*]:pointer-events-auto">
      <motion.div
        className="absolute top-7 left-10 flex items-center gap-4"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <button
          type="button"
          className="flex items-center gap-2 min-h-16 px-6 rounded-2xl bg-cream text-ink font-bold text-[length:var(--fs-body)] shadow-[0_3px_0_var(--color-cream-shade)] cursor-pointer active:translate-y-px"
          onClick={onExit}
        >
          <ArrowLeft size={24} strokeWidth={2.6} aria-hidden="true" />
          {t('visor.back')}
        </button>
        <div className="glass-dark rounded-2xl px-5 py-2.5 text-white">
          <p className="m-0 text-[length:var(--fs-small)] font-bold text-mint">
            {t('visor.title')}
          </p>
          <h2 className="m-0 font-display font-extrabold text-[length:var(--fs-lead)] leading-tight">
            {name}
          </h2>
        </div>
      </motion.div>

      <div className="absolute top-7 right-10">
        <Compass onResetNorth={onResetNorth} />
      </div>

      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <p className="m-0 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-dark text-white text-[length:var(--fs-small)] font-semibold">
          <Hand size={18} aria-hidden="true" />
          {kind === 'ground' ? t('visor.hint') : t('visor.droneHint')}
        </p>
        <div className="flex items-center gap-3 p-2 rounded-2xl bg-cream shadow-[0_3px_0_var(--color-cream-shade),0_18px_40px_rgba(0,0,0,0.35)]">
          <div
            className="flex gap-1 p-1 rounded-xl bg-cream-shade"
            role="radiogroup"
            aria-label={t('visor.mode')}
          >
            {modes.map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                className={`inline-flex items-center gap-2 min-h-14 px-5 rounded-lg font-bold text-[length:var(--fs-body)] cursor-pointer transition-colors ${
                  kind === value ? 'bg-forest text-cream' : 'text-ink hover:bg-cream/60'
                }`}
                onClick={() => onKind(value)}
              >
                <Icon size={22} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={spinning}
            className={`inline-flex items-center gap-2 min-h-14 px-5 rounded-xl border-[3px] font-bold text-[length:var(--fs-body)] cursor-pointer transition-colors ${
              spinning ? 'border-forest bg-forest text-cream' : 'border-forest text-forest'
            }`}
            onClick={onSpin}
          >
            <Rotate3d size={22} aria-hidden="true" />
            {t('visor.spin')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
