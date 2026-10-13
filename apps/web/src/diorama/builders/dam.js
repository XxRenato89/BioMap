import { Float32BufferAttribute, BufferGeometry, ShapeUtils, Vector2 } from 'three';
import { metersToY } from '../utils/projection.js';

/*
 * Medidas de un muro de presa (km): ancho del coronamiento, talud de cada
 * cara (ancho extra por unidad de alto, como una presa de gravedad) y cuánto
 * se entierra bajo el cauce.
 */
export const DAM_CREST_WIDTH = 0.022;
export const DAM_SLOPE = 0.38;
export const DAM_FOOTING = 0.01;
export const CONCRETE = [0.72, 0.71, 0.68];
export const CONCRETE_SHADED = [0.58, 0.57, 0.54];
export const PARAPET = [0.93, 0.92, 0.9];
export const DAM_PARAPET = 0.0025;
/* Detalle del muro: franjas de hormigonado (m), enrocado al pie y postes de luz (km). */
const DAM_LIFT_METERS = 4;
const DAM_APRON = 0.012;
const DAM_LAMP_SPACING = 0.045;
const DAM_LAMP_HEIGHT = 0.007;
const STAIN = [0.5, 0.53, 0.46];
const RIPRAP = [0.45, 0.44, 0.4];
const LAMP_POST = [0.35, 0.37, 0.38];
const LAMP_LIGHT = [1, 0.92, 0.7];
const CREST = [0.6, 0.6, 0.58];

/**
 * Densifica una línea (x, z) con puntos cada ~10 m, para que el muro siga
 * el fondo del cauce.
 *
 * @param {Array<{ x: number, z: number }>} points
 * @param {number} [maxLength=0.01]
 */
export function densify(points, maxLength = 0.01) {
  const dense = [points[0]];
  for (let k = 1; k < points.length; k += 1) {
    const [a, b] = [points[k - 1], points[k]];
    const parts = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / maxLength));
    for (let p = 1; p <= parts; p += 1)
      dense.push({ x: a.x + ((b.x - a.x) * p) / parts, z: a.z + ((b.z - a.z) * p) / parts });
  }
  return dense;
}

/**
 * Muro de hormigón de una presa, a escala real, desde su geometría en
 * OpenStreetMap:
 * - si es una línea (el coronamiento), un muro de sección trapezoidal que la
 *   sigue: angosto arriba y más ancho abajo, como una presa de gravedad;
 * - si es un polígono cerrado (la planta de la presa), ese polígono levantado
 *   como un bloque macizo.
 * La base queda bajo el punto más bajo del cauce y el coronamiento,
 * `heightMeters` más arriba. Si no se conoce la altura, se estima con el
 * relieve: el extremo más alto de la línea, o las laderas donde se apoya el polígono.
 * Una cara es más oscura para que se lea el volumen.
 *
 * @param {number[][]} line Puntos [lng, lat].
 * @param {(x: number, z: number) => number} heightAt
 * @param {{ toWorld: Function }} projection
 * @param {number} [heightMeters] Altura del muro sobre el cauce (m).
 * @returns {BufferGeometry}
 */
export function buildDamWall(line, heightAt, projection, heightMeters) {
  const points = line.map((point) => projection.toWorld(point));
  const closed =
    points.length > 3 &&
    Math.hypot(points[0].x - points.at(-1).x, points[0].z - points.at(-1).z) < 1e-6;
  const dense = densify(points);
  const ground = dense.map(({ x, z }) => heightAt(x, z));
  const riverbed = Math.min(...ground);
  const sorted = [...ground].sort((a, b) => a - b);
  let crest = closed ? sorted[Math.floor(sorted.length * 0.7)] : Math.max(ground[0], ground.at(-1));
  if (heightMeters !== undefined) crest = riverbed + metersToY(heightMeters);
  const base = riverbed - DAM_FOOTING;

  const positions = [];
  const colors = [];
  const tri = (a, b, c, tint) => {
    positions.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k += 1) colors.push(...tint);
  };
  const quad = (a, b, c, d, tint) => {
    tri(a, b, c, tint);
    tri(a, c, d, tint);
  };

  if (closed) {
    const ring = points.slice(0, -1);
    const contour = ring.map(({ x, z }) => new Vector2(x, z));
    const clockwise = ShapeUtils.isClockWise(contour);
    for (const [a, b, c] of ShapeUtils.triangulateShape(contour, [])) {
      const at = (k) => [ring[k].x, crest, ring[k].z];
      /* Coronamiento: calzada de hormigón gastado. */
      if (clockwise) tri(at(a), at(b), at(c), CREST);
      else tri(at(a), at(c), at(b), CREST);
    }
    const center = ring.reduce(
      (sum, p) => ({ x: sum.x + p.x / ring.length, z: sum.z + p.z / ring.length }),
      {
        x: 0,
        z: 0,
      },
    );
    const lift = metersToY(DAM_LIFT_METERS);
    const stained = base + (crest - base) * 0.3;
    let sinceLamp = 0;
    ring.forEach((p, k) => {
      const q = ring[(k + 1) % ring.length];
      const [a, b] = clockwise ? [p, q] : [q, p];
      const shade = k % 2 ? CONCRETE : CONCRETE_SHADED;
      /* Cara en franjas de hormigonado; abajo, manchada por el agua y el musgo. */
      for (let y = base, band = 0; y < crest; y += lift, band += 1) {
        const top = Math.min(y + lift, crest);
        const joint = band % 2 ? 1 : 0.84;
        const tint = (y < stained ? STAIN : shade).map((channel) => channel * joint);
        quad([a.x, y, a.z], [b.x, y, b.z], [b.x, top, b.z], [a.x, top, a.z], tint);
      }
      /* Baranda del coronamiento: un murete a lo largo del borde. */
      const top = crest + DAM_PARAPET;
      quad([a.x, crest, a.z], [b.x, crest, b.z], [b.x, top, b.z], [a.x, top, a.z], PARAPET);
      quad([b.x, crest, b.z], [a.x, crest, a.z], [a.x, top, a.z], [b.x, top, b.z], PARAPET);
      /* Enrocado al pie: baja del muro al terreno, hacia afuera de la planta. */
      const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      let nx = -(b.z - a.z) / length;
      let nz = (b.x - a.x) / length;
      if (nx * ((a.x + b.x) / 2 - center.x) + nz * ((a.z + b.z) / 2 - center.z) < 0) {
        nx = -nx;
        nz = -nz;
      }
      const out = (point) => ({ x: point.x + nx * DAM_APRON, z: point.z + nz * DAM_APRON });
      const [oa, ob] = [out(a), out(b)];
      const foot = (point) => heightAt(point.x, point.z) + 0.0004;
      const apron = [
        [a.x, foot(a), a.z],
        [b.x, foot(b), b.z],
        [ob.x, foot(ob), ob.z],
        [oa.x, foot(oa), oa.z],
      ];
      quad(...apron, RIPRAP);
      quad(apron[3], apron[2], apron[1], apron[0], RIPRAP);
      /* Postes de luz cada DAM_LAMP_SPACING km sobre la baranda. */
      sinceLamp += length;
      if (sinceLamp >= DAM_LAMP_SPACING) {
        sinceLamp = 0;
        const s = 0.0004;
        const h = top + DAM_LAMP_HEIGHT;
        const corners = [
          [a.x - s, a.z - s],
          [a.x + s, a.z - s],
          [a.x + s, a.z + s],
          [a.x - s, a.z + s],
        ];
        corners.forEach(([x0, z0], c) => {
          const [x1, z1] = corners[(c + 1) % 4];
          quad([x0, top, z0], [x1, top, z1], [x1, h, z1], [x0, h, z0], LAMP_POST);
          quad([x1, top, z1], [x0, top, z0], [x0, h, z0], [x1, h, z1], LAMP_POST);
        });
        quad(...corners.map(([x, z]) => [x, h, z]), LAMP_LIGHT);
        quad(...[...corners].reverse().map(([x, z]) => [x, h, z]), LAMP_LIGHT);
      }
    });
  } else {
    /* Medio ancho del muro a la altura y: crece hacia abajo con el talud. */
    const halfWidth = (y) => DAM_CREST_WIDTH / 2 + Math.max(crest - y, 0) * DAM_SLOPE;
    const side = (a, b) => {
      const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return { x: -(b.z - a.z) / length, z: (b.x - a.x) / length };
    };
    const at = (p, n, s, y) => [p.x + n.x * s * halfWidth(y), y, p.z + n.z * s * halfWidth(y)];
    for (let k = 1; k < dense.length; k += 1) {
      const [a, b] = [dense[k - 1], dense[k]];
      const n = side(a, b);
      quad(
        at(a, n, 1, crest),
        at(b, n, 1, crest),
        at(b, n, -1, crest),
        at(a, n, -1, crest),
        CONCRETE,
      );
      quad(at(a, n, 1, base), at(b, n, 1, base), at(b, n, 1, crest), at(a, n, 1, crest), CONCRETE);
      quad(
        at(b, n, -1, base),
        at(a, n, -1, base),
        at(a, n, -1, crest),
        at(b, n, -1, crest),
        CONCRETE_SHADED,
      );
    }
    for (const [end, next, s] of [
      [dense[0], dense[1], 1],
      [dense.at(-1), dense.at(-2), -1],
    ]) {
      const n = side(end, next);
      quad(
        at(end, n, -s, base),
        at(end, n, s, base),
        at(end, n, s, crest),
        at(end, n, -s, crest),
        CONCRETE_SHADED,
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
