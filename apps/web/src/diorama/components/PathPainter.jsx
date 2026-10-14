import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, ShaderMaterial } from 'three';
import { useAvatarStore } from '../../store/avatarStore.js';
import { useDiorama } from './DioramaScene.jsx';

/* Separación de los puntos que siguen el relieve (km) y altura sobre él. */
const STEP = 0.004;
const LIFT = 0.0025;

/**
 * Eje del recorrido cada STEP km, apoyado en el relieve (o en el tablero de
 * un puente, que viene en la altura de los puntos), con su distancia acumulada.
 */
function centerline(path, heightAt) {
  const points = [];
  let along = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-6) continue;
    const parts = Math.max(1, Math.ceil(length / STEP));
    for (let p = points.length === 0 ? 0 : 1; p <= parts; p += 1) {
      const t = p / parts;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const y = Math.max(heightAt(x, z), a.y + (b.y - a.y) * t) + LIFT;
      if (points.length > 0) along += Math.hypot(x - points.at(-1).x, z - points.at(-1).z);
      points.push({ x, y, z, along });
    }
  }
  return points;
}

/**
 * Cinta del recorrido: cada vértice guarda el punto del eje y el shader la
 * abre hacia su lado con un ancho fijo en pantalla.
 */
function ribbon(points) {
  const position = [];
  const side = [];
  const across = [];
  const along = [];
  const index = [];
  points.forEach((p, k) => {
    const a = points[Math.max(k - 1, 0)];
    const b = points[Math.min(k + 1, points.length - 1)];
    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    for (const s of [1, -1]) {
      position.push(p.x, p.y, p.z);
      side.push(s);
      across.push(-(b.z - a.z) / length, (b.x - a.x) / length);
      along.push(p.along);
    }
    if (k > 0) {
      const v = k * 2;
      index.push(v - 2, v - 1, v, v, v - 1, v + 1);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('pathSide', new Float32BufferAttribute(side, 1));
  geometry.setAttribute('pathAcross', new Float32BufferAttribute(across, 2));
  geometry.setAttribute('pathAlong', new Float32BufferAttribute(along, 1));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return geometry;
}

function pathMaterial() {
  return new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
    uniforms: {
      uTime: { value: 0 },
      uDone: { value: 0 },
      uAhead: { value: new Color('#e39b3d') },
      uDots: { value: new Color('#fff4dc') },
      uEdge: { value: new Color('#1d231c') },
      uBehind: { value: new Color('#f3ecdc') },
    },
    vertexShader: `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float pathSide;
attribute vec2 pathAcross;
attribute float pathAlong;
varying float vU;
varying float vAlong;
varying float vHalf;
void main() {
  vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
  /* ~11 px de ancho en pantalla (un píxel ≈ 0,00052 rad), nunca menos de 5 m. */
  float halfWidth = max(0.0025, distance(cameraPosition, world) * 0.00052 * 5.5);
  world.xz += pathAcross * pathSide * halfWidth;
  vU = pathSide * 0.5 + 0.5;
  vAlong = pathAlong;
  vHalf = halfWidth;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  /* La maqueta usa profundidad logarítmica: sin esto la cinta queda bajo el terreno. */
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `
#include <logdepthbuf_pars_fragment>
uniform float uTime;
uniform float uDone;
uniform vec3 uAhead;
uniform vec3 uDots;
uniform vec3 uEdge;
uniform vec3 uBehind;
varying float vU;
varying float vAlong;
varying float vHalf;
void main() {
  #include <logdepthbuf_fragment>
  float across = abs(vU - 0.5) * 2.0;
  float aa = fwidth(across) * 1.5;
  float border = smoothstep(0.62 - aa, 0.62 + aa, across);
  bool walked = vAlong < uDone;
  vec3 core = walked ? uBehind : uAhead;
  float alpha = walked ? 0.55 : 1.0;
  if (!walked) {
    /* Puntos que avanzan hacia el destino, espaciados según el ancho en pantalla. */
    float period = vHalf * 5.0;
    float phase = fract(vAlong / period - uTime * 1.2) - 0.5;
    float spot = length(vec2(phase * period, (vU - 0.5) * 2.0 * vHalf)) / vHalf;
    core = mix(uDots, core, smoothstep(0.32, 0.4, spot));
  }
  vec3 color = mix(core, uEdge, border);
  float outer = 1.0 - smoothstep(1.0 - aa, 1.0, across);
  gl_FragColor = vec4(color, alpha * outer * mix(1.0, 0.8, border));
}`,
  });
}

/**
 * Recorrido de la mascota hasta su destino, dibujado sobre el relieve.
 */
export default function PathPainter() {
  const path = useAvatarStore((state) => state.currentPath);
  const { surfaceAt: heightAt } = useDiorama();
  const material = useMemo(pathMaterial, []);
  const progress = useRef(0);
  const lastAt = useRef({ x: NaN, z: NaN });

  const route = useMemo(() => {
    if (!path || path.length < 2) return null;
    const points = centerline(path, heightAt);
    return points.length < 2 ? null : { points, geometry: ribbon(points) };
  }, [path, heightAt]);

  useEffect(() => {
    progress.current = 0;
    return () => route?.geometry.dispose();
  }, [route]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock, invalidate }) => {
    if (!route) return;
    /* Avance: el punto del eje más cercano a la mascota, buscando hacia adelante. */
    const at = useAvatarStore.getState().currentPosition;
    const { points } = route;
    let best = progress.current;
    let bestDistance = Infinity;
    for (let k = progress.current; k < Math.min(points.length, progress.current + 400); k += 1) {
      const d = Math.hypot(points[k].x - at.x, points[k].z - at.z);
      if (d < bestDistance) {
        bestDistance = d;
        best = k;
      }
    }
    progress.current = best;
    material.uniforms.uDone.value = points[best].along;
    material.uniforms.uTime.value = clock.elapsedTime;
    /* A fps completos solo mientras la mascota camina; quieta, basta el reloj del agua. */
    if (at.x !== lastAt.current.x || at.z !== lastAt.current.z) {
      lastAt.current = { x: at.x, z: at.z };
      invalidate();
    }
  });

  if (!route) return null;
  return (
    <mesh geometry={route.geometry} material={material} renderOrder={15} frustumCulled={false} />
  );
}
