import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  LAYERS,
  buildTestApp,
  fakeLayersRepository,
  fakePointsRepository,
  pointFeature,
} from './fakes.js';

const [HISTORY, ECOLOGY, TOURISM] = LAYERS;
const POINTS = [pointFeature(1, HISTORY), pointFeature(2, ECOLOGY), pointFeature(3, TOURISM)];

/**
 * App con un repositorio de puntos espía para inspeccionar sus llamadas.
 * buildTestApp reemplaza el objeto repositories completo, por eso se incluye
 * de nuevo el repositorio de capas falso.
 */
function setupWithLayers(points = POINTS) {
  const pointsRepository = fakePointsRepository({ points });
  const app = buildTestApp({
    repositories: { layers: fakeLayersRepository(), points: pointsRepository },
  });
  return { app, pointsRepository };
}

describe('GET /api/points', () => {
  it('returns every point as a FeatureCollection when no filter is given', async () => {
    const { app, pointsRepository } = setupWithLayers();
    const res = await request(app).get('/api/points');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 'FeatureCollection', features: POINTS });
    expect(pointsRepository.calls.findAll).toEqual([{ layerIds: null }]);
  });

  it('filters by one layer slug', async () => {
    const { app, pointsRepository } = setupWithLayers();
    const res = await request(app).get('/api/points?layers=history');
    expect(res.body.features).toEqual([POINTS[0]]);
    expect(pointsRepository.calls.findAll).toEqual([{ layerIds: [1] }]);
  });

  it('normalizes messy filters and shares the cache entry', async () => {
    const { app, pointsRepository } = setupWithLayers();
    const messy = await request(app).get('/api/points?layers=Tourism, history,,history');
    const clean = await request(app).get('/api/points?layers=history,tourism');
    expect(messy.body.features).toEqual([POINTS[0], POINTS[2]]);
    expect(clean.body).toEqual(messy.body);
    expect(pointsRepository.calls.findAll).toEqual([{ layerIds: [1, 3] }]);
  });

  it('accepts the layers parameter repeated', async () => {
    const { app, pointsRepository } = setupWithLayers();
    await request(app).get('/api/points?layers=history&layers=tourism');
    expect(pointsRepository.calls.findAll).toEqual([{ layerIds: [1, 3] }]);
  });

  it('returns an empty collection for an empty filter without querying', async () => {
    const { app, pointsRepository } = setupWithLayers();
    const res = await request(app).get('/api/points?layers=');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 'FeatureCollection', features: [] });
    expect(pointsRepository.calls.findAll).toEqual([]);
  });

  it('rejects unknown layers with 400 INVALID_LAYER', async () => {
    const { app } = setupWithLayers();
    const res = await request(app).get('/api/points?layers=history,energy');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_LAYER');
    expect(res.body.error.message).toContain('energy');
  });

  it('gzips large responses', async () => {
    const many = Array.from({ length: 60 }, (_, i) => pointFeature(i + 1, HISTORY));
    const { app } = setupWithLayers(many);
    const res = await request(app).get('/api/points').set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.body.features).toHaveLength(60);
  });
});
