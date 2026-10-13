import { Hand } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

/**
 * Pantalla del modo atracción: la maqueta recorre el territorio sola, bajo
 * un velo que esconde los controles, y un letrero invita a tocar. Toda la
 * pantalla es un botón: el primer toque detiene el recorrido y deja el visor
 * listo para explorar.
 *
 * @param {{ stopName: string | null, onExplore: () => void }} props
 */
export default function AttractOverlay({ stopName, onExplore }) {
  const { t } = useTranslation();
  return (
    <motion.button
      type="button"
      className="absolute inset-0 z-[70] flex flex-col items-center justify-between w-full border-0 px-12 pt-12 pb-20 text-cream text-center cursor-pointer bg-[linear-gradient(180deg,rgba(11,23,16,0.78),rgba(11,23,16,0.2)_32%,rgba(11,23,16,0.2)_55%,rgba(11,23,16,0.88))]"
      onClick={onExplore}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <span className="flex flex-col items-center gap-1">
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-ochre">
          {t('attract.eyebrow')}
        </span>
        <span className="font-display font-extrabold text-7xl tracking-tight leading-none">
          BioMap
        </span>
        <span className="text-2xl text-cream/85">{t('header.subtitle')}</span>
      </span>

      <span className="flex flex-col items-center gap-5">
        <AnimatePresence mode="wait">
          {stopName && (
            <motion.span
              key={stopName}
              className="flex flex-col items-center gap-1 rounded-2xl bg-forest px-8 py-4 shadow-[0_4px_0_#0f241a,0_18px_40px_rgba(0,0,0,0.4)]"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-ochre">
                {t('attract.nowVisiting')}
              </span>
              <span className="font-display font-extrabold text-3xl">{stopName}</span>
            </motion.span>
          )}
        </AnimatePresence>
        <span
          className="flex items-center justify-center w-28 h-28 rounded-full bg-ochre text-[#1b1206] motion-safe:animate-[invite_2.2s_ease-out_infinite]"
          aria-hidden="true"
        >
          <Hand size={54} strokeWidth={2.2} />
        </span>
        <span className="font-display font-extrabold text-6xl tracking-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.5)]">
          {t('attract.cta')}
        </span>
        <span className="text-2xl text-cream/90 max-w-2xl">{t('attract.sub')}</span>
      </span>
    </motion.button>
  );
}
