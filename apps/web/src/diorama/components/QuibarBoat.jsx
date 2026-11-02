import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useEffect } from 'react';
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, MeshStandardMaterial, Vector3 } from 'three';
import { useDiorama } from './DioramaScene.jsx';
import { metersToY } from '../utils/projection.js';
import { RESERVOIR, reservoirDrain } from '../utils/reservoir.js';

// Waypoints en el Embalse Angostura (coordenadas [lng, lat] de agua profunda navegable)
export const BOAT_ROUTE = [
  [-71.808, -37.722],
  [-71.805, -37.725],
  [-71.805, -37.729],
  [-71.807, -37.731],
  [-71.809, -37.728],
  [-71.811, -37.724],
];

export default function QuibarBoat() {
  const { projection } = useDiorama();
  const groupRef = useRef(null);
  const currentWaypoint = useRef(0);
  const currentPos = useRef(new Vector3());
  const heading = useRef(0);
  const isInitialized = useRef(false);

  // Convertir ruta a coordenadas de mundo
  const worldWaypoints = useMemo(() => {
    const waterY = metersToY(RESERVOIR.level) + 0.0008;
    return BOAT_ROUTE.map((coords) => {
      const { x, z } = projection.toWorld(coords);
      return new Vector3(x, waterY, z);
    });
  }, [projection]);

  useEffect(() => {
    if (worldWaypoints.length > 0 && !isInitialized.current) {
      currentPos.current.copy(worldWaypoints[0]);
      isInitialized.current = true;
    }
  }, [worldWaypoints]);

  useFrame((_, delta) => {
    if (!groupRef.current || worldWaypoints.length === 0) return;

    // Si el embalse está vaciado, el barco no navega
    if (reservoirDrain.value > 0.4) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    const time = performance.now() / 1000;
    const target = worldWaypoints[currentWaypoint.current];
    const dx = target.x - currentPos.current.x;
    const dz = target.z - currentPos.current.z;
    const dist = Math.hypot(dx, dz);

    const speed = 0.055; // Velocidad de navegación calma
    const step = speed * delta;

    if (dist < step * 1.5) {
      currentWaypoint.current = (currentWaypoint.current + 1) % worldWaypoints.length;
    } else {
      currentPos.current.x += (dx / dist) * step;
      currentPos.current.z += (dz / dist) * step;

      // Giro suave hacia el destino
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - heading.current;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      heading.current += diff * Math.min(delta * 2.5, 1);
    }

    // Leve balanceo en el agua
    const roll = Math.sin(time * 2.2) * 0.035;
    const pitch = Math.cos(time * 1.8) * 0.02;
    const bob = Math.sin(time * 3.0) * 0.0004;

    groupRef.current.position.set(
      currentPos.current.x,
      currentPos.current.y + bob,
      currentPos.current.z,
    );
    groupRef.current.rotation.set(pitch, heading.current, roll);
  });

  return (
    <group ref={groupRef} scale={[0.022, 0.022, 0.022]}>
      {/* Casco del barco */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.6, 2.8]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>

      {/* Proa afilada */}
      <mesh position={[0, 0.35, 1.6]} rotation={[0, Math.PI, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.65, 0.9, 4]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
      </mesh>

      {/* Cubierta de madera */}
      <mesh position={[0, 0.66, 0.1]} receiveShadow>
        <boxGeometry args={[0.95, 0.04, 2.5]} />
        <meshStandardMaterial color="#c29b61" roughness={0.8} />
      </mesh>

      {/* Cabina */}
      <mesh position={[0, 1.05, -0.3]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.75, 1.2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>

      {/* Parabrisas / Ventanas */}
      <mesh position={[0, 1.15, 0.31]}>
        <boxGeometry args={[0.7, 0.35, 0.05]} />
        <meshStandardMaterial color="#38bdf8" roughness={0.1} metalness={0.8} />
      </mesh>

      {/* Mástil */}
      <mesh position={[0, 1.9, 0.4]} castShadow>
        <cylinderGeometry args={[0.025, 0.035, 1.6, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.5} />
      </mesh>

      {/* Banderín de Quibar */}
      <mesh position={[0.18, 2.55, 0.4]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.15, 0.4, 3]} />
        <meshStandardMaterial color="#d97706" roughness={0.5} />
      </mesh>
    </group>
  );
}
