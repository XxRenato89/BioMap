import { isInside } from './cameraMath.js';

/**
 * Presas que se modelan en la maqueta, por id de vía de OpenStreetMap. Van
 * por id porque el muro de Angostura no tiene nombre en OSM.
 */
export const DAMS = {
  738577784: 'Presa Angostura',
  335658430: 'Presa Pangue',
  335646301: 'Presa Ralco',
};

/**
 * Altura de cada muro sobre el cauce (m), para levantarlo a escala real.
 * Ralco: 155 m (CEDEX, RCC Dams); Pangue: 113 m (proyecto de 1992);
 * Angostura: 50 m (CIPER, 2008; validar con Colbún).
 */
export const DAM_HEIGHTS = {
  738577784: 50,
  335658430: 113,
  335646301: 155,
};

/**
 * Ancho real de cada tipo de camino de OpenStreetMap (m). Los que no están
 * aquí (senderos, escaleras) no se dibujan.
 */
export const ROAD_WIDTHS = {
  motorway: 14,
  trunk: 12,
  primary: 10,
  secondary: 8,
  tertiary: 7,
  unclassified: 5,
  residential: 5,
  service: 3.5,
  track: 3,
  pedestrian: 3,
  /* Senderos: la mascota los usa para llegar a miradores y orillas. */
  path: 1.5,
  footway: 1.5,
};

/*
 * Alto de un edificio sin dato (m) y alto de cada piso.
 */
const BUILDING_HEIGHT = 5;
const LEVEL_HEIGHT = 3;

/*
 * Prioridad de cada tipo de etiqueta: cuando dos se tapan, gana la mayor.
 */
const RANKS = { volcano: 90, reservoir: 80, dam: 75, lake: 70, peak: 60, town: 55, village: 40 };

/**
 * Consulta Overpass de los hitos: las presas con su geometría, los lugares
 * con nombre (volcanes, cerros altos, embalses, lagos y pueblos) con su
 * centro, y los caminos y edificios con su geometría.
 *
 * @param {[[number, number], [number, number]]} bounds
 */
export function overpassQuery([[west, south], [east, north]]) {
  const bbox = `(${south},${west},${north},${east})`;
  return `[out:json][timeout:120];
way(id:${Object.keys(DAMS).join(',')});
out geom;
(
  node["natural"="volcano"]["name"]${bbox};
  node["natural"="peak"]["name"]["ele"]${bbox};
  nwr["natural"="water"]["water"~"^(reservoir|lake)$"]["name"]${bbox};
  node["place"~"^(city|town|village)$"]["name"]${bbox};
);
out tags center;
way["highway"~"^(${Object.keys(ROAD_WIDTHS).join('|')})$"]${bbox};
out tags geom;
way["building"]${bbox};
out tags geom;`;
}

/**
 * Tipo de etiqueta de un elemento OSM, o null si no se muestra.
 */
function kindOf(tags) {
  if (tags.natural === 'volcano') return 'volcano';
  if (tags.natural === 'peak') return Number.parseFloat(tags.ele) >= 2000 ? 'peak' : null;
  if (tags.natural === 'water') return tags.water === 'reservoir' ? 'reservoir' : 'lake';
  if (tags.place === 'city' || tags.place === 'town') return 'town';
  if (tags.place === 'village') return 'village';
  return null;
}

/**
 * Convierte la respuesta de Overpass en los hitos de la maqueta:
 * - `dams`: muros de presa como líneas [lng, lat];
 * - `labels`: etiquetas con tipo, nombre, posición y prioridad, sin repetir
 *   y solo dentro de los límites;
 * - `roads`: caminos { kind, line, bridge? }, cortados donde salen de los
 *   límites (`bridge` marca los tramos que son puentes);
 * - `buildings`: edificios { ring, height } enteramente dentro de los límites.
 *
 * @param {{ elements: Array<object> }} response
 * @param {[[number, number], [number, number]]} bounds
 */
export function parseOverpass(response, bounds) {
  const dams = [];
  const labels = [];
  const roads = [];
  const buildings = [];
  const seen = new Set();
  const addLabel = (label) => {
    const key = `${label.kind}:${label.name}`;
    if (seen.has(key) || !isInside(label.coordinates, bounds)) return;
    seen.add(key);
    labels.push({ ...label, rank: RANKS[label.kind] });
  };

  for (const element of response.elements) {
    const damName = element.type === 'way' ? DAMS[element.id] : undefined;
    const line = element.geometry?.map(({ lat, lon }) => [lon, lat]);
    if (damName && line) {
      if (!line.some((point) => isInside(point, bounds))) continue;
      const cleanLine =
        element.id === 738577784 && line.length === 66
          ? [...line.slice(0, 13), ...line.slice(52)]
          : line;
      dams.push({ id: element.id, name: damName, line: cleanLine });
      addLabel({
        id: `dam-${element.id}`,
        kind: 'dam',
        name: damName,
        coordinates: cleanLine[Math.floor(cleanLine.length / 2)],
      });
      continue;
    }
    const tags = element.tags ?? {};
    if (line && ROAD_WIDTHS[tags.highway]) {
      const bridge = tags.bridge !== undefined && tags.bridge !== 'no';
      for (const run of insideRuns(line, bounds))
        roads.push({
          kind: tags.highway,
          line: run,
          ...(bridge && { bridge: true }),
          /* Número de ruta (Q-61) para los letreros del mapa. */
          ...(tags.ref && { ref: tags.ref }),
        });
      continue;
    }
    if (line && tags.building) {
      if (line.length >= 4 && line.every((point) => isInside(point, bounds)))
        buildings.push({ ring: line, height: buildingHeight(tags) });
      continue;
    }
    const kind = tags.name ? kindOf(tags) : null;
    const point =
      element.center ?? (element.lat != null ? { lat: element.lat, lon: element.lon } : null);
    if (!kind || !point) continue;
    addLabel({
      id: `${element.type}-${element.id}`,
      kind,
      name: tags.name,
      coordinates: [point.lon, point.lat],
    });
  }
  return { dams, labels, roads, buildings };
}

/**
 * Tramos consecutivos de una línea que quedan dentro de los límites (de al
 * menos dos puntos).
 */
function insideRuns(line, bounds) {
  const runs = [];
  let run = [];
  for (const point of line) {
    if (isInside(point, bounds)) run.push(point);
    else {
      if (run.length > 1) runs.push(run);
      run = [];
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/**
 * Alto de un edificio (m) según sus etiquetas: `height`, o pisos × 3 m, o 5 m.
 */
function buildingHeight(tags) {
  const height = Number.parseFloat(tags.height);
  if (height > 0) return height;
  const levels = Number.parseFloat(tags['building:levels']);
  return levels > 0 ? levels * LEVEL_HEIGHT : BUILDING_HEIGHT;
}
