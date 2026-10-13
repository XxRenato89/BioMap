/**
 * Lectura de teselas PNG de elevación (relieve). Funciones puras, sin
 * navegador, para usarlas en el script que esculpe la maqueta y en los tests.
 */

/**
 * Altura en metros de un píxel según la codificación de la tesela.
 * - terrarium: (R × 256 + G + B / 256) − 32768
 * - mapbox (Terrain-RGB): −10000 + (R × 65536 + G × 256 + B) × 0,1
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {'terrarium' | 'mapbox'} encoding
 */
export function decodeElevation(r, g, b, encoding) {
  if (encoding === 'mapbox') return -10000 + (r * 65536 + g * 256 + b) * 0.1;
  return r * 256 + g + b / 256 - 32768;
}

/**
 * Tesela de origen para una tesela más detallada. Más allá de `maxZoom` no
 * hay datos más finos: se usa el trozo correspondiente de la tesela antecesora.
 *
 * @returns {{ z: number, x: number, y: number, scale: number, offsetX: number, offsetY: number }}
 *   `scale` es la fracción de la tesela de origen que se usa y `offsetX/Y`
 *   dónde empieza ese trozo (fracciones de 0 a 1).
 */
export function sourceTileFor(x, y, level, maxZoom) {
  const depth = Math.max(0, level - maxZoom);
  const factor = 2 ** depth;
  return {
    z: level - depth,
    x: Math.floor(x / factor),
    y: Math.floor(y / factor),
    scale: 1 / factor,
    offsetX: (x % factor) / factor,
    offsetY: (y % factor) / factor,
  };
}

/**
 * Muestrea una grilla de `samples` × `samples` alturas (fila por fila, de
 * norte a sur) dentro del trozo indicado de la imagen, con interpolación
 * bilineal para que el relieve ampliado no se vea escalonado.
 *
 * @param {Uint8ClampedArray} pixels Datos RGBA de la imagen.
 * @param {number} size Lado de la imagen en píxeles.
 * @param {{ scale: number, offsetX: number, offsetY: number }} region
 * @param {number} samples
 * @param {'terrarium' | 'mapbox'} encoding
 * @returns {Float32Array}
 */
export function sampleHeights(pixels, size, region, samples, encoding) {
  const heights = new Float32Array(samples * samples);
  const last = size - 1;
  const heightAt = (px, py) => {
    const i = (py * size + px) * 4;
    return decodeElevation(pixels[i], pixels[i + 1], pixels[i + 2], encoding);
  };
  for (let row = 0; row < samples; row += 1) {
    const fy = (region.offsetY + (row / (samples - 1)) * region.scale) * last;
    const y0 = Math.min(Math.floor(fy), last);
    const y1 = Math.min(y0 + 1, last);
    const ty = fy - y0;
    for (let col = 0; col < samples; col += 1) {
      const fx = (region.offsetX + (col / (samples - 1)) * region.scale) * last;
      const x0 = Math.min(Math.floor(fx), last);
      const x1 = Math.min(x0 + 1, last);
      const tx = fx - x0;
      const top = heightAt(x0, y0) * (1 - tx) + heightAt(x1, y0) * tx;
      const bottom = heightAt(x0, y1) * (1 - tx) + heightAt(x1, y1) * tx;
      heights[row * samples + col] = top * (1 - ty) + bottom * ty;
    }
  }
  return heights;
}

/**
 * Reemplaza {z}, {x} e {y} en una plantilla de URL de teselas.
 */
export function tileUrl(template, { z, x, y }) {
  return template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}
