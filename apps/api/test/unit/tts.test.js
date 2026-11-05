import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_NEW_PER_MINUTE, MAX_TTS_CHARS } from '../../src/tts/tts.routes.js';
import { buildTestApp } from './fakes.js';

const MP3 = Buffer.from('ID3fake-mp3');

/** fetch falso de ElevenLabs: devuelve un mp3 y registra cada llamada. */
const elevenLabs = (status = 200) =>
  vi.fn(async () => ({
    ok: status < 300,
    status,
    arrayBuffer: async () => MP3.buffer.slice(MP3.byteOffset, MP3.byteOffset + MP3.length),
  }));

describe('POST /api/tts (Quibar voice)', () => {
  let cacheDir;
  beforeEach(async () => {
    cacheDir = await mkdtemp(path.join(tmpdir(), 'tts-'));
  });
  afterEach(() => rm(cacheDir, { recursive: true, force: true }));

  const app = (fetchImpl, extra = {}) =>
    buildTestApp({
      tts: { apiKey: 'test-key', voiceId: 'voice-1', cacheDir, fetchImpl, ...extra },
    });

  it('synthesizes once with the voice and key on the server, then serves from disk', async () => {
    const fetchImpl = elevenLabs();
    const server = app(fetchImpl);
    const first = await request(server).post('/api/tts').send({ text: '¡Hola, soy Quibar!' });
    expect(first.status).toBe(200);
    expect(first.headers['content-type']).toMatch(/audio\/mpeg/);
    expect(Buffer.from(first.body)).toEqual(MP3);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/v1/text-to-speech/voice-1');
    expect(init.headers['xi-api-key']).toBe('test-key');
    expect(JSON.parse(init.body).text).toBe('¡Hola, soy Quibar!');

    await request(server).post('/api/tts').send({ text: '¡Hola, soy Quibar!' }).expect(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await readdir(cacheDir)).toHaveLength(1);
  });

  it('answers 503 without a key, so the viewer falls back to the browser voice', async () => {
    const res = await request(app(elevenLabs(), { apiKey: undefined }))
      .post('/api/tts')
      .send({ text: 'Hola' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('TTS_UNAVAILABLE');
  });

  it('rejects empty or too long texts and reports ElevenLabs failures', async () => {
    const server = app(elevenLabs(401));
    await request(server).post('/api/tts').send({ text: '' }).expect(400);
    await request(server)
      .post('/api/tts')
      .send({ text: 'a'.repeat(MAX_TTS_CHARS + 1) })
      .expect(400);
    const res = await request(server).post('/api/tts').send({ text: 'Hola' });
    expect(res.status).toBe(502);
    expect(await readdir(cacheDir)).toHaveLength(0);
  });

  it('caps new syntheses per minute to protect the credits', async () => {
    const server = app(elevenLabs(), { now: () => 0 });
    for (let k = 0; k < MAX_NEW_PER_MINUTE; k += 1) {
      await request(server)
        .post('/api/tts')
        .send({ text: `frase ${k}` })
        .expect(200);
    }
    const res = await request(server).post('/api/tts').send({ text: 'una más' });
    expect(res.status).toBe(429);
  });
});
