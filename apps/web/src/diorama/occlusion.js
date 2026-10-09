/*
 * Muestras a lo largo de la línea cámara → punto para saber si el relieve la corta.
 */
const SAMPLES = 28;

/**
 * Indica si el relieve tapa un punto visto desde la cámara: recorre la línea
 * entre ambos y revisa si en algún tramo el terreno queda por encima. Solo
 * mira dentro de la maqueta (afuera no hay terreno).
 *
 * @param {{ x: number, y: number, z: number }} camera
 * @param {{ x: number, y: number, z: number }} point
 * @param {(x: number, z: number) => number} heightAt
 * @param {{ width: number, depth: number }} size
 * @param {number} [margin] Cuánto debe sobresalir el terreno para contar (unidades).
 */
export function isOccluded(camera, point, heightAt, { width, depth }, margin = 0.003) {
  const halfW = width / 2;
  const halfD = depth / 2;
  for (let k = 1; k < SAMPLES; k += 1) {
    const t = k / SAMPLES;
    const x = camera.x + (point.x - camera.x) * t;
    const z = camera.z + (point.z - camera.z) * t;
    if (Math.abs(x) > halfW || Math.abs(z) > halfD) continue;
    const y = camera.y + (point.y - camera.y) * t;
    if (heightAt(x, z) > y + margin) return true;
  }
  return false;
}
