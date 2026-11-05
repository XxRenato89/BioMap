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
 * @param {Array<{ x: number, z: number, r: number }>} [taken] Huellas ya ocupadas (p. ej. campings en la orilla).
 * @returns {Map<number|string, { x: number, y: number, z: number, scale: number }>}
 *   Solo los que encontraron lugar.
 */
export function placeModels(items, { heightAt, isWater }, taken = []) {
  const placed = [...taken];
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

/* Borde de barranco: hasta dónde buscar agua (km), paso de avance y caída que marca el borde. */
const EDGE_SEARCH_KM = 0.35;
const EDGE_STEP_KM = 0.004;
const EDGE_DROP = 0.5;

/**
 * Borde del barranco entre un punto y el agua cercana: se avanza desde (x, z)
 * hacia el agua y se para donde el terreno empieza a caer fuerte (pendiente
 * mayor que EDGE_DROP en unidades de maqueta). Es donde van los miradores,
 * mirando al agua. Se prueban las direcciones con agua de la más cercana a la
 * más lejana, saltando los bordes a menos de `spacing` de los ya ocupados.
 *
 * @param {number} x
 * @param {number} z
 * @param {{ heightAt: (x: number, z: number) => number, isWater: (x: number, z: number) => boolean }} ground
 * @param {{ taken?: Array<{ x: number, z: number }>, spacing?: number }} [options]
 * @returns {{ x: number, y: number, z: number, angle: number } | null} Sin agua cerca, null.
 */
export function cliffEdge(x, z, { heightAt, isWater }, { taken = [], spacing = 0 } = {}) {
  const directions = [];
  for (let k = 0; k < 48; k += 1) {
    const angle = (k / 48) * Math.PI * 2;
    for (let reach = 0.01; reach <= EDGE_SEARCH_KM; reach += 0.01) {
      if (isWater(x + Math.sin(angle) * reach, z + Math.cos(angle) * reach)) {
        directions.push({ angle, reach });
        break;
      }
    }
  }
  directions.sort((a, b) => a.reach - b.reach);
  for (const { angle, reach } of directions) {
    const [dx, dz] = [Math.sin(angle), Math.cos(angle)];
    for (let s = 0; s < reach; s += EDGE_STEP_KM) {
      const here = heightAt(x + dx * s, z + dz * s);
      const ahead = heightAt(x + dx * (s + EDGE_STEP_KM), z + dz * (s + EDGE_STEP_KM));
      if ((here - ahead) / EDGE_STEP_KM <= EDGE_DROP) continue;
      const edge = { x: x + dx * s, y: here, z: z + dz * s, angle };
      if (taken.every((p) => Math.hypot(p.x - edge.x, p.z - edge.z) >= spacing)) return edge;
      break;
    }
  }
  return null;
}

/* Orilla: hasta dónde buscar agua (km) y paso de avance. */
const SHORE_SEARCH_KM = 0.4;
const SHORE_STEP_KM = 0.005;
/* Fracción del radio del modelo que queda entre su centro y la orilla: la
 * playa (al frente) toca el agua y el resto queda en tierra. */
const SHORE_SETBACK = 0.7;

/**
 * Lugar para un modelo de orilla (camping, playa): se busca el agua más
 * cercana al punto y el modelo se corre hasta que su frente toque la orilla,
 * mirando al agua. Así la playa no queda sobre el pasto cuando el punto del
 * lugar (la portería, la oficina) está tierra adentro.
 *
 * @param {number} x
 * @param {number} z
 * @param {number} radius Radio del modelo (km).
 * @param {{ heightAt: (x: number, z: number) => number, isWater: (x: number, z: number) => boolean }} ground
 * @returns {{ x: number, y: number, z: number, angle: number } | null} Sin agua cerca, null.
 */
export function shoreSpot(x, z, radius, { heightAt, isWater }) {
  let nearest = null;
  for (let k = 0; k < 48; k += 1) {
    const angle = (k / 48) * Math.PI * 2;
    for (let reach = SHORE_STEP_KM; reach <= SHORE_SEARCH_KM; reach += SHORE_STEP_KM) {
      if (isWater(x + Math.sin(angle) * reach, z + Math.cos(angle) * reach)) {
        if (!nearest || reach < nearest.reach) nearest = { angle, reach };
        break;
      }
    }
  }
  if (!nearest) return null;
  const move = nearest.reach - radius * SHORE_SETBACK;
  const cx = x + Math.sin(nearest.angle) * move;
  const cz = z + Math.cos(nearest.angle) * move;
  return { x: cx, y: heightAt(cx, cz), z: cz, angle: nearest.angle };
}

/**
 * Árboles (matrices de instancia de 16 números y colores RGB) sin los que caen
 * dentro de alguna huella { x, z, r }: los modelos de los lugares no quedan
 * atravesados por el bosque.
 *
 * @param {{ matrices: Float32Array, colors: Float32Array, count: number }} trees
 * @param {Array<{ x: number, z: number, r: number }>} clearings
 */
export function withoutTreesIn(trees, clearings) {
  if (clearings.length === 0) return trees;
  const keep = [];
  for (let k = 0; k < trees.count; k += 1) {
    const x = trees.matrices[k * 16 + 12];
    const z = trees.matrices[k * 16 + 14];
    if (!clearings.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) keep.push(k);
  }
  if (keep.length === trees.count) return trees;
  const matrices = new Float32Array(keep.length * 16);
  const colors = new Float32Array(keep.length * 3);
  keep.forEach((k, slot) => {
    matrices.set(trees.matrices.subarray(k * 16, k * 16 + 16), slot * 16);
    colors.set(trees.colors.subarray(k * 3, k * 3 + 3), slot * 3);
  });
  return { matrices, colors, count: keep.length };
}

/**
 * Cruce más angosto del río junto a (x, z): de las rectas que pasan por el
 * punto (cada 6°), la que cruza el agua más cercana en el tramo más corto.
 * Devuelve sus dos orillas, o null si no hay agua a menos de `reach` km.
 *
 * @param {number} x
 * @param {number} z
 * @param {(x: number, z: number) => boolean} isWater
 * @param {{ reach?: number, step?: number }} [options]
 * @returns {{ a: { x: number, z: number }, b: { x: number, z: number } } | null}
 */
export function riverCrossing(x, z, isWater, { reach = 0.3, step = 0.002 } = {}) {
  let best = null;
  for (let deg = 0; deg < 180; deg += 6) {
    const angle = (deg * Math.PI) / 180;
    const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
    /* Tramos de agua a lo largo de la recta, de −reach a +reach. */
    const runs = [];
    let start = null;
    for (let t = -reach; t <= reach + 1e-9; t += step) {
      const wet = isWater(x + dx * t, z + dz * t);
      if (wet && start === null) start = t;
      if (!wet && start !== null) {
        runs.push([start, t - step]);
        start = null;
      }
    }
    /* Un tramo que toca el borde de la búsqueda no tiene orilla del otro lado. */
    const closed = runs.filter(([t0]) => t0 > -reach);
    if (closed.length === 0) continue;
    const near = (r) => (r[0] <= 0 && r[1] >= 0 ? 0 : Math.min(Math.abs(r[0]), Math.abs(r[1])));
    const run = closed.reduce((m, r) => (near(r) < near(m) ? r : m));
    const score = near(run) * 2 + (run[1] - run[0]);
    if (!best || score < best.score) {
      const [t0, t1] = [run[0] - step, run[1] + step];
      best = {
        score,
        a: { x: x + dx * t0, z: z + dz * t0 },
        b: { x: x + dx * t1, z: z + dz * t1 },
      };
    }
  }
  return best && { a: best.a, b: best.b };
}
