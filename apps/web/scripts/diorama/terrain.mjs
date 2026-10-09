import { PNG } from 'pngjs';
import { decodeElevation } from '../../src/diorama/elevation.js';
import { fetchWithRetry, pool } from './fetch.mjs';

const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const TILE_SIZE = 256;

/**
 * Píxel global (con fracción) de un punto en Web Mercator al zoom `z`.
 */
function pixelXY(lng, lat, z) {
  const n = 2 ** z * TILE_SIZE;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

/**
 * Relieve de la maqueta: descarga las teselas Terrarium (SRTM y otros) que
 * cubren los límites, las une en un mosaico en memoria y lo muestrea con
 * interpolación bilineal en una grilla de `columns` columnas (filas de norte
 * a sur, alturas en metros enteros).
 *
 * @param {{ west: number, south: number, east: number, north: number }} bounds
 * @param {{ columns: number, rows: number, zoom: number }} grid
 */
export async function buildTerrain(bounds, { columns, rows, zoom }) {
  const topLeft = pixelXY(bounds.west, bounds.north, zoom);
  const bottomRight = pixelXY(bounds.east, bounds.south, zoom);
  const x0 = Math.floor(topLeft.x / TILE_SIZE);
  const y0 = Math.floor(topLeft.y / TILE_SIZE);
  const x1 = Math.floor(bottomRight.x / TILE_SIZE);
  const y1 = Math.floor(bottomRight.y / TILE_SIZE);
  const tilesWide = x1 - x0 + 1;
  const tilesHigh = y1 - y0 + 1;
  const mosaicWidth = tilesWide * TILE_SIZE;
  const mosaic = new Float32Array(mosaicWidth * tilesHigh * TILE_SIZE);

  const jobs = [];
  for (let ty = y0; ty <= y1; ty += 1) for (let tx = x0; tx <= x1; tx += 1) jobs.push([tx, ty]);
  let done = 0;
  await pool(jobs, 12, async ([tx, ty]) => {
    const url = TILE_URL.replace('{z}', zoom).replace('{x}', tx).replace('{y}', ty);
    const response = await fetchWithRetry(url);
    const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
    for (let py = 0; py < TILE_SIZE; py += 1) {
      for (let px = 0; px < TILE_SIZE; px += 1) {
        const i = (py * png.width + px) * 4;
        const mx = (tx - x0) * TILE_SIZE + px;
        const my = (ty - y0) * TILE_SIZE + py;
        mosaic[my * mosaicWidth + mx] = decodeElevation(
          png.data[i],
          png.data[i + 1],
          png.data[i + 2],
          'terrarium',
        );
      }
    }
    done += 1;
    if (done % 100 === 0) console.log(`  teselas de relieve ${done}/${jobs.length}`);
  });

  const mosaicHeight = tilesHigh * TILE_SIZE;
  const at = (x, y) =>
    mosaic[
      Math.min(Math.max(y, 0), mosaicHeight - 1) * mosaicWidth +
        Math.min(Math.max(x, 0), mosaicWidth - 1)
    ];
  const heights = new Uint16Array(columns * rows);
  let min = Infinity;
  let max = -Infinity;
  for (let row = 0; row < rows; row += 1) {
    const lat = bounds.north - (row / (rows - 1)) * (bounds.north - bounds.south);
    for (let col = 0; col < columns; col += 1) {
      const lng = bounds.west + (col / (columns - 1)) * (bounds.east - bounds.west);
      const { x, y } = pixelXY(lng, lat, zoom);
      const fx = x - x0 * TILE_SIZE - 0.5;
      const fy = y - y0 * TILE_SIZE - 0.5;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const top = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
      const bottom = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
      const height = Math.max(0, Math.round(top * (1 - ty) + bottom * ty));
      heights[row * columns + col] = height;
      min = Math.min(min, height);
      max = Math.max(max, height);
    }
  }
  return { heights, min, max, tiles: jobs.length };
}
