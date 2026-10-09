import {
  Color,
  DataTexture,
  LinearFilter,
  MeshPhysicalMaterial,
  RedFormat,
  UnsignedByteType,
  Vector2,
} from 'three';

/**
 * Distancia a la orilla de cada celda de agua de la zona (m, del build) como
 * textura de un canal: 0 en la orilla, 1 a 255 m o más.
 *
 * @param {{ columns: number, rows: number }} meta
 * @param {Uint8Array} shore
 */
export function shoreTexture(meta, shore) {
  const texture = new DataTexture(shore, meta.columns, meta.rows, RedFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/*
 * Corriente general del agua (m/s, hacia el poniente, como baja el Biobío).
 */
const FLOW = new Vector2(-0.55, -0.15);

/**
 * Agua viva: una capa casi a ras del suelo (el fondo está rebajado apenas
 * 1 m), casi opaca para que no se vea el relieve debajo, y encima los
 * detalles: color según la distancia a la orilla (turquesa en el borde, azul
 * profundo al centro), espuma que se mueve en la orilla, olas que corren con
 * la corriente (brillos del sol que se desplazan) y reflejo del cielo al
 * mirarla de lado. `material.userData.time.value` avanza la animación (s).
 *
 * @param {import('three').Texture} shore Ver `shoreTexture`.
 * @param {{ width: number, depth: number }} zone Tamaño de la zona (km).
 */
export function waterMaterial(shore, zone) {
  const material = new MeshPhysicalMaterial({
    color: new Color('#ffffff'),
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const time = { value: 0 };
  material.userData.time = time;
  const half = new Vector2(zone.width / 2, zone.depth / 2);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.waterTime = time;
    shader.uniforms.waterShore = { value: shore };
    shader.uniforms.waterHalf = { value: half };
    shader.uniforms.waterFlow = { value: FLOW };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWater;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWater = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float waterTime;
uniform sampler2D waterShore;
uniform vec2 waterHalf;
uniform vec2 waterFlow;
varying vec3 vWater;
float shoreMeters;
vec2 waveSlope(vec2 p, vec2 dir, float length, float amp, float speed) {
  dir = normalize(dir);
  float k = 6.2831 / length;
  return dir * (amp * k * cos(dot(p, dir) * k + waterTime * speed));
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec2 shoreUv = vWater.xz / (2.0 * waterHalf) + 0.5;
shoreMeters = texture2D(waterShore, clamp(shoreUv, 0.0, 1.0)).r * 255.0;
/* Fuera de la zona no hay distancia calculada: el agua se ve de anchura media. */
if (any(lessThan(shoreUv, vec2(0.0))) || any(greaterThan(shoreUv, vec2(1.0)))) shoreMeters = 60.0;
vec3 shallow = vec3(0.33, 0.72, 0.76);
vec3 deep = vec3(0.06, 0.30, 0.48);
vec3 waterColor = mix(shallow, deep, smoothstep(4.0, 110.0, shoreMeters));
vec2 meters = vWater.xz * 1000.0;
float ripple = sin(meters.x * 0.33 + waterTime * 1.2) * sin(meters.y * 0.29 - waterTime * 0.9);
float foam = 1.0 - smoothstep(0.0, 3.0 + ripple * 1.4, shoreMeters);
waterColor = mix(waterColor, vec3(0.93, 0.97, 0.98), foam * 0.75);
diffuseColor.rgb = waterColor;
diffuseColor.a = mix(0.82, 0.96, smoothstep(0.0, 12.0, shoreMeters));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
vec2 drift = vWater.xz * 1000.0 - waterFlow * waterTime;
vec2 slope = waveSlope(drift, vec2(1.0, 0.25), 9.0, 0.10, 1.6)
  + waveSlope(drift, vec2(0.7, -0.8), 5.5, 0.05, 2.1)
  + waveSlope(drift, vec2(-0.3, 1.0), 3.2, 0.025, 2.7)
  + waveSlope(drift, vec2(0.9, 0.6), 17.0, 0.16, 1.1);
normal = normalize(normal + (viewMatrix * vec4(-slope.x, 0.0, -slope.y, 0.0)).xyz * 0.6);`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
float facing = max(dot(normal, normalize(vViewPosition)), 0.0);
float fresnel = pow(1.0 - facing, 4.0);
reflectedLight.indirectDiffuse += vec3(0.62, 0.78, 0.88) * fresnel * 0.6;`,
      );
  };
  return material;
}
