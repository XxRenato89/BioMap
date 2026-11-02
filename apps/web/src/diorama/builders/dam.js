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
 * Cotas de una presa: base (bajo el punto más bajo del cauce) y coronamiento
 * (`heightMeters` más arriba, o estimado con el relieve si no se conoce).
 */
export function damLevels(line, heightAt, projection, heightMeters) {
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
  return { points, closed, dense, crest, base: riverbed - DAM_FOOTING };
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
 * @param {number} [crestY] Cota del coronamiento ya calculada (ej. la de otro
 *   tramo de la misma presa); si se da, reemplaza a la estimada.
 * @returns {BufferGeometry}
 */
export function buildDamWall(line, heightAt, projection, heightMeters, crestY) {
  const levels = damLevels(line, heightAt, projection, heightMeters);
  const { points, closed, dense, base } = levels;
  const crest = crestY ?? levels.crest;

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
    const densePoints = densify(points, 0.03);
    const denseRing = densePoints.slice(0, -1);
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
    denseRing.forEach((p, k) => {
      const q = denseRing[(k + 1) % denseRing.length];
      const [a, b] = clockwise ? [p, q] : [q, p];
      const shade = k % 2 ? CONCRETE : CONCRETE_SHADED;
      const wallBase = Math.min(
        base,
        heightAt(a.x, a.z) - DAM_FOOTING,
        heightAt(b.x, b.z) - DAM_FOOTING,
      );
      /* Cara en franjas de hormigonado; abajo, manchada por el agua y el musgo. */
      for (let y = wallBase, band = 0; y < crest; y += lift, band += 1) {
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
      const foot = (point) => Math.min(crest, heightAt(point.x, point.z) + 0.0004);
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

/* Terraplén (presa de tierra y enrocado): talud 2:1 en metros, ya en unidades de maqueta. */
const EMBANKMENT_SLOPE = 2 / 1.35;
const EMBANKMENT_STATIONS = 160;
const EMBANKMENT_MAX_REACH = 0.15;
/* Estaciones a cada lado con que se promedia el pie de un talud. */
const TOE_SMOOTH = 4;
/* Empalme con el frente: largo de la curva y cuánto se mete bajo su calzada (km). */
const LEAD_KM = 0.06;
const LEAD_OVERLAP_KM = 0.03;
/* Colores de vértice en espacio lineal (más oscuros que su tono en pantalla). */
const ROCKFILL = [0.37, 0.38, 0.36];
const BANK_GRAVEL = [0.46, 0.42, 0.34];
const ASPHALT = [0.07, 0.075, 0.085];
const CURB = [0.88, 0.86, 0.8];

/**
 * Remuestrea una polilínea (x, z) en `count` puntos a igual distancia.
 */
function resample(points, count) {
  const lengths = [0];
  for (let k = 1; k < points.length; k += 1)
    lengths.push(
      lengths[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].z - points[k - 1].z),
    );
  const total = lengths.at(-1);
  const out = [];
  let seg = 1;
  for (let i = 0; i < count; i += 1) {
    const target = (total * i) / (count - 1);
    while (seg < points.length - 1 && lengths[seg] < target) seg += 1;
    const span = lengths[seg] - lengths[seg - 1] || 1;
    const f = Math.min(1, Math.max(0, (target - lengths[seg - 1]) / span));
    const [a, b] = [points[seg - 1], points[seg]];
    out.push({ x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f });
  }
  return out;
}

/**
 * Presa de terraplén a lo largo de una planta alargada de OSM (polígono
 * cerrado): calzada sobre el coronamiento, talud de losas hacia el embalse
 * y talud de grava hacia afuera, ambos bajando hasta el relieve.
 * La primera mitad del polígono (del primer punto al más lejano) es el borde
 * que da al embalse.
 *
 * @param {number[][]} ring Puntos [lng, lat], cerrado.
 * @param {(x: number, z: number) => number} heightAt
 * @param {{ toWorld: Function }} projection
 * @param {number} crest Cota del coronamiento (unidades de maqueta).
 * @param {{ start?: { x: number, z: number }, end: { x: number, z: number },
 *   dir: { x: number, z: number }, n: { x: number, z: number }, half: number }} [lead]
 *   Calzada del muro vecino (inicio, extremo, dirección hacia afuera, normal al
 *   embalse y medio ancho): el terraplén corre de `start` a `end` y desde ahí
 *   curva hasta su planta, sin quiebre.
 * @param {(x: number, z: number) => boolean} [stop] Dónde no puede llegar el
 *   talud (caminos al pie del terraplén).
 * @returns {BufferGeometry}
 */
export function buildEmbankment(ring, heightAt, projection, crest, lead, stop) {
  const points = ring.slice(0, -1).map((point) => projection.toWorld(point));
  const start = points[0];
  let tip = 0;
  points.forEach((p, k) => {
    if (
      Math.hypot(p.x - start.x, p.z - start.z) >
      Math.hypot(points[tip].x - start.x, points[tip].z - start.z)
    )
      tip = k;
  });
  const upstreamSide = resample(points.slice(0, tip + 1), EMBANKMENT_STATIONS);
  const outerSide = resample([...points.slice(tip), start].reverse(), EMBANKMENT_STATIONS);
  const stations = upstreamSide.map((u, i) => {
    const o = outerSide[i];
    const center = { x: (u.x + o.x) / 2, z: (u.z + o.z) / 2 };
    const half = Math.max(0.006, Math.hypot(u.x - o.x, u.z - o.z) / 2) * 0.6;
    const len = Math.hypot(u.x - o.x, u.z - o.z) || 1;
    return { center, half, n: { x: (u.x - o.x) / len, z: (u.z - o.z) / len } };
  });
  if (lead) {
    /* Una sola calzada: el ancho del coronamiento vecino en todo el largo. */
    for (const station of stations) station.half = lead.half;
    /* Curva cuadrática tangente a la calzada vecina hasta la primera estación a LEAD_KM. */
    const { end, dir } = lead;
    const far = (s) => Math.hypot(s.center.x - end.x, s.center.z - end.z) >= LEAD_KM;
    const j = Math.max(1, stations.findIndex(far));
    const target = stations[j];
    const reach = Math.hypot(target.center.x - end.x, target.center.z - end.z);
    /* Con `start`, el terraplén corre recto por el frente hasta `end` y desde ahí curva. */
    const p0 = lead.start
      ? end
      : { x: end.x - dir.x * LEAD_OVERLAP_KM, z: end.z - dir.z * LEAD_OVERLAP_KM };
    /* Control en el cruce de la calzada vecina con la planta: la curva entra tangente a ambas. */
    const next = stations[Math.min(j + 1, stations.length - 1)].center;
    const along = { x: next.x - target.center.x, z: next.z - target.center.z };
    const cross = dir.x * along.z - dir.z * along.x;
    const k =
      Math.abs(cross) > 1e-9
        ? ((target.center.x - end.x) * along.z - (target.center.z - end.z) * along.x) / cross
        : -1;
    const p1 =
      k > 0 && k < reach * 1.5
        ? { x: end.x + dir.x * k, z: end.z + dir.z * k }
        : { x: end.x + dir.x * reach * 0.6, z: end.z + dir.z * reach * 0.6 };
    const p2 = target.center;
    const count = Math.max(8, Math.round((reach + LEAD_OVERLAP_KM) / 0.006));
    const curve = [];
    for (let k = 0; k < count; k += 1) {
      const t = k / count;
      const at = (a, b, c) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
      const slope = (a, b, c) => 2 * (1 - t) * (b - a) + 2 * t * (c - b);
      const tx = slope(p0.x, p1.x, p2.x);
      const tz = slope(p0.z, p1.z, p2.z);
      const len = Math.hypot(tx, tz) || 1;
      let n = { x: -tz / len, z: tx / len };
      const side = {
        x: lead.n.x * (1 - t) + target.n.x * t,
        z: lead.n.z * (1 - t) + target.n.z * t,
      };
      if (n.x * side.x + n.z * side.z < 0) n = { x: -n.x, z: -n.z };
      curve.push({
        center: { x: at(p0.x, p1.x, p2.x), z: at(p0.z, p1.z, p2.z) },
        half: lead.half + (target.half - lead.half) * t,
        n,
      });
    }
    const straight = [];
    if (lead.start) {
      const length = Math.hypot(end.x - lead.start.x, end.z - lead.start.z);
      const count = Math.max(2, Math.round(length / 0.006));
      for (let k = 0; k < count; k += 1) {
        const f = k / count;
        straight.push({
          center: {
            x: lead.start.x + (end.x - lead.start.x) * f,
            z: lead.start.z + (end.z - lead.start.z) * f,
          },
          half: lead.half,
          n: lead.n,
        });
      }
    }
    stations.splice(0, j, ...straight, ...curve);
  }
  /* Normal perpendicular al eje (del lado del embalse): sin saltos donde cambia de tramo. */
  const normals = stations.map((station, i) => {
    const a = stations[Math.max(0, i - 1)].center;
    const b = stations[Math.min(stations.length - 1, i + 1)].center;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const n = { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
    return n.x * station.n.x + n.z * station.n.z < 0 ? { x: -n.x, z: -n.z } : n;
  });
  stations.forEach((station, i) => {
    station.n = normals[i];
  });

  const positions = [];
  const colors = [];
  const vertex = (p, tint) => {
    positions.push(...p);
    colors.push(...tint);
  };
  const quad = (a, b, c, d, tint) => {
    for (const p of [a, b, c, a, c, d]) vertex(p, tint);
  };
  /* Perfil de una estación, del pie aguas arriba al pie exterior. */
  const profile = ({ center, half, n }, i) => {
    const at = (s) => ({ x: center.x + n.x * s, z: center.z + n.z * s });
    /* El relieve ya trae el terraplén bajo el eje: el talud baja hasta cortar el terreno. */
    const toe = (sign) => {
      let s = half;
      while (s < EMBANKMENT_MAX_REACH) {
        const p = at(sign * s);
        if (heightAt(p.x, p.z) >= crest - (s - half) / EMBANKMENT_SLOPE) break;
        /* Un camino al pie: el talud termina en su borde, no lo tapa. */
        if (stop?.(p.x, p.z)) break;
        s += 0.002;
      }
      const p = at(sign * s);
      return [p.x, Math.min(heightAt(p.x, p.z), crest) - 0.002, p.z];
    };
    const edge = (sign) => {
      const p = at(sign * half);
      return [p.x, crest, p.z];
    };
    const curb = (sign) => {
      const p = at(sign * half);
      return [p.x, crest + DAM_PARAPET, p.z];
    };
    const jitter = 0.9 + 0.1 * Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1);
    return {
      up: toe(1),
      upEdge: edge(1),
      upCurb: curb(1),
      outEdge: edge(-1),
      outCurb: curb(-1),
      out: toe(-1),
      jitter,
    };
  };
  const tint = (color, j) => color.map((c) => c * j);
  const rows = stations.map(profile);
  /*
   * En las curvas, los pies de estaciones vecinas se cruzan y el talud forma
   * abanicos: se promedia cada pie con sus vecinos y se vuelve a apoyar en el relieve.
   */
  /* ¿El talud de `from` a `to` pasa sobre un camino? */
  const crossesRoad = (from, to) => {
    const steps = Math.ceil(Math.hypot(to[0] - from[0], to[2] - from[2]) / 0.002);
    for (let k = 1; k <= steps; k += 1)
      if (
        stop?.(from[0] + ((to[0] - from[0]) * k) / steps, from[2] + ((to[2] - from[2]) * k) / steps)
      )
        return true;
    return false;
  };
  for (const [key, edge] of [
    ['up', 'upEdge'],
    ['out', 'outEdge'],
  ]) {
    const raw = rows.map((row) => row[key]);
    rows.forEach((row, i) => {
      const near = raw.slice(Math.max(0, i - TOE_SMOOTH), i + TOE_SMOOTH + 1);
      const x = near.reduce((sum, p) => sum + p[0], 0) / near.length;
      const z = near.reduce((sum, p) => sum + p[2], 0) / near.length;
      const toe = [x, Math.min(heightAt(x, z), crest) - 0.002, z];
      if (!crossesRoad(row[edge], toe)) row[key] = toe;
    });
  }
  for (let i = 1; i < rows.length; i += 1) {
    const [a, b] = [rows[i - 1], rows[i]];
    quad(a.up, b.up, b.upEdge, a.upEdge, tint(ROCKFILL, b.jitter));
    quad(a.upEdge, b.upEdge, b.outEdge, a.outEdge, ASPHALT);
    quad(a.outEdge, b.outEdge, b.out, a.out, tint(BANK_GRAVEL, b.jitter));
    quad(a.upEdge, b.upEdge, b.upCurb, a.upCurb, CURB);
    quad(a.outEdge, b.outEdge, b.outCurb, a.outCurb, CURB);
  }
  /* Extremo lejano: la punta del terraplén baja al terreno. */
  const end = rows.at(-1);
  quad(end.up, end.upEdge, end.outEdge, end.out, ROCKFILL);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
