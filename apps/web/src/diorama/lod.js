import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three';
import { metersToY } from './projection.js';

/**
 * Densidades posibles de un bloque del relieve (celdas por vértice), de la
 * más gruesa a la más fina.
 */
export const STEPS = [16, 8, 4, 2, 1];

/**
 * Profundidad del «faldón» vertical en el borde de cada bloque (unidades).
 * Tapa las rendijas entre bloques vecinos de distinta densidad.
 */
export const SKIRT_DEPTH = 0.3;

/*
 * Cuánto se aparta el relieve simplificado del real, por celda omitida
 * (fracción del lado de la celda). Estimación conservadora para la maqueta exagerada.
 */
const ERROR_PER_CELL = 0.6;

/**
 * Divide la grilla de alturas en bloques de `chunksX` × `chunksZ`. Los
 * bloques vecinos comparten su borde (col1 de uno es col0 del siguiente).
 * Cada bloque trae su esfera envolvente en coordenadas de la maqueta.
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint16Array} heights
 * @param {{ width: number, depth: number }} projection
 * @param {[number, number]} chunks
 */
export function chunkGrid(meta, heights, projection, [chunksX, chunksZ]) {
  const { columns, rows } = meta;
  const edges = (count, parts) =>
    Array.from({ length: parts + 1 }, (_, k) => Math.round((k * (count - 1)) / parts));
  const colEdges = edges(columns, chunksX);
  const rowEdges = edges(rows, chunksZ);
  const toX = (col) => (col / (columns - 1) - 0.5) * projection.width;
  const toZ = (row) => (row / (rows - 1) - 0.5) * projection.depth;
  const result = [];
  for (let j = 0; j < chunksZ; j += 1) {
    for (let i = 0; i < chunksX; i += 1) {
      const [col0, col1, row0, row1] = [colEdges[i], colEdges[i + 1], rowEdges[j], rowEdges[j + 1]];
      let min = Infinity;
      let max = -Infinity;
      for (let row = row0; row <= row1; row += 1) {
        for (let col = col0; col <= col1; col += 1) {
          const height = heights[row * columns + col];
          if (height < min) min = height;
          if (height > max) max = height;
        }
      }
      const yMin = metersToY(min) - SKIRT_DEPTH;
      const yMax = metersToY(max);
      const halfW = (toX(col1) - toX(col0)) / 2;
      const halfD = (toZ(row1) - toZ(row0)) / 2;
      result.push({
        index: result.length,
        col0,
        col1,
        row0,
        row1,
        center: [toX(col0) + halfW, (yMin + yMax) / 2, toZ(row0) + halfD],
        radius: Math.hypot(halfW, halfD, (yMax - yMin) / 2),
      });
    }
  }
  return result;
}

/**
 * Densidad que necesita un bloque visto desde la cámara: la más gruesa cuyo
 * error en pantalla no supera `maxErrorPx`, sin bajar de `finestStep`.
 *
 * @param {{ center: number[], radius: number }} chunk
 * @param {number[]} camera Posición [x, y, z] de la cámara.
 * @param {{ projectionScale: number, cellKm: number, finestStep: number, maxErrorPx: number }} view
 *   `projectionScale` = alto de la vista en píxeles / (2 · tan(fov / 2)).
 */
export function chooseStep(chunk, camera, { projectionScale, cellKm, finestStep, maxErrorPx }) {
  const distance = Math.max(
    Math.hypot(
      camera[0] - chunk.center[0],
      camera[1] - chunk.center[1],
      camera[2] - chunk.center[2],
    ) - chunk.radius,
    0.001,
  );
  for (const step of STEPS) {
    if (step < finestStep) break;
    const errorPx = ((step * cellKm * ERROR_PER_CELL) / distance) * projectionScale;
    if (errorPx <= maxErrorPx) return step;
  }
  return finestStep;
}

/**
 * Columnas (o filas) muestreadas entre `start` y `end` cada `step`,
 * incluyendo siempre el borde final.
 */
function samples(start, end, step) {
  const list = [];
  for (let value = start; value < end; value += step) list.push(value);
  list.push(end);
  return list;
}

/**
 * Malla de un bloque del relieve con la densidad `step`, más su faldón: una
 * franja vertical bajo el borde que tapa rendijas con bloques vecinos de
 * otra densidad. Las coordenadas de textura recorren la maqueta completa.
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint16Array} heights
 * @param {{ width: number, depth: number }} projection
 * @param {{ col0: number, col1: number, row0: number, row1: number, center: number[], radius: number }} chunk
 * @param {number} step
 */
export function buildChunk(meta, heights, projection, chunk, step) {
  const { columns, rows } = meta;
  const lastCol = columns - 1;
  const lastRow = rows - 1;
  const cols = samples(chunk.col0, chunk.col1, step);
  const rws = samples(chunk.row0, chunk.row1, step);
  const w = cols.length;
  const h = rws.length;
  const border = 2 * w + 2 * h - 4;
  const count = w * h + border;
  const position = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const put = (k, col, row, dropY = 0) => {
    position[k * 3] = (col / lastCol - 0.5) * projection.width;
    position[k * 3 + 1] = metersToY(heights[row * columns + col]) - dropY;
    position[k * 3 + 2] = (row / lastRow - 0.5) * projection.depth;
    uv[k * 2] = col / lastCol;
    uv[k * 2 + 1] = row / lastRow;
  };
  rws.forEach((row, j) => cols.forEach((col, i) => put(j * w + i, col, row)));

  const index = [];
  for (let j = 0; j < h - 1; j += 1) {
    for (let i = 0; i < w - 1; i += 1) {
      const a = j * w + i;
      const b = a + 1;
      const c = a + w;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }

  /* Recorrido del borde en sentido horario, visto desde arriba. */
  const ring = [
    ...cols.map((_, i) => i),
    ...rws.slice(1).map((_, j) => (j + 1) * w + w - 1),
    ...cols.slice(0, -1).map((_, i) => (h - 1) * w + (w - 2 - i)),
    ...rws.slice(1, -1).map((_, j) => (h - 2 - j) * w),
  ];
  ring.forEach((top, k) => {
    const bottom = w * h + k;
    const col = cols[top % w];
    const row = rws[Math.floor(top / w)];
    put(bottom, col, row, SKIRT_DEPTH);
    const nextTop = ring[(k + 1) % ring.length];
    const nextBottom = w * h + ((k + 1) % ring.length);
    index.push(top, nextTop, bottom, nextTop, nextBottom, bottom);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  geometry.setIndex(new BufferAttribute(new Uint32Array(index), 1));
  geometry.boundingSphere = new Sphere(new Vector3(...chunk.center), chunk.radius);
  return geometry;
}

/**
 * Genera la lista de mallas de bloques para una densidad `step` fija y división `chunks`.
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint16Array} heights
 * @param {{ width: number, depth: number }} projection
 * @param {{ step?: number, chunks?: [number, number] }} [options]
 * @returns {BufferGeometry[]}
 */
export function buildTerrainChunks(meta, heights, projection, { step = 4, chunks = [6, 4] } = {}) {
  const grid = chunkGrid(meta, heights, projection, chunks);
  return grid.map((chunk) => buildChunk(meta, heights, projection, chunk, step));
}
