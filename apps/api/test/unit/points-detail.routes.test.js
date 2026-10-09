import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, fakeLayersRepository, fakePointsRepository } from './fakes.js';

const DETAIL = {
  type: 'Feature',
  id: 7,
  geometry: { type: 'Point', coordinates: [-71.83, -37.68] },
  properties: {
    id: 7,
    name: 'Mirador del embalse',
    description: 'Vista al embalse Angostura',
    layerId: 3,
    layerSlug: 'tourism',
    images: [
      {
        filePath: '/fotos/mi mirador.jpg',
        altText: 'Vista del embalse',
        credit: 'Colbún',
        isMain: true,
      },
      { filePath: 'fotos/otra.jpg', altText: 'Sendero', credit: 'Colbún', isMain: false },
      {
        filePath: 'panoramas/mirador.jpg',
        altText: 'Panorama 360 del mirador',
        credit: 'Colbún',
        isMain: false,
        kind: 'panorama',
      },
    ],
  },
};

/**
 * App con un repositorio que conoce solo el punto 7.
 */
function setup() {
  const pointsRepository = fakePointsRepository({ details: { 7: DETAIL } });
  const app = buildTestApp({
    repositories: { layers: fakeLayersRepository(), points: pointsRepository },
  });
  return { app, pointsRepository };
}

describe('GET /api/points/:id', () => {
  it('returns the point with public image URLs', async () => {
    const { app, pointsRepository } = setup();
    const res = await request(app).get('/api/points/7');
    expect(res.status).toBe(200);
    expect(res.body.properties.description).toBe('Vista al embalse Angostura');
    expect(res.body.properties.images).toEqual([
      {
        url: '/media/fotos/mi%20mirador.jpg',
        altText: 'Vista del embalse',
        credit: 'Colbún',
        isMain: true,
      },
      { url: '/media/fotos/otra.jpg', altText: 'Sendero', credit: 'Colbún', isMain: false },
      {
        url: '/media/panoramas/mirador.jpg',
        altText: 'Panorama 360 del mirador',
        credit: 'Colbún',
        isMain: false,
        kind: 'panorama',
      },
    ]);
    expect(pointsRepository.calls.findById).toEqual([7]);
  });

  it.each(['abc', '0', '-3', '1.5', '007', '99999999999'])(
    'rejects id "%s" with 400 INVALID_ID',
    async (id) => {
      const { app, pointsRepository } = setup();
      const res = await request(app).get(`/api/points/${id}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID');
      expect(pointsRepository.calls.findById).toEqual([]);
    },
  );

  it('returns 404 POINT_NOT_FOUND for an unknown point', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/points/8');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('POINT_NOT_FOUND');
  });
});
