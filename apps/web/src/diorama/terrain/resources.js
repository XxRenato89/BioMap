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
  Vector3,
  Vector4,
} from 'three';
import {
  bakeDetail,
  buildBuildings,
  buildDamWall,
  buildWater,
  damLevels,
  plantForest,
  plantFringe,
  plantRocks,
} from '../builders/index.js';
import { buildTerrainChunks } from './lod.js';
import { benchRoad, carveDamToe, cellsNear, damClearing, markWater } from './damToe.js';
import { SPILLWAY_SHARE } from '../models/angosturaFront.js';
import { RESERVOIR, reservoirDrain, within } from '../utils/reservoir.js';
import { buildContextTerrain, contextMaterial, createContextSampler } from './context.js';
import { DAM_HEIGHTS, ROAD_WIDTHS } from '../utils/osm.js';
import {
  bridgeReservoirCrossings,
  buildBridges,
  buildRoads,
  roadMaterial,
  surfaceSampler,
} from './roads.js';
import { waterTest } from '../utils/pathfinder.js';
import {
  createHeightSampler,
  createProjection,
  metersToY,
  VERTICAL_EXAGGERATION,
} from '../utils/projection.js';
import { PRESA_ANGOSTURA_COORDINATES as ANGOSTURA } from '../../data/damCoordinates.js';
import { TIERS, useRenderStore } from '../utils/quality.js';
import { rockMaterial, treeMaterial } from './trees.js';
import { blendShore, shoreTexture, sinkUnderWater, waterMaterial } from './water.js';

/*
 * Lugares cuyo entorno se ajusta a sus fotos de Google Maps [lng, lat]: el Centro
 * de Visitantes Colbún (pabellones oscuros de techo plano) y el Santuario San
 * Sebastián (cima despejada).
 */
const VISITOR_CENTER = [-71.8127746, -37.7272949];
const SANCTUARY = [-71.8044955, -37.7171099];
const DARK_PAVILION = {
  roof: [0.2, 0.21, 0.22],
  wall: [0.08, 0.085, 0.095],
  base: [0.05, 0.05, 0.06],
};
const near = ([lng, lat], [lng0, lat0], km) =>
  Math.hypot((lng - lng0) * 88, (lat - lat0) * 111) < km;

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
 * Límites del embalse en la maqueta (x y z mínimos y máximos), para el shader del terreno.
 */
function reservoirBox(projection) {
  const { west, east, south, north } = RESERVOIR.bed;
  const a = projection.toWorld([west, north]);
  const b = projection.toWorld([east, south]);
  return new Vector4(
    Math.min(a.x, b.x),
    Math.min(a.z, b.z),
    Math.max(a.x, b.x),
    Math.max(a.z, b.z),
  );
}

/**
 * Material del terreno: color (foto satelital fundida con la paleta de
 * maqueta) y normales horneados del relieve real, grano fino repetido para
 * el detalle de cerca y curvas de nivel (fina y gruesa, ver `contourSteps`).
 * Las curvas se encienden o apagan con `material.userData.contours.value` (1 o 0).
 * Con el embalse vaciado (`reservoirDrain`), su fondo se ve como sedimento.
 *
 * @param {{ fine: number, major: number }} steps
 * @param {import('three').Vector4} box Ver `reservoirBox`.
 */
function terrainMaterial(colorMap, normalMap, detailMap, shoreMap, steps, box) {
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
    shader.uniforms.shoreMap = { value: shoreMap };
    shader.uniforms.detailRepeat = { value: DETAIL_REPEAT };
    shader.uniforms.exaggeration = { value: VERTICAL_EXAGGERATION };
    shader.uniforms.reservoirDrain = reservoirDrain;
    shader.uniforms.reservoirBox = { value: box };
    shader.uniforms.reservoirLevel = { value: RESERVOIR.level };
    shader.uniforms.drainedLevel = { value: RESERVOIR.drainedLevel };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vHeight;\nvarying vec3 vGround;',
      )
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvHeight = vGround.y;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D detailMap;
uniform sampler2D shoreMap;
uniform float detailRepeat;
uniform float exaggeration;
uniform float contours;
uniform float reservoirDrain;
uniform vec4 reservoirBox;
uniform float reservoirLevel;
uniform float drainedLevel;
varying float vHeight;
varying vec3 vGround;
float groundHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float groundNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(groundHash(i), groundHash(i + vec2(1.0, 0.0)), f.x),
    mix(groundHash(i + vec2(0.0, 1.0)), groundHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wet;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float grain = texture2D(detailMap, vMapUv * detailRepeat).r;
float grainFine = texture2D(detailMap, vMapUv * detailRepeat * 7.0).r;
diffuseColor.rgb *= 0.94 + grain * 0.10 + grainFine * 0.04;
float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(vec3(luma), diffuseColor.rgb, 1.05);
diffuseColor.rgb = pow(diffuseColor.rgb, vec3(0.98));
/* Dentro del agua el lecho toma el color natural del fondo fluvial profundo. */
wet = smoothstep(0.5 / 255.0, 3.0 / 255.0, texture2D(shoreMap, vMapUv).r);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.09, 0.11), wet);
float meters = vHeight / exaggeration * 1000.0;
float fine = meters / ${steps.fine.toFixed(1)};
float major = meters / ${steps.major.toFixed(1)};
float fineLine = 1.0 - clamp(abs(fract(fine - 0.5) - 0.5) / (fwidth(fine) + 1e-4), 0.0, 1.0);
float majorLine = 1.0 - clamp(abs(fract(major - 0.5) - 0.5) / (fwidth(major) * 1.7 + 1e-4), 0.0, 1.0);
float fineFade = clamp(1.0 - fwidth(fine) * 4.0, 0.0, 1.0);
vec3 ink = vec3(0.545, 0.435, 0.278) * 0.5;
diffuseColor.rgb = mix(diffuseColor.rgb, ink,
  contours * (fineLine * 0.12 * fineFade + majorLine * 0.26));
/*
 * «Bajo el embalse»: al vaciarlo, el fondo (relieve del año 2000, antes de la
 * inundación) se ve como sedimento, más oscuro y húmedo hacia lo hondo, y una
 * franja clara marca en las laderas la cota del agua de hoy.
 */
bool inReservoir = vGround.x > reservoirBox.x && vGround.x < reservoirBox.z
  && vGround.z > reservoirBox.y && vGround.z < reservoirBox.w;
if (reservoirDrain > 0.0 && inReservoir) {
  float depth = clamp((reservoirLevel - meters) / (reservoirLevel - drainedLevel), 0.0, 1.0);
  vec3 silt = mix(vec3(0.58, 0.52, 0.42), vec3(0.3, 0.27, 0.22), depth);
  silt *= 0.9 + 0.2 * groundNoise(vGround.xz * 1000.0 / 14.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, silt, wet * reservoirDrain);
  float ring = 1.0 - smoothstep(0.4, 2.2, abs(meters - reservoirLevel));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.9, 0.8), ring * reservoirDrain * 0.85);
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
/*
 * Detalle de cerca (la foto satelital tiene ~2 m por píxel): manchones de
 * pasto a varias escalas y roca estriada en las laderas fuertes. Se funde
 * con la distancia: de lejos manda la foto.
 */
float closeUp = 1.0 - smoothstep(0.35, 2.5, distance(cameraPosition, vGround));
if (closeUp > 0.0 && wet < 0.5) {
  vec2 m = vGround.xz * 1000.0;
  float patches = groundNoise(m / 9.0) * 0.5 + groundNoise(m / 2.6) * 0.33 + groundNoise(m / 0.8) * 0.17;
  float green = dot(diffuseColor.rgb, vec3(-0.5, 1.0, -0.5));
  vec3 grassTint = mix(vec3(0.86, 0.84, 0.62), vec3(0.72, 0.9, 0.62), patches);
  vec3 detailed = diffuseColor.rgb
    * mix(vec3(0.85 + patches * 0.3), grassTint * 1.12, clamp(green * 6.0, 0.0, 1.0));
  vec3 up = inverseTransformDirection(normal, viewMatrix);
  float steep = smoothstep(0.62, 0.42, up.y);
  float strata = groundNoise(vec2(m.x * 0.15, vGround.y * 1000.0 / exaggeration * 1.4));
  vec3 rock = vec3(0.47, 0.44, 0.4) * (0.78 + strata * 0.35);
  detailed = mix(detailed, rock, steep * 0.75);
  diffuseColor.rgb = mix(diffuseColor.rgb, detailed, closeUp);
}`,
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
  return { near: chunks(2), far: chunks(4) };
}

/*
 * Ancho (km) de la franja de bosque que difumina el borde de la zona.
 */
const FRINGE_KM = 1.2;

/*
 * Distancia (km) a la que los árboles terminan de desaparecer (DioramaScene
 * deja de dibujar los mosaicos más allá de TREE_VIEW_KM).
 */
const TREE_FADE_KM = 35;
/* Viento y paso de detalle, compartidos por los modelos livianos y detallados. */
const treeWind = { value: 0 };
const treeLod = { focus: { value: new Vector3() }, radius: { value: 0.0001 } };

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
    /* Agua del cauce al pie del vertedero (ver ANGOSTURA.tailwater). */
    const { tailwater } = ANGOSTURA;
    markWater(meta, shore, tailwater.outer);
    /* Cota del agua de OSM más cercana (sin el embalse, que va más arriba). */
    const riverLevel = ([lng, lat]) => {
      let best = { d: Infinity, level: RESERVOIR.level };
      for (const polygon of water)
        for (const [x, y, level] of polygon.outer) {
          if (level >= RESERVOIR.level - 10) continue;
          const d = Math.hypot(x - lng, y - lat);
          if (d < best.d) best = { d, level };
        }
      return best.level;
    };
    /* Un solo nivel: el del río donde empalma (el más bajo de los cercanos). */
    const level = Math.min(...tailwater.outer.map(riverLevel));
    water.push({ outer: tailwater.outer.map((point) => [...point, level]), holes: [] });
    const { west, south, east, north } = meta.bounds;
    const { columns, rows } = meta;

    /* El fondo del embalse siempre bajo su espejo (ver RESERVOIR). */
    for (let r = 0; r < rows; r += 1) {
      const lat = north - (r / (rows - 1)) * (north - south);
      for (let c = 0; c < columns; c += 1) {
        const i = r * columns + c;
        const lng = west + (c / (columns - 1)) * (east - west);
        if (shore[i] > 0 && heights[i] >= RESERVOIR.level - 1 && within([lng, lat], RESERVOIR.bed))
          heights[i] = RESERVOIR.level - RESERVOIR.bedDepth;
      }
    }

    const boundsPair = [
      [west, south],
      [east, north],
    ];
    const projection = createProjection(boundsPair);
    const heightAt = createHeightSampler(meta, heights, projection);

    /* El agua primero: el relieve se hunde bajo la superficie que se dibuja. */
    const waterGeometry = water.length > 0 ? buildWater(water, projection, heightAt) : null;
    if (waterGeometry) {
      const levels = new Float32Array(meta.columns * meta.rows);
      sinkUnderWater(meta, heights, shore, waterGeometry, projection, 1.5, levels);
      blendShore(meta, heights, shore, levels);
    }
    /* Después de las orillas: si no, el borde del embalse vuelve a rellenar el pie del muro. */
    carveDamToe(meta, heights, ANGOSTURA.line, ANGOSTURA.upstream, SPILLWAY_SHARE);
    /* El camino de la Central baja por una terraza pareja, no por la ladera dentada. */
    benchRoad(meta, heights, ANGOSTURA.powerhouseRoad);
    /* Sin árboles ni rocas al pie de la presa. */
    const clearing = damClearing(meta, ANGOSTURA.line, ANGOSTURA.upstream);
    /* El camino de la Central baja por ladera despejada (como en la foto). */
    for (const cell of cellsNear(meta, ANGOSTURA.powerhouseRoad, 0.025)) clearing.add(cell);
    /* Cima del Cerro el Calvario: pradera abierta de ~250 m, como en su foto. */
    for (const cell of cellsNear(meta, [SANCTUARY, SANCTUARY], 0.12)) clearing.add(cell);
    const shoreMap = shoreTexture(meta, shore);

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
          blocked: (cell) => shore[cell] > 0 || clearing.has(cell),
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
    /* Rocas en laderas fuertes y suelo desnudo, en proporción a la densidad del bosque. */
    const rocks = landcover
      ? plantRocks(meta, heights, projection, landcover, {
          spacing: spacing * 2.5,
          max: Math.round(max * 0.08),
          blocked: (cell) => shore[cell] > 0 || clearing.has(cell),
        })
      : null;
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
    /* Calzadas sobre el embalse como puentes (el relieve es anterior al agua). */
    sites.roads = bridgeReservoirCrossings(
      [...sites.roads, { kind: 'service', line: ANGOSTURA.powerhouseRoad }],
      waterTest(water),
    );

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
      roadsData: sites.roads,
      waterPolygons: water,
      /* Lo que se pisa: tablero de puente, espejo de agua o relieve (para mascota, camino y pines). */
      surfaceAt: surfaceSampler(sites.roads, heightAt, projection, waterTest(water)),
      /*
       * Angostura no sale de OSM: su frente es el modelo .glb y su muro lateral,
       * un terraplén junto a la ruta (ver AngosturaDam), a la cota real del coronamiento.
       */
      dams: sites.dams
        .filter((dam) => dam.id !== ANGOSTURA.id)
        .map((dam) => ({
          id: dam.id,
          name: dam.name,
          geometry: buildDamWall(dam.line, heightAt, projection, DAM_HEIGHTS[dam.id]),
        })),
      angosturaFront: {
        ...damLevels(ANGOSTURA.line, heightAt, projection),
        crest: metersToY(ANGOSTURA.crestMeters),
      },
      forest,
      rocks,
      context,
      roads: buildRoads(sites.roads, ROAD_WIDTHS, heightAt, projection),
      bridges: buildBridges(sites.roads, ROAD_WIDTHS, heightAt, projection),
      buildings: buildBuildings(
        sites.buildings.map((building) =>
          near(building.ring[0], VISITOR_CENTER, 0.15)
            ? { ...building, palette: DARK_PAVILION }
            : building,
        ),
        heightAt,
        projection,
      ),
      terrain: terrainLevels(meta, heights, projection),
      water: waterGeometry,
      materials: {
        terrain: terrainMaterial(
          colorMap,
          normalMap,
          detailMap,
          shoreMap,
          contourSteps(meta.minHeight, meta.maxHeight),
          reservoirBox(projection),
        ),
        dam: new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
        water: waterMaterial(shoreMap, projection),
        road: roadMaterial(),
        bridge: new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: DoubleSide }),
        building: new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
        rock: rockMaterial(),
        forest: treeMaterial(TREE_FADE_KM, { time: treeWind, lod: treeLod }),
        forestDetailed: treeMaterial(TREE_FADE_KM, {
          detailed: true,
          time: treeWind,
          lod: treeLod,
        }),
      },
    };
  })();
  return loading;
}
