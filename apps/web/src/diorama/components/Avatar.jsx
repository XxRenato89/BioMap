import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Box3, Vector3 } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useAvatarStore } from '../../store/avatarStore.js';
import { useViewerStore } from '../../store/viewerStore.js';
import i18n from '../../i18n/index.js';
import { useDiorama } from './DioramaScene.jsx';
import { Pathfinder } from '../utils/pathfinder.js';
import { useCharacterModel } from '../utils/characterModel.js';
import { useUserStore } from '../../store/userStore.js';
import { WILDLIFE_SPOTS } from './Wildlife.jsx';

/**
 * Configuración por defecto de la mascota 3D en el diorama.
 * Modifica estos valores para cambiar el tamaño, velocidad o cadencia del avatar.
 */
export const AVATAR_CONFIG = {
  /** Multiplicador de escala visible (aumentado para que no se vea diminuto en el mapa) */
  screenScale: 2.4,
  /** Velocidad de caminata en modo patrulla automática */
  patrolSpeed: 0.14,
  /** Velocidad de carrera al dirigirse a un hito seleccionado */
  runSpeed: 0.36,
  /** Cadencia / velocidad de reproducción de la animación de trote */
  runCadence: 0.85,
  /** Cadencia / velocidad de reproducción de la animación de caminata / trote suave */
  walkCadence: 0.72,
};

/**
 * Ruta por caminos reales y puentes, o null si no hay una que evite el agua
 * (entonces la mascota aparece en el destino en vez de cruzar volando).
 */
function createPath(startCoord, endCoord, pathfinder) {
  return pathfinder?.findPath(startCoord, endCoord) ?? null;
}

/*
 * Qué hace Quibar en cada pausa del paseo: animación, cuánto dura (ms) y
 * hacia dónde mira ('look' recorre el paisaje, 'camera' mira al visitante,
 * 'keep' sigue igual).
 */
export const PAUSES = [
  { anim: 'Look', ms: 4500, face: 'keep' },
  { anim: 'Wave', ms: 2600, face: 'camera' },
  { anim: 'Clapping', ms: 2600, face: 'camera' },
  { anim: 'Sit', ms: 7000, face: 'keep' },
];
const CLAPPING = PAUSES[2];

/** Una pausa al azar entre las que tienen su animación cargada, o null si no hay ninguna. */
export function pickPause(actions, random = Math.random) {
  const ready = PAUSES.filter(({ anim }) => actions?.[anim]);
  if (ready.length === 0) return null;
  return ready[Math.floor(random() * ready.length) % ready.length];
}

/* Quibar se gira a mirar la fauna que tenga a menos de esto (km) en una pausa. */
const WATCH_KM = 0.6;

/* Paseo: próximo destino al azar entre los lugares a menos de esto (km). */
const WANDER_KM = 3;

/**
 * Índice del próximo lugar del paseo: uno cercano al azar (distinto del
 * actual); si no hay ninguno cerca, cualquiera.
 */
export function nextWanderIndex(pois, current, from, random = Math.random) {
  const others = pois.map((_, i) => i).filter((i) => i !== current);
  if (others.length === 0) return current;
  const near = others.filter((i) => Math.hypot(pois[i].x - from.x, pois[i].z - from.z) < WANDER_KM);
  const pool = near.length > 0 ? near : others;
  return pool[Math.floor(random() * pool.length) % pool.length];
}

export default memo(function Avatar({
  points,
  onArrivedAtPoint,
  screenScale = AVATAR_CONFIG.screenScale,
  patrolSpeed = AVATAR_CONFIG.patrolSpeed,
  runSpeed = AVATAR_CONFIG.runSpeed,
  runCadence = AVATAR_CONFIG.runCadence,
  walkCadence = AVATAR_CONFIG.walkCadence,
}) {
  /* La mascota pisa lo que se ve: relieve, o el tablero si cruza un puente. */
  const { projection, surfaceAt: heightAt, roadsData, waterPolygons } = useDiorama();

  const mode = useAvatarStore((state) => state.mode);
  const targetPoint = useAvatarStore((state) => state.targetPoint);
  const skipRequested = useAvatarStore((state) => state.skipRequested);
  const setMode = useAvatarStore((state) => state.setMode);
  const setPath = useAvatarStore((state) => state.setPath);
  const setPosition = useAvatarStore((state) => state.setPosition);
  const setLastArrivedPoint = useAvatarStore((state) => state.setLastArrivedPoint);
  const startSpeaking = useAvatarStore((state) => state.startSpeaking);
  const stopSpeaking = useAvatarStore((state) => state.stopSpeaking);
  const isSpeaking = useAvatarStore((state) => state.isSpeaking);
  const selectedPointIds = useViewerStore((state) => state.selectedPointIds);

  const groupRef = useRef();

  const currentPos = useRef(new Vector3(0, 0, 0));
  const currentHeading = useRef(0);
  const patrolIndex = useRef(0);
  const isInitialized = useRef(false);
  const idleWaitUntil = useRef(0);
  const currentAnimRef = useRef('Idle');

  const pathRef = useRef([]);
  const pathIndex = useRef(0);
  const plannedTargetRef = useRef(null);
  const jumpingRef = useRef(null);
  const lastArrivedPointRef = useRef(null);
  const wasSheetOpenRef = useRef(false);
  /* Pausa del paseo: salta y mira el paisaje a un lado y otro. */
  const lookRef = useRef(null);

  const { scene, actions, mixer } = useCharacterModel(groupRef);
  /* Alto del modelo en sus unidades para normalizar la escala de la maqueta */
  const modelHeight = useMemo(() => {
    const copy = clone(scene);
    copy.position.set(0, 0, 0);
    copy.updateMatrixWorld(true);
    const box = new Box3().setFromObject(copy);
    return box.getSize(new Vector3()).y || 1.9;
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
    /* Al cambiar el juego de clips (p. ej. al recargar), las acciones viejas seguirían
       mezclándose con las nuevas: se detienen todas antes de partir. */
    mixer?.stopAllAction();
    const idleAction = actions?.idle || actions?.Idle;
    if (idleAction) {
      idleAction.reset().setEffectiveTimeScale(0).fadeIn(0.2).play();
      currentAnimRef.current = 'Idle';
    }
  }, [actions, mixer]);

  const animalSpots = useMemo(
    () => WILDLIFE_SPOTS.map((spot) => projection.toWorld(spot)),
    [projection],
  );

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
      const startPoi =
        poiWorldPositions.find((p) => p.id === 12 || p.name?.toLowerCase().includes('visitante')) ||
        poiWorldPositions[0];
      currentPos.current.set(startPoi.x, startPoi.y, startPoi.z);
      if (groupRef.current) {
        groupRef.current.position.copy(currentPos.current);
      }
      setPosition(currentPos.current);
      isInitialized.current = true;
      const startIdx = poiWorldPositions.findIndex((p) => p.id === startPoi.id);
      patrolIndex.current = startIdx >= 0 ? startIdx : 0;
      idleWaitUntil.current = performance.now() + 800;
    }
  }, [poiWorldPositions, setPosition]);

  useFrame((state, delta) => {
    if (poiWorldPositions.length === 0 || !groupRef.current) return;

    /* Tamaño en pantalla proporcional a la distancia de cámara, configurable y legible */
    const camDist = state.camera.position.distanceTo(currentPos.current);
    const avatarWorldSize = Math.max(0.012, Math.min(0.22, camDist * 0.046 * screenScale));
    const roadOffset = 0.0006;

    const isSheetOpen = selectedPointIds && selectedPointIds.length > 0;

    // Solo una instancia de Quibar en pantalla: si la ficha está abierta, Quibar está
    // en primer plano (SheetMascot) y se oculta en la maqueta 3D, pausando su recorrido.
    if (isSheetOpen) {
      groupRef.current.visible = false;
      wasSheetOpenRef.current = true;
      return;
    }

    // Al cerrar la pestaña/ficha, vuelve al punto de interés seleccionado y reanuda el recorrido normal
    if (wasSheetOpenRef.current) {
      wasSheetOpenRef.current = false;
      const returnPoint = lastArrivedPointRef.current;
      if (returnPoint) {
        currentPos.current.set(returnPoint.x, returnPoint.y, returnPoint.z);
        const groundY = heightAt(returnPoint.x, returnPoint.z) + roadOffset;
        currentPos.current.y = groundY;
        groupRef.current.position.set(returnPoint.x, groundY, returnPoint.z);
        setPosition(currentPos.current);

        const idx = poiWorldPositions.findIndex((p) => p.id === returnPoint.id);
        patrolIndex.current = nextWanderIndex(poiWorldPositions, idx, returnPoint);
        pathRef.current = [];
        plannedTargetRef.current = null;
        idleWaitUntil.current = performance.now() + 1500;
      }
      setMode('patrol');
      groupRef.current.visible = true;
    }

    groupRef.current.scale.setScalar(avatarWorldSize / modelHeight);
    groupRef.current.visible = true;

    const now = performance.now();

    // Animación de salto al llegar al hito antes de pasar al frente de la pantalla
    if (jumpingRef.current) {
      const elapsed = (now - jumpingRef.current.startTime) / jumpingRef.current.duration;
      if (elapsed < 1) {
        const dxCam = state.camera.position.x - currentPos.current.x;
        const dzCam = state.camera.position.z - currentPos.current.z;
        currentHeading.current = Math.atan2(dxCam, dzCam);

        // Salto parabólico y squash/stretch celebratorio
        const jumpHeight = avatarWorldSize * 1.5;
        const hopY = Math.sin(elapsed * Math.PI) * jumpHeight;
        const groundY = heightAt(currentPos.current.x, currentPos.current.z) + roadOffset;

        let stretch = 1;
        if (elapsed < 0.15) stretch = 0.88;
        else if (elapsed < 0.85) stretch = 1.18;
        else stretch = 0.92;

        const baseScale = avatarWorldSize / modelHeight;
        groupRef.current.scale.set(
          baseScale / Math.sqrt(stretch),
          baseScale * stretch,
          baseScale / Math.sqrt(stretch),
        );
        groupRef.current.position.set(currentPos.current.x, groundY + hopY, currentPos.current.z);
        groupRef.current.rotation.y = currentHeading.current;
        return;
      }

      // Salto completado: pasa hacia adelante de la pantalla
      const arrivedPoint = jumpingRef.current.point;
      jumpingRef.current = null;
      lastArrivedPointRef.current = arrivedPoint;
      setLastArrivedPoint(arrivedPoint.raw);
      pathRef.current = [];
      setMode('speaking');
      startSpeaking(i18n.t('avatar.arrived', { name: arrivedPoint.name }));
      onArrivedAtPoint?.(arrivedPoint.raw);
      return;
    }

    const dt = Math.min(delta, 0.1);
    let speed = patrolSpeed;
    let activePoint = null;
    let targetCoord = null;

    if (mode === 'running_to_point' && targetPoint) {
      targetCoord = targetPoint.geometry.coordinates;
      speed = runSpeed;
      const found = poiWorldPositions.find((p) => p.id === targetPoint.properties.id);
      if (found) activePoint = found;
    } else if (mode === 'patrol') {
      const p = poiWorldPositions[patrolIndex.current % poiWorldPositions.length];
      targetCoord = p.raw.geometry.coordinates;
      activePoint = p;
    }

    const isWaiting = (mode === 'patrol' || mode === 'speaking') && now < idleWaitUntil.current;

    // Mensaje pendiente (p. ej. un secreto hallado) mientras pasea: se cierra al terminar la pausa.
    if (!isWaiting && isSpeaking && mode === 'patrol') stopSpeaking();

    // Planificar ruta si no existe o cambió el destino
    const targetChanged = Boolean(
      targetCoord &&
      (!plannedTargetRef.current ||
        plannedTargetRef.current[0] !== targetCoord[0] ||
        plannedTargetRef.current[1] !== targetCoord[1]),
    );

    if (targetChanged) {
      jumpingRef.current = null;
    }

    if (!isWaiting && targetCoord && (targetChanged || !pathRef.current.length)) {
      plannedTargetRef.current = targetCoord;
      const currentCoord = projection.toLngLat(currentPos.current.x, currentPos.current.z);
      const path = createPath(currentCoord, targetCoord, pathfinder);
      if (path) {
        pathRef.current = path;
        pathIndex.current = 0;
      } else if (mode === 'patrol') {
        /* Paseando no se teletransporta: busca otro lugar al que se llegue caminando. */
        patrolIndex.current = nextWanderIndex(
          poiWorldPositions,
          patrolIndex.current,
          currentPos.current,
        );
        plannedTargetRef.current = null;
        pathRef.current = [];
        idleWaitUntil.current = now + 300;
        return;
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
      currentPos.current.y = heightAt(activePoint.x, activePoint.z) + roadOffset;
      pathIndex.current = pathRef.current.length;
      pathRef.current = [];
      jumpingRef.current = null;
      lastArrivedPointRef.current = activePoint;
      setLastArrivedPoint(activePoint.raw);
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

      currentPos.current.y = heightAt(currentPos.current.x, currentPos.current.z) + roadOffset;
    } else if (!isWaiting && activePoint) {
      if (mode === 'running_to_point') {
        if (!jumpingRef.current) {
          jumpingRef.current = {
            startTime: performance.now(),
            duration: 750,
            point: activePoint,
          };
        }
      } else if (mode === 'patrol') {
        /* Sin hablar: mira el paisaje, saluda o aplaude, y sigue paseando. */
        /* Con fauna cerca, la mira (o la saluda) en vez de mirar al azar. */
        const animal = animalSpots.find(
          (spot) =>
            Math.hypot(spot.x - currentPos.current.x, spot.z - currentPos.current.z) < WATCH_KM,
        );
        const picked = pickPause(actions);
        const pause =
          animal && actions?.Look
            ? {
                ...(actions?.Wave && Math.random() < 0.5 ? PAUSES[1] : PAUSES[0]),
                face: 'target',
                target: animal,
              }
            : picked;
        /* Sin clips de pausa, sigue paseando sin detenerse. */
        if (pause) {
          idleWaitUntil.current = now + pause.ms;
          lookRef.current = {
            ...pause,
            start: now,
            end: now + pause.ms,
            heading: currentHeading.current,
          };
        }
        patrolIndex.current = nextWanderIndex(
          poiWorldPositions,
          patrolIndex.current,
          currentPos.current,
        );
        pathRef.current = [];
        plannedTargetRef.current = null;
      }
    }

    /* Durante la pausa mira según la pausa (sin saltito: ningún clip lo anima). */
    const look = lookRef.current;
    if (look && mode === 'patrol' && now < look.end) {
      const t = (now - look.start) / 1000;
      if (look.face === 'camera') {
        currentHeading.current = Math.atan2(
          state.camera.position.x - currentPos.current.x,
          state.camera.position.z - currentPos.current.z,
        );
      } else if (look.face === 'target') {
        currentHeading.current = Math.atan2(
          look.target.x - currentPos.current.x,
          look.target.z - currentPos.current.z,
        );
      } else if (look.face === 'look') {
        currentHeading.current = look.heading + Math.sin(t * 1.8) * 0.9;
      }
    } else if (look) {
      lookRef.current = null;
    }

    // Selección de animación: caminar o correr al desplazarse; en pausa, la de la pausa.
    let currentAnim = 'Idle';
    if (isMoving) {
      currentAnim = actions?.Running && mode === 'running_to_point' ? 'Running' : 'Walking';
    } else if (lookRef.current && actions?.[lookRef.current.anim]) {
      currentAnim = lookRef.current.anim;
    }

    // Transición suave entre animaciones y ritmo más pausado
    if (actions && currentAnim !== currentAnimRef.current) {
      const prevAnim = currentAnimRef.current;
      currentAnimRef.current = currentAnim;
      const nextAction = actions[currentAnim];
      if (nextAction) {
        if (currentAnim === 'Running') {
          nextAction.setEffectiveTimeScale(runCadence);
        } else if (currentAnim === 'Walking') {
          nextAction.setEffectiveTimeScale(walkCadence);
        } else if (currentAnim === 'Idle') {
          /* El reposo es la caminata congelada en su primer cuadro: Quibar queda de pie. */
          nextAction.setEffectiveTimeScale(0);
        } else {
          nextAction.setEffectiveTimeScale(1.0);
        }
        nextAction.reset().fadeIn(0.25).play();
      }
      if (prevAnim && actions[prevAnim] && actions[prevAnim] !== nextAction) {
        actions[prevAnim].fadeOut(0.25);
      }
    }

    // Apoyar siempre al personaje sobre la cota exacta del relieve o camino
    const groundY = heightAt(currentPos.current.x, currentPos.current.z) + roadOffset;
    currentPos.current.y = groundY;
    groupRef.current.position.set(currentPos.current.x, groundY, currentPos.current.z);
    groupRef.current.rotation.y = currentHeading.current;
    setPosition(currentPos.current);

    // Comprobar si Quibar descubre un punto secreto al pasar cerca
    const userStore = useUserStore.getState();
    for (const poi of poiWorldPositions) {
      if (poi.raw?.properties?.secret && !userStore.isSecretDiscovered(poi.id)) {
        const dist = Math.hypot(currentPos.current.x - poi.x, currentPos.current.z - poi.z);
        if (dist < 0.15) {
          userStore.discoverSecret(poi.id);
          startSpeaking(`¡Oh, he encontrado algo misterioso! Es: ${poi.name}`);
          /* No frena el paseo: se detiene a mirar y sigue. */
          if (mode === 'patrol' && actions?.Clapping) {
            setMode('patrol');
            idleWaitUntil.current = now + 3500;
            lookRef.current = {
              ...CLAPPING,
              start: now,
              end: now + 3500,
              heading: currentHeading.current,
            };
          }
          break;
        }
      }
    }
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} scale={modelHeight / 2.2}>
        <ringGeometry args={[0, 0.42, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>
      <primitive object={scene} />
    </group>
  );
});
