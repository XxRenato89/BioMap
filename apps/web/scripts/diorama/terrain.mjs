import fs from 'node:fs';
import path from 'node:path';
import { fromArrayBuffer } from 'geotiff';
import { PNG } from 'pngjs';
import { decodeElevation } from '../../src/diorama/terrain/elevation.js';
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
 * Relieve de la maqueta:
 * 1. Si existe un archivo DEM local en `data/sources/` (GeoTIFF de alta resolución),
 *    lo lee y remuestrea directamente con geotiff.
 * 2. Si no, intenta descargar las teselas Terrarium (SRTM 30m) desde AWS.
 * 3. Si no hay conexión (offline), reutiliza el relieve preexistente en `public/diorama/`.
 *
 * @param {{ west: number, south: number, east: number, north: number }} bounds
 * @param {{ columns: number, rows: number, zoom: number, name?: string }} grid
 */
export async function buildTerrain(bounds, { columns, rows, zoom, name = 'zona' }) {
  /* 1. Comprobar fuentes DEM locales de alta resolución */
  const localCandidates =
    name === 'contexto'
      ? ['data/sources/dem_contexto.tif', 'data/sources/dem.tif']
      : ['data/sources/dem_zona.tif', 'data/sources/dem.tif', 'src/data/dem.tif'];

  for (const cand of localCandidates) {
    const fullPath = path.resolve(cand);
    if (fs.existsSync(fullPath)) {
      console.log(`  usando DEM local de alta resolución: ${path.basename(fullPath)}`);
      try {
        const buffer = fs.readFileSync(fullPath);
        const tiff = await fromArrayBuffer(buffer.buffer);
        const [band] = await tiff.readRasters({
          bbox: [bounds.west, bounds.south, bounds.east, bounds.north],
          width: columns,
          height: rows,
          resampleMethod: 'bilinear',
        });
        const heights = new Uint16Array(columns * rows);
        let min = Infinity;
        let max = -Infinity;
        for (let k = 0; k < band.length; k += 1) {
          const val = Math.max(0, Math.round(band[k] || 0));
          heights[k] = val;
          if (val < min) min = val;
          if (val > max) max = val;
        }
        return { heights, min, max, tiles: 0, source: 'local-geotiff' };
      } catch (err) {
        console.warn(
          `  error leyendo ${cand} (${err.message}), continuando con siguiente opción...`,
        );
      }
    }
  }

  /* 2. Descarga de teselas Terrarium si hay conexión */
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

  try {
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
    return { heights, min, max, tiles: jobs.length, source: 'terrarium' };
  } catch (netErr) {
    /* 3. Fallback local offline si no hay internet */
    const cachedBin = path.resolve(
      name === 'contexto' ? 'public/diorama/context.bin' : 'public/diorama/terrain.bin',
    );
    if (fs.existsSync(cachedBin)) {
      console.log(
        `  aviso: sin conexión a Terrarium (${netErr.message}), usando relieve local en ${path.basename(cachedBin)}`,
      );
      const buf = fs.readFileSync(cachedBin);
      const heights = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
      let min = Infinity;
      let max = -Infinity;
      for (const h of heights) {
        if (h < min) min = h;
        if (h > max) max = h;
      }
      return { heights, min, max, tiles: 0, source: 'local-cache' };
    }
    throw netErr;
  }
}
