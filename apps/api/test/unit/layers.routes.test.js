import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { LAYERS, buildTestApp, fakeLayersRepository } from './fakes.js';

describe('GET /api/layers', () => {
  it('returns the active layers', async () => {
    const res = await request(buildTestApp()).get('/api/layers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(LAYERS);
  });

  it('serves repeated requests from the cache', async () => {
    const layers = fakeLayersRepository();
    const app = buildTestApp({ repositories: { layers } });
    await request(app).get('/api/layers');
    await request(app).get('/api/layers');
    expect(layers.calls.findActive).toBe(1);
  });

  it('answers 304 when the ETag matches', async () => {
    const app = buildTestApp();
    const first = await request(app).get('/api/layers');
    expect(first.headers.etag).toBeDefined();
    const second = await request(app).get('/api/layers').set('If-None-Match', first.headers.etag);
    expect(second.status).toBe(304);
  });

  it('returns 500 INTERNAL_ERROR when the repository fails', async () => {
    const app = buildTestApp({
      repositories: { layers: fakeLayersRepository(LAYERS, { fail: true }) },
    });
    const res = await request(app).get('/api/layers');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
