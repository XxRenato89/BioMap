import { Camera, Link2, QrCode, Wifi, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQrSvg } from '../hooks/useQr.js';

/* Se cierra solo si nadie lo usa (ms). */
const AUTO_CLOSE_MS = 60_000;

/**
 * BioMap Mobile: el código QR para seguir el mapa en el teléfono, con tres
 * pasos. Si hay una ficha abierta, el código lleva a ese lugar.
 *
 * @param {{ url?: string, wifi?: string, selectedPoint?: object | null,
 *   onClose: () => void }} props
 */
export default function MobilePanel({ url, wifi, selectedPoint = null, onClose }) {
  const { t } = useTranslation();

  const baseUrl = url || window.location.origin;
  /* Sin VITE_PUBLIC_URL, el kiosco se abre en localhost: un teléfono no llega ahí. */
  const unreachable = !url && /^(localhost|127\.|\[::1\])/.test(window.location.hostname);
  const pointId = selectedPoint?.properties?.id;
  const name = selectedPoint?.properties?.name;
  const activeUrl = useMemo(
    () => (pointId ? `${baseUrl}/?point=${pointId}` : baseUrl),
    [baseUrl, pointId],
  );

  const qrSvg = useQrSvg(activeUrl);

  /* Escape lo cierra, y se cierra solo si nadie lo usa. */
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [onClose]);

  const steps = [
    [Camera, t('mobile.step1')],
    [QrCode, t('mobile.step2')],
    [Link2, t('mobile.step3')],
  ];

  return (
    <section
      className="panel absolute bottom-[124px] left-10 z-30 flex w-[860px] gap-8 rounded-[28px] p-8"
      role="dialog"
      aria-labelledby="mobile-title"
      data-obstacle
    >
      <div className="flex w-[260px] flex-none flex-col items-center justify-center gap-3 border-r-2 border-forest/15 pr-8">
        {unreachable ? (
          <p className="m-0 flex h-[224px] w-[224px] items-center rounded-2xl bg-white/70 p-4 text-center text-sm font-bold text-muted">
            {t('mobile.notConfigured')}
          </p>
        ) : (
          <div className="rounded-2xl bg-white p-3 ring-4 ring-forest-light">
            <div
              className="h-[200px] w-[200px] [&_svg]:h-full [&_svg]:w-full"
              role="img"
              aria-label={t('mobile.qrAlt')}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
        )}
        <p className="m-0 font-display text-lg font-extrabold">{t('mobile.scanMe')}</p>
        <p className="m-0 max-w-full truncate text-xs text-muted">
          {activeUrl.replace(/^https?:\/\//, '')}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <h2
          id="mobile-title"
          className="pr-16 text-[length:calc(var(--fs-card-title)*1.05)] font-extrabold leading-tight"
        >
          {name ? t('mobile.pointTitle') : t('mobile.title')}
        </h2>
        <p className="m-0 mt-2 text-[length:var(--fs-body)] text-muted">
          {name ? t('mobile.pointText', { name }) : t('mobile.text')}
        </p>
        <ol className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
          {steps.map(([Icon, label], index) => (
            <li
              key={label}
              className="flex items-center gap-3 text-[length:var(--fs-body)] font-bold"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-forest-light text-white">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs text-muted">
                  {t('mobile.stepN', { n: index + 1 })}
                </span>
                {label}
              </span>
            </li>
          ))}
        </ol>
        {wifi && (
          <p className="m-0 mt-4 flex items-center gap-2 text-sm text-muted">
            <Wifi size={18} aria-hidden="true" />
            {t('mobile.wifi', { wifi })}
          </p>
        )}
      </div>
      <button
        type="button"
        className="absolute right-4 top-4 flex h-14 w-14 items-center justify-center rounded-2xl border-0 bg-transparent text-forest cursor-pointer hover:bg-forest-light/10"
        onClick={onClose}
        aria-label={t('mobile.close')}
      >
        <X size={26} aria-hidden="true" />
      </button>
    </section>
  );
}
