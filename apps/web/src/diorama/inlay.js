/*
 * Agua «incrustada» en el relieve, como en las maquetas impresas: el relieve
 * SRTM es del año 2000, anterior al embalse Angostura, y bajo el agua muestra
 * el cañón seco. Estas funciones (puras, corren en el build) calculan el nivel
 * del agua en cada punto de la orilla y rebajan el fondo y ajustan las
 * orillas para que el agua calce justo con el terreno.
 */

const KM_PER_DEGREE = 111.32;

/**
 * Agrega puntos a un anillo [lng, lat] para que ningún tramo mida más de
 * `maxKm`. El anillo queda cerrado (el último punto repite el primero).
 *
 * @param {number[][]} ring
 * @param {number} maxKm
 */
export function densifyRing(ring, maxKm) {
  const kmX = KM_PER_DEGREE * Math.cos((ring[0][1] * Math.PI) / 180);
  const dense = [ring[0]];
  for (let k = 1; k < ring.length; k += 1) {
    const [a, b] = [ring[k - 1], ring[k]];
    const length = Math.hypot((b[0] - a[0]) * kmX, (b[1] - a[1]) * KM_PER_DEGREE);
    const parts = Math.max(1, Math.ceil(length / maxKm));
    for (let p = 1; p <= parts; p += 1)
      dense.push([a[0] + ((b[0] - a[0]) * p) / parts, a[1] + ((b[1] - a[1]) * p) / parts]);
  }
  return dense;
}

/**
 * Nivel del agua (m) en cada punto de la orilla: un valor bajo (`quantile`)
 * de las alturas de los `neighbors` puntos de orilla más cercanos. Así el
 * embalse queda plano y el río baja con su cauce, y las orillas mal
 * dibujadas por el relieve grueso no levantan el agua.
 *
 * @param {number[][]} points Puntos [lng, lat] de todas las orillas del polígono.
 * @param {(point: number[]) => number} heightOf Altura del terreno (m).
 * @param {{ neighbors?: number, quantile?: number }} [options]
 * @returns {number[]}
 */
export function shoreLevels(points, heightOf, { neighbors = 48, quantile = 0.15 } = {}) {
  const kmX = KM_PER_DEGREE * Math.cos((points[0][1] * Math.PI) / 180);
  const xy = points.map(([lng, lat]) => [lng * kmX, lat * KM_PER_DEGREE]);
  const heights = points.map(heightOf);
  const k = Math.min(neighbors, points.length);
  return xy.map(([x, y]) => {
    const nearest = xy
      .map(([px, py], index) => [(px - x) ** 2 + (py - y) ** 2, heights[index]])
      .sort((a, b) => a[0] - b[0])
      .slice(0, k)
      .map(([, height]) => height)
      .sort((a, b) => a - b);
    return nearest[Math.floor(quantile * (nearest.length - 1))];
  });
}

/**
 * Columnas de la fila (por su latitud) que caen dentro del polígono (regla
 * par-impar con todos sus anillos), como tramos [desde, hasta].
 */
function rowSpans(rings, lat, toCol) {
  const crossings = [];
  for (const ring of rings) {
    for (let k = 1; k < ring.length; k += 1) {
      const [a, b] = [ring[k - 1], ring[k]];
      if (a[1] > lat === b[1] > lat) continue;
      const t = (lat - a[1]) / (b[1] - a[1]);
      crossings.push(toCol(a[0] + (b[0] - a[0]) * t));
    }
  }
  crossings.sort((a, b) => a - b);
  const spans = [];
  for (let k = 0; k + 1 < crossings.length; k += 2)
    spans.push([Math.ceil(crossings[k]), Math.floor(crossings[k + 1])]);
  return spans;
}

/**
 * Rebaja el terreno bajo el agua y ajusta las orillas, en la grilla de
 * alturas (la modifica). Cada polígono trae sus anillos densificados con el
 * nivel de cada punto: [lng, lat, nivel]. En cada celda bajo el agua el
 * nivel es el promedio (por cercanía) de los cuatro puntos de orilla más
 * cercanos; el terreno queda `carve` m bajo él: el agua es una capa casi a
 * ras. Las celdas de tierra junto al agua quedan `bank` m sobre ese nivel y,
 * hasta `bankCells` celdas tierra adentro, suben en rampa hasta el terreno
 * (sin escalones que se vean como paredes oscuras).
 *
 * @param {{ bounds: { west: number, south: number, east: number, north: number },
 *   columns: number, rows: number }} grid
 * @param {Uint16Array} heights
 * @param {Array<{ outer: number[][], holes: number[][][] }>} polygons
 * @param {{ carve?: number, bank?: number, bankCells?: number }} [options]
 * @returns {{ carved: number, mask: Uint8Array }} Celdas rebajadas y máscara de agua (1 = agua).
 */
export function inlayWater(grid, heights, polygons, { carve = 1, bank = 1, bankCells = 4 } = {}) {
  const { bounds, columns, rows } = grid;
  const toCol = (lng) => ((lng - bounds.west) / (bounds.east - bounds.west)) * (columns - 1);
  const toRow = (lat) => ((bounds.north - lat) / (bounds.north - bounds.south)) * (rows - 1);
  const latOf = (row) => bounds.north - (row / (rows - 1)) * (bounds.north - bounds.south);
  const levels = new Float32Array(columns * rows).fill(Number.NaN);

  for (const { outer, holes } of polygons) {
    const rings = [outer, ...holes];
    const shore = rings.flat().map(([lng, lat, level]) => [toCol(lng), toRow(lat), level]);
    const rowsOf = outer.map(([, lat]) => toRow(lat));
    const r0 = Math.max(0, Math.floor(Math.min(...rowsOf)));
    const r1 = Math.min(rows - 1, Math.ceil(Math.max(...rowsOf)));
    /* Nivel por cercanía, calculado cada 4 celdas y reutilizado (es lo caro). */
    const cache = new Map();
    const levelAt = (col, row) => {
      const key = (row >> 2) * 65536 + (col >> 2);
      if (!cache.has(key)) {
        const cx = (col >> 2) * 4 + 2;
        const cy = (row >> 2) * 4 + 2;
        const nearest = [];
        for (const [x, y, level] of shore) {
          const d = (x - cx) ** 2 + (y - cy) ** 2;
          if (nearest.length < 4 || d < nearest[3][0]) {
            nearest.push([d, level]);
            nearest.sort((a, b) => a[0] - b[0]);
            if (nearest.length > 4) nearest.pop();
          }
        }
        let sum = 0;
        let weight = 0;
        for (const [d, level] of nearest) {
          const w = 1 / (d + 1);
          sum += level * w;
          weight += w;
        }
        cache.set(key, sum / weight);
      }
      return cache.get(key);
    };
    for (let row = r0; row <= r1; row += 1) {
      for (const [c0, c1] of rowSpans(rings, latOf(row), toCol)) {
        for (let col = Math.max(0, c0); col <= Math.min(columns - 1, c1); col += 1)
          levels[row * columns + col] = levelAt(col, row);
      }
    }
  }

  const mask = new Uint8Array(columns * rows);
  let carved = 0;
  for (let i = 0; i < levels.length; i += 1) {
    if (Number.isNaN(levels[i])) continue;
    heights[i] = Math.max(0, Math.min(heights[i], Math.round(levels[i] - carve)));
    mask[i] = 1;
    carved += 1;
  }
  /* Orillas en rampa: junto al agua, `bank` m sobre ella; hacia tierra, se funden con el terreno. */
  const original = heights.slice();
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const level = levels[row * columns + col];
      if (Number.isNaN(level)) continue;
      const target = level + bank;
      for (let dr = -bankCells; dr <= bankCells; dr += 1) {
        for (let dc = -bankCells; dc <= bankCells; dc += 1) {
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || c < 0 || r >= rows || c >= columns) continue;
          const j = r * columns + c;
          const d = Math.hypot(dr, dc);
          if (mask[j] || d > bankCells || original[j] >= target) continue;
          const ramp = Math.max(d - 1, 0) / bankCells;
          heights[j] = Math.max(heights[j], Math.round(target - (target - original[j]) * ramp));
        }
      }
    }
  }
  return { carved, mask };
}

/**
 * Distancia (m) de cada celda de agua a la orilla más cercana, hasta 255 m
 * (0 en tierra). El agua la usa para su color (turquesa junto a la orilla,
 * azul profundo al centro) y su espuma, sin mirar el fondo.
 *
 * @param {Uint8Array} mask 1 = agua (de `inlayWater`).
 * @param {number} columns
 * @param {number} rows
 * @param {number} cellMeters Lado de una celda (m).
 */
export function shoreDistance(mask, columns, rows, cellMeters) {
  const far = 1e9;
  const distance = new Float32Array(columns * rows);
  for (let i = 0; i < mask.length; i += 1) distance[i] = mask[i] ? far : 0;
  const diagonal = Math.SQRT2;
  const relax = (i, j, step) => {
    if (distance[j] + step < distance[i]) distance[i] = distance[j] + step;
  };
  for (let row = 0; row < rows; row += 1)
    for (let col = 0; col < columns; col += 1) {
      const i = row * columns + col;
      if (!mask[i]) continue;
      if (col > 0) relax(i, i - 1, 1);
      if (row > 0) {
        relax(i, i - columns, 1);
        if (col > 0) relax(i, i - columns - 1, diagonal);
        if (col < columns - 1) relax(i, i - columns + 1, diagonal);
      }
    }
  for (let row = rows - 1; row >= 0; row -= 1)
    for (let col = columns - 1; col >= 0; col -= 1) {
      const i = row * columns + col;
      if (!mask[i]) continue;
      if (col < columns - 1) relax(i, i + 1, 1);
      if (row < rows - 1) {
        relax(i, i + columns, 1);
        if (col < columns - 1) relax(i, i + columns + 1, diagonal);
        if (col > 0) relax(i, i + columns - 1, diagonal);
      }
    }
  const meters = new Uint8Array(columns * rows);
  for (let i = 0; i < distance.length; i += 1)
    meters[i] = mask[i] ? Math.min(255, Math.round(distance[i] * cellMeters)) : 0;
  return meters;
}
