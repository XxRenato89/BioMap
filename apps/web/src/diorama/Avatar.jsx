import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MeshStandardMaterial, Vector3 } from 'three';
import { useAvatarStore } from '../store/avatarStore.js';
import { useDiorama } from './DioramaScene.jsx';

/*
 * Escala del avatar para que sea claramente visible y distinguible en la maqueta
 * desde vista lejana y media (altura de unos 50 metros en escala del territorio).
 */
const AVATAR_SCALE = 0.055;
const PATROL_SPEED = 0.85; // km/s en tiempo simulado
const RUN_TO_POINT_SPEED = 2.2; // Velocidad rápida al ser llamado
const ARRIVAL_DISTANCE = 0.04; // Distancia para considerar que llegó

/**
 * Materiales compartidos del avatar para óptimo rendimiento de renderizado.
 */
function createAvatarMaterials() {
  return {
    skin: new MeshStandardMaterial({ color: '#f4c29e', roughness: 0.6 }),
    hat: new MeshStandardMaterial({ color: '#8d6e3f', roughness: 0.7 }),
    hatBand: new MeshStandardMaterial({ color: '#314e35', roughness: 0.5 }),
    jacket: new MeshStandardMaterial({ color: '#2d6a4f', roughness: 0.6 }),
    pants: new MeshStandardMaterial({ color: '#403d39', roughness: 0.7 }),
    backpack: new MeshStandardMaterial({ color: '#e07a5f', roughness: 0.5 }),
    boots: new MeshStandardMaterial({ color: '#2b1e17', roughness: 0.8 }),
    badge: new MeshStandardMaterial({ color: '#f2cc8f', metalness: 0.5, roughness: 0.3 }),
    beacon: new MeshStandardMaterial({
      color: '#48cae4',
      emissive: '#00b4d8',
      emissiveIntensity: 0.8,
      roughness: 0.2,
    }),
  };
}

/**
 * Avatar 3D procedural del explorador ("BioGuía" de Angostura).
 * Corre por el terreno siguiendo las curvas de nivel y montañas,
 * visita los puntos en tour continuo y acude velozmente cuando el usuario toca un punto.
 */
export default function Avatar({ points, onArrivedAtPoint }) {
  const { projection, heightAt } = useDiorama();
  const invalidate = useThree((state) => state.invalidate);

  const mode = useAvatarStore((state) => state.mode);
  const targetPoint = useAvatarStore((state) => state.targetPoint);
  const setMode = useAvatarStore((state) => state.setMode);
  const startSpeaking = useAvatarStore((state) => state.startSpeaking);

  const groupRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const bodyRef = useRef();
  const headRef = useRef();
  const beaconRef = useRef();

  // Posición actual del avatar en coordenadas de mundo
  const currentPos = useRef(new Vector3(0, 0, 0));
  const currentHeading = useRef(0);
  const patrolIndex = useRef(0);
  const isInitialized = useRef(false);
  const runCycle = useRef(0);
  const idleWaitUntil = useRef(0);

  const materials = useMemo(() => createAvatarMaterials(), []);

  // Lista de posiciones en mundo de los puntos de interés
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

  // Inicializar la posición del avatar en el primer punto
  useEffect(() => {
    if (!isInitialized.current && poiWorldPositions.length > 0) {
      const first = poiWorldPositions[0];
      currentPos.current.set(first.x, first.y, first.z);
      if (groupRef.current) {
        groupRef.current.position.copy(currentPos.current);
      }
      isInitialized.current = true;
    }
  }, [poiWorldPositions]);

  // Actualización cuadro a cuadro del movimiento y las articulaciones
  useFrame((_, delta) => {
    if (poiWorldPositions.length === 0 || !groupRef.current) return;

    const dt = Math.min(delta, 0.1);
    let targetX = 0;
    let targetZ = 0;
    let speed = PATROL_SPEED;
    let activePoint = null;

    if (mode === 'running_to_point' && targetPoint) {
      // Objetivo: el punto seleccionado por el usuario
      const found = poiWorldPositions.find((p) => p.id === targetPoint.properties.id);
      if (found) {
        targetX = found.x;
        targetZ = found.z;
        speed = RUN_TO_POINT_SPEED;
        activePoint = found;
      }
    } else if (mode === 'patrol') {
      // Objetivo: siguiente punto en la patrulla
      const p = poiWorldPositions[patrolIndex.current % poiWorldPositions.length];
      targetX = p.x;
      targetZ = p.z;
      activePoint = p;
    }

    const dx = targetX - currentPos.current.x;
    const dz = targetZ - currentPos.current.z;
    const distToTarget = Math.hypot(dx, dz);

    const isMoving =
      (mode === 'patrol' || mode === 'running_to_point') && distToTarget > ARRIVAL_DISTANCE;

    if (isMoving) {
      // Comprobar si está esperando en pausa de patrulla
      if (mode === 'patrol' && performance.now() < idleWaitUntil.current) {
        // En pausa contemplando el lugar
      } else {
        // Calcular dirección y rotación
        const moveDist = Math.min(speed * dt, distToTarget);
        const dirX = dx / distToTarget;
        const dirZ = dz / distToTarget;

        currentPos.current.x += dirX * moveDist;
        currentPos.current.z += dirZ * moveDist;

        // Calcular ángulo hacia donde camina
        const angle = Math.atan2(dirX, dirZ);
        currentHeading.current = angle;

        // Animar ciclo de carrera
        runCycle.current += dt * (speed > 1.5 ? 18 : 12);
        const legSwing = Math.sin(runCycle.current) * 0.75;
        const armSwing = Math.sin(runCycle.current) * 0.75;

        if (leftLegRef.current) leftLegRef.current.rotation.x = legSwing;
        if (rightLegRef.current) rightLegRef.current.rotation.x = -legSwing;
        if (leftArmRef.current) leftArmRef.current.rotation.x = -armSwing;
        if (rightArmRef.current) rightArmRef.current.rotation.x = armSwing;
        if (bodyRef.current)
          bodyRef.current.position.y = Math.abs(Math.sin(runCycle.current * 2)) * 0.08;
      }
    } else {
      // Llegó a su destino
      if (mode === 'running_to_point' && activePoint) {
        setMode('speaking');
        // Construir narración explicativa del lugar
        const speech = `¡Hola! Bienvenido a ${activePoint.name}. ${
          activePoint.description ||
          'Este es uno de los hitos más emblemáticos de la cuenca del Biobío y del entorno Angostura.'
        }`;
        startSpeaking(speech);
        onArrivedAtPoint?.(activePoint.raw);
      } else if (mode === 'patrol') {
        // Avanzar al siguiente punto tras pequeña pausa de observación
        idleWaitUntil.current = performance.now() + 3500;
        patrolIndex.current = (patrolIndex.current + 1) % poiWorldPositions.length;
      }

      // Animación en reposo / hablando (respiración y gestos suaves)
      const t = performance.now() / 1000;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;

      if (mode === 'speaking') {
        // Gestos explicativos con los brazos y cabeza
        if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 3.5) * 0.35 - 0.2;
        if (rightArmRef.current) rightArmRef.current.rotation.x = Math.cos(t * 3) * 0.45 - 0.3;
        if (headRef.current) {
          headRef.current.rotation.y = Math.sin(t * 2) * 0.25;
          headRef.current.rotation.x = Math.sin(t * 4) * 0.08;
        }
      } else {
        if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 1.5) * 0.08;
        if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.sin(t * 1.5) * 0.08;
        if (headRef.current) headRef.current.rotation.set(0, 0, 0);
      }

      if (bodyRef.current) bodyRef.current.position.y = Math.sin(t * 2) * 0.02;
    }

    // Calcular altura real del terreno bajo el avatar
    const groundY = heightAt(currentPos.current.x, currentPos.current.z);
    currentPos.current.y = groundY;

    // Aplicar transformaciones al grupo
    groupRef.current.position.copy(currentPos.current);
    groupRef.current.rotation.y = currentHeading.current;

    // Animar la baliza flotante (rotación y pulsación)
    if (beaconRef.current) {
      beaconRef.current.rotation.y += dt * 2.5;
      beaconRef.current.position.y = 2.4 + Math.sin(performance.now() / 350) * 0.12;
    }

    invalidate();
  });

  return (
    <group ref={groupRef} scale={[AVATAR_SCALE, AVATAR_SCALE, AVATAR_SCALE]}>
      {/* Baliza flotante indicadora sobre la cabeza para visibilidad desde lejos */}
      <group ref={beaconRef} position={[0, 2.4, 0]}>
        <mesh material={materials.beacon}>
          <octahedronGeometry args={[0.22, 0]} />
        </mesh>
      </group>

      {/* Sombra en el suelo bajo el personaje */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0, 0.5, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>

      {/* Cuerpo principal articulado */}
      <group ref={bodyRef} position={[0, 0.75, 0]}>
        {/* Torso con chaqueta de guardaparques */}
        <mesh position={[0, 0.2, 0]} material={materials.jacket} castShadow>
          <boxGeometry args={[0.55, 0.58, 0.35]} />
        </mesh>

        {/* Insignia / distintivo en el pecho */}
        <mesh position={[0.16, 0.3, 0.18]} material={materials.badge}>
          <boxGeometry args={[0.08, 0.1, 0.02]} />
        </mesh>

        {/* Mochila de exploración en la espalda */}
        <mesh position={[0, 0.2, -0.25]} material={materials.backpack} castShadow>
          <boxGeometry args={[0.42, 0.48, 0.22]} />
        </mesh>

        {/* Cabeza y cuello */}
        <group ref={headRef} position={[0, 0.58, 0]}>
          {/* Cuello */}
          <mesh position={[0, -0.05, 0]} material={materials.skin}>
            <cylinderGeometry args={[0.1, 0.1, 0.1, 10]} />
          </mesh>

          {/* Cabeza */}
          <mesh position={[0, 0.12, 0]} material={materials.skin} castShadow>
            <sphereGeometry args={[0.22, 16, 16]} />
          </mesh>

          {/* Sombrero de explorador (ala ancha) */}
          <mesh position={[0, 0.26, 0]} material={materials.hat} castShadow>
            <cylinderGeometry args={[0.48, 0.48, 0.04, 20]} />
          </mesh>
          {/* Copa del sombrero */}
          <mesh position={[0, 0.37, 0]} material={materials.hat} castShadow>
            <cylinderGeometry args={[0.24, 0.26, 0.22, 16]} />
          </mesh>
          {/* Cinta del sombrero */}
          <mesh position={[0, 0.3, 0]} material={materials.hatBand}>
            <cylinderGeometry args={[0.262, 0.262, 0.06, 16]} />
          </mesh>
        </group>

        {/* Brazo izquierdo */}
        <group ref={leftArmRef} position={[-0.35, 0.4, 0]}>
          <mesh position={[0, -0.22, 0]} material={materials.jacket} castShadow>
            <boxGeometry args={[0.14, 0.46, 0.16]} />
          </mesh>
          <mesh position={[0, -0.48, 0]} material={materials.skin}>
            <sphereGeometry args={[0.08, 10, 10]} />
          </mesh>
        </group>

        {/* Brazo derecho */}
        <group ref={rightArmRef} position={[0.35, 0.4, 0]}>
          <mesh position={[0, -0.22, 0]} material={materials.jacket} castShadow>
            <boxGeometry args={[0.14, 0.46, 0.16]} />
          </mesh>
          <mesh position={[0, -0.48, 0]} material={materials.skin}>
            <sphereGeometry args={[0.08, 10, 10]} />
          </mesh>
        </group>
      </group>

      {/* Pierna izquierda */}
      <group ref={leftLegRef} position={[-0.16, 0.68, 0]}>
        <mesh position={[0, -0.32, 0]} material={materials.pants} castShadow>
          <boxGeometry args={[0.18, 0.58, 0.2]} />
        </mesh>
        {/* Bota */}
        <mesh position={[0, -0.62, 0.05]} material={materials.boots} castShadow>
          <boxGeometry args={[0.19, 0.18, 0.3]} />
        </mesh>
      </group>

      {/* Pierna derecha */}
      <group ref={rightLegRef} position={[0.16, 0.68, 0]}>
        <mesh position={[0, -0.32, 0]} material={materials.pants} castShadow>
          <boxGeometry args={[0.18, 0.58, 0.2]} />
        </mesh>
        {/* Bota */}
        <mesh position={[0, -0.62, 0.05]} material={materials.boots} castShadow>
          <boxGeometry args={[0.19, 0.18, 0.3]} />
        </mesh>
      </group>
    </group>
  );
}
