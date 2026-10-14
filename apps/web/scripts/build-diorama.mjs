/**
 * Genera TODOS los recursos de la maqueta 3D de la zona de Angostura. Se
 * ejecuta UNA vez, con internet; después el visor funciona sin conexión:
 *
 *   npm run build:diorama -w apps/web
 *
 * Fuentes (todas de uso comercial permitido citando la fuente): relieve
 * Terrarium (SRTM y otros, AWS Open Data), cobertura de suelo ESA WorldCover
 * 2021 (CC BY 4.0), fotografía Sentinel-2 cloudless 2016 de EOX (CC BY 4.0)
 * e hitos, caminos y edificios de OpenStreetMap (ODbL).
 *
 * Dos áreas, cada una con relieve, foto fundida con la paleta de maqueta y luz:
 * - la zona (BOUNDS), con todo el detalle;
 * - el contexto (CONTEXT_KM alrededor), un paisaje más liviano y más
 *   «de mapa» que rodea la zona para que la pantalla nunca muestre vacío.
 *
 * Salida en public/diorama/:
 *   terrain.bin / context.bin     alturas en metros (Uint16, filas de norte a sur)
 *   terrain.json                  límites y grillas de ambas áreas (version 2)
 *   surface.webp / context.webp   color: foto + paleta de maqueta + luz del relieve
 *   normal.webp                   normales de la zona en espacio de objeto (sin pérdida)
 *   landcover.bin                 clase de cobertura de la zona (Uint8)
 *   context-landcover.bin         cobertura del contexto reducida (Uint8, 1024 columnas)
 *   shore.bin                     distancia a la orilla de cada celda de agua de la zona
 *                                 (Uint8, m, hasta 255; 0 en tierra)
 *   landmarks.json                presas, etiquetas, caminos y edificios de la zona
 *   water.json                    cuerpos de agua con el nivel (m) en cada punto de
 *                                 orilla: [lng, lat, nivel]; el relieve de ambas áreas
 *                                 ya viene rebajado bajo el agua (ver inlay.js)
 *
 * Todo se escribe primero en public/diorama.tmp/ y solo al final reemplaza la
 * carpeta anterior: si algo falla, la maqueta que había sigue intacta.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  ambientOcclusion,
  fuseColor,
  gridNormal,
  hillshade,
  satelliteLight,
} from '../src/diorama/terrain/bake.js';
import waterPolygons from '../src/data/water.json' with { type: 'json' };
import landmarksLocal from '../src/data/landmarks_local.json' with { type: 'json' };
import { clipPolygonToBounds } from '../src/diorama/utils/geo.js';
import {
  densifyRing,
  inlayWater,
  shoreDistance,
  shoreLevels,
} from '../src/diorama/terrain/inlay.js';
import { overpassQuery, parseOverpass } from '../src/diorama/utils/osm.js';
import { fetchWithRetry } from './diorama/fetch.mjs';
import { buildLandcover } from './diorama/landcover.mjs';
import { buildSatelliteTexture } from './diorama/satellite.mjs';
import { buildTerrain } from './diorama/terrain.mjs';

/*
 * Zona de Angostura: el embalse, la presa y el parque. Debe coincidir con
 * DEFAULT_BOUNDS de src/config.js.
 */
const BOUNDS = { west: -71.855, south: -37.7672, east: -71.75374, north: -37.672 };
const ZONE = {
  columns: 2048,
  textureColumns: 4096,
  landcoverColumns: 2048,
  terrainZoom: 15,
  imageryZoom: 15,
  blend: 0.36,
  ao: { radiusKm: 0.6, directions: 12, scale: 2 },
};

/*
 * Paisaje de contexto: CONTEXT_KM hacia cada lado desde el centro de la zona.
 */
const CONTEXT_KM = 30;
const CONTEXT = {
  columns: 1024,
  textureColumns: 4096,
  landcoverColumns: 4096,
  terrainZoom: 12,
  imageryZoom: 13,
  blend: 0.55,
  ao: { radiusKm: 2, directions: 8, scale: 1 },
};
/*
 * Separación máxima entre puntos de orilla al calcular el nivel del agua (km).
 */
const WATER_STEP_KM = 0.04;
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const OUT_DIR = path.join(PUBLIC_DIR, 'diorama');
const TMP_DIR = path.join(PUBLIC_DIR, 'diorama.tmp');
const KM_PER_DEGREE = 111.32;

const started = Date.now();
const step = (message) =>
  console.log(`[${((Date.now() - started) / 1000).toFixed(0)} s] ${message}`);

/**
 * Ancho y fondo (km) de unos límites.
 */
function sizeKm(bounds) {
  const middleLat = (bounds.north + bounds.south) / 2;
  return {
    widthKm: (bounds.east - bounds.west) * KM_PER_DEGREE * Math.cos((middleLat * Math.PI) / 180),
    depthKm: (bounds.north - bounds.south) * KM_PER_DEGREE,
  };
}

/**
 * Descarga el relieve, la cobertura y la foto de un área.
 */
async function fetchArea(name, bounds, options) {
  const { widthKm, depthKm } = sizeKm(bounds);
  const rows = Math.round((options.columns * depthKm) / widthKm);
  const textureRows = Math.round((options.textureColumns * depthKm) / widthKm);
  const landcoverRows = Math.round((options.landcoverColumns * depthKm) / widthKm);

  step(`${name}: relieve ${options.columns}×${rows} (Terrarium z${options.terrainZoom})`);
  const terrain = await buildTerrain(bounds, {
    columns: options.columns,
    rows,
    zoom: options.terrainZoom,
    name,
  });
  step(`${name}: cobertura ${options.landcoverColumns}×${landcoverRows} (ESA WorldCover)`);
  const landcover = await buildLandcover(bounds, {
    columns: options.landcoverColumns,
    rows: landcoverRows,
    name,
  });
  step(`${name}: foto ${options.textureColumns}×${textureRows} (Sentinel-2 cloudless 2016)`);
  const satellite = await buildSatelliteTexture(bounds, {
    columns: options.textureColumns,
    rows: textureRows,
    zoom: options.imageryZoom,
    name,
  });

  return {
    name,
    bounds,
    options,
    widthKm,
    depthKm,
    rows,
    textureRows,
    landcoverRows,
    terrain,
    landcover,
    satellite,
  };
}

/**
 * Hornea un área ya descargada (y con el agua incrustada): luz del relieve,
 * color (foto fundida con la paleta de maqueta) y normales.
 */
function bakeArea(area) {
  const {
    name,
    bounds,
    options,
    widthKm,
    depthKm,
    rows,
    textureRows,
    landcoverRows,
    terrain,
    landcover,
    satellite,
  } = area;
  step(`${name}: horneado (luz del relieve, fusión foto + maqueta, normales)`);
  let min = Infinity;
  let max = -Infinity;
  for (const height of terrain.heights) {
    if (height < min) min = height;
    if (height > max) max = height;
  }
  const { columns } = options;
  const cellX = widthKm / (columns - 1);
  const cellZ = depthKm / (rows - 1);
  const shade = hillshade(terrain.heights, columns, rows, cellX, cellZ);
  const ao = ambientOcclusion(terrain.heights, columns, rows, cellX, cellZ, options.ao);
  const light = new Float32Array(columns * rows);
  for (let k = 0; k < light.length; k += 1) light[k] = satelliteLight(shade[k], ao[k]);

  /* Luz y cobertura llevadas a la resolución de la foto (bilineal y vecino más cercano). */
  const { textureColumns, landcoverColumns } = options;
  const color = new Uint8Array(textureColumns * textureRows * 3);
  for (let ty = 0; ty < textureRows; ty += 1) {
    const fr = (ty / (textureRows - 1)) * (rows - 1);
    const r0 = Math.floor(fr);
    const r1 = Math.min(r0 + 1, rows - 1);
    const tz = fr - r0;
    const coverRow = Math.min(Math.floor((ty / textureRows) * landcoverRows), landcoverRows - 1);
    for (let tx = 0; tx < textureColumns; tx += 1) {
      const fc = (tx / (textureColumns - 1)) * (columns - 1);
      const c0 = Math.floor(fc);
      const c1 = Math.min(c0 + 1, columns - 1);
      const t = fc - c0;
      const lit =
        (light[r0 * columns + c0] * (1 - t) + light[r0 * columns + c1] * t) * (1 - tz) +
        (light[r1 * columns + c0] * (1 - t) + light[r1 * columns + c1] * t) * tz;
      const cls =
        landcover[
          coverRow * landcoverColumns +
            Math.min(Math.floor((tx / textureColumns) * landcoverColumns), landcoverColumns - 1)
        ];
      const o = (ty * textureColumns + tx) * 3;
      color.set(
        fuseColor([satellite[o], satellite[o + 1], satellite[o + 2]], cls, lit, options.blend),
        o,
      );
    }
  }

  const normal = new Uint8Array(columns * rows * 3);
  for (let row = 0; row < rows; row += 1)
    for (let col = 0; col < columns; col += 1) {
      const n = gridNormal(terrain.heights, columns, rows, col, row, cellX, cellZ);
      for (let k = 0; k < 3; k += 1)
        normal[(row * columns + col) * 3 + k] = Math.round((n[k] * 0.5 + 0.5) * 255);
    }

  return {
    terrain,
    landcover,
    color,
    normal,
    grid: {
      bounds,
      columns,
      rows,
      widthKm: Number(widthKm.toFixed(3)),
      depthKm: Number(depthKm.toFixed(3)),
      minHeight: min,
      maxHeight: max,
      texture: { columns: textureColumns, rows: textureRows },
    },
    landcoverGrid: { columns: landcoverColumns, rows: landcoverRows },
  };
}

/**
 * Guarda una imagen RGB como WebP.
 */
function saveWebp(file, data, width, height, options) {
  return sharp(Buffer.from(data.buffer), {
    raw: { width, height, channels: 3 },
    limitInputPixels: false,
  })
    .webp(options)
    .toFile(path.join(TMP_DIR, file));
}

/**
 * Consulta Overpass probando cada servidor (el principal suele saturarse).
 */
async function queryOverpass(query) {
  let lastError;
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetchWithRetry(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        },
        4,
      );
      return await response.json();
    } catch (error) {
      lastError = error;
      console.warn(`  ${url} no respondió, pruebo el siguiente`);
    }
  }
  throw lastError;
}

rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });

/* Preservar modelo 3D de la mascota en el directorio de salida */
const mascotBackup = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/data/mascot.glb',
);
if (existsSync(mascotBackup)) {
  cpSync(mascotBackup, path.join(TMP_DIR, 'mascot.glb'));
} else if (existsSync(path.join(OUT_DIR, 'mascot.glb'))) {
  cpSync(path.join(OUT_DIR, 'mascot.glb'), path.join(TMP_DIR, 'mascot.glb'));
}

step('hitos, caminos y edificios (OpenStreetMap + datos locales de Angostura)');
const boundsPair = [
  [BOUNDS.west, BOUNDS.south],
  [BOUNDS.east, BOUNDS.north],
];
let landmarks;
try {
  landmarks = parseOverpass(await queryOverpass(overpassQuery(boundsPair)), boundsPair);
} catch (err) {
  console.warn(
    `  aviso: Overpass no respondió (${err.message}). Usando hitos locales de respaldo.`,
  );
  const cachedLandmarks = path.join(OUT_DIR, 'landmarks.json');
  if (existsSync(cachedLandmarks)) {
    landmarks = JSON.parse(readFileSync(cachedLandmarks, 'utf8'));
  } else {
    landmarks = { dams: [], labels: [], roads: [], buildings: [] };
  }
}

/* Fusión con infraestructura y edificios locales de alta resolución */
if (landmarksLocal) {
  if (landmarksLocal.dams) {
    for (const dam of landmarksLocal.dams) {
      if (!landmarks.dams.some((d) => d.name === dam.name)) landmarks.dams.push(dam);
    }
  }
  if (landmarksLocal.labels) {
    for (const label of landmarksLocal.labels) {
      /* Un hito local reemplaza al de OSM con el mismo nombre (corrige su posición). */
      landmarks.labels = landmarks.labels.filter((l) => l.name !== label.name);
      landmarks.labels.push(label);
    }
  }
  if (landmarksLocal.buildings) {
    landmarks.buildings.push(...landmarksLocal.buildings);
  }
  if (landmarksLocal.roads) {
    landmarks.roads.push(...landmarksLocal.roads);
  }
}

if (landmarks.dams.length === 0) console.warn('  aviso: ninguna presa cae dentro de los límites');
writeFileSync(path.join(TMP_DIR, 'landmarks.json'), `${JSON.stringify(landmarks)}\n`);
step(
  `  ${landmarks.dams.length} presas, ${landmarks.labels.length} etiquetas, ` +
    `${landmarks.roads.length} caminos, ${landmarks.buildings.length} edificios`,
);

/* --only-roads: solo hitos y caminos de OSM, sin volver a descargar relieve, cobertura ni fotos. */
if (process.argv.includes('--only-roads')) {
  cpSync(path.join(TMP_DIR, 'landmarks.json'), path.join(OUT_DIR, 'landmarks.json'));
  rmSync(TMP_DIR, { recursive: true, force: true });
  step('listo: solo landmarks.json actualizado');
  process.exit(0);
}

const centerLat = (BOUNDS.north + BOUNDS.south) / 2;
const centerLng = (BOUNDS.east + BOUNDS.west) / 2;
const halfLat = CONTEXT_KM / KM_PER_DEGREE;
const halfLng = halfLat / Math.cos((centerLat * Math.PI) / 180);
const contextBounds = {
  west: centerLng - halfLng,
  south: centerLat - halfLat,
  east: centerLng + halfLng,
  north: centerLat + halfLat,
};
const zoneArea = await fetchArea('zona', BOUNDS, ZONE);
const contextArea = await fetchArea('contexto', contextBounds, CONTEXT);

step('agua incrustada (nivel en cada orilla, fondo rebajado y orillas ajustadas)');
const gridOf = (area) => ({ bounds: area.bounds, columns: area.options.columns, rows: area.rows });
const sampler = (area) => {
  const { bounds, columns } = gridOf(area);
  const { rows } = area;
  const { heights } = area.terrain;
  return ([lng, lat]) => {
    const fc = Math.min(
      Math.max(((lng - bounds.west) / (bounds.east - bounds.west)) * (columns - 1), 0),
      columns - 1,
    );
    const fr = Math.min(
      Math.max(((bounds.north - lat) / (bounds.north - bounds.south)) * (rows - 1), 0),
      rows - 1,
    );
    const c0 = Math.floor(fc);
    const r0 = Math.floor(fr);
    const c1 = Math.min(c0 + 1, columns - 1);
    const r1 = Math.min(r0 + 1, rows - 1);
    const tx = fc - c0;
    const tz = fr - r0;
    const at = (c, r) => heights[r * columns + c];
    return (
      (at(c0, r0) * (1 - tx) + at(c1, r0) * tx) * (1 - tz) +
      (at(c0, r1) * (1 - tx) + at(c1, r1) * tx) * tz
    );
  };
};
const zoneHeight = sampler(zoneArea);
const contextHeight = sampler(contextArea);
const insideZone = ([lng, lat]) =>
  lng >= BOUNDS.west && lng <= BOUNDS.east && lat >= BOUNDS.south && lat <= BOUNDS.north;
const heightOf = (point) => (insideZone(point) ? zoneHeight(point) : contextHeight(point));
const contextPair = [
  [contextBounds.west, contextBounds.south],
  [contextBounds.east, contextBounds.north],
];
const water = waterPolygons
  .map((polygon) => clipPolygonToBounds(polygon, contextPair))
  .filter(Boolean)
  .map(({ outer, holes }) => {
    const rings = [outer, ...holes].map((ring) => densifyRing(ring, WATER_STEP_KM));
    const levels = shoreLevels(rings.flat(), heightOf);
    let k = 0;
    const withLevels = rings.map((ring) => ring.map(([lng, lat]) => [lng, lat, levels[k++]]));
    return { outer: withLevels[0], holes: withLevels.slice(1) };
  });
const zoneInlay = inlayWater(gridOf(zoneArea), zoneArea.terrain.heights, water, {
  bankCells: 8,
  bank: 0.5,
});
const contextInlay = inlayWater(gridOf(contextArea), contextArea.terrain.heights, water, {
  bankCells: 1,
});
writeFileSync(path.join(TMP_DIR, 'water.json'), `${JSON.stringify(water)}\n`);
step(
  `  ${water.length} cuerpos de agua; celdas rebajadas: zona ${zoneInlay.carved}, contexto ${contextInlay.carved}`,
);

const zone = bakeArea(zoneArea);
writeFileSync(path.join(TMP_DIR, 'terrain.bin'), Buffer.from(zone.terrain.heights.buffer));
writeFileSync(path.join(TMP_DIR, 'landcover.bin'), Buffer.from(zone.landcover.buffer));
await saveWebp('surface.webp', zone.color, zone.grid.texture.columns, zone.grid.texture.rows, {
  quality: 90,
});
await saveWebp('normal.webp', zone.normal, zone.grid.columns, zone.grid.rows, {
  lossless: true,
  effort: 3,
});

const context = bakeArea(contextArea);
writeFileSync(path.join(TMP_DIR, 'context.bin'), Buffer.from(context.terrain.heights.buffer));

/* Distancia a la orilla en la zona (para el color y la espuma del agua). */
const cellMeters = (zone.grid.widthKm / (zone.grid.columns - 1)) * 1000;
const shore = shoreDistance(zoneInlay.mask, zone.grid.columns, zone.grid.rows, cellMeters);
writeFileSync(path.join(TMP_DIR, 'shore.bin'), Buffer.from(shore.buffer));

/* Cobertura del contexto reducida (para el bosque que difumina el borde de la zona). */
const CONTEXT_COVER_COLUMNS = 1024;
const coverScale = contextArea.options.landcoverColumns / CONTEXT_COVER_COLUMNS;
const contextCoverRows = Math.floor(contextArea.landcoverRows / coverScale);
const contextCover = new Uint8Array(CONTEXT_COVER_COLUMNS * contextCoverRows);
for (let r = 0; r < contextCoverRows; r += 1)
  for (let c = 0; c < CONTEXT_COVER_COLUMNS; c += 1)
    contextCover[r * CONTEXT_COVER_COLUMNS + c] =
      contextArea.landcover[
        Math.floor(r * coverScale) * contextArea.options.landcoverColumns +
          Math.floor(c * coverScale)
      ];
writeFileSync(path.join(TMP_DIR, 'context-landcover.bin'), Buffer.from(contextCover.buffer));
await saveWebp(
  'context.webp',
  context.color,
  context.grid.texture.columns,
  context.grid.texture.rows,
  { quality: 86 },
);

const zoneGrid = { ...zone.grid };
delete zoneGrid.texture;
const meta = {
  version: 2,
  ...zoneGrid,
  landcover: zone.landcoverGrid,
  context: {
    ...context.grid,
    landcover: { columns: CONTEXT_COVER_COLUMNS, rows: contextCoverRows },
  },
  sources: [
    `Terrarium (Mapzen Terrain Tiles, AWS Open Data), zoom ${ZONE.terrainZoom} y ${CONTEXT.terrainZoom}`,
    'ESA WorldCover 2021 v200 (CC BY 4.0)',
    'Sentinel-2 cloudless 2016 by EOX IT Services GmbH (CC BY 4.0), contains modified Copernicus Sentinel data 2016',
    '© OpenStreetMap contributors (ODbL)',
  ],
};
writeFileSync(path.join(TMP_DIR, 'terrain.json'), `${JSON.stringify(meta, null, 2)}\n`);

rmSync(OUT_DIR, { recursive: true, force: true });
try {
  renameSync(TMP_DIR, OUT_DIR);
} catch {
  /* En Windows el renombrado falla si algo vigila la carpeta (servidor de desarrollo): se copia. */
  cpSync(TMP_DIR, OUT_DIR, { recursive: true });
  rmSync(TMP_DIR, { recursive: true, force: true });
}
step(
  `listo: zona ${zone.grid.columns}×${zone.grid.rows}, contexto ${context.grid.columns}×${context.grid.rows}`,
);
