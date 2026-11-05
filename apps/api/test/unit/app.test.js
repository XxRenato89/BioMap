import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, fakeDb } from './fakes.js';

describe('GET /api/health', () => {
  it('returns 200 when the database answers', async () => {
    const res = await request(buildTestApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('returns 503 when the database fails', async () => {
    const res = await request(buildTestApp({ db: fakeDb({ fail: true }) })).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', database: 'down' });
  });
});

describe('app shell', () => {
  it('returns the JSON error format for unknown routes', async () => {
    const res = await request(buildTestApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('hides x-powered-by and sets helmet headers', async () => {
    const res = await request(buildTestApp()).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('does not force https: phones reach the kiosk over plain http on its Wi-Fi', async () => {
    const res = await request(buildTestApp()).get('/api/health');
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });

  it('rejects malformed JSON with 400 INVALID_BODY', async () => {
    const res = await request(buildTestApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_BODY');
  });

  it('rejects bodies over 100kb with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(buildTestApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ big: 'x'.repeat(110 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('serves media files with a long immutable cache', async () => {
    const mediaDir = mkdtempSync(join(tmpdir(), 'biomap-media-'));
    writeFileSync(join(mediaDir, 'test.txt'), 'hello');
    const res = await request(buildTestApp({ mediaDir })).get('/media/test.txt');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('serves the built viewer at the root, with index.html for app routes, not for the API', async () => {
    const webDir = mkdtempSync(join(tmpdir(), 'biomap-web-'));
    writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>BioMap</title>');
    writeFileSync(join(webDir, 'app.js'), 'console.log(1)');
    const app = buildTestApp({ webDir });
    expect((await request(app).get('/')).text).toContain('BioMap');
    expect((await request(app).get('/app.js')).text).toContain('console.log');
    expect((await request(app).get('/?point=3')).text).toContain('BioMap');
    const missing = await request(app).get('/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBeDefined();
  });
});
