import { Hand } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import quibarRun from '../../assets/quibar-run.webp';
import { useQrSvg } from '../../hooks/useQr.js';

/**
 * Pantalla del modo atracción: la maqueta recorre el territorio sola, bajo
 * un velo que esconde los controles, y un letrero invita a tocar. Toda la
 * pantalla es un botón: el primer toque detiene el recorrido y deja el visor
 * listo para explorar.
 *
 * Abajo, Quibar cruza la pantalla corriendo y un código QR grande lleva el
 * mapa al teléfono (se puede escanear sin tocar la pantalla).
 *
 * @param {{ stopName: string | null, url?: string, onExplore: () => void }} props
 */
export default function AttractOverlay({ stopName, url, onExplore }) {
  const { t } = useTranslation();
  const qr = useQrSvg(url || window.location.origin);
  /* Sin dirección pública el kiosco se abre en localhost: ese código no sirve en un teléfono. */
  const reachable = Boolean(url) || !/^(localhost|127\.|\[::1\])/.test(window.location.hostname);
  return (
    <motion.button
      type="button"
      className="absolute inset-0 z-[70] flex flex-col items-center justify-between w-full border-0 px-12 pt-12 pb-20 text-cream text-center cursor-pointer bg-[linear-gradient(180deg,rgba(28,117,188,0.82),rgba(28,117,188,0.22)_32%,rgba(20,51,77,0.22)_55%,rgba(20,51,77,0.9))]"
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
              className="flex flex-col items-center gap-1 rounded-2xl bg-forest px-8 py-4 shadow-[0_4px_0_#0d2438,0_18px_40px_rgba(0,0,0,0.4)]"
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

      {reachable && (
        <span className="absolute bottom-10 left-10 flex items-center gap-5 rounded-[28px] bg-cream p-4 pr-7 text-left text-forest shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
          <span
            className="block h-[150px] w-[150px] rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            role="img"
            aria-label={t('mobile.scanMe')}
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <span className="text-xl leading-snug">
            <strong className="block font-display text-2xl">{t('attract.qrTitle')}</strong>
            {t('attract.qrText')}
          </span>
        </span>
      )}
      {/* Quibar cruza corriendo de lado a lado: llama la atención desde lejos. */}
      <span
        className="pointer-events-none absolute bottom-6 left-0 h-[210px] w-[210px] overflow-hidden motion-safe:animate-[quibar-cross_14s_linear_infinite] motion-reduce:left-[60%]"
        aria-hidden="true"
      >
        <img
          src={quibarRun}
          alt=""
          className="block h-full max-w-none motion-safe:animate-[quibar-run_0.7s_steps(12)_infinite]"
          style={{ width: 210 * 12 }}
        />
      </span>
    </motion.button>
  );
}
