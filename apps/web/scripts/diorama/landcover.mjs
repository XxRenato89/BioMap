import fs from 'node:fs';
import path from 'node:path';
import { fromArrayBuffer, fromUrl } from 'geotiff';
import { reclassify } from '../../src/diorama/terrain/landcover.js';
import { USER_AGENT } from './fetch.mjs';

const TILE_URL =
  'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif';

/**
 * Nombre de la tesela WorldCover de 3° × 3° cuya esquina suroeste es (lng, lat).
 */
function tileName(lng, lat) {
  const ns = lat < 0 ? 'S' : 'N';
  const ew = lng < 0 ? 'W' : 'E';
  return `${ns}${String(Math.abs(lat)).padStart(2, '0')}${ew}${String(Math.abs(lng)).padStart(3, '0')}`;
}

/**
 * Cobertura de suelo de la maqueta:
 * 1. Si existe un GeoTIFF local en `data/sources/` (ej. Catastro CONAF rasterizado), lo lee.
 * 2. Si no, lee de ESA WorldCover 2021 (10 m, CC BY 4.0) por rangos de nube.
 * 3. Si no hay conexión (offline), reutiliza la cobertura local en `public/diorama/`.
 *
 * @param {{ west: number, south: number, east: number, north: number }} bounds
 * @param {{ columns: number, rows: number, name?: string }} grid
 * @returns {Promise<Uint8Array>} Una clase por celda (ver landcover.js), filas de norte a sur.
 */
export async function buildLandcover(bounds, { columns, rows, name = 'zona' }) {
  /* 1. Comprobar fuentes de cobertura locales */
  const localCandidates =
    name === 'contexto'
      ? ['data/sources/landcover_contexto.tif', 'data/sources/landcover.tif']
      : ['data/sources/landcover_zona.tif', 'data/sources/landcover.tif'];

  for (const cand of localCandidates) {
    const fullPath = path.resolve(cand);
    if (fs.existsSync(fullPath)) {
      console.log(`  usando cobertura local: ${path.basename(fullPath)}`);
      try {
        const buffer = fs.readFileSync(fullPath);
        const tiff = await fromArrayBuffer(buffer.buffer);
        const [band] = await tiff.readRasters({
          bbox: [bounds.west, bounds.south, bounds.east, bounds.north],
          width: columns,
          height: rows,
          resampleMethod: 'nearest',
        });
        const data = new Uint8Array(columns * rows);
        for (let k = 0; k < band.length; k += 1) {
          data[k] = reclassify(band[k]);
        }
        return data;
      } catch (err) {
        console.warn(
          `  error leyendo ${cand} (${err.message}), continuando con siguiente opción...`,
        );
      }
    }
  }

  /* 2. Descarga de teselas ESA WorldCover si hay conexión */
  const data = new Uint8Array(columns * rows);
  const spanLng = bounds.east - bounds.west;
  const spanLat = bounds.north - bounds.south;

  try {
    for (let lng = Math.floor(bounds.west / 3) * 3; lng < bounds.east; lng += 3) {
      for (let lat = Math.floor(bounds.south / 3) * 3; lat < bounds.north; lat += 3) {
        const part = {
          west: Math.max(bounds.west, lng),
          east: Math.min(bounds.east, lng + 3),
          south: Math.max(bounds.south, lat),
          north: Math.min(bounds.north, lat + 3),
        };
        const c0 = Math.round(((part.west - bounds.west) / spanLng) * columns);
        const c1 = Math.round(((part.east - bounds.west) / spanLng) * columns);
        const r0 = Math.round(((bounds.north - part.north) / spanLat) * rows);
        const r1 = Math.round(((bounds.north - part.south) / spanLat) * rows);
        if (c1 <= c0 || r1 <= r0) continue;
        const tile = tileName(lng, lat);
        console.log(`  cobertura ${tile}: ${c1 - c0}×${r1 - r0}`);
        const tiff = await fromUrl(TILE_URL.replace('{tile}', tile), {
          headers: { 'User-Agent': USER_AGENT },
        });
        const [band] = await tiff.readRasters({
          bbox: [part.west, part.south, part.east, part.north],
          width: c1 - c0,
          height: r1 - r0,
          resampleMethod: 'nearest',
        });
        for (let r = 0; r < r1 - r0; r += 1)
          for (let c = 0; c < c1 - c0; c += 1)
            data[(r0 + r) * columns + c0 + c] = reclassify(band[r * (c1 - c0) + c]);
      }
    }
    return data;
  } catch (netErr) {
    /* 3. Fallback local offline si no hay internet */
    const cachedLandcover = path.resolve(
      name === 'contexto' ? 'public/diorama/context-landcover.bin' : 'public/diorama/landcover.bin',
    );
    if (fs.existsSync(cachedLandcover)) {
      console.log(
        `  aviso: sin conexión a WorldCover (${netErr.message}), usando cobertura local en ${path.basename(cachedLandcover)}`,
      );
      const buf = fs.readFileSync(cachedLandcover);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    throw netErr;
  }
}
