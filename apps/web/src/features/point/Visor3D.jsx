import { Orbit, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Visor 360° de un lugar, en una ventana sobre la maqueta. Por ahora es un
 * marcador de posición: el video 360° del lugar (mirar alrededor como con una
 * cámara) llegará cuando estén las grabaciones.
 *
 * @param {{ name: string, onExit: () => void }} props
 */
export default function Visor3D({ name, onExit }) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onExit();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center bg-ink/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onExit}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="visor-title"
        className="panel relative flex w-[min(1280px,calc(100vw-96px))] flex-col gap-4 rounded-[34px] p-6"
        initial={{ y: 40, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-2">
          <div>
            <p className="m-0 text-[length:var(--fs-small)] font-bold text-muted">
              {t('visor.title')}
            </p>
            <h2
              id="visor-title"
              className="m-0 font-display text-[length:var(--fs-lead)] font-extrabold leading-tight text-forest"
            >
              {name}
            </h2>
          </div>
          <button
            type="button"
            className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl border-0 bg-transparent text-forest cursor-pointer hover:bg-forest-light/10"
            aria-label={t('visor.back')}
            onClick={onExit}
          >
            <X size={26} aria-hidden="true" />
          </button>
        </div>
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_50%_40%,white,transparent_60%)]" />
          <div className="relative flex flex-col items-center gap-4 text-center">
            <motion.span
              className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/40"
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            >
              <Orbit size={48} aria-hidden="true" />
            </motion.span>
            <p className="m-0 font-display text-[length:var(--fs-lead)] font-extrabold">
              {t('visor.soon')}
            </p>
            <p className="m-0 max-w-[36ch] text-[length:var(--fs-body)] text-white/80">
              {t('visor.soonText')}
            </p>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
