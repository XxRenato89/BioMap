import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gridNormal } from './bake.js';
import { LANDCOVER } from './landcover.js';
import { valueNoise } from './noise.js';
import { createHeightSampler, metersToY, VERTICAL_EXAGGERATION } from './projection.js';
import { TREE_KINDS } from './trees.js';

export { bakeSurface } from './bake.js';
export { buildTerrainChunks } from './lod.js';

/**
 * Textura de detalle fino (grano de suelo, pasto y roca), repetida sobre el
 * terreno para que de cerca no se vea borroso. Se genera aquí: no hay que
 * descargar imágenes.
 *
 * @param {number} size Lado en píxeles (potencia de 2).
 */
export function bakeDetail(size = 512) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      /* Ruido periódico: se repite sin costuras. */
      const sample = (scale) => {
        const u = (x / size) * scale;
        const v = (y / size) * scale;
        return valueNoise(u % scale, v % scale);
      };
      const value = sample(8) * 0.45 + sample(32) * 0.35 + sample(128) * 0.2;
      const o = (y * size + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = value * 255;
      data[o + 3] = 255;
    }
  }
  return data;
}

/*
 * Cuánto queda el agua sobre su nivel (km): el fondo ya viene rebajado y las
 * orillas levantadas en el build, así que basta un poco para que no parpadee.
 */
const WATER_LIFT = 0.0004;

/**
 * Agua (embalses y el cauce del Biobío): polígonos de OpenStreetMap apoyados
 * sobre el relieve, en una sola malla.
 *
 * @param {Array<{ outer: number[][], holes: number[][][] }>} polygons
 * @param {{ toWorld: Function }} projection
 * @param {(x: number, z: number) => number} heightAt
 */
export function buildWater(polygons, projection, heightAt) {
  const parts = polygons.map(({ outer, holes }) => {
    const toVec = (ring) =>
      ring.slice(0, -1).map((point) => {
        const { x, z } = projection.toWorld(point);
        return new Vector2(x, z);
      });
    const contour = toVec(outer);
    const holeRings = holes.map(toVec);
    const faces = ShapeUtils.triangulateShape(contour, holeRings);
    const points = [...contour, ...holeRings.flat()];
    /* Nivel de cada punto de orilla (del build, ver inlay.js) o, si no hay, el terreno. */
    const levels = [outer, ...holes].flatMap((ring) => ring.slice(0, -1).map((point) => point[2]));
    const position = new Float32Array(points.length * 3);
    points.forEach(({ x, y }, k) => {
      position[k * 3] = x;
      position[k * 3 + 1] =
        (levels[k] === undefined ? heightAt(x, y) : metersToY(levels[k])) + WATER_LIFT;
      position[k * 3 + 2] = y;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute(
      'normal',
      new BufferAttribute(
        new Float32Array(points.length * 3).map((_, k) => (k % 3 === 1 ? 1 : 0)),
        3,
      ),
    );
    geometry.setIndex(faces.flatMap(([a, b, c]) => [a, c, b]));
    return geometry;
  });
  return mergeGeometries(parts.filter((geometry) => geometry.index.count > 0));
}

/**
 * Tipo de árbol según el lugar. WorldCover no distingue plantaciones de
 * bosque nativo: en la zona, las plantaciones (pino, eucalipto) ocupan los
 * lomajes bajos y suaves, y el bosque nativo la precordillera y las laderas fuertes.
 *
 * @param {number} meters Altura del terreno.
 * @param {number} slopeDeg Pendiente en grados.
 * @returns {'plantation' | 'native'}
 */
export function treeKind(meters, slopeDeg) {
  return meters < 900 && slopeDeg < 20 ? 'plantation' : 'native';
}

/**
 * Especie de una plantación: las plantaciones se ordenan en rodales parejos
 * de pino o de eucalipto (manchas de ~400 m), no mezcladas árbol a árbol.
 *
 * @param {number} x Posición en la maqueta (km).
 * @param {number} z
 * @returns {'pine' | 'eucalyptus'}
 */
export function plantationSpecies(x, z) {
  return valueNoise(x / 0.4 + 31.7, z / 0.4 - 12.3) < 0.55 ? 'pine' : 'eucalyptus';
}

/*
 * Altura real de los árboles (m): robles y coigües de 15 a 28 m, pinos
 * radiata de 22 a 32 m y eucaliptos, los más altos, de 25 a 40 m.
 */
const TREE_HEIGHT = { native: [15, 28], pine: [22, 32], eucalyptus: [25, 40] };

/*
 * Probabilidad de plantar según la cobertura de suelo: bosque casi lleno,
 * matorral ralo y nada en el resto.
 */
const COVER_CHANCE = { [LANDCOVER.tree]: 0.92, [LANDCOVER.shrubland]: 0.18 };

/**
 * Número pseudoaleatorio en [0, 1) fijo para una celda (i, j) y un canal:
 * cada árbol queda siempre en el mismo lugar aunque el bosque se vuelva a plantar.
 */
function cellRandom(i, j, channel) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(channel, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Agrega un árbol a su conjunto: tamaño real (con `scale`), giro y tono
 * propios según la especie, siempre los mismos para la celda (i, j).
 */
function emitTree(target, kind, x, ground, z, meters, i, j, scale, color) {
  const [low, high] = TREE_HEIGHT[kind];
  const size = ((low + (high - low) * cellRandom(i, j, 4)) * scale) / 1000;
  const tall = size * (0.92 + cellRandom(i, j, 5) * 0.16);
  const angle = cellRandom(i, j, 6) * Math.PI * 2;
  const cos = Math.cos(angle) * size;
  const sin = Math.sin(angle) * size;
  target.matrices.set(
    [cos, 0, -sin, 0, 0, tall, 0, 0, sin, 0, cos, 0, x, ground - 0.001, z, 1],
    target.count * 16,
  );
  const r = cellRandom(i, j, 7);
  if (kind === 'pine') {
    color.setHSL(0.3 + r * 0.03, 0.42, 0.15 + cellRandom(i, j, 8) * 0.04);
  } else if (kind === 'eucalyptus') {
    /* Verde azulado y grisáceo, más claro que el pino. */
    color.setHSL(
      0.38 + r * 0.05,
      0.22 + cellRandom(i, j, 8) * 0.08,
      0.32 + cellRandom(i, j, 9) * 0.06,
    );
  } else {
    /* Más oscuro y frío en altura (coigüe, lenga); más claro en los valles. */
    const altitude = Math.min(Math.max((meters - 600) / 1400, 0), 1);
    color.setHSL(
      0.25 + r * 0.08,
      0.36 + cellRandom(i, j, 8) * 0.16,
      0.2 + cellRandom(i, j, 9) * 0.08 - altitude * 0.05,
    );
  }
  target.colors.set([color.r, color.g, color.b], target.count * 3);
  target.count += 1;
}

/**
 * Bosque a escala real alrededor de un punto: una grilla de celdas de
 * `spacing` km dentro de `radius`, con a lo más un árbol por celda según la
 * cobertura de suelo de WorldCover (nunca en pendientes muy fuertes). Los
 * árboles miden lo que miden en la realidad (1 unidad = 1 km), así que solo
 * se ven de cerca; de lejos, el bosque es la imagen satelital. Hacia el borde
 * del círculo se achican, para que no se note dónde termina.
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint16Array} heights
 * @param {{ width: number, depth: number }} projection
 * @param {{ data: Uint8Array, columns: number, rows: number }} cover
 * @param {{ center: [number, number], radius: number, spacing: number, max: number,
 *   fade?: boolean, blocked?: (cell: number) => boolean }} area `fade` achica los
 *   árboles hacia el borde del círculo; `blocked` descarta celdas del relieve
 *   (por ejemplo, las de agua).
 * @returns {{ native: TreeSet, pine: TreeSet, eucalyptus: TreeSet }}
 *
 * @typedef {{ matrices: Float32Array, colors: Float32Array, count: number }} TreeSet
 */
export function plantForest(
  meta,
  heights,
  projection,
  cover,
  { center, radius, spacing, max, fade = true, blocked },
) {
  const { columns, rows } = meta;
  const cellX = projection.width / (columns - 1);
  const cellZ = projection.depth / (rows - 1);
  const heightAt = createHeightSampler(meta, heights, projection);
  const slot = () => ({
    matrices: new Float32Array(max * 16),
    colors: new Float32Array(max * 3),
    count: 0,
  });
  const kinds = Object.fromEntries(TREE_KINDS.map((kind) => [kind, slot()]));
  const color = new Color();
  const [cx, cz] = center;
  const i0 = Math.floor((cx - radius) / spacing);
  const i1 = Math.ceil((cx + radius) / spacing);
  const j0 = Math.floor((cz - radius) / spacing);
  const j1 = Math.ceil((cz + radius) / spacing);
  let planted = 0;
  for (let j = j0; j <= j1 && planted < max; j += 1) {
    for (let i = i0; i <= i1 && planted < max; i += 1) {
      const x = (i + cellRandom(i, j, 1)) * spacing;
      const z = (j + cellRandom(i, j, 2)) * spacing;
      const distance = Math.hypot(x - cx, z - cz);
      if (distance > radius) continue;
      const u = x / projection.width + 0.5;
      const v = z / projection.depth + 0.5;
      if (u <= 0 || u >= 1 || v <= 0 || v >= 1) continue;
      const cls =
        cover.data[Math.floor(v * cover.rows) * cover.columns + Math.floor(u * cover.columns)];
      if (cellRandom(i, j, 3) >= (COVER_CHANCE[cls] ?? 0)) continue;
      const col = Math.min(columns - 2, Math.max(1, Math.round(u * (columns - 1))));
      const row = Math.min(rows - 2, Math.max(1, Math.round(v * (rows - 1))));
      const n = gridNormal(heights, columns, rows, col, row, cellX, cellZ);
      const slopeDeg = (Math.acos(n[1]) * 180) / Math.PI;
      if (slopeDeg > 42 || blocked?.(row * columns + col)) continue;
      const meters = heights[row * columns + col];
      const kind = treeKind(meters, slopeDeg) === 'plantation' ? plantationSpecies(x, z) : 'native';
      const edge = fade ? Math.min(Math.max((radius - distance) / (radius * 0.25), 0), 1) : 1;
      emitTree(kinds[kind], kind, x, heightAt(x, z), z, meters, i, j, 0.35 + 0.65 * edge, color);
      planted += 1;
    }
  }
  return kinds;
}

/**
 * Bosque del borde: fuera de la zona, en una franja de `band` km, el bosque
 * sigue sobre el paisaje de contexto pero cada vez más ralo y más bajo, para
 * que la maqueta no termine en una línea recta de árboles.
 *
 * @param {{ width: number, depth: number }} zone Tamaño de la zona (km).
 * @param {(x: number, z: number) => number} groundAt Altura del paisaje (unidades).
 * @param {(x: number, z: number) => number} coverAt Clase de cobertura en (x, z).
 * @param {{ band: number, spacing: number, max: number }} options
 * @returns {{ native: TreeSet, pine: TreeSet, eucalyptus: TreeSet }}
 */
export function plantFringe(zone, groundAt, coverAt, { band, spacing, max }) {
  const slot = () => ({
    matrices: new Float32Array(max * 16),
    colors: new Float32Array(max * 3),
    count: 0,
  });
  const kinds = Object.fromEntries(TREE_KINDS.map((kind) => [kind, slot()]));
  const color = new Color();
  const halfW = zone.width / 2;
  const halfD = zone.depth / 2;
  const i0 = Math.floor((-halfW - band) / spacing);
  const i1 = Math.ceil((halfW + band) / spacing);
  const j0 = Math.floor((-halfD - band) / spacing);
  const j1 = Math.ceil((halfD + band) / spacing);
  const probe = 0.03;
  let planted = 0;
  for (let j = j0; j <= j1 && planted < max; j += 1) {
    for (let i = i0; i <= i1 && planted < max; i += 1) {
      const x = (i + cellRandom(i, j, 1)) * spacing;
      const z = (j + cellRandom(i, j, 2)) * spacing;
      const distance = Math.hypot(
        Math.max(Math.abs(x) - halfW, 0),
        Math.max(Math.abs(z) - halfD, 0),
      );
      if (distance <= 0 || distance > band) continue;
      const fade = (1 - distance / band) ** 1.5;
      if (cellRandom(i, j, 3) >= (COVER_CHANCE[coverAt(x, z)] ?? 0) * fade) continue;
      const ground = groundAt(x, z);
      const slope =
        Math.hypot(
          groundAt(x + probe, z) - groundAt(x - probe, z),
          groundAt(x, z + probe) - groundAt(x, z - probe),
        ) /
        (2 * probe);
      const slopeDeg = (Math.atan(slope) * 180) / Math.PI;
      if (slopeDeg > 42) continue;
      const meters = (ground * 1000) / VERTICAL_EXAGGERATION;
      const kind = treeKind(meters, slopeDeg) === 'plantation' ? plantationSpecies(x, z) : 'native';
      emitTree(kinds[kind], kind, x, ground, z, meters, i, j, 0.6 + 0.4 * fade, color);
      planted += 1;
    }
  }
  return kinds;
}

/*
 * Medidas de un muro de presa (km): ancho del coronamiento, talud de cada
 * cara (ancho extra por unidad de alto, como una presa de gravedad) y cuánto
 * se entierra bajo el cauce.
 */
const DAM_CREST_WIDTH = 0.01;
const DAM_SLOPE = 0.38;
const DAM_FOOTING = 0.01;
const CONCRETE = [0.86, 0.85, 0.82];
const CONCRETE_SHADED = [0.7, 0.69, 0.66];
const PARAPET = [0.93, 0.92, 0.9];
const DAM_PARAPET = 0.0011;

/**
 * Densifica una línea (x, z) con puntos cada ~10 m, para que el muro siga
 * el fondo del cauce.
 */
function densify(points, maxLength = 0.01) {
  const dense = [points[0]];
  for (let k = 1; k < points.length; k += 1) {
    const [a, b] = [points[k - 1], points[k]];
    const parts = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / maxLength));
    for (let p = 1; p <= parts; p += 1)
      dense.push({ x: a.x + ((b.x - a.x) * p) / parts, z: a.z + ((b.z - a.z) * p) / parts });
  }
  return dense;
}

/**
 * Muro de hormigón de una presa, a escala real, desde su geometría en
 * OpenStreetMap:
 * - si es una línea (el coronamiento), un muro de sección trapezoidal que la
 *   sigue: angosto arriba y más ancho abajo, como una presa de gravedad;
 * - si es un polígono cerrado (la planta de la presa), ese polígono levantado
 *   como un bloque macizo.
 * La base queda bajo el punto más bajo del cauce y el coronamiento,
 * `heightMeters` más arriba. Si no se conoce la altura, se estima con el
 * relieve: el extremo más alto de la línea, o las laderas donde se apoya el polígono.
 * Una cara es más oscura para que se lea el volumen.
 *
 * @param {number[][]} line Puntos [lng, lat].
 * @param {(x: number, z: number) => number} heightAt
 * @param {{ toWorld: Function }} projection
 * @param {number} [heightMeters] Altura del muro sobre el cauce (m).
 */
export function buildDamWall(line, heightAt, projection, heightMeters) {
  const points = line.map((point) => projection.toWorld(point));
  const closed =
    points.length > 3 &&
    Math.hypot(points[0].x - points.at(-1).x, points[0].z - points.at(-1).z) < 1e-6;
  const dense = densify(points);
  const ground = dense.map(({ x, z }) => heightAt(x, z));
  const riverbed = Math.min(...ground);
  const sorted = [...ground].sort((a, b) => a - b);
  let crest = closed ? sorted[Math.floor(sorted.length * 0.7)] : Math.max(ground[0], ground.at(-1));
  if (heightMeters !== undefined) crest = riverbed + metersToY(heightMeters);
  const base = riverbed - DAM_FOOTING;

  const positions = [];
  const colors = [];
  const tri = (a, b, c, tint) => {
    positions.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k += 1) colors.push(...tint);
  };
  const quad = (a, b, c, d, tint) => {
    tri(a, b, c, tint);
    tri(a, c, d, tint);
  };

  if (closed) {
    const ring = points.slice(0, -1);
    const contour = ring.map(({ x, z }) => new Vector2(x, z));
    const clockwise = ShapeUtils.isClockWise(contour);
    for (const [a, b, c] of ShapeUtils.triangulateShape(contour, [])) {
      const at = (k) => [ring[k].x, crest, ring[k].z];
      if (clockwise) tri(at(a), at(b), at(c), CONCRETE);
      else tri(at(a), at(c), at(b), CONCRETE);
    }
    ring.forEach((p, k) => {
      const q = ring[(k + 1) % ring.length];
      const [a, b] = clockwise ? [p, q] : [q, p];
      const tint = k % 2 ? CONCRETE : CONCRETE_SHADED;
      quad([a.x, base, a.z], [b.x, base, b.z], [b.x, crest, b.z], [a.x, crest, a.z], tint);
      /* Baranda del coronamiento: un murete a lo largo del borde. */
      const top = crest + DAM_PARAPET;
      quad([a.x, crest, a.z], [b.x, crest, b.z], [b.x, top, b.z], [a.x, top, a.z], PARAPET);
      quad([b.x, crest, b.z], [a.x, crest, a.z], [a.x, top, a.z], [b.x, top, b.z], PARAPET);
    });
  } else {
    /* Medio ancho del muro a la altura y: crece hacia abajo con el talud. */
    const halfWidth = (y) => DAM_CREST_WIDTH / 2 + Math.max(crest - y, 0) * DAM_SLOPE;
    const side = (a, b) => {
      const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return { x: -(b.z - a.z) / length, z: (b.x - a.x) / length };
    };
    const at = (p, n, s, y) => [p.x + n.x * s * halfWidth(y), y, p.z + n.z * s * halfWidth(y)];
    for (let k = 1; k < dense.length; k += 1) {
      const [a, b] = [dense[k - 1], dense[k]];
      const n = side(a, b);
      quad(
        at(a, n, 1, crest),
        at(b, n, 1, crest),
        at(b, n, -1, crest),
        at(a, n, -1, crest),
        CONCRETE,
      );
      quad(at(a, n, 1, base), at(b, n, 1, base), at(b, n, 1, crest), at(a, n, 1, crest), CONCRETE);
      quad(
        at(b, n, -1, base),
        at(a, n, -1, base),
        at(a, n, -1, crest),
        at(b, n, -1, crest),
        CONCRETE_SHADED,
      );
    }
    for (const [end, next, s] of [
      [dense[0], dense[1], 1],
      [dense.at(-1), dense.at(-2), -1],
    ]) {
      const n = side(end, next);
      quad(
        at(end, n, -s, base),
        at(end, n, s, base),
        at(end, n, s, crest),
        at(end, n, -s, crest),
        CONCRETE_SHADED,
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/*
 * Colores de los edificios, como los de Mapbox: muros claros y cálidos que
 * se oscurecen hacia el suelo (sombra de contacto) y techos más claros.
 */
const ROOF = [0.95, 0.93, 0.9];
const WALL = [0.86, 0.82, 0.78];
const WALL_BASE = [0.62, 0.59, 0.56];

/**
 * Edificios de OpenStreetMap levantados a su altura real: su planta se
 * extruye desde bajo el terreno hasta la altura del edificio sobre el punto
 * más alto de su planta, con los colores de Mapbox (ver ROOF y WALL).
 *
 * @param {Array<{ ring: number[][], height: number }>} buildings
 * @param {(x: number, z: number) => number} heightAt
 * @param {{ toWorld: Function }} projection
 */
export function buildBuildings(buildings, heightAt, projection) {
  const positions = [];
  const colors = [];
  const tri = (a, b, c, tint) => {
    positions.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k += 1) colors.push(...tint);
  };
  for (const { ring: line, height } of buildings) {
    const ring = line.slice(0, -1).map((point) => projection.toWorld(point));
    if (ring.length < 3) continue;
    const ground = ring.map(({ x, z }) => heightAt(x, z));
    const base = Math.min(...ground) - 0.002;
    const top = Math.max(...ground) + height / 1000;
    const contour = ring.map(({ x, z }) => new Vector2(x, z));
    const clockwise = ShapeUtils.isClockWise(contour);
    for (const [a, b, c] of ShapeUtils.triangulateShape(contour, [])) {
      const at = (k) => [ring[k].x, top, ring[k].z];
      if (clockwise) tri(at(a), at(b), at(c), ROOF);
      else tri(at(a), at(c), at(b), ROOF);
    }
    ring.forEach((p, k) => {
      const q = ring[(k + 1) % ring.length];
      const [a, b] = clockwise ? [p, q] : [q, p];
      const low = (point) => ({ point: [point.x, base, point.z], tint: WALL_BASE });
      const high = (point) => ({ point: [point.x, top, point.z], tint: WALL });
      for (const face of [
        [low(a), low(b), high(b)],
        [low(a), high(b), high(a)],
      ]) {
        for (const { point, tint } of face) {
          positions.push(...point);
          colors.push(...tint);
        }
      }
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
