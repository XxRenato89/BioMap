import { Box3, Vector3 } from 'three';
import { buildDam } from './dam.js';
import { buildBridge } from './bridge.js';
import { buildRuka } from './ruka.js';
import { buildAraucarias, buildLengas } from './trees.js';
import { buildWetland } from './wetland.js';
import { buildLookout } from './lookout.js';
import { buildCamping } from './camping.js';
import { buildInfo } from './info.js';
import { buildArboretum } from './arboretum.js';
import { buildPowerhouse } from './powerhouse.js';
import { buildTrailhead } from './trailhead.js';
import { buildBeach, buildCampsite } from './beach.js';
import { mergeByMaterial } from './merge.js';
import {
  buildForestTrail,
  buildMeshDeck,
  buildSanctuary,
  buildVisitorPavilions,
} from './angosturaPlaces.js';

/*
 * Modelos 3D de los puntos de interés (portados de ejemplo.html). Cada uno
 * se construye en unidades "de ejemplo" apoyado en y = 0. Para dejarlos a
 * escala real (1 unidad de la maqueta = 1 km), cada tipo tiene sus metros
 * por unidad de ejemplo, calculados con una medida conocida: una ruka de
 * ~10 m de diámetro, araucarias de ~35 m, lengas de ~25 m, un mirador de
 * ~8 m, un puente colgante de ~100 m, etc.
 */
export const MODEL_SCALE_MULTIPLIER = 3;

export const METERS_PER_UNIT = {
  dam: 30 * MODEL_SCALE_MULTIPLIER,
  bridge: 6.5 * MODEL_SCALE_MULTIPLIER,
  ruka: 4.3 * MODEL_SCALE_MULTIPLIER,
  araucaria: 10 * MODEL_SCALE_MULTIPLIER,
  lenga: 7.4 * MODEL_SCALE_MULTIPLIER,
  wetland: 20 * MODEL_SCALE_MULTIPLIER,
  /* Modelos según fotos de Google Maps, ya en metros (ver angosturaPlaces.js). */
  visitors: MODEL_SCALE_MULTIPLIER,
  forestTrail: MODEL_SCALE_MULTIPLIER,
  meshDeck: MODEL_SCALE_MULTIPLIER,
  sanctuary: MODEL_SCALE_MULTIPLIER,
  lookout: 2.1 * MODEL_SCALE_MULTIPLIER,
  camping: 6.6 * MODEL_SCALE_MULTIPLIER,
  info: 3.5 * MODEL_SCALE_MULTIPLIER,
  arboretum: 6 * MODEL_SCALE_MULTIPLIER,
  powerhouse: 4 * MODEL_SCALE_MULTIPLIER,
  trailhead: 3 * MODEL_SCALE_MULTIPLIER,
  beach: 5 * MODEL_SCALE_MULTIPLIER,
  campsite: 4.5 * MODEL_SCALE_MULTIPLIER,
};

/**
 * Escala para llevar el modelo `kind` a su tamaño real en la maqueta.
 *
 * @param {string} kind
 * @returns {number}
 */
export function modelScale(kind) {
  return (METERS_PER_UNIT[kind] ?? 10) / 1000;
}

export const BUILDERS = {
  dam: buildDam,
  bridge: buildBridge,
  ruka: buildRuka,
  araucaria: buildAraucarias,
  lenga: buildLengas,
  wetland: buildWetland,
  visitors: buildVisitorPavilions,
  forestTrail: buildForestTrail,
  meshDeck: buildMeshDeck,
  sanctuary: buildSanctuary,
  lookout: buildLookout,
  camping: buildCamping,
  info: buildInfo,
  arboretum: buildArboretum,
  powerhouse: buildPowerhouse,
  trailhead: buildTrailhead,
  beach: buildBeach,
  campsite: buildCampsite,
};

/*
 * Palabras del nombre del punto que eligen el modelo. Los puentes de
 * caminos ya se ven como caminos reales: solo un puente colgante usa el modelo.
 */
export const KEYWORDS = [
  /* Lugares reales de Angostura con modelo propio (antes que las palabras genéricas). */
  [/parque angostura/i, 'forestTrail'],
  [/mirador central angostura/i, 'meshDeck'],
  [/calvario|san sebasti[aá]n/i, 'sanctuary'],
  [/playa|balneario/i, 'beach'],
  /* Campings de interior: el de Los Notros (playa y muelle) no calza con ellos. */
  [/trompelhueno|patagua/i, 'campsite'],
  [/camping|camp|acampar/i, 'camping'],
  [/mirador|vista/i, 'lookout'],
  [/central|hidroel[eé]ctrica/i, 'powerhouse'],
  [/presa|represa/i, 'dam'],
  [/puente colgante/i, 'bridge'],
  [/ruka|pehuenche|mapuche/i, 'ruka'],
  [/araucaria|pehu[eé]n/i, 'araucaria'],
  [/arboret(o|um)/i, 'arboretum'],
  [/lenga/i, 'lenga'],
  [/humedal|laguna|aves/i, 'wetland'],
  [/informaci/i, 'info'],
  [/visitante|centro/i, 'visitors'],
  [/sendero|parque/i, 'trailhead'],
];

/*
 * Sin coincidencia no se dibuja modelo: un modelo genérico (una ruka, unas
 * araucarias) en un lugar real que no los tiene confundiría al visitante.
 */
export const LAYER_DEFAULT = {};

/**
 * Elige el modelo de un punto: el que indican sus datos (`modelKind`, editable
 * en el panel de administración; `none` = sin modelo) o, si no trae uno
 * válido, el que calce con su nombre.
 *
 * @param {string} name
 * @param {string} [layerSlug]
 * @param {string | null} [explicit]
 * @returns {keyof typeof BUILDERS | null}
 */
export function modelKindFor(name, layerSlug, explicit) {
  if (explicit === 'none') return null;
  if (explicit && BUILDERS[explicit]) return explicit;
  for (const [re, kind] of KEYWORDS) {
    if (re.test(name)) return kind;
  }
  return LAYER_DEFAULT[layerSlug] ?? null;
}

const cache = new Map();

/**
 * Instancia única clonada de cada modelo para un punto.
 *
 * @param {keyof typeof BUILDERS} kind
 * @returns {import('three').Group}
 */
export function createPoiModel(kind) {
  if (!BUILDERS[kind]) return null;
  if (!cache.has(kind)) cache.set(kind, mergeByMaterial(BUILDERS[kind]()));
  return cache.get(kind).clone(true);
}

const radii = new Map();

/**
 * Radio en planta (km) de un modelo ya a escala de la maqueta, medido de su
 * caja: es la huella que necesita para apoyarse sin chocar con otro.
 *
 * @param {keyof typeof BUILDERS} kind
 * @returns {number}
 */
export function modelRadius(kind) {
  if (!BUILDERS[kind]) return 0;
  if (!radii.has(kind)) {
    const size = new Box3().setFromObject(createPoiModel(kind)).getSize(new Vector3());
    radii.set(kind, (Math.max(size.x, size.z) / 2) * modelScale(kind));
  }
  return radii.get(kind);
}
