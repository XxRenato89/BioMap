import {
  DoubleSide,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  ObjectSpaceNormalMap,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  TextureLoader,
} from 'three';
import {
  bakeDetail,
  buildBuildings,
  buildDamWall,
  buildWater,
  plantForest,
  plantFringe,
} from './builders.js';
import { buildTerrainChunks } from './lod.js';
import { buildContextTerrain, contextMaterial, createContextSampler } from './context.js';
import { DAM_HEIGHTS, ROAD_WIDTHS } from './osm.js';
import { buildBridges, buildRoads, roadMaterial } from './roads.js';
import { createHeightSampler, createProjection, VERTICAL_EXAGGERATION } from './projection.js';
import { TIERS, useRenderStore } from './quality.js';
import { treeMaterial } from './trees.js';
import { shoreTexture, waterMaterial } from './water.js';

/**
 * Valida que los metadatos del relieve correspondan a la versión 2 (horneado fuera de línea).
 */
export function checkTerrainMeta(meta) {
  if (!meta || meta.version !== 2) {
    throw new Error(
      'Formato antiguo de relieve: ejecuta "npm run build:diorama -w apps/web" para regenerarlo.',
    );
  }
}

/**
 * Carga una textura asíncronamente con Three.js TextureLoader.
 */
function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new TextureLoader().load(url, resolve, undefined, reject);
  });
}

/**
 * Cuántas veces se repite la textura de detalle a lo ancho de la maqueta.
 */
const DETAIL_REPEAT = 300;

/**
 * Textura nítida a cualquier distancia y ángulo: mipmaps con filtrado
 * trilineal y el máximo filtrado anisotrópico que permita la tarjeta gráfica.
 */
function crisp(texture, anisotropy) {
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Equidistancia de las curvas de nivel según el desnivel de la maqueta: la
 * fina es un valor redondo (1, 2, 5, 10, 20, 50… m) que da unas 40 curvas de
 * abajo arriba, y la gruesa, cinco finas. Como en una carta topográfica.
 *
 * @param {number} minHeight Metros.
 * @param {number} maxHeight Metros.
 * @returns {{ fine: number, major: number }}
 */
export function contourSteps(minHeight, maxHeight) {
  const target = Math.max(maxHeight - minHeight, 1) / 40;
  const power = 10 ** Math.floor(Math.log10(target));
  const fine = [1, 2, 5, 10].map((k) => k * power).find((step) => step >= target) ?? 10 * power;
  return { fine, major: fine * 5 };
}

/**
 * Material del terreno: color (foto satelital fundida con la paleta de
 * maqueta) y normales horneados del relieve real, grano fino repetido para
 * el detalle de cerca y curvas de nivel (fina y gruesa, ver `contourSteps`).
 * Las curvas se encienden o apagan con `material.userData.contours.value` (1 o 0).
 *
 * @param {{ fine: number, major: number }} steps
 */
function terrainMaterial(colorMap, normalMap, detailMap, steps) {
  const material = new MeshStandardMaterial({
    map: colorMap,
    normalMap,
    normalMapType: ObjectSpaceNormalMap,
    roughness: 0.93,
    metalness: 0,
  });
  const contours = { value: 1 };
  material.userData.contours = contours;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.contours = contours;
    shader.uniforms.detailMap = { value: detailMap };
    shader.uniforms.detailRepeat = { value: DETAIL_REPEAT };
    shader.uniforms.exaggeration = { value: VERTICAL_EXAGGERATION };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vHeight;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvHeight = (modelMatrix * vec4(transformed, 1.0)).y;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D detailMap;
uniform float detailRepeat;
uniform float exaggeration;
uniform float contours;
varying float vHeight;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float grain = texture2D(detailMap, vMapUv * detailRepeat).r;
float grainFine = texture2D(detailMap, vMapUv * detailRepeat * 7.0).r;
diffuseColor.rgb *= 0.92 + grain * 0.14 + grainFine * 0.05;
float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(vec3(luma), diffuseColor.rgb, 1.35);
diffuseColor.rgb = pow(diffuseColor.rgb, vec3(0.95)) * 1.0;
float meters = vHeight / exaggeration * 1000.0;
float fine = meters / ${steps.fine.toFixed(1)};
float major = meters / ${steps.major.toFixed(1)};
float fineLine = 1.0 - clamp(abs(fract(fine - 0.5) - 0.5) / (fwidth(fine) + 1e-4), 0.0, 1.0);
float majorLine = 1.0 - clamp(abs(fract(major - 0.5) - 0.5) / (fwidth(major) * 1.7 + 1e-4), 0.0, 1.0);
float fineFade = clamp(1.0 - fwidth(fine) * 4.0, 0.0, 1.0);
vec3 ink = vec3(0.545, 0.435, 0.278) * 0.6;
diffuseColor.rgb = mix(diffuseColor.rgb, ink,
  contours * (fineLine * 0.18 * fineFade + majorLine * 0.38));`,
      );
  };
  return material;
}

/*
 * Relieve en bloques con dos mallas: la fina (un vértice cada 2 celdas,
 * ~9 m) y la gruesa (cada 6 celdas, ~26 m).
 */
const TERRAIN_CHUNKS = [8, 8];

/**
 * Bloques del relieve en sus dos niveles de detalle (ver Terrain en DioramaScene).
 */
function terrainLevels(meta, heights, projection) {
  const chunks = (step) =>
    buildTerrainChunks(meta, heights, projection, { step, chunks: TERRAIN_CHUNKS });
  return { near: chunks(2), far: chunks(6) };
}

/*
 * Ancho (km) de la franja de bosque que difumina el borde de la zona.
 */
const FRINGE_KM = 1.2;

/*
 * Distancia (km) a la que los árboles terminan de desaparecer (DioramaScene
 * deja de dibujar los mosaicos más allá de TREE_VIEW_KM).
 */
const TREE_FADE_KM = 8.5;

let loading = null;

/**
 * Carga el relieve y construye la maqueta UNA sola vez. Todas las vistas
 * (la general y las ventanas) comparten las mismas geometrías, texturas y
 * materiales: la tarjeta gráfica las guarda una vez aunque se dibujen seis.
 *
 * @param {{ anisotropy: number }} gpu
 */
export function loadDiorama({ anisotropy }) {
  loading ??= (async () => {
    const meta = await fetch('/diorama/terrain.json').then((response) => response.json());
    checkTerrainMeta(meta);

    const [
      buffer,
      surfaceTexture,
      normalTexture,
      landcoverBuffer,
      landmarks,
      contextBuffer,
      contextTexture,
      contextCoverBuffer,
      shoreBuffer,
      water,
    ] = await Promise.all([
      fetch('/diorama/terrain.bin').then((response) => response.arrayBuffer()),
      loadTexture('/diorama/surface.webp'),
      loadTexture('/diorama/normal.webp'),
      fetch('/diorama/landcover.bin')
        .then((response) => (response.ok ? response.arrayBuffer() : null))
        .catch(() => null),
      fetch('/diorama/landmarks.json')
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
      meta.context
        ? fetch('/diorama/context.bin').then((response) => response.arrayBuffer())
        : null,
      meta.context ? loadTexture('/diorama/context.webp') : null,
      meta.context?.landcover
        ? fetch('/diorama/context-landcover.bin')
            .then((response) => (response.ok ? response.arrayBuffer() : null))
            .catch(() => null)
        : null,
      fetch('/diorama/shore.bin')
        .then((response) => (response.ok ? response.arrayBuffer() : null))
        .catch(() => null),
      fetch('/diorama/water.json')
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []),
    ]);

    const heights = new Uint16Array(buffer);
    /* Distancia a la orilla (si falta, todo el agua se ve de anchura media). */
    const shore =
      shoreBuffer && shoreBuffer.byteLength === meta.columns * meta.rows
        ? new Uint8Array(shoreBuffer)
        : new Uint8Array(meta.columns * meta.rows).fill(60);
    const { west, south, east, north } = meta.bounds;
    const boundsPair = [
      [west, south],
      [east, north],
    ];
    const projection = createProjection(boundsPair);
    const heightAt = createHeightSampler(meta, heights, projection);

    const colorMap = crisp(surfaceTexture, anisotropy);
    colorMap.colorSpace = SRGBColorSpace;
    colorMap.flipY = false;

    const normalMap = crisp(normalTexture, anisotropy);
    normalMap.flipY = false;

    const detailMap = crisp(new DataTexture(bakeDetail(512), 512, 512, RGBAFormat), anisotropy);
    detailMap.wrapS = detailMap.wrapT = RepeatWrapping;

    const landcover = landcoverBuffer
      ? {
          data: new Uint8Array(landcoverBuffer),
          columns: meta.landcover?.columns ?? 2048,
          rows: meta.landcover?.rows ?? 1479,
        }
      : null;

    /* Bosque de toda la maqueta, con la densidad del nivel de calidad. */
    const { spacing, max } = TIERS[useRenderStore.getState().tier].forest;
    const planted = landcover
      ? plantForest(meta, heights, projection, landcover, {
          center: [0, 0],
          radius: Math.hypot(projection.width, projection.depth) / 2,
          spacing,
          max,
          fade: false,
          /* Nunca sobre el agua (WorldCover y OpenStreetMap no coinciden en las orillas). */
          blocked: (cell) => shore[cell] > 0,
        })
      : null;
    const forest =
      planted &&
      Object.fromEntries(
        Object.entries(planted).map(([kind, { matrices, colors, count }]) => [
          kind,
          { matrices: matrices.slice(0, count * 16), colors: colors.slice(0, count * 3), count },
        ]),
      );
    /* Bosque del borde: sigue, cada vez más ralo, sobre el paisaje de contexto. */
    if (forest && contextBuffer && contextCoverBuffer) {
      const contextHeights = new Uint16Array(contextBuffer);
      const groundAt = createContextSampler(meta.context, contextHeights, projection, heightAt);
      const cover = new Uint8Array(contextCoverBuffer);
      const { columns: coverColumns, rows: coverRows } = meta.context.landcover;
      const cb = meta.context.bounds;
      const coverAt = (x, z) => {
        const [lng, lat] = projection.toLngLat(x, z);
        const c = Math.floor(((lng - cb.west) / (cb.east - cb.west)) * coverColumns);
        const r = Math.floor(((cb.north - lat) / (cb.north - cb.south)) * coverRows);
        return c < 0 || r < 0 || c >= coverColumns || r >= coverRows
          ? 0
          : cover[r * coverColumns + c];
      };
      const fringeTrees = plantFringe(projection, groundAt, coverAt, {
        band: FRINGE_KM,
        spacing: spacing * 1.4,
        max: Math.round(max * 0.35),
      });
      for (const kind of Object.keys(forest)) {
        const extra = fringeTrees[kind];
        const merged = {
          matrices: new Float32Array((forest[kind].count + extra.count) * 16),
          colors: new Float32Array((forest[kind].count + extra.count) * 3),
          count: forest[kind].count + extra.count,
        };
        merged.matrices.set(forest[kind].matrices);
        merged.matrices.set(extra.matrices.subarray(0, extra.count * 16), forest[kind].count * 16);
        merged.colors.set(forest[kind].colors);
        merged.colors.set(extra.colors.subarray(0, extra.count * 3), forest[kind].count * 3);
        forest[kind] = merged;
      }
    }

    const sites = { dams: [], labels: [], roads: [], buildings: [], ...landmarks };

    /* Paisaje que rodea la zona, para que la pantalla nunca muestre vacío. */
    let context = null;
    if (contextBuffer && contextTexture) {
      const contextMap = crisp(contextTexture, anisotropy);
      contextMap.colorSpace = SRGBColorSpace;
      contextMap.flipY = false;
      context = {
        geometry: buildContextTerrain(
          meta.context,
          new Uint16Array(contextBuffer),
          projection,
          heightAt,
        ),
        material: contextMaterial(contextMap, projection),
      };
    }

    return {
      meta,
      projection,
      heightAt,
      heights,
      landcover,
      landmarks: sites,
      dams: sites.dams.map((dam) => ({
        id: dam.id,
        name: dam.name,
        geometry: buildDamWall(dam.line, heightAt, projection, DAM_HEIGHTS[dam.id]),
      })),
      forest,
      context,
      roads: buildRoads(sites.roads, ROAD_WIDTHS, heightAt, projection),
      bridges: buildBridges(sites.roads, ROAD_WIDTHS, heightAt, projection),
      buildings: buildBuildings(sites.buildings, heightAt, projection),
      terrain: terrainLevels(meta, heights, projection),
      water: water.length > 0 ? buildWater(water, projection, heightAt) : null,
      materials: {
        terrain: terrainMaterial(
          colorMap,
          normalMap,
          detailMap,
          contourSteps(meta.minHeight, meta.maxHeight),
        ),
        dam: new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
        water: waterMaterial(shoreTexture(meta, shore), projection),
        road: roadMaterial(),
        bridge: new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: DoubleSide }),
        building: new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
        forest: treeMaterial(TREE_FADE_KM),
      },
    };
  })();
  return loading;
}
