import { Download, Share2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { postcardBlob } from '../features/passport/postcard.js';
import { triggerConfetti } from './ConfettiCanvas.jsx';
import { useStamps } from './Passport.jsx';

const FILE_NAME = 'postal-biomap-angostura.png';

/**
 * Postal de recuerdo del teléfono: una imagen con Quibar y los sellos ganados,
 * para guardar o compartir. Cae girando con confeti y se puede arrastrar: al
 * soltarla vuelve a su lugar.
 *
 * @param {{ onClose: () => void }} props
 */
export default function Postcard({ onClose }) {
  const { t, i18n } = useTranslation();
  const stamps = useStamps();
  const done = stamps.filter((stamp) => stamp.earned).length;
  const [file, setFile] = useState(null);
  const [failed, setFailed] = useState(false);
  /* Los sellos como texto: la postal se rehace solo si cambian. */
  const key = JSON.stringify(
    stamps.map(({ feature, earned }) => [feature?.properties.name ?? '', earned]),
  );

  useEffect(() => {
    let url = '';
    let cancelled = false;
    postcardBlob({
      stamps: JSON.parse(key).map(([name, earned]) => ({ name, earned })),
      title: t('passport.title'),
      count: t('passport.count', { done, total: stamps.length }),
      place: t('attract.eyebrow'),
      date: new Date().toLocaleDateString(i18n.language, { dateStyle: 'long' }),
    })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setFile({ url, blob });
        triggerConfetti();
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    /* `done` y el total salen de `key`. */
  }, [key, i18n.language]);

  /* Compartir archivos solo existe en algunos teléfonos y por https; descargar sirve siempre. */
  const shareable =
    file && typeof navigator.canShare === 'function'
      ? new File([file.blob], FILE_NAME, { type: 'image/png' })
      : null;
  const canShare = shareable !== null && navigator.canShare({ files: [shareable] });
  const button =
    'flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-0 px-4 text-lg font-bold no-underline cursor-pointer';

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-forest-dark/85 p-4"
      role="dialog"
      aria-labelledby="postcard-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] flex h-14 w-14 items-center justify-center rounded-full border-0 bg-cream text-forest cursor-pointer"
        aria-label={t('settings.close')}
        onClick={onClose}
      >
        <X size={26} strokeWidth={2.6} aria-hidden="true" />
      </button>
      <h2
        id="postcard-title"
        className="m-0 px-14 text-center font-display text-3xl font-extrabold text-white"
      >
        {t('passport.postcardTitle')}
      </h2>
      {file ? (
        <motion.img
          src={file.url}
          alt={t('passport.postcardAlt', { done })}
          className="max-h-[58vh] w-auto max-w-full touch-none rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
          initial={{ y: -500, rotate: -25, scale: 0.6 }}
          animate={{ y: 0, rotate: -3, scale: 1 }}
          transition={{ type: 'spring', stiffness: 170, damping: 15 }}
          drag
          dragSnapToOrigin
          dragElastic={0.6}
          whileDrag={{ scale: 1.06, rotate: 5 }}
          whileTap={{ scale: 1.03 }}
        />
      ) : (
        <p className="m-0 text-lg text-white" role="status">
          {failed ? t('card.error') : t('card.loading')}
        </p>
      )}
      <p className="m-0 text-center text-base text-white/85">{t('passport.postcardHint')}</p>
      {file && (
        <div className="flex w-full max-w-md gap-3">
          <a className={`${button} bg-ochre text-forest-dark`} href={file.url} download={FILE_NAME}>
            <Download size={22} aria-hidden="true" />
            {t('passport.download')}
          </a>
          {canShare && (
            <button
              type="button"
              className={`${button} bg-cream text-forest`}
              onClick={() => navigator.share({ files: [shareable] }).catch(() => {})}
            >
              <Share2 size={22} aria-hidden="true" />
              {t('passport.share')}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
