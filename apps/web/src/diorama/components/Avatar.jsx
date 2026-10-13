import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Vector3 } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useAvatarStore } from '../../store/avatarStore.js';
import { useViewerStore } from '../../store/viewerStore.js';
import i18n from '../../i18n/index.js';
import { useDiorama } from './DioramaScene.jsx';
import { Pathfinder } from '../utils/pathfinder.js';
import { useGLTF, useAnimations } from '@react-three/drei';

const PATROL_SPEED = 0.35;
const RUN_TO_POINT_SPEED = 0.95;
const MASCOT_GLB_PATH = '/diorama/mascot.glb';

useGLTF.preload(MASCOT_GLB_PATH);

/**
 * Ruta por caminos reales y puentes, o null si no hay una que evite el agua
 * (entonces la mascota aparece en el destino en vez de cruzar volando).
 */
function createPath(startCoord, endCoord, pathfinder) {
  return pathfinder?.findPath(startCoord, endCoord) ?? null;
}

export default function Avatar({ points, onArrivedAtPoint }) {
  /* La mascota pisa lo que se ve: relieve, o el tablero si cruza un puente. */
  const { projection, surfaceAt: heightAt, roadsData, waterPolygons } = useDiorama();

  const mode = useAvatarStore((state) => state.mode);
  const targetPoint = useAvatarStore((state) => state.targetPoint);
  const skipRequested = useAvatarStore((state) => state.skipRequested);
  const setMode = useAvatarStore((state) => state.setMode);
  const setPath = useAvatarStore((state) => state.setPath);
  const setPosition = useAvatarStore((state) => state.setPosition);
  const startSpeaking = useAvatarStore((state) => state.startSpeaking);

  const groupRef = useRef();
  const beaconRef = useRef();

  const currentPos = useRef(new Vector3(0, 0, 0));
  const currentHeading = useRef(0);
  const patrolIndex = useRef(0);
  const isInitialized = useRef(false);
  const idleWaitUntil = useRef(0);
  const currentAnimRef = useRef('Idle');

  const pathRef = useRef([]);
  const pathIndex = useRef(0);

  const { scene, animations } = useGLTF(MASCOT_GLB_PATH);
  const { actions } = useAnimations(animations, groupRef);
  /* Alto del modelo en sus unidades (la armadura viene escalada ×100). */
  const modelHeight = useMemo(() => {
    const copy = clone(scene);
    copy.updateMatrixWorld(true);
    return new Box3().setFromObject(copy).getSize(new Vector3()).y || 1;
  }, [scene]);

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, [scene]);

  useEffect(() => {
    if (actions && actions['Idle']) {
      actions['Idle'].reset().fadeIn(0.2).play();
      currentAnimRef.current = 'Idle';
    }
  }, [actions]);

  const pathfinder = useMemo(() => {
    if (!roadsData || roadsData.length === 0) return null;
    return new Pathfinder(roadsData, { water: waterPolygons });
  }, [roadsData, waterPolygons]);

  const poiWorldPositions = useMemo(() => {
    if (!points || !points.features || points.features.length === 0) return [];
    return points.features
      .filter((f) => f.geometry && f.geometry.coordinates)
      .map((f) => {
        const { x, z } = projection.toWorld(f.geometry.coordinates);
        return {
          id: f.properties.id,
          name: f.properties.name,
          description: f.properties.description,
          x,
          z,
          y: heightAt(x, z),
          raw: f,
        };
      });
  }, [points, projection, heightAt]);

  useEffect(() => {
    if (!isInitialized.current && poiWorldPositions.length > 0) {
      const first = poiWorldPositions[0];
      currentPos.current.set(first.x, first.y, first.z);
      if (groupRef.current) {
        groupRef.current.position.copy(currentPos.current);
      }
      setPosition(currentPos.current);
      isInitialized.current = true;
      idleWaitUntil.current = performance.now() + 2000;
    }
  }, [poiWorldPositions, setPosition]);

  useFrame((state, delta) => {
    if (poiWorldPositions.length === 0 || !groupRef.current) return;

    /* ~60 px de alto en pantalla (un píxel ≈ 0,00052 rad), nunca menos de 4 m. */
    const camDist = state.camera.position.distanceTo(currentPos.current);
    groupRef.current.scale.setScalar(Math.max(0.004, camDist * 0.031) / modelHeight);
    /* Con una ficha abierta, la mascota la presenta al costado (SheetMascot). */
    groupRef.current.visible = useViewerStore.getState().selectedPointIds.length === 0;

    const dt = Math.min(delta, 0.1);
    let speed = PATROL_SPEED;
    let activePoint = null;
    let targetCoord = null;

    if (mode === 'running_to_point' && targetPoint) {
      targetCoord = targetPoint.geometry.coordinates;
      speed = RUN_TO_POINT_SPEED;
      const found = poiWorldPositions.find((p) => p.id === targetPoint.properties.id);
      if (found) activePoint = found;
    } else if (mode === 'patrol') {
      const p = poiWorldPositions[patrolIndex.current % poiWorldPositions.length];
      targetCoord = p.raw.geometry.coordinates;
      activePoint = p;
    }

    const isWaiting = mode === 'patrol' && performance.now() < idleWaitUntil.current;

    // Planificar ruta si no existe o cambió el destino
    if (
      !isWaiting &&
      targetCoord &&
      (!pathRef.current.length ||
        pathRef.current[pathRef.current.length - 1][0] !== targetCoord[0] ||
        pathRef.current[pathRef.current.length - 1][1] !== targetCoord[1])
    ) {
      const currentCoord = projection.toLngLat(currentPos.current.x, currentPos.current.z);
      const path = createPath(currentCoord, targetCoord, pathfinder);
      if (path) {
        pathRef.current = path;
        pathIndex.current = 0;
      } else {
        const { x, z } = projection.toWorld(targetCoord);
        currentPos.current.set(x, heightAt(x, z), z);
        pathRef.current = [targetCoord];
        pathIndex.current = 1;
      }
      setPath(
        pathRef.current.map((coord) => {
          const { x, z } = projection.toWorld(coord);
          return { x, y: heightAt(x, z), z };
        }),
      );
    }

    // Salto inmediato si el visitante solicitó saltar la caminata
    if (skipRequested && mode === 'running_to_point' && activePoint) {
      currentPos.current.x = activePoint.x;
      currentPos.current.z = activePoint.z;
      currentPos.current.y = heightAt(activePoint.x, activePoint.z);
      pathIndex.current = pathRef.current.length;
      pathRef.current = [];
      groupRef.current.position.copy(currentPos.current);
      setPosition(currentPos.current);
      setMode('speaking');
      startSpeaking(i18n.t('avatar.arrived', { name: activePoint.name }));
      onArrivedAtPoint?.(activePoint.raw);
      return;
    }

    const isMoving =
      !isWaiting &&
      (mode === 'patrol' || mode === 'running_to_point') &&
      pathIndex.current < pathRef.current.length;

    if (isMoving) {
      let moveBudget = speed * dt;

      while (moveBudget > 0 && pathIndex.current < pathRef.current.length) {
        const targetCoordLngLat = pathRef.current[pathIndex.current];
        const { x, z } = projection.toWorld(targetCoordLngLat);

        const dx = x - currentPos.current.x;
        const dz = z - currentPos.current.z;
        const distToTarget = Math.hypot(dx, dz);

        if (distToTarget < 0.002) {
          pathIndex.current++;
          continue;
        }

        if (distToTarget <= moveBudget) {
          currentPos.current.x = x;
          currentPos.current.z = z;
          moveBudget -= distToTarget;
          pathIndex.current++;
        } else {
          const ratio = moveBudget / distToTarget;
          currentPos.current.x += dx * ratio;
          currentPos.current.z += dz * ratio;
          moveBudget = 0;

          // Rotación suave hacia el rumbo de avance
          const targetHeading = Math.atan2(dx, dz);
          let diff = targetHeading - currentHeading.current;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          currentHeading.current += diff * Math.min(dt * 14, 1);
        }
      }

      currentPos.current.y = heightAt(currentPos.current.x, currentPos.current.z);
    } else if (!isWaiting) {
      if (mode === 'running_to_point' && activePoint) {
        setMode('speaking');
        startSpeaking(i18n.t('avatar.arrived', { name: activePoint.name }));
        onArrivedAtPoint?.(activePoint.raw);
      } else if (mode === 'patrol') {
        idleWaitUntil.current = performance.now() + 4000;
        patrolIndex.current = (patrolIndex.current + 1) % poiWorldPositions.length;
        pathRef.current = [];
      }
    }

    // Selección de animación (0.35 patrol -> Walking, 0.95 run -> Running)
    let currentAnim = 'Idle';
    if (mode === 'speaking') {
      currentAnim = 'Wave';
    } else if (isMoving) {
      currentAnim = speed > 0.5 ? 'Running' : 'Walking';
    } else {
      currentAnim = 'Idle';
    }

    // Transición suave entre animaciones
    if (actions && currentAnim !== currentAnimRef.current) {
      const prevAnim = currentAnimRef.current;
      currentAnimRef.current = currentAnim;
      const nextAction = actions[currentAnim];
      if (nextAction) {
        nextAction.reset().fadeIn(0.25).play();
      }
      if (prevAnim && actions[prevAnim] && actions[prevAnim] !== nextAction) {
        actions[prevAnim].fadeOut(0.25);
      }
    }

    // Apoyar siempre al personaje sobre la altura real del relieve
    const groundY = heightAt(currentPos.current.x, currentPos.current.z);
    currentPos.current.y = groundY;
    groupRef.current.position.copy(currentPos.current);
    groupRef.current.rotation.y = currentHeading.current;
    setPosition(currentPos.current);

    if (beaconRef.current) {
      beaconRef.current.rotation.y += dt * 2.5;
      beaconRef.current.position.y = modelHeight * (1.2 + Math.sin(performance.now() / 350) * 0.05);
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={beaconRef} position={[0, modelHeight * 1.2, 0]} scale={modelHeight / 2.2}>
        <mesh>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial
            color="#48cae4"
            emissive="#00b4d8"
            emissiveIntensity={0.8}
            roughness={0.2}
          />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={modelHeight / 2.2}>
        <ringGeometry args={[0, 0.42, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>
      <primitive object={scene} />
    </group>
  );
}
