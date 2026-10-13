import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fetchWithRetry, pool } from './fetch.mjs';

/*
 * Sentinel-2 cloudless 2016 de EOX IT Services: mosaico sin nubes de 10 m,
 * licencia CC BY 4.0 (uso comercial permitido citando la fuente).
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
 * Fotografía satelital o aérea de la maqueta:
 * 1. Si existe una ortofoto local en `data/sources/` (ej. SAF FACh, dron, mosaico sub-métrico),
 *    la recorta y escala con sharp sin depender de internet.
 * 2. Si no, descarga el mosaico satelital (Sentinel-2 cloudless / EOX).
 * 3. Si no hay conexión (offline), reutiliza la textura previa de `public/diorama/`.
 *
 * @param {{ west: number, south: number, east: number, north: number }} bounds
 * @param {{ columns: number, rows: number, zoom?: number, name?: string }} options
 * @returns {Promise<Uint8Array>}
 */
export async function buildSatelliteTexture(bounds, { columns, rows, zoom = 12, name = 'zona' }) {
  /* 1. Comprobar fuentes de imagen / ortofoto locales de alta resolución */
  const localCandidates =
    name === 'contexto'
      ? [
          'data/sources/surface_contexto.png',
          'data/sources/surface_contexto.webp',
          'data/sources/surface_contexto.jpg',
          'data/sources/surface_contexto.tif',
        ]
      : [
          'data/sources/surface_zona.png',
          'data/sources/surface_zona.webp',
          'data/sources/surface_zona.jpg',
          'data/sources/surface_zona.tif',
          'data/sources/surface.png',
          'data/sources/surface.webp',
          'data/sources/surface.jpg',
        ];

  for (const cand of localCandidates) {
    const fullPath = path.resolve(cand);
    if (fs.existsSync(fullPath)) {
      console.log(`  usando ortofoto/imagen local: ${path.basename(fullPath)}`);
      try {
        const resized = await sharp(fullPath)
          .resize(columns, rows, { fit: 'fill', kernel: 'lanczos3' })
          .raw()
          .toBuffer();
        return new Uint8Array(resized);
      } catch (err) {
        console.warn(
          `  error leyendo ${cand} (${err.message}), continuando con siguiente opción...`,
        );
      }
    }
  }

  /* 2. Descarga de teselas satelitales si hay conexión */
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

  try {
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
  } catch (netErr) {
    /* 3. Fallback local offline si no hay internet */
    const cachedWebp = path.resolve(
      name === 'contexto' ? 'public/diorama/context.webp' : 'public/diorama/surface.webp',
    );
    if (fs.existsSync(cachedWebp)) {
      console.log(
        `\n  aviso: sin conexión a satélite (${netErr.message}), usando textura local en ${path.basename(cachedWebp)}`,
      );
      const { data } = await sharp(cachedWebp)
        .resize(columns, rows, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      return new Uint8Array(data);
    }
    throw netErr;
  }
}
