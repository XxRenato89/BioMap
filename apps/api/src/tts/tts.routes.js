import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../http/errors.js';

/* Lo más largo que se sintetiza (la ficha más larga cabe con holgura). */
export const MAX_TTS_CHARS = 1200;
/* Tope de audios nuevos por minuto: protege los créditos de ElevenLabs si alguien abusa. */
export const MAX_NEW_PER_MINUTE = 20;

const body = z.object({ text: z.string().trim().min(1).max(MAX_TTS_CHARS) });

/**
 * Voz de Quibar con ElevenLabs. La clave queda en el servidor (nunca en el
 * navegador del kiosco). Cada texto se sintetiza una sola vez y se guarda en
 * disco: las frases que se repiten (llegadas, fichas) salen del caché sin
 * gastar créditos y funcionan aunque se caiga internet.
 *
 * Sin clave responde 503 y el visor usa la voz del navegador.
 *
 * @param {object} deps
 * @param {string} [deps.apiKey]
 * @param {string} deps.voiceId
 * @param {string} deps.cacheDir
 * @param {string} [deps.modelId]
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {() => number} [deps.now]
 */
export function createTtsRouter({
  apiKey,
  voiceId,
  cacheDir,
  modelId = 'eleven_multilingual_v2',
  fetchImpl = fetch,
  now = () => Date.now(),
}) {
  const router = Router();
  const inFlight = new Map();
  let window = { start: 0, count: 0 };

  async function synthesize(text, file) {
    const minute = Math.floor(now() / 60_000);
    if (window.start !== minute) window = { start: minute, count: 0 };
    if (window.count >= MAX_NEW_PER_MINUTE) {
      throw new HttpError(429, 'TTS_BUSY', 'Demasiadas voces nuevas; intenta en un minuto');
    }
    window.count += 1;
    const response = await fetchImpl(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: modelId }),
      },
    );
    if (!response.ok) {
      throw new HttpError(502, 'TTS_FAILED', `ElevenLabs respondió ${response.status}`);
    }
    const audio = Buffer.from(await response.arrayBuffer());
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, audio);
    return audio;
  }

  router.post('/', async (req, res) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Texto inválido');
    const { text } = parsed.data;
    const key = createHash('sha256').update(`${voiceId}\n${modelId}\n${text}`).digest('hex');
    const file = path.join(cacheDir, `${key}.mp3`);

    let audio = await readFile(file).catch(() => null);
    if (!audio) {
      if (!apiKey) {
        throw new HttpError(503, 'TTS_UNAVAILABLE', 'Voz no configurada (ELEVENLABS_API_KEY)');
      }
      /* Dos pedidos del mismo texto a la vez: una sola síntesis. */
      if (!inFlight.has(key)) {
        inFlight.set(
          key,
          synthesize(text, file).finally(() => inFlight.delete(key)),
        );
      }
      audio = await inFlight.get(key);
    }
    res.set('Cache-Control', 'private, max-age=86400');
    res.type('audio/mpeg').send(audio);
  });
  return router;
}
