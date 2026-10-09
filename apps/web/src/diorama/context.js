import { BufferAttribute, BufferGeometry, MeshStandardMaterial, Vector4 } from 'three';
import { metersToY } from './projection.js';

/*
 * El paisaje de contexto queda un poco bajo la zona (km), para que en el
 * borde mande el relieve detallado; en una franja de `SEAM_KM` junto a la
 * zona su altura se funde con la del borde de la zona, sin escalones.
 */
const CONTEXT_DROP = 0.0015;
const SEAM_KM = 0.35;

/*
 * El contexto no se dibuja dentro de la zona (ahí va el relieve detallado).
 */
const HOLE_MARGIN = 0;

/**
 * Altura del paisaje de contexto en (x, z) de la maqueta, la misma que dibuja
 * su malla: interpola los vértices de la malla (uno cada `step` celdas),
 * hundida `CONTEXT_DROP` y fundida con el borde de la zona.
 *
 * @param {{ bounds: { west: number, south: number, east: number, north: number },
 *   columns: number, rows: number }} grid
 * @param {Uint16Array} heights
 * @param {{ toLngLat: Function, width: number, depth: number }} projection Proyección de la zona.
 * @param {(x: number, z: number) => number} zoneHeightAt
 * @param {number} [step]
 */
export function createContextSampler(grid, heights, projection, zoneHeightAt, step = 2) {
  const { bounds, columns, rows } = grid;
  const at = (c, r) => heights[Math.min(r, rows - 1) * columns + Math.min(c, columns - 1)];
  return (x, z) => {
    const [lng, lat] = projection.toLngLat(x, z);
    const fc =
      Math.min(
        Math.max(((lng - bounds.west) / (bounds.east - bounds.west)) * (columns - 1), 0),
        columns - 1,
      ) / step;
    const fr =
      Math.min(
        Math.max(((bounds.north - lat) / (bounds.north - bounds.south)) * (rows - 1), 0),
        rows - 1,
      ) / step;
    const c0 = Math.floor(fc);
    const r0 = Math.floor(fr);
    const tx = fc - c0;
    const tz = fr - r0;
    const h = (c, r) => at(c * step, r * step);
    const meters =
      (h(c0, r0) * (1 - tx) + h(c0 + 1, r0) * tx) * (1 - tz) +
      (h(c0, r0 + 1) * (1 - tx) + h(c0 + 1, r0 + 1) * tx) * tz;
    return seamBlend(x, z, metersToY(meters) - CONTEXT_DROP, projection, zoneHeightAt);
  };
}

/**
 * Funde la altura del contexto con la del borde de la zona en la franja de
 * `SEAM_KM` junto a ella (0 dentro de la zona).
 */
function seamBlend(x, z, own, projection, zoneHeightAt) {
  const dx = Math.max(Math.abs(x) - projection.width / 2, 0);
  const dz = Math.max(Math.abs(z) - projection.depth / 2, 0);
  const t = Math.min(Math.hypot(dx, dz) / SEAM_KM, 1);
  const blend = t * t * (3 - 2 * t);
  const seam = zoneHeightAt(x, z) - CONTEXT_DROP;
  return seam + (own - seam) * blend;
}

/**
 * Malla del paisaje que rodea la zona: una grilla de su relieve (un vértice
 * cada `step` celdas) en las mismas coordenadas de la maqueta, levemente
 * hundida. Las coordenadas de textura recorren todo el contexto.
 *
 * @param {{ bounds: { west: number, south: number, east: number, north: number },
 *   columns: number, rows: number }} grid
 * @param {Uint16Array} heights
 * @param {{ toWorld: Function, width: number, depth: number }} projection Proyección de la zona.
 * @param {(x: number, z: number) => number} zoneHeightAt Relieve de la zona (para la costura).
 * @param {number} [step]
 */
export function buildContextTerrain(grid, heights, projection, zoneHeightAt, step = 2) {
  const { bounds, columns, rows } = grid;
  const cols = [];
  for (let c = 0; c < columns; c += step) cols.push(c);
  if (cols.at(-1) !== columns - 1) cols.push(columns - 1);
  const rws = [];
  for (let r = 0; r < rows; r += step) rws.push(r);
  if (rws.at(-1) !== rows - 1) rws.push(rows - 1);
  const w = cols.length;
  const h = rws.length;
  const position = new Float32Array(w * h * 3);
  const uv = new Float32Array(w * h * 2);
  rws.forEach((row, j) => {
    const lat = bounds.north - (row / (rows - 1)) * (bounds.north - bounds.south);
    cols.forEach((col, i) => {
      const lng = bounds.west + (col / (columns - 1)) * (bounds.east - bounds.west);
      const { x, z } = projection.toWorld([lng, lat]);
      const k = j * w + i;
      const own = metersToY(heights[row * columns + col]) - CONTEXT_DROP;
      position[k * 3] = x;
      position[k * 3 + 1] = seamBlend(x, z, own, projection, zoneHeightAt);
      position[k * 3 + 2] = z;
      uv[k * 2] = col / (columns - 1);
      uv[k * 2 + 1] = row / (rows - 1);
    });
  });
  const index = new Uint32Array((w - 1) * (h - 1) * 6);
  let n = 0;
  for (let j = 0; j < h - 1; j += 1) {
    for (let i = 0; i < w - 1; i += 1) {
      const a = j * w + i;
      index.set([a, a + w, a + 1, a + 1, a + w, a + w + 1], n);
      n += 6;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  geometry.setIndex(new BufferAttribute(index, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Material del contexto: su foto horneada, sin dibujarse dentro de la zona
 * (ahí va el relieve detallado).
 *
 * @param {import('three').Texture} map
 * @param {{ width: number, depth: number }} zone Tamaño de la zona (km).
 */
export function contextMaterial(map, zone) {
  const material = new MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 });
  const hole = new Vector4(
    -zone.width / 2 + HOLE_MARGIN,
    -zone.depth / 2 + HOLE_MARGIN,
    zone.width / 2 - HOLE_MARGIN,
    zone.depth / 2 - HOLE_MARGIN,
  );
  material.onBeforeCompile = (shader) => {
    shader.uniforms.zoneHole = { value: hole };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec4 zoneHole;\nvarying vec2 vGround;',
      )
      .replace(
        'void main() {',
        `void main() {
  if (vGround.x > zoneHole.x && vGround.x < zoneHole.z && vGround.y > zoneHole.y && vGround.y < zoneHole.w) discard;`,
      );
  };
  return material;
}
