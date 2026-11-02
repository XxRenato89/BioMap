import { useFrame, useThree } from '@react-three/fiber';
import { memo, use, useEffect, useMemo, useRef } from 'react';
import { InstancedBufferAttribute, InstancedMesh, Vector3 } from 'three';
import { useViewerStore } from '../../store/viewerStore.js';
import { TIERS, useRenderStore } from '../utils/quality.js';
import { loadDiorama } from '../terrain/resources.js';
import { ROCK_MODEL, TREE_KINDS, TREE_MODELS } from '../terrain/trees.js';
import Birds from './Birds.jsx';
import Wildlife from './Wildlife.jsx';
import PathPainter from './PathPainter.jsx';
import QuibarBoat from './QuibarBoat.jsx';
import AngosturaDam from './AngosturaDam.jsx';
import { useDaylight } from '../../hooks/useDaylight.js';
import { reservoirDrain } from '../utils/reservoir.js';

/* Distancia del sol (km): la cámara de sombras abarca de 60 a 180 km desde él. */
const SUN_DISTANCE = 120;

/**
 * Recursos de la maqueta (se cargan una vez y se comparten entre vistas).
 */
export function useDiorama() {
  const gl = useThree((state) => state.gl);
  return use(loadDiorama({ anisotropy: gl.capabilities.getMaxAnisotropy() }));
}

/*
 * Distancia de cámara (km) bajo la cual se usan los modelos detallados cerca
 * del punto que se mira; más lejos, todos los árboles van con el modelo liviano.
 */
const DETAIL_VIEW_DISTANCE = 5;

/*
 * Los árboles se agrupan en mosaicos de TILES × TILES: los que quedan fuera
 * de la pantalla no se dibujan, y los que están más lejos que TREE_VIEW_KM
 * tampoco (a esa distancia un árbol mide un par de píxeles y solo parpadea:
 * el bosque lo muestra la textura). El shader los achica antes de ocultarlos.
 */
const TILES = 8;
export const TREE_VIEW_KM = 35;
const forestTarget = new Vector3();
const tileCenter = new Vector3();

/**
 * Una especie de árbol. Todos los árboles van con el modelo liviano en
 * mosaicos fijos (se suben a la GPU una sola vez); los que rodean el punto
 * que mira la cámara se suman además con el modelo detallado. El shader cruza
 * los dos en un anillo (ver `treeMaterial`), así que el reparto puede
 * rehacerse sin que se note, y solo recorre los mosaicos cercanos.
 */
function TreeSet({ kind, trees, materials, settings, castShadow }) {
  const controls = useThree((state) => state.controls);
  const gl = useThree((state) => state.gl);
  const split = useRef(null);
  const meshes = useMemo(() => {
    const make = (geometry, material, capacity) => {
      const mesh = new InstancedMesh(geometry, material, Math.max(capacity, 1));
      mesh.instanceColor = new InstancedBufferAttribute(
        new Float32Array(Math.max(capacity, 1) * 3),
        3,
      );
      mesh.count = 0;
      return mesh;
    };
    /* Mosaico de cada árbol según su posición. */
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let k = 0; k < trees.count; k += 1) {
      const x = trees.matrices[k * 16 + 12];
      const z = trees.matrices[k * 16 + 14];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    const tileSize = { x: (maxX - minX || 1) / TILES, z: (maxZ - minZ || 1) / TILES };
    const tileOf = new Uint16Array(trees.count);
    const perTile = new Uint32Array(TILES * TILES);
    for (let k = 0; k < trees.count; k += 1) {
      const i = Math.min(TILES - 1, Math.floor((trees.matrices[k * 16 + 12] - minX) / tileSize.x));
      const j = Math.min(TILES - 1, Math.floor((trees.matrices[k * 16 + 14] - minZ) / tileSize.z));
      tileOf[k] = j * TILES + i;
      perTile[tileOf[k]] += 1;
    }
    /* Índices de los árboles de cada mosaico, y los mosaicos ya llenos. */
    const members = [...perTile].map((count) => new Uint32Array(count));
    const filled = new Uint32Array(TILES * TILES);
    const tiles = [...perTile].map((count) =>
      make(TREE_MODELS[kind].simple, materials.simple, count),
    );
    for (let k = 0; k < trees.count; k += 1) {
      const tile = tileOf[k];
      const slot = filled[tile]++;
      members[tile][slot] = k;
      tiles[tile].instanceMatrix.array.set(trees.matrices.subarray(k * 16, k * 16 + 16), slot * 16);
      tiles[tile].instanceColor.array.set(trees.colors.subarray(k * 3, k * 3 + 3), slot * 3);
    }
    for (const [index, tile] of tiles.entries()) {
      tile.count = perTile[index];
      tile.computeBoundingSphere();
    }
    split.current = null;
    return {
      origin: { x: minX, z: minZ },
      tileSize,
      members,
      tiles,
    };
  }, [kind, trees, materials, settings]);

  useFrame(({ camera }) => {
    if (!controls) return;
    const { tiles } = meshes;
    /* Mosaicos lejanos: no se dibujan. */
    for (const tile of tiles) {
      if (!tile.boundingSphere || tile.count === 0) continue;
      tileCenter.copy(tile.boundingSphere.center);
      tile.visible =
        camera.position.distanceTo(tileCenter) - tile.boundingSphere.radius < TREE_VIEW_KM;
    }
  });

  return (
    <>
      {meshes.tiles.map((tile) => (
        <primitive key={tile.uuid} object={tile} castShadow={castShadow} receiveShadow />
      ))}
    </>
  );
}

/**
 * Relieve de la maqueta: mallas optimizadas generadas una sola vez al inicio.
 */
function Terrain({ terrain, material, castShadow }) {
  return terrain.near.map((geometry) => (
    <mesh
      key={geometry.uuid}
      geometry={geometry}
      material={material}
      castShadow={castShadow}
      receiveShadow
    />
  ));
}

/**
 * El bosque: las tres especies, y el viento que mueve su follaje.
 */
function Forest({ forest, materials, castShadow }) {
  const tier = useRenderStore((state) => state.tier);
  const settings = TIERS[tier].forest;
  useFrame(() => {
    materials.simple.userData.time.value = performance.now() / 1000;
  });
  return TREE_KINDS.map((kind) =>
    forest[kind]?.count ? (
      <TreeSet
        key={kind}
        kind={kind}
        trees={forest[kind]}
        materials={materials}
        settings={settings}
        castShadow={castShadow}
      />
    ) : null,
  );
}

/**
 * Rocas de las laderas: una sola malla instanciada, armada una vez.
 */
function Rocks({ rocks, material, castShadow }) {
  const mesh = useMemo(() => {
    const instanced = new InstancedMesh(ROCK_MODEL, material, Math.max(rocks.count, 1));
    instanced.instanceMatrix.array.set(rocks.matrices.subarray(0, rocks.count * 16));
    instanced.instanceColor = new InstancedBufferAttribute(
      rocks.colors.slice(0, rocks.count * 3),
      3,
    );
    instanced.count = rocks.count;
    instanced.computeBoundingSphere();
    return instanced;
  }, [rocks, material]);
  return <primitive object={mesh} castShadow={castShadow} receiveShadow />;
}

/*
 * Cuadros por segundo de la animación del agua (el resto se dibuja a pedido).
 */
const WATER_FPS = 24;

/**
 * Agua animada: avanza el tiempo de sus olas y pide un cuadro nuevo
 * `WATER_FPS` veces por segundo.
 */
function Water({ geometry, material }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) invalidate();
    }, 1000 / WATER_FPS);
    return () => clearInterval(timer);
  }, [invalidate]);
  /* «Bajo el embalse»: el agua baja o sube en unos segundos, sin saltos. */
  const drained = useViewerStore((state) => state.drained);
  useFrame((_, delta) => {
    material.userData.time.value = performance.now() / 1000;
    const goal = drained ? 1 : 0;
    reservoirDrain.value += (goal - reservoirDrain.value) * Math.min(1, delta * 0.6);
    if (Math.abs(goal - reservoirDrain.value) < 0.001) reservoirDrain.value = goal;
  });
  return <mesh geometry={geometry} material={material} renderOrder={1} />;
}

/**
 * Iluminación de vitrina de museo: un foco principal cálido desde el
 * poniente alto (sombras suaves que marcan cerros y quebradas), luz de cielo
 * y suelo para rellenar, y un contraluz frío que recorta el borde de la cordillera.
 *
 * @param {{ shadows: boolean, size: { width: number, depth: number } }} props
 */
function ShowcaseLights({ shadows, size, water }) {
  const half = Math.max(size.width, size.depth) * 0.62;
  /* El sol y el cielo siguen la hora del kiosco (ver daylight.js). */
  const light = useDaylight();
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    water?.userData.sky?.value.copy(light.sky[1]);
    water?.userData.sun?.value.set(...light.sun);
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [light, water, gl, invalidate]);
  return (
    <>
      <hemisphereLight args={[light.hemiSky, light.hemiGround, light.hemiIntensity]} />
      <directionalLight
        position={light.sun.map((value) => value * SUN_DISTANCE)}
        intensity={light.sunIntensity}
        color={light.sunColor}
        castShadow={shadows}
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.002}
        shadow-radius={4}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={60}
        shadow-camera-far={180}
      />
      <directionalLight position={[80, 40, 70]} intensity={0.35} color="#cfe0ff" />
    </>
  );
}

/**
 * La maqueta: relieve con curvas de nivel, paisaje de contexto alrededor,
 * agua animada, bosque, caminos y edificios.
 *
 * @param {{ shadows?: boolean, forest?: boolean }} props
 */
export default memo(function DioramaScene({ shadows = false, forest = false }) {
  const diorama = useDiorama();
  const { projection, materials } = diorama;
  const contours = useViewerStore((state) => state.contours);
  const forestMaterials = useMemo(
    () => ({ simple: materials.forest, detailed: materials.forestDetailed }),
    [materials],
  );
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    materials.terrain.userData.contours.value = contours ? 1 : 0;
    invalidate();
  }, [contours, materials, invalidate]);
  return (
    <group>
      <ShowcaseLights shadows={shadows} size={projection} water={materials.water} />
      <Terrain terrain={diorama.terrain} material={materials.terrain} castShadow={shadows} />
      {diorama.context && (
        <mesh
          geometry={diorama.context.geometry}
          material={diorama.context.material}
          receiveShadow
        />
      )}
      {diorama.water && <Water geometry={diorama.water} material={materials.water} />}
      {forest && diorama.forest && (
        <Forest forest={diorama.forest} materials={forestMaterials} castShadow={shadows} />
      )}
      {forest && diorama.rocks?.count > 0 && (
        <Rocks rocks={diorama.rocks} material={materials.rock} castShadow={shadows} />
      )}
      <mesh geometry={diorama.roads} material={materials.road} receiveShadow />
      <mesh
        geometry={diorama.bridges}
        material={materials.bridge}
        castShadow={shadows}
        receiveShadow
      />
      <mesh
        geometry={diorama.buildings}
        material={materials.building}
        castShadow={shadows}
        receiveShadow
      />
      <PathPainter />
      {forest && <Birds />}
      {forest && <Wildlife />}
      <QuibarBoat />
      <AngosturaDam shadows={shadows} />
    </group>
  );
});
