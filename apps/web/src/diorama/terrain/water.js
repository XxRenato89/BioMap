import {
  Color,
  DataTexture,
  DoubleSide,
  LinearFilter,
  MeshStandardMaterial,
  RedFormat,
  UnsignedByteType,
  Vector2,
} from 'three';
import { VERTICAL_EXAGGERATION } from '../utils/projection.js';

/**
 * Distancia a la orilla de cada celda de agua de la zona (m, del build) como
 * textura de un canal: 0 en la orilla, 1 a 255 m o más.
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint8Array} shore
 */
export function shoreTexture(meta, shore) {
  const texture = new DataTexture(shore, meta.columns, meta.rows, RedFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Hunde bajo la superficie del agua (la malla que realmente se dibuja) cada
 * celda de agua del relieve que quedara por encima de ella. El build rebaja
 * el fondo con un nivel interpolado distinto al de la malla del agua y, donde
 * no coinciden, el cauce seco asomaba como manchas oscuras sobre el agua.
 * Modifica `heights`.
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint16Array} heights Metros.
 * @param {Uint8Array} shore Distancia a la orilla (> 0 = agua).
 * @param {import('three').BufferGeometry} geometry Malla del agua (`buildWater`).
 * @param {{ width: number, depth: number }} projection
 * @param {number} [margin] Metros que queda el fondo bajo el agua.
 * @returns {number} Celdas hundidas.
 */
export function sinkUnderWater(
  meta,
  heights,
  shore,
  geometry,
  projection,
  margin = 1.5,
  levels = null,
) {
  const { columns, rows } = meta;
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const count = index ? index.count : position.count;
  const vertex = (k) => {
    const v = index ? index.getX(k) : k;
    return [
      (position.getX(v) / projection.width + 0.5) * (columns - 1),
      (position.getZ(v) / projection.depth + 0.5) * (rows - 1),
      (position.getY(v) * 1000) / VERTICAL_EXAGGERATION,
    ];
  };
  let sunk = 0;
  for (let t = 0; t + 2 < count; t += 3) {
    const [a, b, c] = [vertex(t), vertex(t + 1), vertex(t + 2)];
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-9) continue;
    const c0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const c1 = Math.min(columns - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const r0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const r1 = Math.min(rows - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) {
        const i = row * columns + col;
        if (!shore[i]) continue;
        const w0 = ((b[0] - col) * (c[1] - row) - (b[1] - row) * (c[0] - col)) / area;
        const w1 = ((c[0] - col) * (a[1] - row) - (c[1] - row) * (a[0] - col)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const surface = w0 * a[2] + w1 * b[2] + w2 * c[2];
        if (levels) levels[i] = surface;
        const floor = Math.max(0, Math.floor(surface - margin));
        if (heights[i] > floor) {
          heights[i] = floor;
          sunk += 1;
        }
      }
    }
  }
  return sunk;
}

/**
 * Orillas sin barrancos ni huecos: la tierra a menos de `reach` celdas del
 * agua se lleva suave hasta el nivel del agua más cercana (sube si quedaba
 * bajo el agua, baja si formaba un muro), como una playa en pendiente.
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint16Array} heights Metros; se modifica.
 * @param {Uint8Array} shore > 0 en las celdas de agua.
 * @param {Float32Array} levels Nivel del agua (m) de cada celda de agua (ver sinkUnderWater).
 * @param {number} [reach] Celdas (~4,4 m cada una).
 */
export function blendShore(meta, heights, shore, levels, reach = 10) {
  const { columns } = meta;
  const distance = new Uint8Array(heights.length).fill(255);
  const level = new Float32Array(heights.length);
  let frontier = [];
  for (let i = 0; i < shore.length; i += 1) {
    if (shore[i] && levels[i] > 0) {
      distance[i] = 0;
      level[i] = levels[i];
      frontier.push(i);
    }
  }
  for (let step = 1; step <= reach && frontier.length > 0; step += 1) {
    const next = [];
    for (const i of frontier) {
      const col = i % columns;
      const neighbours = [i - columns, i + columns];
      if (col > 0) neighbours.push(i - 1);
      if (col < columns - 1) neighbours.push(i + 1);
      for (const j of neighbours) {
        if (j < 0 || j >= heights.length || distance[j] !== 255 || shore[j]) continue;
        distance[j] = step;
        level[j] = level[i];
        next.push(j);
      }
    }
    const t = (step - 1) / reach;
    const keep = t * t * (3 - 2 * t);
    for (const j of next) heights[j] = Math.round(level[j] + (heights[j] - level[j]) * keep);
    frontier = next;
  }
}

/*
 * Corriente general del agua (m/s, hacia el poniente, como baja el Biobío).
 */
const FLOW = new Vector2(-0.55, -0.15);

/**
 * Agua viva y cristalina: una capa opaca con profundidad garantizada que cubre
 * el relieve sin dejar ver imperfecciones del fondo, con color turquesa vivo en
 * las orillas, azul profundo al centro, espuma dinámica en las riberas y reflejos
 * del cielo.
 *
 * @param {import('three').Texture} shore Ver `shoreTexture`.
 * @param {{ width: number, depth: number }} zone Tamaño de la zona (km).
 */
export function waterMaterial(shore, zone) {
  const material = new MeshStandardMaterial({
    color: new Color('#0a242a'),
    roughness: 0.1,
    metalness: 0.04,
    side: DoubleSide,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const time = { value: 0 };
  material.userData.time = time;
  const half = new Vector2(zone.width / 2, zone.depth / 2);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.waterTime = time;
    shader.uniforms.waterShore = { value: shore };
    shader.uniforms.waterHalf = { value: half };
    shader.uniforms.waterFlow = { value: FLOW };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWater;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWater = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float waterTime;
uniform sampler2D waterShore;
uniform vec2 waterHalf;
uniform vec2 waterFlow;
varying vec3 vWater;
float shoreMeters;
vec2 waveSlope(vec2 p, vec2 dir, float length, float amp, float speed) {
  dir = normalize(dir);
  float k = 6.2831 / length;
  return dir * (amp * k * cos(dot(p, dir) * k + waterTime * speed));
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec2 shoreUv = vWater.xz / (2.0 * waterHalf) + 0.5;
bool outsideZone = any(lessThan(shoreUv, vec2(0.0))) || any(greaterThan(shoreUv, vec2(1.0)));
shoreMeters = outsideZone ? 60.0 : texture2D(waterShore, clamp(shoreUv, 0.0, 1.0)).r * 255.0;
/* Tonos fotorrealistas del Embalse Angostura: esmeralda oscuro en orillas, azul profundo en el centro */
vec3 shallow = vec3(0.06, 0.24, 0.24);
vec3 deep = vec3(0.018, 0.07, 0.105);
vec3 waterColor = mix(shallow, deep, smoothstep(2.0, 45.0, shoreMeters));
/* Aguas bajas junto a la orilla: el fondo de arena y grava tiñe el agua. */
waterColor = mix(waterColor, vec3(0.2, 0.33, 0.28), (1.0 - smoothstep(0.0, 6.0, shoreMeters)) * 0.45);
vec2 meters = vWater.xz * 1000.0;
float ripple = sin(meters.x * 0.33 + waterTime * 1.2) * sin(meters.y * 0.29 - waterTime * 0.9);
float shoreEdge = (1.0 - smoothstep(0.0, 2.0 + ripple * 0.4, shoreMeters));
/* Sutil transición en la orilla inmediata sin espuma blanca marina artificial */
waterColor = mix(waterColor, vec3(0.3, 0.42, 0.38), shoreEdge * 0.4);
diffuseColor.rgb = waterColor;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
vec2 drift = vWater.xz * 1000.0 - waterFlow * waterTime;
vec2 slope = waveSlope(drift, vec2(1.0, 0.25), 9.0, 0.04, 1.4)
  + waveSlope(drift, vec2(0.7, -0.8), 5.5, 0.025, 1.8)
  + waveSlope(drift, vec2(-0.3, 1.0), 3.2, 0.012, 2.2)
  + waveSlope(drift, vec2(0.9, 0.6), 17.0, 0.05, 0.9);
vec3 wavePerturbation = (viewMatrix * vec4(-slope.x, 0.0, -slope.y, 0.0)).xyz * 0.22;
normal = normalize(normal + wavePerturbation);
vec3 viewDir = normalize(vViewPosition);
float nDotV = dot(normal, viewDir);
if (nDotV < 0.2) {
  normal = normalize(normal + viewDir * (0.2 - nDotV));
}`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
float fresnel = pow(1.0 - facing, 3.4);
/* Reflejo del cielo contenido: con la cámara inclinada, un reflejo pleno blanquea el agua. */
vec3 skyColor = vec3(0.42, 0.6, 0.72);
vec3 waterAmbient = mix(vec3(0.02, 0.07, 0.09), skyColor, fresnel * 0.7);
reflectedLight.indirectDiffuse += waterAmbient * (0.5 + 0.3 * fresnel);
/* Destellos del sol en las crestas de las olas. */
vec3 sunDir = normalize((viewMatrix * vec4(-0.75, 0.6, -0.33, 0.0)).xyz);
float glint = pow(max(dot(reflect(-normalize(vViewPosition), normal), sunDir), 0.0), 220.0);
reflectedLight.directSpecular += vec3(1.0, 0.94, 0.82) * glint * 1.6;
reflectedLight.directDiffuse = max(reflectedLight.directDiffuse, diffuseColor.rgb * 0.35);`,
      );
  };
  return material;
}
