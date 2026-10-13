/*
 * Dónde apoyar los modelos 3D de los puntos de interés: cerca de su punto,
 * en un lugar plano, fuera del agua y sin chocar entre ellos. Unidades de la
 * maqueta (km en planta).
 */
const ANGLES = 16;
/* Distancias de búsqueda, en radios del modelo. */
const RINGS = [0, 0.5, 1, 1.5];
/* Si no cabe cerca de su punto, se prueba más chico antes que alejarlo. */
const SCALES = [1, 0.8, 0.65, 0.5, 0.4];
/* Desnivel máximo de la huella respecto de su ancho. */
const MAX_RELIEF = 0.22;

/**
 * Muestras de la huella circular: centro y dos anillos.
 */
function footprint(x, z, r) {
  const samples = [[x, z]];
  for (const ring of [0.5, 0.95]) {
    for (let k = 0; k < 8; k += 1) {
      const angle = (k / 8) * Math.PI * 2;
      samples.push([x + Math.sin(angle) * r * ring, z + Math.cos(angle) * r * ring]);
    }
  }
  return samples;
}

/**
 * @param {Array<{ id: number|string, x: number, z: number, radius: number }>} items
 * @param {{ heightAt: (x: number, z: number) => number, isWater: (x: number, z: number) => boolean }} ground
 * @returns {Map<number|string, { x: number, y: number, z: number, scale: number }>}
 *   Solo los que encontraron lugar.
 */
export function placeModels(items, { heightAt, isWater }) {
  const placed = [];
  const result = new Map();
  for (const item of [...items].sort((a, b) => b.radius - a.radius)) {
    let best = null;
    for (const scale of SCALES) {
      const r = item.radius * scale;
      for (const ring of RINGS) {
        for (let k = 0; k < (ring === 0 ? 1 : ANGLES); k += 1) {
          const angle = (k / ANGLES) * Math.PI * 2;
          const x = item.x + Math.sin(angle) * ring * r;
          const z = item.z + Math.cos(angle) * ring * r;
          if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r)) continue;
          const samples = footprint(x, z, r);
          if (samples.some(([sx, sz]) => isWater(sx, sz))) continue;
          const heights = samples.map(([sx, sz]) => heightAt(sx, sz));
          const low = Math.min(...heights);
          const relief = (Math.max(...heights) - low) / (2 * r);
          if (relief > MAX_RELIEF) continue;
          /* Lo más plano y lo más cerca de su punto. */
          const score = relief + ring * 0.04;
          if (!best || score < best.score) best = { x, z, y: low, scale, r, score };
        }
      }
      if (best) break;
    }
    if (!best) continue;
    placed.push(best);
    result.set(item.id, { x: best.x, y: best.y, z: best.z, scale: best.scale });
  }
  return result;
}
