import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/**
 * Código QR de una dirección, como marcado SVG (azul marino sobre
 * transparente). Vacío mientras se genera o si falla.
 *
 * @param {string} url
 */
export function useQrSvg(url) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#14334d', light: '#00000000' } })
      .then((markup) => !cancelled && setSvg(markup))
      .catch(() => !cancelled && setSvg(''));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return svg;
}
