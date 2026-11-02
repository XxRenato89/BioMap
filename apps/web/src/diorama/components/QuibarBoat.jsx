import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useEffect } from 'react';
import { Vector3 } from 'three';
import { buildLaunch } from '../models/launch.js';
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
  const launch = useMemo(() => buildLaunch(), []);

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
    /* Lancha de ~8 m dibujada a ~60 m de eslora, para que se lea en la maqueta. */
    <group ref={groupRef} scale={[0.0077, 0.0077, 0.0077]}>
      <primitive object={launch} />
    </group>
  );
}
