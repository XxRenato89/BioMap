import { Color } from 'three';

/*
 * Luz de la maqueta según la hora del kiosco: amanecer cálido, mediodía
 * blanco y alto, tarde dorada y atardecer rosado. Fuera del horario de
 * atención se queda en una tarde suave (la maqueta nunca se ve de noche).
 * Cada momento define el sol (dirección hacia él, color, intensidad), el cielo
 * (arriba, medio y horizonte, que también es el color de la bruma) y el
 * relleno de la luz de cielo y suelo.
 */
const KEYS = [
  {
    hour: 7,
    sun: [0.85, 0.32, -0.25],
    sunColor: '#ffc89a',
    sunIntensity: 2.2,
    sky: ['#8eaed0', '#d9c8b6', '#f1d2b0'],
    hemi: ['#d6dcea', '#5a4d3c', 0.9],
  },
  {
    hour: 12,
    sun: [-0.35, 0.85, -0.3],
    sunColor: '#fff6ea',
    sunIntensity: 3.0,
    sky: ['#86acd0', '#bfd2dc', '#dcd8c8'],
    hemi: ['#dfeaf5', '#5a4d3c', 1.15],
  },
  {
    hour: 16,
    sun: [-0.75, 0.6, -0.33],
    sunColor: '#fff3e0',
    sunIntensity: 2.8,
    sky: ['#93b4cc', '#c3d2d3', '#dcd8c8'],
    hemi: ['#dfeaf5', '#5a4d3c', 1.1],
  },
  {
    hour: 19,
    sun: [-0.9, 0.3, -0.2],
    sunColor: '#ffbf7a',
    sunIntensity: 2.4,
    sky: ['#7d97bd', '#e0b99a', '#f0c294'],
    hemi: ['#e6d3c4', '#4e4033', 0.95],
  },
  {
    hour: 21,
    sun: [-0.95, 0.2, 0.0],
    sunColor: '#ff9f80',
    sunIntensity: 1.9,
    sky: ['#5f6f9c', '#c89aa0', '#e7b08c'],
    hemi: ['#c9c2d6', '#3f3530', 0.85],
  },
];

const mixColor = (a, b, t) => new Color(a).lerp(new Color(b), t);
const mix = (a, b, t) => a + (b - a) * t;

/**
 * Luz para una hora del día (0–24, con decimales).
 *
 * @param {number} hour
 * @returns {{ sun: number[], sunColor: Color, sunIntensity: number,
 *   sky: Color[], hemiSky: Color, hemiGround: Color, hemiIntensity: number }}
 */
export function daylightAt(hour) {
  const h = Math.min(Math.max(hour, KEYS[0].hour), KEYS.at(-1).hour);
  const next = Math.max(
    1,
    KEYS.findIndex((key) => key.hour >= h),
  );
  const [a, b] = [KEYS[next - 1], KEYS[next]];
  const t = (h - a.hour) / (b.hour - a.hour);
  const sun = a.sun.map((value, k) => mix(value, b.sun[k], t));
  const length = Math.hypot(...sun);
  return {
    sun: sun.map((value) => value / length),
    sunColor: mixColor(a.sunColor, b.sunColor, t),
    sunIntensity: mix(a.sunIntensity, b.sunIntensity, t),
    sky: a.sky.map((color, k) => mixColor(color, b.sky[k], t)),
    hemiSky: mixColor(a.hemi[0], b.hemi[0], t),
    hemiGround: mixColor(a.hemi[1], b.hemi[1], t),
    hemiIntensity: mix(a.hemi[2], b.hemi[2], t),
  };
}

/**
 * Hora a mostrar: la de `?hora=` en la URL (para probar o presentar), o la
 * del reloj. Fuera del rango 7–21 se usa una tarde suave.
 *
 * @param {Date} [now]
 * @param {string} [search]
 */
export function kioskHour(now = new Date(), search = globalThis.location?.search ?? '') {
  const forced = Number.parseFloat(new URLSearchParams(search).get('hora'));
  const hour = Number.isFinite(forced) ? forced : now.getHours() + now.getMinutes() / 60;
  return hour >= 7 && hour <= 21 ? hour : 17;
}
