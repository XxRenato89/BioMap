import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { metersToY } from '../utils/projection.js';
import { RESERVOIR, within } from '../utils/reservoir.js';

/*
 * Caminos y puentes hechos a mano, con el estilo de los mapas de Mapbox: de
 * cerca, asfalto con bordes blancos y línea central (amarilla continua en las
 * rutas principales, blanca segmentada en las secundarias) y caminos de
 * tierra; de lejos, cada camino conserva un ancho mínimo en pantalla y toma
 * su color de mapa (rutas principales amarillas, secundarias blancas), para
 * que la red se lea desde la vista general.
 */

/**
 * Estilo de cada tipo de camino de OpenStreetMap: 0 ruta principal, 1 ruta
 * secundaria, 2 camino pavimentado menor, 3 camino de tierra, 4 sendero peatonal.
 */
export const ROAD_CLASS = {
  motorway: 0,
  trunk: 0,
  primary: 0,
  secondary: 1,
  tertiary: 1,
  unclassified: 2,
  residential: 2,
  service: 2,
  track: 3,
  path: 4,
  footway: 4,
  pedestrian: 4,
};

/*
 * Cuánto sobresale la cinta del relieve (km) y cada cuánto se apoya en él.
 */
const ROAD_LIFT = 0.0012;
const ROAD_STEP = 0.006;

/*
 * Puentes (km): altura del tablero sobre sus extremos, espesor de la losa,
 * vereda a cada lado, baranda (alto y ancho) y separación entre pilares.
 */
const DECK_RISE = 0.0015;
const DECK_THICKNESS = 0.0016;
/* Puentes sobre el embalse: altura libre sobre el agua (m), fracción del largo en rampa
 * en cada extremo y distancia (km) a la que un punto se considera sobre el tablero. */
const BRIDGE_CLEARANCE_M = 8;
const BRIDGE_RAMP = 0.25;
const DECK_SNAP = 0.03;
const SIDEWALK = 0.0012;
const PARAPET_HEIGHT = 0.0009;
const PARAPET_WIDTH = 0.0003;
const PIER_SPACING = 0.035;
const PIER_LENGTH = 0.0016;

const CONCRETE = [0.74, 0.72, 0.68];
const CONCRETE_DARK = [0.58, 0.56, 0.53];
const PARAPET = [0.88, 0.87, 0.84];

/**
 * Densifica una línea de puntos {x, z} a tramos de a lo más `step` km.
 */
function densify(points, step) {
  const dense = [points[0]];
  for (let k = 1; k < points.length; k += 1) {
    const [a, b] = [points[k - 1], points[k]];
    const parts = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let p = 1; p <= parts; p += 1)
      dense.push({ x: a.x + ((b.x - a.x) * p) / parts, z: a.z + ((b.z - a.z) * p) / parts });
  }
  return dense;
}

/**
 * Puntos de un camino en la maqueta, con su altura: sobre el relieve, o, si
 * es un puente, sobre un tablero recto entre sus dos extremos (las orillas).
 */
function roadPoints({ line, bridge }, heightAt, projection) {
  const points = densify(
    line.map((point) => projection.toWorld(point)),
    ROAD_STEP,
  );
  if (!bridge) return points.map((p) => ({ ...p, y: heightAt(p.x, p.z) + ROAD_LIFT }));
  /*
   * Sobre el embalse, el tablero va sobre el agua: el relieve es anterior al
   * embalse y sus extremos pueden quedar bajo la cota. Arranca a nivel del
   * agua, sube en rampa desde cada orilla y cruza a nivel.
   */
  const middle = points[Math.floor(points.length / 2)];
  const overReservoir = within(projection.toLngLat(middle.x, middle.z), RESERVOIR.surface);
  const floor = overReservoir ? metersToY(RESERVOIR.level) : -Infinity;
  const start = Math.max(heightAt(points[0].x, points[0].z), floor);
  const end = Math.max(heightAt(points.at(-1).x, points.at(-1).z), floor);
  const level = metersToY(RESERVOIR.level + BRIDGE_CLEARANCE_M);
  const last = Math.max(points.length - 1, 1);
  return points.map((p, k) => {
    const t = k / last;
    const straight = start + (end - start) * t;
    if (!overReservoir) return { ...p, y: straight + DECK_RISE };
    const ramp = Math.min(1, Math.min(t, 1 - t) / BRIDGE_RAMP);
    return { ...p, y: Math.max(straight, straight + (level - straight) * ramp) + DECK_RISE };
  });
}

/* Separación (km) al revisar qué partes de un camino cruzan el embalse, y largo mínimo de un cruce. */
const WATER_PROBE_KM = 0.01;
const MIN_CROSSING_KM = 0.02;

/**
 * Caminos que cruzan el embalse como puentes: el relieve es anterior al agua,
 * así que los accesos de un puente (y cualquier calzada sobre el embalse)
 * quedarían sumergidos. Cada tramo de más de MIN_CROSSING_KM sobre el agua
 * pasa a ser un puente aparte; los vértices originales se conservan, así los
 * cruces con otros caminos no cambian.
 *
 * @param {Array<{ kind: string, line: number[][], bridge?: boolean }>} roads
 * @param {(lngLat: number[]) => boolean} inWater
 */
export function bridgeReservoirCrossings(roads, inWater) {
  const wet = (point) => inWater(point) && within(point, RESERVOIR.surface);
  const lengthKm = (a, b) => Math.hypot((a[0] - b[0]) * 88.2, (a[1] - b[1]) * 111.2);
  const result = [];
  for (const road of roads) {
    if (road.bridge || road.line.length < 2) {
      result.push(road);
      continue;
    }
    /* Línea densa, marcando si cada punto está sobre el agua. */
    const dense = [{ point: road.line[0], wet: wet(road.line[0]) }];
    for (let k = 1; k < road.line.length; k += 1) {
      const [a, b] = [road.line[k - 1], road.line[k]];
      const parts = Math.max(1, Math.ceil(lengthKm(a, b) / WATER_PROBE_KM));
      for (let p = 1; p <= parts; p += 1) {
        const t = p / parts;
        const point = p === parts ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        dense.push({ point, wet: wet(point) });
      }
    }
    /* Tramos alternos de tierra y agua; los de agua cortos se quedan como camino. */
    const runs = [];
    for (const item of dense) {
      const last = runs.at(-1);
      if (last && last.wet === item.wet) last.points.push(item.point);
      else
        runs.push({
          wet: item.wet,
          points: last ? [last.points.at(-1), item.point] : [item.point],
        });
    }
    for (const run of runs) {
      const length = run.points.slice(1).reduce((sum, p, i) => sum + lengthKm(run.points[i], p), 0);
      const bridge = run.wet && length >= MIN_CROSSING_KM;
      if (run.points.length >= 2)
        result.push({ ...road, line: run.points, ...(bridge && { bridge: true }) });
    }
  }
  return result;
}

/**
 * Altura de lo que pisa un punto (x, z): el tablero de un puente si pasa por
 * encima, el espejo de agua si es agua, o el relieve. Para apoyar pines y
 * etiquetas sobre lo que se ve, no en el fondo del embalse.
 *
 * @param {Array<{ line: number[][], bridge?: boolean }>} roads
 * @param {(x: number, z: number) => number} heightAt
 * @param {{ toWorld: Function, toLngLat: Function }} projection
 * @param {(lngLat: number[]) => boolean} inWater
 * @returns {(x: number, z: number) => number}
 */
export function surfaceSampler(roads, heightAt, projection, inWater) {
  const decks = roads
    .filter((road) => road.bridge)
    .map((road) => roadPoints(road, heightAt, projection));
  return (x, z) => {
    let best = null;
    let bestDistance = DECK_SNAP;
    for (const deck of decks) {
      for (const p of deck) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bestDistance) {
          bestDistance = d;
          best = p.y;
        }
      }
    }
    if (best !== null) return best;
    const lngLat = projection.toLngLat(x, z);
    if (inWater(lngLat) && within(lngLat, RESERVOIR.surface))
      return Math.max(heightAt(x, z), metersToY(RESERVOIR.level));
    return heightAt(x, z);
  };
}

/**
 * Dirección perpendicular (horizontal, unitaria) a la línea en el punto k.
 */
function sideways(points, k) {
  const a = points[Math.max(k - 1, 0)];
  const b = points[Math.min(k + 1, points.length - 1)];
  const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: -(b.z - a.z) / length, z: (b.x - a.x) / length };
}

/**
 * Cintas de todos los caminos. Cada vértice guarda el punto del eje y el
 * shader lo abre hacia su lado (`roadSide`) según el ancho real del camino
 * o el ancho mínimo en pantalla, lo que sea mayor.
 *
 * @param {Array<{ kind: string, line: number[][], bridge?: boolean }>} roads
 * @param {Record<string, number>} widths Ancho real de cada tipo (m).
 * @param {(x: number, z: number) => number} heightAt
 * @param {{ toWorld: Function }} projection
 */
export function buildRoads(roads, widths, heightAt, projection) {
  const position = [];
  const normal = [];
  const side = [];
  const across = [];
  const half = [];
  const kind = [];
  const along = [];
  const index = [];
  for (const road of roads) {
    if (ROAD_CLASS[road.kind] === undefined) continue;
    const points = roadPoints(road, heightAt, projection);
    if (points.length < 2) continue;
    const start = position.length / 3;
    let distance = 0;
    points.forEach((p, k) => {
      if (k > 0) distance += Math.hypot(p.x - points[k - 1].x, p.z - points[k - 1].z) * 1000;
      const n = sideways(points, k);
      for (const s of [1, -1]) {
        position.push(p.x, p.y, p.z);
        normal.push(0, 1, 0);
        side.push(s);
        across.push(n.x, n.z);
        half.push((widths[road.kind] ?? 4) / 2000);
        kind.push(ROAD_CLASS[road.kind]);
        along.push(distance);
      }
      if (k === 0) return;
      const v = start + k * 2;
      index.push(v - 2, v - 1, v, v, v - 1, v + 1);
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  geometry.setAttribute('roadSide', new Float32BufferAttribute(side, 1));
  geometry.setAttribute('roadAcross', new Float32BufferAttribute(across, 2));
  geometry.setAttribute('roadHalf', new Float32BufferAttribute(half, 1));
  geometry.setAttribute('roadKind', new Float32BufferAttribute(kind, 1));
  geometry.setAttribute('roadAlong', new Float32BufferAttribute(along, 1));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Material de los caminos (ver el comentario del módulo).
 */
export function roadMaterial() {
  const material = new MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float roadSide;
attribute vec2 roadAcross;
attribute float roadHalf;
attribute float roadKind;
attribute float roadAlong;
varying float vRoadU;
varying float vRoadAlong;
varying float vRoadKind;
varying float vRoadDetail;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
/* Ancho mínimo en pantalla (px) por tipo: el ángulo de un píxel es ~0,00052 rad. */
float minPixels = roadKind < 0.5 ? 3.2 : roadKind < 1.5 ? 2.6 : roadKind < 2.5 ? 1.6 : roadKind < 3.5 ? 1.2 : 1.4;
float toCamera = distance(cameraPosition, (modelMatrix * vec4(position, 1.0)).xyz);
float halfWidth = max(roadHalf, toCamera * 0.00052 * minPixels * 0.5);
transformed.xz += roadAcross * roadSide * halfWidth;
vRoadU = roadSide * 0.5 + 0.5;
vRoadAlong = roadAlong;
vRoadKind = roadKind;
vRoadDetail = clamp(roadHalf / halfWidth * 1.4 - 0.4, 0.0, 1.0);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vRoadU;
varying float vRoadAlong;
varying float vRoadKind;
varying float vRoadDetail;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float edge = min(vRoadU, 1.0 - vRoadU);
float aa = fwidth(vRoadU) * 1.5;
vec3 asphalt = vec3(0.34, 0.355, 0.37);
vec3 dirt = vec3(0.66, 0.57, 0.43);
vec3 trail = vec3(0.6, 0.47, 0.33);
vec3 road = vRoadKind > 3.5 ? trail : vRoadKind > 2.5 ? dirt : asphalt;
/* Grano del asfalto o de la tierra, para que no se vea como pintura plana. */
float grain = fract(sin(dot(vec2(floor(vRoadAlong * 1.5), floor(vRoadU * 9.0)), vec2(12.9898, 78.233))) * 43758.5453);
road *= 0.94 + 0.09 * grain;
if (vRoadKind < 2.5) {
  /* Huellas de rodado más oscuras y berma de grava en los bordes. */
  float tracks = smoothstep(0.09, 0.0, abs(abs(vRoadU - 0.5) - 0.24));
  road *= 1.0 - tracks * 0.1;
  road = mix(road, vec3(0.56, 0.53, 0.47), smoothstep(0.05 + aa, 0.05, edge));
}
if (vRoadKind > 3.5) {
  /* Sendero: trazo segmentado, como en los mapas de excursión. */
  road = mix(road, vec3(0.86, 0.74, 0.55), step(0.55, fract(vRoadAlong / 6.0)) * smoothstep(0.3, 0.1, abs(vRoadU - 0.5)));
}
if (vRoadKind < 1.5) {
  float edgeLine = smoothstep(0.035 + aa, 0.035, abs(edge - 0.07));
  road = mix(road, vec3(0.95), edgeLine);
  float center = abs(vRoadU - 0.5);
  if (vRoadKind < 0.5) {
    float yellow = smoothstep(0.012 + aa, 0.012, abs(center - 0.022));
    road = mix(road, vec3(0.96, 0.78, 0.22), yellow);
  } else {
    float dash = step(fract(vRoadAlong / 12.0), 0.5);
    road = mix(road, vec3(0.95), smoothstep(0.018 + aa, 0.018, center) * dash);
  }
} else if (vRoadKind > 2.5) {
  /* Huellas de las ruedas en el camino de tierra. */
  float ruts = smoothstep(0.08, 0.0, abs(abs(vRoadU - 0.5) - 0.22));
  road *= 1.0 - ruts * 0.18;
}
/* De lejos, tonos reales de ortofoto aérea: asfalto oscuro y tierra cálida. */
vec3 mapColor = vRoadKind < 0.5 ? vec3(0.26, 0.28, 0.30)
  : vRoadKind < 1.5 ? vec3(0.32, 0.34, 0.36)
  : vRoadKind < 2.5 ? vec3(0.42, 0.40, 0.38)
  : vRoadKind < 3.5 ? vec3(0.55, 0.48, 0.40)
  : vec3(0.62, 0.46, 0.3);
mapColor *= mix(0.72, 1.0, smoothstep(0.0, 0.18 + aa, edge));
diffuseColor.rgb = mix(mapColor, road, vRoadDetail);`,
      );
  };
  return material;
}

/**
 * Estructura de los puentes, hecha a mano: losa de hormigón bajo el tablero
 * (el tablero es la cinta del camino), veredas, barandas a cada lado y
 * pilares hasta el fondo cada `PIER_SPACING` km.
 *
 * @param {Array<{ kind: string, line: number[][], bridge?: boolean }>} roads
 * @param {Record<string, number>} widths Ancho real de cada tipo (m).
 * @param {(x: number, z: number) => number} heightAt
 * @param {{ toWorld: Function }} projection
 */
export function buildBridges(roads, widths, heightAt, projection) {
  const positions = [];
  const colors = [];
  const quad = (a, b, c, d, tint) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let k = 0; k < 6; k += 1) colors.push(...tint);
  };
  /* Caja entre dos secciones (cada una: puntos izquierdo y derecho, alto y bajo). */
  const sweep = (left0, right0, left1, right1, top, bottom, tint, sideTint = tint) => {
    const at = (p, y) => [p.x, y, p.z];
    quad(at(left0, top[0]), at(left1, top[1]), at(right1, top[1]), at(right0, top[0]), tint);
    quad(
      at(left0, bottom[0]),
      at(right0, bottom[0]),
      at(right1, bottom[1]),
      at(left1, bottom[1]),
      CONCRETE_DARK,
    );
    quad(
      at(left0, bottom[0]),
      at(left1, bottom[1]),
      at(left1, top[1]),
      at(left0, top[0]),
      sideTint,
    );
    quad(
      at(right1, bottom[1]),
      at(right0, bottom[0]),
      at(right0, top[0]),
      at(right1, top[1]),
      sideTint,
    );
  };
  for (const road of roads) {
    if (!road.bridge) continue;
    const points = roadPoints(road, heightAt, projection);
    if (points.length < 2) continue;
    const half = (widths[road.kind] ?? 6) / 2000 + SIDEWALK;
    const offset = (p, n, d) => ({ x: p.x + n.x * d, z: p.z + n.z * d });
    let sincePier = PIER_SPACING / 2;
    for (let k = 1; k < points.length; k += 1) {
      const [a, b] = [points[k - 1], points[k]];
      const [na, nb] = [sideways(points, k - 1), sideways(points, k)];
      const deck = [a.y - ROAD_LIFT * 0.2, b.y - ROAD_LIFT * 0.2];
      /* Losa. */
      sweep(
        offset(a, na, half),
        offset(a, na, -half),
        offset(b, nb, half),
        offset(b, nb, -half),
        deck,
        [deck[0] - DECK_THICKNESS, deck[1] - DECK_THICKNESS],
        CONCRETE,
      );
      /* Barandas. */
      for (const s of [1, -1]) {
        const outer = half * s;
        const inner = (half - PARAPET_WIDTH) * s;
        sweep(
          offset(a, na, outer),
          offset(a, na, inner),
          offset(b, nb, outer),
          offset(b, nb, inner),
          [deck[0] + PARAPET_HEIGHT, deck[1] + PARAPET_HEIGHT],
          deck,
          PARAPET,
        );
      }
      /* Pilares. */
      sincePier += Math.hypot(b.x - a.x, b.z - a.z);
      if (sincePier >= PIER_SPACING && k < points.length - 1) {
        sincePier = 0;
        const along = {
          x: (b.x - a.x) / Math.hypot(b.x - a.x, b.z - a.z),
          z: (b.z - a.z) / Math.hypot(b.x - a.x, b.z - a.z),
        };
        const width = half * 0.75;
        const bottom = heightAt(b.x, b.z) - 0.002;
        const top = deck[1] - DECK_THICKNESS;
        const corner = (u, v) => ({
          x: b.x + along.x * u + nb.x * v,
          z: b.z + along.z * u + nb.z * v,
        });
        const l = PIER_LENGTH / 2;
        sweep(
          corner(-l, width),
          corner(-l, -width),
          corner(l, width),
          corner(l, -width),
          [top, top],
          [bottom, bottom],
          CONCRETE,
          CONCRETE_DARK,
        );
        quad(
          [corner(-l, width).x, bottom, corner(-l, width).z],
          [corner(-l, -width).x, bottom, corner(-l, -width).z],
          [corner(-l, -width).x, top, corner(-l, -width).z],
          [corner(-l, width).x, top, corner(-l, width).z],
          CONCRETE,
        );
        quad(
          [corner(l, -width).x, bottom, corner(l, -width).z],
          [corner(l, width).x, bottom, corner(l, width).z],
          [corner(l, width).x, top, corner(l, width).z],
          [corner(l, -width).x, top, corner(l, -width).z],
          CONCRETE,
        );
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
