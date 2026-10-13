import { valueNoise } from '../utils/noise.js';

/**
 * Textura de detalle fino (grano de suelo, pasto y roca), repetida sobre el
 * terreno para que de cerca no se vea borroso. Se genera aquí: no hay que
 * descargar imágenes.
 *
 * @param {number} [size=512] Lado en píxeles (potencia de 2).
 * @returns {Uint8Array}
 */
export function bakeDetail(size = 512) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      /* Ruido periódico: se repite sin costuras. */
      const sample = (scale) => {
        const u = (x / size) * scale;
        const v = (y / size) * scale;
        return valueNoise(u % scale, v % scale);
      };
      const value = sample(8) * 0.45 + sample(32) * 0.35 + sample(128) * 0.2;
      const o = (y * size + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = value * 255;
      data[o + 3] = 255;
    }
  }
  return data;
}
