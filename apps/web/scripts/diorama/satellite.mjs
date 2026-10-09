import sharp from 'sharp';
import { fetchWithRetry, pool } from './fetch.mjs';

/*
 * Sentinel-2 cloudless 2016 de EOX IT Services: mosaico sin nubes de 10 m,
 * licencia CC BY 4.0 (uso comercial permitido citando la fuente). Las
 * versiones de años posteriores son CC BY-NC-SA: no usarlas.
 */
const TILE_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';
const TILE_SIZE = 256;

/**
 * Píxel global en Web Mercator al zoom `z`.
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
 * Descarga y compone el mosaico satelital (Sentinel-2 cloudless 2016, EOX)
 * para los límites indicados, recortado y escalado a columns × rows en formato RGB plano.
 *
 * @param {{ west: number, south: number, east: number, north: number }} bounds
 * @param {{ columns: number, rows: number, zoom?: number }} options
 * @returns {Promise<Uint8Array>}
 */
export async function buildSatelliteTexture(bounds, { columns, rows, zoom = 12 }) {
  const topLeft = pixelXY(bounds.west, bounds.north, zoom);
  const bottomRight = pixelXY(bounds.east, bounds.south, zoom);
  const x0 = Math.floor(topLeft.x / TILE_SIZE);
  const y0 = Math.floor(topLeft.y / TILE_SIZE);
  const x1 = Math.floor(bottomRight.x / TILE_SIZE);
  const y1 = Math.floor(bottomRight.y / TILE_SIZE);

  const tilesWide = x1 - x0 + 1;
  const tilesHigh = y1 - y0 + 1;
  const mosaicWidth = tilesWide * TILE_SIZE;
  const mosaicHeight = tilesHigh * TILE_SIZE;
  const mosaic = new Uint8Array(mosaicWidth * mosaicHeight * 3);

  const jobs = [];
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      jobs.push([tx, ty]);
    }
  }

  let completed = 0;
  await pool(jobs, 16, async ([tx, ty]) => {
    const url = TILE_URL.replace('{z}', zoom).replace('{x}', tx).replace('{y}', ty);
    const response = await fetchWithRetry(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });

    const tileLeft = (tx - x0) * TILE_SIZE;
    const tileTop = (ty - y0) * TILE_SIZE;

    for (let py = 0; py < info.height; py += 1) {
      const srcOffset = py * info.width * 3;
      const dstOffset = ((tileTop + py) * mosaicWidth + tileLeft) * 3;
      mosaic.set(data.subarray(srcOffset, srcOffset + info.width * 3), dstOffset);
    }
    completed += 1;
    if (completed % 50 === 0 || completed === jobs.length) {
      process.stdout.write(`\r  teselas satelitales: ${completed}/${jobs.length}`);
    }
  });
  console.log('');

  const cropX = Math.max(0, Math.round(topLeft.x - x0 * TILE_SIZE));
  const cropY = Math.max(0, Math.round(topLeft.y - y0 * TILE_SIZE));
  const cropW = Math.min(mosaicWidth - cropX, Math.round(bottomRight.x - topLeft.x));
  const cropH = Math.min(mosaicHeight - cropY, Math.round(bottomRight.y - topLeft.y));

  const resized = await sharp(Buffer.from(mosaic.buffer), {
    raw: { width: mosaicWidth, height: mosaicHeight, channels: 3 },
  })
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .resize(columns, rows, { fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer();

  return new Uint8Array(resized);
}
