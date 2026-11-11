import { ArrowRight, Check, Image, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import quibarRun from '../assets/quibar-run.webp';
import { stampsUrl } from '../features/passport/postcard.js';
import { useQrSvg } from '../hooks/useQr.js';
import { getPoiIcon } from '../map/poiIcon.jsx';
import { useUserStore } from '../store/userStore.js';

/* Cada sello con su tinta e inclinación, como timbrados a mano. */
const INKS = [
  ['text-ochre-deep border-ochre-deep bg-ochre/15', '-rotate-12'],
  ['text-forest-light border-forest-light bg-forest-light/10', 'rotate-6'],
  ['text-[#9a6200] border-[#9a6200] bg-warning/15', '-rotate-3'],
  ['text-forest-light border-forest-light bg-forest-light/10', '-rotate-6'],
];

/**
 * Paradas del recorrido activo con su lugar y si ya tienen sello.
 *
 * @returns {Array<{ id: number, feature: object | undefined, earned: boolean }>}
 */
export function useStamps() {
  const tour = useUserStore((state) => state.tour);
  const features = useUserStore((state) => state.features);
  const visited = useUserStore((state) => state.visitedPoints);
  return tour.map((id) => ({
    id,
    feature: features.find((f) => Number(f.properties.id) === id),
    earned: visited.some((v) => Number(v) === id),
  }));
}

/**
 * Sello de una parada: timbrado si ya se visitó, punteado si falta.
 *
 * @param {{ feature?: object, earned: boolean, index?: number, className?: string }} props
 */
export function Stamp({ feature, earned, index = 0, className = '' }) {
  const [ink, tilt] = INKS[index % INKS.length];
  const name = feature?.properties.name ?? '';
  /* El sello ganado cae timbrando, uno tras otro, y rebota al tocarlo (la inclinación va aparte, en `rotate`). */
  return (
    <motion.span
      initial={earned ? { scale: 2.6, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.25 + index * 0.18 }}
      whileTap={{ scale: 0.86 }}
      className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-full p-[8%] text-center font-extrabold uppercase leading-tight tracking-wide ${
        earned
          ? `border-4 border-double ${ink} ${tilt}`
          : 'border-[3px] border-dashed border-mint-muted text-mint-muted'
      } ${className}`}
    >
      <span className="[&>svg]:h-[2.4em] [&>svg]:w-[2.4em]">
        {getPoiIcon(null, name, 24, feature?.properties.icon)}
      </span>
      <span className="line-clamp-2 text-[0.8em]">{name}</span>
    </motion.span>
  );
}

/**
 * Sello pequeño de "visitado" para la ficha de un lugar.
 *
 * @param {{ className?: string }} props
 */
export function StampBadge({ className = '' }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex -rotate-6 items-center gap-1 rounded-full border-[3px] border-double border-ochre-deep bg-ochre/15 px-3 py-1 text-[0.85em] font-extrabold uppercase tracking-wide text-ochre-deep ${className}`}
    >
      <Check size={16} strokeWidth={3.2} aria-hidden="true" />
      {t('sheet.visited')}
    </span>
  );
}

/**
 * Sellos en miniatura para la barra: uno por parada, lleno si ya se visitó.
 *
 * @param {{ size?: number }} props
 */
export function StampRow({ size = 38 }) {
  const stamps = useStamps();
  return (
    <span className="flex flex-none items-center gap-1.5" aria-hidden="true">
      {stamps.map(({ id, feature, earned }) => (
        <span
          key={id}
          className={`flex items-center justify-center rounded-full border-2 ${
            earned
              ? '-rotate-6 border-ochre bg-ochre text-forest-dark'
              : 'border-dashed border-current opacity-45'
          }`}
          style={{ width: size, height: size }}
        >
          {getPoiIcon(
            null,
            feature?.properties.name,
            Math.round(size * 0.48),
            feature?.properties.icon,
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * Pasaporte del recorrido: los sellos de cada parada. Se abre solo al
 * completar el recorrido (celebración) y a pedido para ver qué falta. En el
 * kiosco suma el código QR para seguir en el teléfono con los sellos ya
 * ganados; en el teléfono, el botón de la postal de recuerdo.
 *
 * @param {{ url?: string, onClose: () => void, onGo?: (id: number) => void,
 *   onPostcard?: () => void }} props
 */
export default function PassportCard({ url, onClose, onGo, onPostcard }) {
  const { t } = useTranslation();
  const stamps = useStamps();
  const done = stamps.filter((stamp) => stamp.earned).length;
  const complete = stamps.length > 0 && done === stamps.length;
  const pending = stamps.find((stamp) => !stamp.earned);
  const qr = useQrSvg(
    stampsUrl(
      url || window.location.origin,
      stamps.filter((stamp) => stamp.earned).map((stamp) => stamp.id),
    ),
  );

  return (
    <motion.div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-forest-dark/60 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        className="relative flex max-h-full w-[min(1100px,100%)] flex-col gap-6 overflow-y-auto rounded-[32px] bg-cream p-6 text-forest shadow-[0_24px_60px_rgba(0,0,0,0.45)] md:flex-row md:p-12"
        role="dialog"
        aria-labelledby="passport-title"
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-4 top-4 flex h-14 w-14 items-center justify-center rounded-full border-0 bg-forest/10 text-forest cursor-pointer"
          aria-label={t('settings.close')}
          onClick={onClose}
        >
          <X size={26} strokeWidth={2.6} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[length:var(--fs-eyebrow)] font-bold uppercase tracking-[0.1em] text-forest-light">
            {t('passport.progress', { done, total: stamps.length })}
          </p>
          <h2
            id="passport-title"
            className="m-0 mt-1 pr-14 font-display text-[clamp(30px,4vw,60px)] font-extrabold leading-none"
          >
            {complete ? t('passport.complete') : t('passport.title')}
          </h2>
          <p className="m-0 mt-3 text-[length:var(--fs-lead)] leading-snug text-muted">
            {complete ? t('passport.completeText') : t('passport.text')}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-[clamp(10px,1vw,15px)] sm:grid-cols-4">
            {stamps.map(({ id, feature, earned }, index) => (
              <Stamp key={id} feature={feature} earned={earned} index={index} />
            ))}
          </div>
          {pending?.feature && onGo && (
            <button
              type="button"
              className="mt-6 inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-0 bg-forest-light px-5 text-[length:var(--fs-body)] font-bold text-white cursor-pointer md:w-auto"
              onClick={() => onGo(pending.id)}
            >
              <span className="truncate">
                {t('passport.go', { name: pending.feature.properties.name })}
              </span>
              <ArrowRight size={22} aria-hidden="true" className="flex-none" />
            </button>
          )}
          {onPostcard && done > 0 && (
            <button
              type="button"
              className="mt-3 inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-0 bg-ochre px-5 text-[length:var(--fs-body)] font-bold text-forest-dark cursor-pointer md:w-auto"
              onClick={onPostcard}
            >
              <Image size={22} aria-hidden="true" className="flex-none" />
              {t('passport.postcard')}
            </button>
          )}
        </div>
        {url !== undefined && (
          <aside className="flex flex-none flex-col items-center gap-3 rounded-3xl border border-cream-shade bg-white p-5 text-center md:w-[280px]">
            <span
              className="block h-[200px] w-[200px] [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label={t('mobile.scanMe')}
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <p className="m-0 text-[length:var(--fs-small)] leading-snug">
              <strong className="block font-display text-[1.3em]">{t('passport.take')}</strong>
              {t('passport.takeText')}
            </p>
          </aside>
        )}
        {/* Quibar celebra corriendo en su lugar (un cuadro de la tira a la vez). */}
        {complete && (
          <span
            className="pointer-events-none absolute -left-6 -bottom-8 hidden h-[190px] w-[190px] overflow-hidden md:block"
            aria-hidden="true"
          >
            <img
              src={quibarRun}
              alt=""
              className="block h-full max-w-none motion-safe:animate-[quibar-run_0.7s_steps(12)_infinite]"
              style={{ width: 190 * 12 }}
            />
          </span>
        )}
      </motion.section>
    </motion.div>
  );
}
