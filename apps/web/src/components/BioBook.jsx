import { Canvas } from '@react-three/fiber';
import { BookOpen, Camera, Link2, QrCode, Wifi, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mascot } from '../features/avatar/SheetMascot.jsx';

/* Se cierra solo si nadie lo usa (ms). */
const AUTO_CLOSE_MS = 60_000;

/**
 * Ilustración de la tapa: el embalse entre cerros, con sol y araucarias.
 */
function CoverArt({ className }) {
  return (
    <svg viewBox="0 0 200 130" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d79b" />
          <stop offset="1" stopColor="#e9b46a" />
        </linearGradient>
        <linearGradient id="bb-water" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3f8fb0" />
          <stop offset="1" stopColor="#6fb6cf" />
        </linearGradient>
      </defs>
      <rect width="200" height="130" rx="6" fill="url(#bb-sky)" />
      <circle cx="148" cy="38" r="16" fill="#fff3d6" opacity="0.9" />
      <path d="M0 70 L38 34 L66 58 L98 22 L136 62 L164 44 L200 72 V130 H0Z" fill="#6f8f6a" />
      <path d="M0 84 L46 56 L84 80 L122 52 L170 84 L200 70 V130 H0Z" fill="#3f6b4c" />
      <path d="M0 102 C40 92 70 108 104 98 C138 88 168 100 200 92 V130 H0Z" fill="url(#bb-water)" />
      <path
        d="M18 104 c14 -3 22 3 36 0 M120 100 c12 -3 22 2 34 -1"
        stroke="#d9eef5"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      {[
        [30, 86],
        [52, 80],
        [170, 82],
        [186, 88],
      ].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <rect x="-1" y="0" width="2" height="12" fill="#2b3a2a" />
          <path
            d="M-9 2 Q0 -6 9 2 M-7 -3 Q0 -10 7 -3"
            stroke="#22412c"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}

/**
 * Tapa del libro: la ilustración, el título dorado y la invitación a abrirlo.
 */
function Cover({ t }) {
  return (
    <span className="relative flex h-full flex-col gap-3 rounded-[6px_14px_14px_6px] border-l-[10px] border-[#0f2a1c] bg-[radial-gradient(circle_at_30%_20%,#2f6d4c,#173d2b_70%)] p-4 pb-5 shadow-[0_18px_34px_rgba(0,0,0,0.45),inset_0_0_0_2px_rgba(243,236,220,0.18)]">
      <span
        className="absolute right-6 -bottom-4 w-5 h-10 bg-ochre [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]"
        aria-hidden="true"
      />
      <span className="rounded-lg overflow-hidden ring-2 ring-[#c8a35a]/70">
        <CoverArt className="block w-full h-auto" />
      </span>
      <span className="flex items-end justify-between gap-3">
        <span>
          <span className="block font-display font-extrabold text-[28px] leading-none tracking-tight whitespace-nowrap text-[#f2cf86] [text-shadow:0_1px_0_#0b1d13]">
            Bio-Book
          </span>
          <span className="block mt-1 text-[length:var(--fs-small)] text-cream/85">
            {t('bioBook.tagline')}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-ochre px-4 py-2.5 font-bold text-[#1b1206] text-[length:var(--fs-small)] shadow-[0_3px_0_var(--color-ochre-deep)] motion-safe:animate-[wiggle_4s_ease-in-out_infinite] whitespace-nowrap">
          <BookOpen size={20} aria-hidden="true" />
          {t('bioBook.open')}
        </span>
      </span>
    </span>
  );
}

/**
 * Bio-Book: un libro ilustrado en la esquina. Al tocarlo se abre ahí mismo
 * (la tapa gira sobre el lomo) y la mascota aparece a su lado abriéndolo:
 * a la izquierda los pasos, a la derecha el código QR para seguir en el
 * teléfono (el mapa entero, o la ficha abierta si hay una).
 *
 * @param {{ url?: string, wifi?: string, selectedPoint?: object | null }} props
 */
export default function BioBook({ url, wifi, selectedPoint = null }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState('');

  const baseUrl = url || window.location.origin;
  const pointId = selectedPoint?.properties?.id;
  const activeUrl = useMemo(
    () => (pointId ? `${baseUrl}/?point=${pointId}` : baseUrl),
    [baseUrl, pointId],
  );

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(activeUrl, {
      type: 'svg',
      margin: 0,
      color: { dark: '#14261d', light: '#00000000' },
    })
      .then((markup) => !cancelled && setQrSvg(markup))
      .catch(() => !cancelled && setQrSvg(''));
    return () => {
      cancelled = true;
    };
  }, [activeUrl]);

  /* Se abre también desde la ficha de un punto; Escape lo cierra. */
  useEffect(() => {
    const open = () => setIsOpen(true);
    const onKey = (event) => event.key === 'Escape' && setIsOpen(false);
    window.addEventListener('biomap:open-biobook', open);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('biomap:open-biobook', open);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => setIsOpen(false), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const name = selectedPoint?.properties?.name;
  const steps = [
    [Camera, t('bioBook.step1')],
    [QrCode, t('bioBook.step2')],
    [Link2, t('bioBook.step3')],
  ];

  return (
    <div className="relative w-[300px] z-100">
      {/* Cerrado: ocupa su lugar en la columna; abierto, se despliega hacia arriba y a la derecha sin moverla. */}
      <button
        type="button"
        className={`group relative block w-[300px] text-left cursor-pointer [perspective:900px] transition-opacity duration-300 ${isOpen ? 'opacity-0 pointer-events-none' : ''}`}
        onClick={() => setIsOpen(true)}
        aria-label={t('bioBook.openAria')}
        aria-expanded={isOpen}
      >
        <span className="relative block [transform:rotateY(-14deg)_rotateX(6deg)] transition-transform duration-500 group-hover:[transform:rotateY(-6deg)_rotateX(3deg)] group-active:scale-[0.98]">
          <span
            className="absolute inset-y-2 right-[-7px] w-3 rounded-r-md bg-[repeating-linear-gradient(180deg,#f7f0de_0_2px,#ddd1b4_2px_3px)] shadow-[2px_6px_12px_rgba(0,0,0,0.35)]"
            aria-hidden="true"
          />
          <Cover t={t} />
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="open"
            role="dialog"
            aria-labelledby="biobook-title"
            className="absolute bottom-0 left-0 z-30 flex items-end gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            <div className="relative flex w-[640px] h-[380px] [perspective:1600px]">
              {/* Página izquierda: cómo llevárselo */}
              <section className="flex-1 rounded-l-[16px] bg-[linear-gradient(90deg,#efe5cc,#fbf6ea_14%,#fbf6ea_90%,#e9dcbd)] p-6 pr-7 text-ink shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
                <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-ochre-deep">
                  Bio-Book
                </p>
                <h2
                  id="biobook-title"
                  className="mt-1 font-display font-extrabold text-[24px] leading-tight text-balance"
                >
                  {name ? t('bioBook.scanPointTitle') : t('bioBook.scanMapTitle')}
                </h2>
                <ol className="mt-4 mb-0 p-0 list-none flex flex-col gap-3">
                  {steps.map(([Icon, label], index) => (
                    <li
                      key={label}
                      className="flex items-center gap-3 text-[length:var(--fs-small)] font-bold"
                    >
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-forest text-cream flex-none">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-xs text-ochre-deep">
                          {t('bioBook.stepN', { n: index + 1 })}
                        </span>
                        {label}
                      </span>
                    </li>
                  ))}
                </ol>
                {wifi && (
                  <p className="mt-4 mb-0 flex items-center gap-2 text-sm text-muted-strong">
                    <Wifi size={18} aria-hidden="true" />
                    {t('bioBook.wifi', { wifi })}
                  </p>
                )}
              </section>
              <span
                className="w-2.5 bg-[linear-gradient(90deg,#c9b98f,#f4ecd8,#c9b98f)]"
                aria-hidden="true"
              />
              {/* Página derecha: el código */}
              <section className="relative flex-1 flex flex-col items-center justify-center gap-2 rounded-r-[16px] bg-[linear-gradient(90deg,#e9dcbd,#fbf6ea_10%,#fbf6ea_86%,#efe5cc)] p-5 text-ink shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
                <div className="rounded-xl bg-white p-3 ring-4 ring-ochre">
                  <div
                    className="w-[200px] h-[200px] [&_svg]:w-full [&_svg]:h-full"
                    role="img"
                    aria-label={t('bioBook.qrAlt')}
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                </div>
                <p className="m-0 font-display font-extrabold text-lg">{t('bioBook.scanMe')}</p>
                <p className="m-0 text-xs text-muted max-w-full truncate">
                  {activeUrl.replace(/^https?:\/\//, '')}
                </p>
              </section>
              {/* La tapa gira sobre el lomo y se va: el libro se abre ahí mismo. */}
              <motion.div
                className="absolute top-0 bottom-0 left-1/2 w-1/2 origin-left [transform-style:preserve-3d] pointer-events-none"
                initial={{ rotateY: 0, opacity: 1 }}
                animate={{ rotateY: -175, opacity: [1, 1, 0] }}
                transition={{ duration: 1, ease: [0.3, 0.7, 0.2, 1], delay: 0.35 }}
                aria-hidden="true"
              >
                <span className="block h-full [backface-visibility:hidden]">
                  <Cover t={t} />
                </span>
              </motion.div>
              <button
                type="button"
                className="absolute -top-4 -right-4 flex items-center gap-2 min-h-12 px-4 rounded-xl bg-cream text-ink font-bold text-sm shadow-[0_3px_0_var(--color-cream-shade),0_8px_20px_rgba(0,0,0,0.3)] cursor-pointer"
                onClick={() => setIsOpen(false)}
                aria-label={t('bioBook.close')}
              >
                <X size={20} strokeWidth={3} aria-hidden="true" />
                <span aria-hidden="true">{t('sheet.close')}</span>
              </button>
            </div>
            {/* La mascota, a su lado, presenta el libro (Quibar cuando llegue su modelo). */}
            <motion.div
              className="w-[220px] h-[320px] pointer-events-none"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              aria-hidden="true"
            >
              <Canvas
                camera={{ position: [0, 0.3, 3.9], fov: 38 }}
                dpr={[1, 2]}
                gl={{ alpha: true }}
              >
                <ambientLight intensity={1.1} />
                <directionalLight position={[3, 5, 4]} intensity={1.6} />
                <Mascot gestureKey="biobook" facing={-0.6} />
              </Canvas>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
