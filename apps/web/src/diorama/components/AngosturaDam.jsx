import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { DoubleSide, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry } from 'three';
import {
  EMBANKMENT_FROM,
  FRONT_BOX,
  FRONT_LENGTH,
  FRONT_ROAD,
  buildAngosturaFront,
} from '../models/angosturaFront.js';
import { buildEmbankment } from '../builders/dam.js';
import { ROAD_WIDTHS } from '../utils/osm.js';
import { metersToY } from '../utils/projection.js';
import { RESERVOIR, reservoirDrain } from '../utils/reservoir.js';
import { useDiorama } from './DioramaScene.jsx';
import { PRESA_ANGOSTURA_COORDINATES as ANGOSTURA } from '../../data/damCoordinates.js';

/* Doble cara: el terraplén se arma sin cuidar el sentido de cada triángulo. */
const embankmentMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.95,
  side: DoubleSide,
});

/* Boyas de la barrera flotante: ~2 m, exageradas para verse desde lejos (km). */
const BOOM_FLOATS = 60;
const boomGeometry = new SphereGeometry(0.0022, 8, 5);
const boomMaterial = new MeshStandardMaterial({ color: 0xe8662e, roughness: 0.6 });

/* Holgura entre el pie del talud y el borde de un camino (km). */
const ROAD_MARGIN = 0.003;

/**
 * ¿Está (x, z) sobre algún camino cercano a la planta? (con su ancho real).
 */
function roadTest(roads, ring, projection) {
  const near = (lng, lat) =>
    ring.some(([a, b]) => Math.hypot((lng - a) * 88, (lat - b) * 111) < 0.3);
  const segments = [];
  for (const road of roads) {
    if (!road.line.some(([lng, lat]) => near(lng, lat))) continue;
    const reach = (ROAD_WIDTHS[road.kind] ?? 4) / 2000 + ROAD_MARGIN;
    const pts = road.line.map((point) => projection.toWorld(point));
    for (let k = 1; k < pts.length; k += 1) segments.push([pts[k - 1], pts[k], reach]);
  }
  return (x, z) =>
    segments.some(([a, b, reach]) => {
      const [dx, dz] = [b.x - a.x, b.z - a.z];
      const t = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)),
      );
      return Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < reach;
    });
}

/**
 * Cómo encajar el modelo en la planta del muro frontal: el eje largo del
 * polígono (del primer punto al más lejano) da el largo y el giro; la cara
 * aguas arriba (+x del modelo) queda en el borde del polígono que da al
 * embalse, y su alto va de la base bajo el cauce al coronamiento.
 * `startEnd` dice en qué extremo del modelo (z −1 o +1) queda el primer punto.
 *
 * @param {Array<{ x: number, z: number }>} points Planta del muro (mundo).
 * @param {{ x: number, z: number }} upstream Un punto del embalse (mundo).
 * @param {import('three').Box3} box Caja del cuerpo del muro.
 * @param {{ base: number, crest: number }} levels
 */
export function fitDamFront(points, upstream, box, { base, crest }) {
  const a = points[0];
  const far = points.reduce((best, p) =>
    Math.hypot(p.x - a.x, p.z - a.z) > Math.hypot(best.x - a.x, best.z - a.z) ? p : best,
  );
  const span = Math.hypot(far.x - a.x, far.z - a.z);
  let d = { x: (far.x - a.x) / span, z: (far.z - a.z) / span };
  let rotationY = Math.atan2(d.x, d.z);
  /* +x local tras girar: (cos θ, −sin θ) = (d.z, −d.x). Debe apuntar al embalse. */
  let startEnd = -1;
  if (d.z * (upstream.x - a.x) - d.x * (upstream.z - a.z) < 0) {
    rotationY += Math.PI;
    d = { x: -d.x, z: -d.z };
    startEnd = 1;
  }
  const u = { x: d.z, z: -d.x };
  const along = points.map((p) => (p.x - a.x) * d.x + (p.z - a.z) * d.z);
  const across = points.map((p) => (p.x - a.x) * u.x + (p.z - a.z) * u.z);
  const [t0, t1] = [Math.min(...along), Math.max(...along)];
  const upstreamEdge = Math.max(...across);
  const mid = (t0 + t1) / 2;
  const horizontal = (t1 - t0) / (box.max.z - box.min.z);
  const vertical = (crest - base) / (box.max.y - box.min.y);
  return {
    position: [a.x + d.x * mid + u.x * upstreamEdge, base, a.z + d.z * mid + u.z * upstreamEdge],
    rotationY,
    scale: [horizontal, vertical, horizontal],
    startEnd,
    /* El modelo se corre para que su cara aguas arriba y su base queden en el origen. */
    offset: [
      -box.max.x * horizontal,
      -box.min.y * vertical,
      (-(box.min.z + box.max.z) / 2) * horizontal,
    ],
  };
}

/**
 * Presa Angostura: el frente (vertedero y presa de enrocado, ver
 * `buildAngosturaFront`) a escala real sobre su planta de OpenStreetMap, y el
 * muro lateral, un terraplén que sigue la ruta por la ribera poniente del
 * embalse (ver `buildEmbankment`).
 *
 * @param {{ shadows?: boolean }} props
 */
export default function AngosturaDam({ shadows = false }) {
  const { angosturaFront, heightAt, projection, roadsData } = useDiorama();
  const fit = useMemo(
    () =>
      fitDamFront(
        angosturaFront.points,
        projection.toWorld(ANGOSTURA.upstream),
        FRONT_BOX,
        angosturaFront,
      ),
    [angosturaFront, projection],
  );

  /* El primer punto de la planta es el estribo norte, donde está el vertedero. */
  const front = useMemo(() => buildAngosturaFront({ spillwayEnd: fit.startEnd }), [fit]);
  /*
   * Presa de enrocado: corre por el frente desde el vertedero y curva hasta la
   * planta del muro lateral.
   */
  const toWorld = useMemo(() => {
    const [h] = fit.scale;
    const [cos, sin] = [Math.cos(fit.rotationY), Math.sin(fit.rotationY)];
    return {
      /* Del modelo (x, z) al mundo: giro θ en y, desde la posición del frente. */
      world: (x, z) => ({
        x: fit.position[0] + (x * cos + z * sin) * h,
        z: fit.position[2] + (-x * sin + z * cos) * h,
      }),
      /* z de diseño (vertedero en z negativo) a z del modelo armado. */
      modelZ: (z) => (fit.startEnd < 0 ? z : -z),
    };
  }, [fit]);

  /*
   * Barrera flotante naranja (fotos aéreas): de la torre de toma cruza el
   * embalse en curva hasta el cerro del norte. Las boyas que caen en tierra
   * quedan bajo el terreno y no se ven.
   */
  const boom = useMemo(() => {
    const { world, modelZ } = toWorld;
    const y = metersToY(RESERVOIR.level) + 0.0004;
    const [a, c, b] = [
      [40, EMBANKMENT_FROM + 10],
      [150, EMBANKMENT_FROM - 40],
      [170, -FRONT_LENGTH / 2 - 120],
    ];
    const mesh = new InstancedMesh(boomGeometry, boomMaterial, BOOM_FLOATS);
    const dummy = new Object3D();
    for (let k = 0; k < BOOM_FLOATS; k += 1) {
      const t = k / (BOOM_FLOATS - 1);
      const bez = (i) => (1 - t) ** 2 * a[i] + 2 * (1 - t) * t * c[i] + t ** 2 * b[i];
      const p = world(bez(0), modelZ(bez(1)));
      dummy.position.set(p.x, y, p.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    }
    return mesh;
  }, [toWorld]);
  /* Sin agua no hay barrera: con el embalse vaciado quedaría flotando en el aire. */
  useFrame(() => {
    boom.visible = reservoirDrain.value < 0.05;
  });

  const lateral = useMemo(() => {
    const [h] = fit.scale;
    const [cos, sin] = [Math.cos(fit.rotationY), Math.sin(fit.rotationY)];
    const { world, modelZ } = toWorld;
    const endZ = modelZ(FRONT_BOX.max.z);
    const start = world(-FRONT_ROAD / 2, modelZ(EMBANKMENT_FROM));
    const end = world(-FRONT_ROAD / 2, endZ);
    const out = world(-FRONT_ROAD / 2, endZ - fit.startEnd);
    const len = Math.hypot(out.x - end.x, out.z - end.z);
    return buildEmbankment(
      ANGOSTURA.lateral,
      heightAt,
      projection,
      metersToY(ANGOSTURA.crestMeters),
      {
        start,
        end,
        dir: { x: (out.x - end.x) / len, z: (out.z - end.z) / len },
        n: { x: cos, z: -sin },
        half: (FRONT_ROAD / 2) * h,
      },
      roadTest(roadsData, ANGOSTURA.lateral, projection),
    );
  }, [fit, toWorld, heightAt, projection, roadsData]);
  useEffect(() => {
    front.traverse((object) => {
      if (object.isMesh) object.castShadow = shadows;
    });
  }, [front, shadows]);

  return (
    <group name="angostura-dam">
      <group position={fit.position} rotation={[0, fit.rotationY, 0]}>
        <primitive object={front} position={fit.offset} scale={fit.scale} />
      </group>
      <mesh geometry={lateral} material={embankmentMaterial} castShadow={shadows} receiveShadow />
      <primitive object={boom} />
    </group>
  );
}
