import {
  BufferAttribute,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../utils/noise.js';

/*
 * Modelos de los tres tipos de árbol de la maqueta, cada uno en dos versiones:
 * `detailed` (de cerca: copa de varias masas, ramas, pisos) y `simple` (de
 * lejos: unas pocas caras). Todos miden 1 de alto: la matriz de cada árbol
 * los escala a su altura real. El atributo `foliage` marca el follaje (1),
 * que toma el tono de cada árbol, y el tronco (0), que conserva su color.
 */

const hex = (value) => [
  ((value >> 16) & 255) / 255,
  ((value >> 8) & 255) / 255,
  (value & 255) / 255,
];

/* Modelos lejanos: tronco oscuro y follaje de poco contraste, para que no titilen. */
const FAR_TRUNK = hex(0x4a3b2e);
const farShade = (y) => 0.84 + (0.16 * Math.min(Math.max(y, 0), 1.2)) / 1.2;

const TRUNK_COLORS = {
  native: hex(0x5a4231),
  pine: hex(0x6b4a33),
  eucalyptus: hex(0x8f7f68),
};

/**
 * Pieza de un árbol con color por vértice. En el follaje, el color se
 * oscurece hacia abajo (la copa se sombrea a sí misma) según `shade(y)`.
 */
function piece(geometry, rgb, foliage, shade = () => 1) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.deleteAttribute('uv');
  flat.deleteAttribute('normal');
  const position = flat.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const marks = new Float32Array(position.count).fill(foliage);
  for (let k = 0; k < position.count; k += 1) {
    const light = shade(position.getY(k));
    colors.set(
      rgb.map((channel) => channel * light),
      k * 3,
    );
  }
  flat.setAttribute('color', new BufferAttribute(colors, 3));
  flat.setAttribute('foliage', new BufferAttribute(marks, 1));
  return flat;
}

/**
 * Masa de follaje irregular: un icosaedro con los vértices movidos al azar
 * (sin abrir grietas) para que no se vea como una esfera perfecta.
 */
function blob(radius, detail, random, roughness = 0.18) {
  const geometry = mergeVertices(
    new IcosahedronGeometry(radius, detail).deleteAttribute('normal').deleteAttribute('uv'),
  );
  const position = geometry.getAttribute('position');
  for (let k = 0; k < position.count; k += 1) {
    const grow = 1 + (random() - 0.5) * 2 * roughness;
    position.setXYZ(k, position.getX(k) * grow, position.getY(k) * grow, position.getZ(k) * grow);
  }
  return geometry;
}

/**
 * Sombreado vertical del follaje entre `bottom` y `top` (en la altura del modelo).
 */
const canopyShade = (bottom, top) => (y) =>
  0.68 + 0.42 * Math.min(Math.max((y - bottom) / (top - bottom), 0), 1);

/**
 * Une las piezas, deja el árbol de 1 de alto apoyado en y = 0 y calcula
 * normales por cara (aspecto facetado de maqueta).
 */
function assemble(parts) {
  const geometry = mergeGeometries(parts);
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const height = max.y - min.y;
  geometry.translate(0, -min.y, 0);
  geometry.scale(1 / height, 1 / height, 1 / height);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const WHITE = [1, 1, 1];

/**
 * Nativo (roble, coigüe): tronco con dos ramas y una copa ancha de varias
 * masas irregulares.
 */
function nativeDetailed() {
  const random = seeded(11);
  const trunk = TRUNK_COLORS.native;
  const shade = canopyShade(0.45, 1.15);
  const leaves = (geometry) => piece(geometry, WHITE, 1, shade);
  return assemble([
    piece(new CylinderGeometry(0.05, 0.085, 0.6, 7).translate(0, 0.3, 0), trunk, 0),
    piece(
      new CylinderGeometry(0.022, 0.032, 0.36, 5).rotateZ(0.75).translate(0.12, 0.6, 0),
      trunk,
      0,
    ),
    piece(
      new CylinderGeometry(0.02, 0.03, 0.32, 5)
        .rotateZ(-0.7)
        .rotateY(0.9)
        .translate(-0.08, 0.58, 0.07),
      trunk,
      0,
    ),
    leaves(blob(0.36, 1, random).translate(0, 0.82, 0)),
    leaves(blob(0.25, 0, random).translate(0.26, 0.7, 0.06)),
    leaves(blob(0.24, 0, random).translate(-0.24, 0.72, -0.08)),
    leaves(blob(0.22, 0, random).translate(0.02, 0.68, 0.26)),
    leaves(blob(0.21, 0, random).translate(-0.05, 0.7, -0.27)),
    leaves(blob(0.22, 1, random, 0.12).translate(0.04, 1.0, -0.02)),
    leaves(blob(0.18, 0, random).translate(0.2, 0.58, -0.2)),
    leaves(blob(0.17, 0, random).translate(-0.22, 0.6, 0.18)),
    leaves(blob(0.14, 0, random).translate(-0.12, 1.12, 0.1)),
  ]);
}

function nativeSimple() {
  return assemble([
    piece(new CylinderGeometry(0.06, 0.09, 0.55, 5).translate(0, 0.27, 0), FAR_TRUNK, 0),
    piece(
      new IcosahedronGeometry(0.42, 0).scale(1, 0.85, 1).translate(0, 0.85, 0),
      WHITE,
      1,
      farShade,
    ),
  ]);
}

/**
 * Pino (plantación de pino radiata): tronco alto y recto y la copa en pisos
 * de ramas que se angostan hacia la punta.
 */
function pineDetailed() {
  const shade = canopyShade(0.3, 1.25);
  const tiers = [0, 1, 2, 3, 4, 5, 6].map((k) =>
    piece(
      new ConeGeometry(0.28 - k * 0.034, 0.26, 10, 1, true)
        .rotateY(k * 0.7)
        .translate(0, 0.4 + k * 0.125, 0),
      WHITE,
      1,
      shade,
    ),
  );
  return assemble([
    piece(new CylinderGeometry(0.028, 0.055, 1.05, 6).translate(0, 0.52, 0), TRUNK_COLORS.pine, 0),
    ...tiers,
  ]);
}

function pineSimple() {
  return assemble([
    piece(new CylinderGeometry(0.035, 0.06, 0.5, 5).translate(0, 0.25, 0), FAR_TRUNK, 0),
    piece(new ConeGeometry(0.24, 0.95, 6).translate(0, 0.72, 0), WHITE, 1, farShade),
  ]);
}

/**
 * Eucalipto (plantación): tronco claro, alto y delgado que se bifurca, y una
 * copa alta, rala y alargada.
 */
function eucalyptusDetailed() {
  const random = seeded(29);
  const trunk = TRUNK_COLORS.eucalyptus;
  const shade = canopyShade(0.55, 1.2);
  const leaves = (geometry) => piece(geometry, WHITE, 1, shade);
  return assemble([
    piece(new CylinderGeometry(0.026, 0.045, 0.8, 6).translate(0, 0.4, 0), trunk, 0),
    piece(
      new CylinderGeometry(0.014, 0.022, 0.34, 5).rotateZ(0.32).translate(0.05, 0.92, 0),
      trunk,
      0,
    ),
    piece(
      new CylinderGeometry(0.014, 0.022, 0.3, 5).rotateZ(-0.36).translate(-0.05, 0.9, 0),
      trunk,
      0,
    ),
    leaves(blob(0.15, 0, random).scale(1, 1.5, 1).translate(0.1, 1.02, 0.02)),
    leaves(blob(0.14, 0, random).scale(1, 1.5, 1).translate(-0.1, 0.98, -0.03)),
    leaves(blob(0.13, 0, random).scale(1, 1.4, 1).translate(0.01, 0.86, 0.11)),
    leaves(blob(0.12, 0, random).scale(1, 1.4, 1).translate(0.0, 1.17, -0.01)),
    leaves(blob(0.11, 0, random).scale(1, 1.5, 1).translate(0.14, 1.12, -0.08)),
    leaves(blob(0.1, 0, random).scale(1, 1.4, 1).translate(-0.12, 1.08, 0.09)),
  ]);
}

function eucalyptusSimple() {
  return assemble([
    piece(new CylinderGeometry(0.03, 0.05, 0.7, 5).translate(0, 0.35, 0), FAR_TRUNK, 0),
    piece(
      new IcosahedronGeometry(0.2, 0).scale(1, 1.6, 1).translate(0, 0.9, 0),
      WHITE,
      1,
      farShade,
    ),
  ]);
}

/**
 * Tipos de árbol de la maqueta, con sus dos modelos.
 */
export const TREE_KINDS = ['native', 'pine', 'eucalyptus'];

export const TREE_MODELS = {
  native: { detailed: nativeDetailed(), simple: nativeSimple() },
  pine: { detailed: pineDetailed(), simple: pineSimple() },
  eucalyptus: { detailed: eucalyptusDetailed(), simple: eucalyptusSimple() },
};

/**
 * Material de todos los árboles: color por vértice, el tono de cada árbol
 * solo en el follaje (el tronco conserva su color) y un vaivén suave del
 * follaje con el viento, más marcado arriba. Más allá de `fadeKm` de la
 * cámara los árboles se achican hasta desaparecer (el bosque lo muestra la
 * textura). `material.userData.time.value` avanza el viento (s).
 *
 * Paso suave entre modelos: alrededor de `lod.focus` (el punto que mira la
 * cámara), dentro de `lod.radius` km, los modelos detallados crecen mientras
 * los livianos se achican en un anillo, así ningún árbol cambia de golpe.
 *
 * @param {number} fadeKm
 * @param {{ detailed?: boolean, time?: { value: number },
 *   lod?: { focus: { value: import('three').Vector3 }, radius: { value: number } } }} [options]
 */
export function treeMaterial(fadeKm, { detailed = false, time = { value: 0 }, lod } = {}) {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  });
  material.userData.time = time;
  material.userData.lod = lod;
  /* Un programa distinto por modelo (si no, three los comparte por tener el mismo código). */
  if (detailed) material.defines = { TREE_DETAILED: '' };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = time;
    shader.uniforms.treeFade = { value: new Vector2(fadeKm * 0.7, fadeKm) };
    shader.uniforms.lodFocus = lod?.focus ?? { value: new Vector3() };
    shader.uniforms.lodRadius = lod?.radius ?? { value: 0.0001 };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float foliage;\nuniform float windTime;\nuniform vec2 treeFade;\nuniform vec3 lodFocus;\nuniform float lodRadius;',
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
vColor.xyz = mix(color.xyz, color.xyz * instanceColor.xyz, foliage);
#endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 treeBase = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
transformed *= 1.0 - smoothstep(treeFade.x, treeFade.y, distance(cameraPosition, treeBase));
float lodOutside = smoothstep(lodRadius * 0.7, lodRadius, distance(treeBase.xz, lodFocus.xz));
#ifdef TREE_DETAILED
transformed *= 1.0 - lodOutside;
#else
transformed *= lodOutside;
#endif
float sway = sin(windTime * 1.4 + instanceMatrix[3].x * 700.0 + instanceMatrix[3].z * 500.0);
transformed.x += sway * 0.025 * position.y * position.y * foliage;
transformed.z += cos(windTime * 1.1 + instanceMatrix[3].z * 600.0) * 0.015 * position.y * position.y * foliage;
#endif`,
      );
  };
  return material;
}

/**
 * Roca: una masa irregular de pocas caras, de 1 de ancho y apoyada en y = 0
 * (la matriz de cada roca la achata y le da su tamaño).
 */
export const ROCK_MODEL = (() => {
  const geometry = blob(0.5, 1, seeded(47), 0.32);
  geometry.translate(0, 0.35, 0);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
})();

/**
 * Material de las rocas: facetado y mate; el tono lo pone cada roca.
 */
export function rockMaterial() {
  return new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });
}
