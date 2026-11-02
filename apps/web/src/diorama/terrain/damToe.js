/*
 * El relieve (30 m por píxel) rellena el cañón junto al muro de Angostura y
 * tapa el pie del vertedero. Se talla una franja aguas abajo del vertedero
 * hasta el fondo del cauce, con bordes en rampa; bajo la presa de grava el
 * relieve queda como está (por ahí pasa la ruta). La planta de OSM es más ancha
 * que el cuerpo del muro, así que se talla desde su cara aguas arriba.
 */
const TOE_KM = 0.14;
const SIDE_MARGIN_KM = 0.02;
const RAMP_KM = 0.04;
/* Zona sin árboles alrededor de la presa (km aguas abajo de su cara). */
const CLEAR_KM = 0.2;

const smooth = (x) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Peso (0 a 1) de una franja aguas abajo del muro, en [lng, lat]. La franja
 * cubre la parte `share` del largo del muro desde su primer punto, y llega
 * `toe` km aguas abajo de la cara; sus bordes bajan en rampa.
 *
 * @param {number[][]} line Planta del muro [lng, lat].
 * @param {number[]} upstream Un punto [lng, lat] del embalse.
 * @param {{ share?: number, toe?: number }} [options]
 * @returns {(lng: number, lat: number) => number}
 */
export function damToeZone(line, upstream, { share = 1, toe = TOE_KM } = {}) {
  const kx = 111.32 * Math.cos((line[0][1] * Math.PI) / 180);
  const ky = 110.57;
  const km = ([lng, lat]) => ({ x: lng * kx, y: lat * ky });

  const points = line.map(km);
  const a = points[0];
  const far = points.reduce((best, p) =>
    Math.hypot(p.x - a.x, p.y - a.y) > Math.hypot(best.x - a.x, best.y - a.y) ? p : best,
  );
  const span = Math.hypot(far.x - a.x, far.y - a.y);
  const d = { x: (far.x - a.x) / span, y: (far.y - a.y) / span };
  let u = { x: d.y, y: -d.x };
  const up = km(upstream);
  if ((up.x - a.x) * u.x + (up.y - a.y) * u.y < 0) u = { x: -u.x, y: -u.y };
  const along = points.map((p) => (p.x - a.x) * d.x + (p.y - a.y) * d.y);
  const across = points.map((p) => (p.x - a.x) * u.x + (p.y - a.y) * u.y);
  const start = Math.min(...along);
  const t0 = start + SIDE_MARGIN_KM;
  const t1 = start + (Math.max(...along) - start) * share - SIDE_MARGIN_KM;
  const face = Math.max(...across);

  return (lng, lat) => {
    const p = km([lng, lat]);
    const t = (p.x - a.x) * d.x + (p.y - a.y) * d.y;
    const s = face - ((p.x - a.x) * u.x + (p.y - a.y) * u.y);
    if (s < 0) return 0;
    const side = Math.min(t - t0, t1 - t);
    return smooth(1 + side / RAMP_KM) * smooth(1 + (toe - s) / RAMP_KM);
  };
}

/**
 * Celdas del mapa de alturas cercanas al muro con su peso en `zone`.
 */
function zoneCells(meta, line, zone) {
  const { west, south, east, north } = meta.bounds;
  const { columns, rows } = meta;
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    const lat = north - (r / (rows - 1)) * (north - south);
    /* Descarte rápido: lejos del muro no hay nada que revisar. */
    if (Math.abs(lat - line[0][1]) > 0.01) continue;
    for (let c = 0; c < columns; c += 1) {
      const lng = west + (c / (columns - 1)) * (east - west);
      if (Math.abs(lng - line[0][0]) > 0.01) continue;
      const w = zone(lng, lat);
      if (w > 0) cells.push([r * columns + c, w]);
    }
  }
  return cells;
}

/**
 * Baja el relieve aguas abajo del vertedero (la parte `share` del muro desde
 * su primer punto).
 *
 * @param {{ bounds: { west: number, south: number, east: number, north: number }, columns: number, rows: number }} meta
 * @param {Uint16Array} heights Alturas en metros (se modifican).
 * @param {number[][]} line Planta del muro [lng, lat].
 * @param {number[]} upstream Un punto [lng, lat] del embalse.
 * @param {number} [share=1]
 */
export function carveDamToe(meta, heights, line, upstream, share = 1) {
  const cells = zoneCells(meta, line, damToeZone(line, upstream, { share }));
  if (cells.length === 0) return;
  const floor = Math.min(...cells.filter(([, w]) => w >= 1).map(([i]) => heights[i]));
  for (const [i, w] of cells)
    heights[i] = Math.round(heights[i] + (Math.min(floor, heights[i]) - heights[i]) * w);
}

/**
 * Celdas donde no se plantan árboles: todo el pie de la presa.
 *
 * @returns {Set<number>}
 */
export function damClearing(meta, line, upstream) {
  const cells = zoneCells(meta, line, damToeZone(line, upstream, { toe: CLEAR_KM }));
  return new Set(cells.map(([i]) => i));
}

/**
 * Celdas a menos de `radius` km de una polilínea [lng, lat] (para dejarlas sin árboles).
 *
 * @returns {Set<number>}
 */
export function cellsNear(meta, line, radius) {
  const { west, south, east, north } = meta.bounds;
  const { columns, rows } = meta;
  const kx = 111.32 * Math.cos((line[0][1] * Math.PI) / 180);
  const ky = 110.57;
  const pts = line.map(([lng, lat]) => ({ x: lng * kx, y: lat * ky }));
  const distance = (p) =>
    Math.min(
      ...pts.slice(1).map((b, k) => {
        const a = pts[k];
        const [dx, dy] = [b.x - a.x, b.y - a.y];
        const t = Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
        );
        return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
      }),
    );
  const cells = new Set();
  for (let r = 0; r < rows; r += 1) {
    const lat = north - (r / (rows - 1)) * (north - south);
    if (Math.abs(lat - line[0][1]) > 0.01) continue;
    for (let c = 0; c < columns; c += 1) {
      const lng = west + (c / (columns - 1)) * (east - west);
      if (Math.abs(lng - line[0][0]) > 0.01) continue;
      if (distance({ x: lng * kx, y: lat * ky }) <= radius) cells.add(r * columns + c);
    }
  }
  return cells;
}

/**
 * Marca como agua (en el mapa de orillas) las celdas dentro de un polígono
 * [lng, lat]: así el relieve se hunde bajo un espejo de agua agregado a mano.
 *
 * @param {Uint8Array} shore Se modifica.
 * @param {number[][]} polygon
 * @param {number} [value=20] Distancia a la orilla que se asigna (celdas).
 */
export function markWater(meta, shore, polygon, value = 20) {
  const { west, south, east, north } = meta.bounds;
  const { columns, rows } = meta;
  const inside = (lng, lat) => {
    let hit = false;
    for (let k = 0, j = polygon.length - 1; k < polygon.length; j = k, k += 1) {
      const [xi, yi] = polygon[k];
      const [xj, yj] = polygon[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const lngs = polygon.map(([lng]) => lng);
  const lats = polygon.map(([, lat]) => lat);
  for (let r = 0; r < rows; r += 1) {
    const lat = north - (r / (rows - 1)) * (north - south);
    if (lat < Math.min(...lats) || lat > Math.max(...lats)) continue;
    for (let c = 0; c < columns; c += 1) {
      const lng = west + (c / (columns - 1)) * (east - west);
      if (lng < Math.min(...lngs) || lng > Math.max(...lngs) || !inside(lng, lat)) continue;
      const i = r * columns + c;
      shore[i] = Math.max(shore[i], value);
    }
  }
}

/* Banco del camino: medio ancho plano y rampa hasta el relieve (km). */
const BENCH_KM = 0.012;
const BENCH_RAMP_KM = 0.025;

/**
 * Suaviza el relieve a lo largo de un camino: una terraza que baja con
 * pendiente pareja de su primer a su último punto, con bordes en rampa.
 * El relieve de 30 m deja la ladera dentada bajo el camino.
 *
 * @param {Uint16Array} heights Alturas en metros (se modifican).
 * @param {number[][]} line [lng, lat]
 */
export function benchRoad(meta, heights, line) {
  const { west, south, east, north } = meta.bounds;
  const { columns, rows } = meta;
  const kx = 111.32 * Math.cos((line[0][1] * Math.PI) / 180);
  const ky = 110.57;
  const cellOf = ([lng, lat]) =>
    Math.round(((north - lat) / (north - south)) * (rows - 1)) * columns +
    Math.round(((lng - west) / (east - west)) * (columns - 1));
  const [h0, h1] = [heights[cellOf(line[0])], heights[cellOf(line.at(-1))]];
  const pts = line.map(([lng, lat]) => ({ x: lng * kx, y: lat * ky }));
  const lengths = [0];
  for (let k = 1; k < pts.length; k += 1)
    lengths.push(lengths[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
  const total = lengths.at(-1);
  /* Distancia al camino y avance (0 a 1) del punto más cercano. */
  const nearest = (p) => {
    let best = { d: Infinity, f: 0 };
    for (let k = 1; k < pts.length; k += 1) {
      const [a, b] = [pts[k - 1], pts[k]];
      const [dx, dy] = [b.x - a.x, b.y - a.y];
      const len = Math.hypot(dx, dy) || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len)));
      const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
      if (d < best.d) best = { d, f: (lengths[k - 1] + t * len) / total };
    }
    return best;
  };
  const reach = BENCH_KM + BENCH_RAMP_KM;
  for (let r = 0; r < rows; r += 1) {
    const lat = north - (r / (rows - 1)) * (north - south);
    if (Math.abs(lat - line[0][1]) > 0.01) continue;
    for (let c = 0; c < columns; c += 1) {
      const lng = west + (c / (columns - 1)) * (east - west);
      if (Math.abs(lng - line[0][0]) > 0.01) continue;
      const { d, f } = nearest({ x: lng * kx, y: lat * ky });
      if (d > reach) continue;
      const i = r * columns + c;
      const w = smooth((reach - d) / BENCH_RAMP_KM);
      heights[i] = Math.round(heights[i] + (h0 + (h1 - h0) * f - heights[i]) * w);
    }
  }
}
