import { fromUrl } from 'geotiff';
import { reclassify } from '../../src/diorama/landcover.js';
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
 * Cobertura de suelo de la maqueta desde ESA WorldCover 2021 (10 m, CC BY 4.0).
 * Lee de cada tesela solo la ventana que cae en los límites (GeoTIFF
 * optimizado para la nube: pide por rangos y usa sus versiones reducidas),
 * la remuestrea al vecino más cercano en la grilla y la reclasifica.
 *
 * @param {{ west: number, south: number, east: number, north: number }} bounds
 * @param {{ columns: number, rows: number }} grid
 * @returns {Promise<Uint8Array>} Una clase por celda (ver landcover.js), filas de norte a sur.
 */
export async function buildLandcover(bounds, { columns, rows }) {
  const data = new Uint8Array(columns * rows);
  const spanLng = bounds.east - bounds.west;
  const spanLat = bounds.north - bounds.south;
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
      const name = tileName(lng, lat);
      console.log(`  cobertura ${name}: ${c1 - c0}×${r1 - r0}`);
      const tiff = await fromUrl(TILE_URL.replace('{tile}', name), {
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
}
