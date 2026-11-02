import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { buildEgret, buildFox, buildPudu, buildSwan } from '../models/wildlife.js';
import { seeded } from '../models/materials.js';
import { metersToY } from '../utils/projection.js';
import { RESERVOIR, reservoirDrain } from '../utils/reservoir.js';
import { waterTest } from '../utils/pathfinder.js';
import { useDiorama } from './DioramaScene.jsx';

/* Tamaño exagerado (×) para que se lean en la maqueta, como las aves. */
const SIZE = 12;
const SCALE = SIZE / 1000;

/* Grupos de cisnes de cuello negro: centro [lng, lat] en el embalse y radio del giro (km). */
const SWANS = [
  { center: [-71.8035, -37.7255], radius: 0.05, count: 3 },
  { center: [-71.8065, -37.7215], radius: 0.06, count: 2 },
  { center: [-71.7965, -37.7155], radius: 0.05, count: 3 },
];
/* Pudúes y zorros que van y vuelven por el borde del bosque: [desde, hasta]. */
const WALKERS = [
  { build: buildPudu, from: [-71.8138, -37.7118], to: [-71.8124, -37.7131] },
  { build: buildPudu, from: [-71.8052, -37.7182], to: [-71.8038, -37.7168] },
  { build: buildFox, from: [-71.7978, -37.7445], to: [-71.7958, -37.7428] },
  { build: buildFox, from: [-71.8105, -37.73], to: [-71.8088, -37.7318] },
];
/* Garzas en la orilla del embalse. */
const EGRETS = 6;
const EGRET_SPACING_KM = 0.5;

/**
 * Puntos de la orilla del embalse para las garzas: vértices del borde del
 * agua dentro del embalse, separados al menos `EGRET_SPACING_KM`.
 */
function shorePoints(polygons, projection) {
  const { west, east, south, north } = RESERVOIR.bed;
  const picked = [];
  for (const polygon of polygons) {
    for (const [lng, lat] of polygon.outer) {
      if (lng < west || lng > east || lat < south || lat > north) continue;
      const p = projection.toWorld([lng, lat]);
      if (picked.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < EGRET_SPACING_KM)) continue;
      picked.push(p);
      if (picked.length >= EGRETS) return picked;
    }
  }
  return picked;
}

/**
 * Fauna de la zona: cisnes de cuello negro nadando en el embalse, garzas
 * blancas en la orilla, y pudúes y zorros culpeo en el borde del bosque.
 */
export default function Wildlife() {
  const { projection, heightAt, waterPolygons } = useDiorama();
  const group = useRef(null);
  const waterY = metersToY(RESERVOIR.level);

  const animals = useMemo(() => {
    const random = seeded(91);
    const inWater = waterTest(waterPolygons ?? []);
    const list = [];
    for (const { center, radius, count } of SWANS) {
      const { x, z } = projection.toWorld(center);
      for (let k = 0; k < count; k += 1)
        list.push({
          kind: 'swan',
          object: buildSwan(),
          x,
          z,
          radius: radius * (0.7 + random() * 0.4),
          phase: (k / count) * Math.PI * 2 + random() * 0.3,
          speed: 0.05 + random() * 0.03,
        });
    }
    for (const p of shorePoints(waterPolygons ?? [], projection))
      list.push({ kind: 'egret', object: buildEgret(), x: p.x, z: p.z, phase: random() * 6 });
    for (const { build, from, to } of WALKERS) {
      if (inWater(from) || inWater(to)) continue;
      const a = projection.toWorld(from);
      const b = projection.toWorld(to);
      list.push({ kind: 'walker', object: build(), a, b, phase: random() * 6, speed: 0.12 });
    }
    for (const animal of list) animal.object.scale.setScalar(SCALE);
    return list;
  }, [projection, waterPolygons]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    const drained = reservoirDrain.value > 0.4;
    for (const animal of animals) {
      const { object } = animal;
      if (animal.kind === 'swan') {
        object.visible = !drained;
        const angle = animal.phase + t * animal.speed;
        object.position.set(
          animal.x + Math.cos(angle) * animal.radius,
          waterY + Math.sin(t * 1.3 + animal.phase) * 0.00008,
          animal.z + Math.sin(angle) * animal.radius,
        );
        /* Nada en el sentido del giro (tangente al círculo). */
        object.rotation.y = -angle;
      } else if (animal.kind === 'egret') {
        object.position.set(animal.x, Math.max(heightAt(animal.x, animal.z), waterY), animal.z);
        /* Gira la cabeza de a poco, mirando el agua. */
        object.rotation.y = animal.phase + Math.sin(t * 0.3 + animal.phase) * 0.6;
      } else {
        /* Va y vuelve por su tramo, con pausas en los extremos. */
        const cycle = (t * animal.speed + animal.phase) % 2;
        const f = Math.min(
          Math.max(cycle < 1 ? cycle * 1.3 - 0.15 : (2 - cycle) * 1.3 - 0.15, 0),
          1,
        );
        const x = animal.a.x + (animal.b.x - animal.a.x) * f;
        const z = animal.a.z + (animal.b.z - animal.a.z) * f;
        object.position.set(x, heightAt(x, z), z);
        const heading = Math.atan2(animal.b.x - animal.a.x, animal.b.z - animal.a.z);
        object.rotation.y = cycle < 1 ? heading : heading + Math.PI;
      }
    }
  });

  return (
    <group ref={group} name="wildlife">
      {animals.map((animal, k) => (
        <primitive key={k} object={animal.object} />
      ))}
    </group>
  );
}

/** Posiciones fijas aproximadas de la fauna, para que Quibar la mire al pasar. */
export const WILDLIFE_SPOTS = [
  ...SWANS.map(({ center }) => center),
  ...WALKERS.map(({ from, to }) => [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]),
];
