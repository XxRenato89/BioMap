import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

/**
 * Tarjeta «Llévalo en tu teléfono» con animación del personaje BioGuía.
 * El avatar anima su saludo y señala el código QR generado localmente.
 *
 * @param {{ url: string, wifi: string }} props
 */
export default function QrCard({ url, wifi }) {
  const { t } = useTranslation();
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, {
      type: 'svg',
      margin: 0,
      color: { dark: '#10201A', light: '#FFFFFF' },
    })
      .then((markup) => !cancelled && setSvg(markup))
      .catch(() => !cancelled && setSvg(''));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <aside className="panel glass-light qr-card qr-card--with-avatar">
      {/* Personaje guardaparques animado junto al QR */}
      <div className="qr-avatar-character" aria-hidden="true">
        <svg viewBox="0 0 100 120" className="qr-avatar-svg" xmlns="http://www.w3.org/2000/svg">
          {/* Sombra suave */}
          <ellipse cx="50" cy="114" rx="28" ry="5" fill="rgba(0,0,0,0.2)" />

          {/* Cuerpo y chaqueta verde */}
          <g className="qr-avatar-body">
            {/* Mochila visible al costado */}
            <rect x="22" y="62" width="14" height="26" rx="5" fill="#e07a5f" />
            {/* Torso */}
            <path d="M32 60 C32 54 68 54 68 60 L65 92 C65 96 35 96 35 92 Z" fill="#2d6a4f" />
            {/* Insignia dorada */}
            <polygon points="56,66 60,66 61,72 58,74 55,72" fill="#f2cc8f" />
            {/* Cinturón */}
            <rect x="34" y="85" width="32" height="6" rx="1" fill="#403d39" />
            <rect x="47" y="84" width="6" height="8" rx="1" fill="#f2cc8f" />
          </g>

          {/* Cabeza y rostro */}
          <g className="qr-avatar-head">
            {/* Cuello */}
            <rect x="45" y="48" width="10" height="12" rx="2" fill="#f4c29e" />
            {/* Cara */}
            <circle cx="50" cy="42" r="16" fill="#f4c29e" />

            {/* Ojos expresivos con animación de parpadeo */}
            <ellipse cx="44" cy="40" rx="2.4" ry="3.2" fill="#2b1e17" className="qr-avatar-eye" />
            <circle cx="43.2" cy="38.8" r="0.8" fill="#ffffff" />
            <ellipse cx="56" cy="40" rx="2.4" ry="3.2" fill="#2b1e17" className="qr-avatar-eye" />
            <circle cx="55.2" cy="38.8" r="0.8" fill="#ffffff" />

            {/* Sonrisa amigable */}
            <path
              d="M45 47 Q50 52 55 47"
              stroke="#2b1e17"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            {/* Mejillas sonrosadas */}
            <circle cx="40" cy="45" r="2.5" fill="#f28482" opacity="0.6" />
            <circle cx="60" cy="45" r="2.5" fill="#f28482" opacity="0.6" />

            {/* Sombrero de explorador con ala ancha */}
            <g className="qr-avatar-hat">
              {/* Copa del sombrero */}
              <path d="M36 28 C36 17 64 17 64 28 Z" fill="#8d6e3f" />
              {/* Cinta verde del sombrero */}
              <rect x="36" y="24" width="28" height="4" fill="#314e35" />
              {/* Ala ancha */}
              <ellipse cx="50" cy="28" rx="28" ry="6" fill="#9c7c4c" />
            </g>
          </g>

          {/* Brazo izquierdo que sostiene una lupa / brújula */}
          <g className="qr-avatar-arm-left">
            <path
              d="M32 64 C22 72 20 84 26 88"
              stroke="#2d6a4f"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="26" cy="88" r="4" fill="#f4c29e" />
          </g>

          {/* Brazo derecho animado saludando e indicando el QR */}
          <g className="qr-avatar-arm-right">
            <path
              d="M68 64 C78 68 85 58 84 48"
              stroke="#2d6a4f"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              className="qr-waving-arm"
            />
            {/* Mano saludando */}
            <circle cx="84" cy="46" r="4.5" fill="#f4c29e" className="qr-waving-hand" />
          </g>
        </svg>
        <span className="qr-avatar-bubble">¡Escanea aquí! 👇</span>
      </div>

      {/* Contenedor del código QR generado dinámicamente */}
      <div className="qr-card__content-row">
        <div
          className="qr-card__code"
          role="img"
          aria-label={t('qr.alt')}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="qr-card__text">
          <h2>{t('qr.title')}</h2>
          <p>
            <Trans i18nKey="qr.text" values={{ wifi }} components={{ strong: <strong /> }} />
          </p>
        </div>
      </div>
    </aside>
  );
}
