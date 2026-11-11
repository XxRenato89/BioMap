import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MAX_NEW_PER_MINUTE } from '../src/tts/tts.routes.js';

/**
 * CLI: genera por adelantado todas las frases de Quibar (llegada a cada punto,
 * en español e inglés, y los hallazgos secretos) pidiéndolas a la API que está
 * corriendo. Cada audio queda en MEDIA_DIR/tts, así el kiosco habla con la voz
 * de ElevenLabs aunque no tenga internet. Correrlo con internet tras cargar o
 * cambiar puntos. Las frases que ya están en caché no gastan créditos.
 */
const api = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const i18nDir = path.join(import.meta.dirname, '../../web/src/i18n');
const arrived = ['es', 'en'].map(
  (lng) => JSON.parse(readFileSync(path.join(i18nDir, `${lng}.json`), 'utf8')).avatar.arrived,
);

/* Mismos textos que arma Avatar.jsx: si cambian allá, cambiar aquí. */
function phrasesFor(points) {
  const texts = new Set();
  for (const { properties: p } of points) {
    for (const template of arrived) texts.add(template.replaceAll('{{name}}', p.name));
    if (p.secret) texts.add(`¡Oh, he encontrado algo misterioso! Es: ${p.name}`);
  }
  return [...texts];
}

const response = await fetch(`${api}/api/points`).catch(() => null);
if (!response?.ok) {
  console.error(`No se pudo leer ${api}/api/points: ¿está corriendo la API?`);
  process.exit(1);
}
const texts = phrasesFor((await response.json()).features);

/* Las nuevas cuentan para el tope por minuto de la API: se espera entre una y otra. */
const pauseMs = Math.ceil(60_000 / MAX_NEW_PER_MINUTE) + 200;
let failed = 0;
for (const [i, text] of texts.entries()) {
  const started = Date.now();
  const res = await fetch(`${api}/api/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => null);
  const ms = Date.now() - started;
  console.log(
    `${i + 1}/${texts.length} ${res?.ok ? 'ok' : `falló (${res?.status ?? 'sin red'})`}: ${text}`,
  );
  if (res?.status === 503) {
    console.error('La API no tiene ELEVENLABS_API_KEY: ver infra/kiosk/README.md');
    process.exit(1);
  }
  if (!res?.ok) failed += 1;
  /* Respuesta rápida = venía del caché, no hace falta esperar. */
  if (ms > 300) await new Promise((r) => setTimeout(r, pauseMs));
}
console.log(failed ? `${failed} frases fallaron: volver a correr.` : 'Todas las frases en caché.');
process.exit(failed ? 1 : 0);
