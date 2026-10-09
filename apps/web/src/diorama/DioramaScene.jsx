import { useFrame, useThree } from '@react-three/fiber';
import { use, useEffect, useMemo, useRef } from 'react';
import { InstancedBufferAttribute, InstancedMesh, Vector3 } from 'three';
import { useViewerStore } from '../store/viewerStore.js';
import { TIERS, useRenderStore } from './quality.js';
import { loadDiorama } from './resources.js';
import { TREE_KINDS, TREE_MODELS } from './trees.js';

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
export const TREE_VIEW_KM = 9;
const forestTarget = new Vector3();
const tileCenter = new Vector3();

/**
 * Una especie de árbol: los árboles cerca del punto que mira la cámara con
 * el modelo detallado (una malla) y el resto con el liviano, en mosaicos.
 * El reparto se rehace cuando ese punto se mueve; entonces también se
 * recalculan las sombras (el mapa de sombras no se actualiza en cada cuadro).
 */
function TreeSet({ kind, trees, material, settings, castShadow }) {
  const controls = useThree((state) => state.controls);
  const gl = useThree((state) => state.gl);
  const split = useRef(null);
  const meshes = useMemo(() => {
    const make = (geometry, capacity) => {
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
    const tileOf = new Uint16Array(trees.count);
    const perTile = new Uint32Array(TILES * TILES);
    for (let k = 0; k < trees.count; k += 1) {
      const i = Math.min(
        TILES - 1,
        Math.floor(((trees.matrices[k * 16 + 12] - minX) / (maxX - minX || 1)) * TILES),
      );
      const j = Math.min(
        TILES - 1,
        Math.floor(((trees.matrices[k * 16 + 14] - minZ) / (maxZ - minZ || 1)) * TILES),
      );
      tileOf[k] = j * TILES + i;
      perTile[tileOf[k]] += 1;
    }
    split.current = null;
    return {
      tileOf,
      detailed: make(TREE_MODELS[kind].detailed, Math.min(settings.nearMax, trees.count)),
      tiles: [...perTile].map((count) => make(TREE_MODELS[kind].simple, count)),
    };
  }, [kind, trees, material, settings]);

  useFrame(({ camera }) => {
    if (!controls) return;
    const { detailed, tiles, tileOf } = meshes;
    /* Mosaicos lejanos: no se dibujan. */
    for (const tile of tiles) {
      if (!tile.boundingSphere || tile.count === 0) continue;
      tileCenter.copy(tile.boundingSphere.center);
      tile.visible =
        camera.position.distanceTo(tileCenter) - tile.boundingSphere.radius < TREE_VIEW_KM;
    }
    controls.getTarget(forestTarget);
    const near = controls.distance < DETAIL_VIEW_DISTANCE;
    const last = split.current;
    if (
      last &&
      last.near === near &&
      (!near ||
        Math.hypot(forestTarget.x - last.x, forestTarget.z - last.z) < settings.nearRadius * 0.25)
    )
      return;
    split.current = { near, x: forestTarget.x, z: forestTarget.z };
    const radius2 = settings.nearRadius ** 2;
    const capacity = detailed.instanceMatrix.count;
    let d = 0;
    for (const tile of tiles) tile.count = 0;
    for (let k = 0; k < trees.count; k += 1) {
      const x = trees.matrices[k * 16 + 12];
      const z = trees.matrices[k * 16 + 14];
      const close =
        near && d < capacity && (x - forestTarget.x) ** 2 + (z - forestTarget.z) ** 2 < radius2;
      const mesh = close ? detailed : tiles[tileOf[k]];
      const slot = close ? d++ : mesh.count++;
      mesh.instanceMatrix.array.set(trees.matrices.subarray(k * 16, k * 16 + 16), slot * 16);
      mesh.instanceColor.array.set(trees.colors.subarray(k * 3, k * 3 + 3), slot * 3);
    }
    detailed.count = d;
    for (const mesh of [detailed, ...tiles]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    gl.shadowMap.needsUpdate = true;
  });

  return (
    <>
      {meshes.tiles.map((tile) => (
        <primitive key={tile.uuid} object={tile} castShadow={castShadow} receiveShadow />
      ))}
      <primitive object={meshes.detailed} castShadow={castShadow} receiveShadow />
    </>
  );
}

/**
 * Relieve en bloques con dos niveles de detalle: cerca de la cámara, la malla
 * fina; lejos, la gruesa (las normales horneadas mantienen la nitidez).
 */
function Terrain({ terrain, material, castShadow }) {
  const groups = useRef([]);
  useFrame(({ camera }) => {
    terrain.near.forEach((geometry, k) => {
      const group = groups.current[k];
      if (!group) return;
      const { center, radius } = geometry.boundingSphere;
      const close = camera.position.distanceTo(center) - radius < TERRAIN_NEAR_KM;
      group.children[0].visible = close;
      group.children[1].visible = !close;
    });
  });
  return terrain.near.map((geometry, k) => (
    <group key={geometry.uuid} ref={(element) => (groups.current[k] = element)}>
      <mesh geometry={geometry} material={material} castShadow={castShadow} receiveShadow />
      <mesh geometry={terrain.far[k]} material={material} castShadow={castShadow} receiveShadow />
    </group>
  ));
}

/*
 * Distancia (km) bajo la cual un bloque del relieve usa la malla fina.
 */
const TERRAIN_NEAR_KM = 3;

/**
 * El bosque: las tres especies, y el viento que mueve su follaje.
 */
function Forest({ forest, material, castShadow }) {
  const tier = useRenderStore((state) => state.tier);
  useFrame(() => {
    material.userData.time.value = performance.now() / 1000;
  });
  return TREE_KINDS.map((kind) =>
    forest[kind]?.count ? (
      <TreeSet
        key={kind}
        kind={kind}
        trees={forest[kind]}
        material={material}
        settings={TIERS[tier].forest}
        castShadow={castShadow}
      />
    ) : null,
  );
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
  useFrame(() => {
    material.userData.time.value = performance.now() / 1000;
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
function ShowcaseLights({ shadows, size }) {
  const half = Math.max(size.width, size.depth) * 0.62;
  return (
    <>
      <hemisphereLight args={['#dfeaf5', '#5a4d3c', 1.1]} />
      <directionalLight
        position={[-90, 70, -40]}
        intensity={2.8}
        color="#fff3e0"
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
export default function DioramaScene({ shadows = false, forest = false }) {
  const diorama = useDiorama();
  const { projection, materials } = diorama;
  const contours = useViewerStore((state) => state.contours);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    materials.terrain.userData.contours.value = contours ? 1 : 0;
    invalidate();
  }, [contours, materials, invalidate]);
  return (
    <group>
      <ShowcaseLights shadows={shadows} size={projection} />
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
        <Forest forest={diorama.forest} material={materials.forest} castShadow={shadows} />
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
    </group>
  );
}
