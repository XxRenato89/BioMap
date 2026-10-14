import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import { metersToY } from '../utils/projection.js';
import { RESERVOIR } from '../utils/reservoir.js';
import { seeded } from '../models/materials.js';
import { useRenderStore } from '../utils/quality.js';
import { useDiorama } from './DioramaScene.jsx';

/*
 * Bandadas sobre el agua: [lng, lat] del centro del giro, radio (km) y
 * cantidad de aves. Envergadura exagerada (m) para que se lean en la maqueta.
 */
const FLOCKS = [
  { center: [-71.801, -37.724], radius: 0.45, count: 9 },
  { center: [-71.789, -37.741], radius: 0.3, count: 6 },
  { center: [-71.812, -37.716], radius: 0.25, count: 5 },
];
const WINGSPAN_M = 22;

/**
 * Silueta de ave en V: dos alas desde el cuerpo, de 1 de envergadura.
 */
function birdGeometry() {
  const geometry = new BufferGeometry();
  /* Ala izquierda y derecha (puntas hacia ±x, borde de ataque hacia +z). */
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [0, 0, 0.18, -0.5, 0.06, -0.05, 0, 0, -0.12, 0, 0, 0.18, 0, 0, -0.12, 0.5, 0.06, -0.05],
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Aves que giran en círculos amplios sobre el embalse, cada una a su altura
 * y su ritmo, alternando aleteo y planeo.
 */
export default function Birds() {
  const { projection } = useDiorama();
  const tier = useRenderStore((state) => state.tier);
  const birds = useMemo(() => {
    const random = seeded(73);
    return FLOCKS.flatMap(({ center, radius, count }) => {
      const { x, z } = projection.toWorld(center);
      return Array.from({ length: count }, () => ({
        x,
        z,
        radius: radius * (0.6 + random() * 0.5),
        height: metersToY(RESERVOIR.level + 40 + random() * 80),
        speed: (0.05 + random() * 0.04) * (random() < 0.5 ? 1 : -1),
        phase: random() * Math.PI * 2,
        flap: 7 + random() * 3,
      }));
    });
  }, [projection]);

  const mesh = useMemo(() => {
    const instanced = new InstancedMesh(
      birdGeometry(),
      new MeshBasicMaterial({ color: '#2b2a26', side: DoubleSide }),
      birds.length,
    );
    instanced.frustumCulled = false;
    return instanced;
  }, [birds]);

  const dummy = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const span = WINGSPAN_M / 1000;
    birds.forEach((bird, k) => {
      const angle = bird.phase + t * bird.speed * 2;
      dummy.position.set(
        bird.x + Math.cos(angle) * bird.radius,
        bird.height + Math.sin(t * 0.3 + bird.phase) * 0.004,
        bird.z + Math.sin(angle) * bird.radius,
      );
      /* Mira hacia donde vuela (tangente del círculo) y se inclina en la curva. */
      dummy.rotation.set(0, -angle + (bird.speed > 0 ? 0 : Math.PI), bird.speed > 0 ? -0.25 : 0.25);
      /* Aleteo: las alas suben y bajan; cada tanto planea con las alas abiertas. */
      const gliding = Math.sin(t * 0.4 + bird.phase) > 0.3;
      /* Siempre positivo: la V se abre y se cierra, nunca se aplana ni se invierte. */
      const wings = gliding ? 0.5 : 0.35 + (Math.sin(t * bird.flap + bird.phase) + 1) * 0.9;
      dummy.scale.set(span, span * wings, span);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  /* En equipos modestos (nivel bajo) no se dibujan. */
  return tier === 'low' ? null : <primitive object={mesh} />;
}
