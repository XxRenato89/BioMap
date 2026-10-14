import { History, Waves } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

/**
 * «Bajo el embalse»: vacía el embalse en la maqueta y deja ver el valle del
 * Biobío como era antes de la inundación de 2014 (el relieve SRTM es del año
 * 2000). Una tarjeta explica lo que se ve.
 *
 * @param {{ drained: boolean, onToggle: () => void }} props
 */
export default function ReservoirToggle({ drained, onToggle }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-end gap-3">
      <AnimatePresence>
        {drained && (
          <motion.section
            className="glass-dark w-[400px] rounded-2xl p-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            aria-live="polite"
          >
            <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-ochre">
              {t('reservoir.eyebrow')}
            </p>
            <h2 className="m-0 mt-1 font-display font-extrabold text-2xl leading-tight">
              {t('reservoir.title')}
            </h2>
            <p className="m-0 mt-3 text-base leading-relaxed text-cream/90">
              {t('reservoir.text')}
            </p>
            <dl className="m-0 mt-4 grid grid-cols-2 gap-3">
              {[
                ['reservoir.depth', '≈ 45 m'],
                ['reservoir.area', '641 ha'],
              ].map(([key, value]) => (
                <div key={key} className="rounded-xl bg-cream/10 px-3 py-2">
                  <dt className="text-xs text-cream/75">{t(key)}</dt>
                  <dd className="m-0 font-display font-extrabold text-xl tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="m-0 mt-3 text-xs text-cream/60">{t('reservoir.source')}</p>
          </motion.section>
        )}
      </AnimatePresence>
      <button
        type="button"
        className="glass-dark inline-flex items-center gap-3 min-h-16 rounded-2xl px-5 font-bold text-lg cursor-pointer active:translate-y-px"
        onClick={onToggle}
        aria-pressed={drained}
      >
        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-ochre text-[#1b1206]">
          {drained ? (
            <Waves size={22} aria-hidden="true" />
          ) : (
            <History size={22} aria-hidden="true" />
          )}
        </span>
        {drained ? t('reservoir.fill') : t('reservoir.drain')}
      </button>
    </div>
  );
}
