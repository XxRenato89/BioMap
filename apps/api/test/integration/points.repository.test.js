import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPointsRepository } from '../../src/points/points.repository.js';
import {
  createTestPool,
  describeWithDb,
  insertImage,
  insertLayer,
  insertPoint,
  resetDatabase,
  truncateAll,
} from './db-helper.js';

describeWithDb('points repository', () => {
  let pool;
  let repository;

  beforeAll(async () => {
    pool = createTestPool();
    await resetDatabase(pool);
    repository = createPointsRepository(pool);
  });
  afterAll(async () => {
    await pool?.end();
  });
  beforeEach(async () => {
    await truncateAll(pool);
  });

  describe('findAll', () => {
    it('returns GeoJSON features with [lng, lat] coordinates', async () => {
      const layerId = await insertLayer(pool, { slug: 'history' });
      const id = await insertPoint(pool, {
        layerId,
        name: 'Santa Bárbara',
        lng: -72.0206,
        lat: -37.6656,
      });

      const features = await repository.findAll({ layerIds: null });

      expect(features).toEqual([
        {
          type: 'Feature',
          id,
          geometry: { type: 'Point', coordinates: [-72.0206, -37.6656] },
          properties: {
            id,
            name: 'Santa Bárbara',
            layerId,
            layerSlug: 'history',
            tourStop: null,
            secret: false,
            modelKind: null,
            icon: null,
          },
        },
      ]);
    });

    it('excludes soft-deleted points and points in inactive layers', async () => {
      const active = await insertLayer(pool, { slug: 'history' });
      const inactive = await insertLayer(pool, { slug: 'energy', isActive: false });
      const visible = await insertPoint(pool, { layerId: active });
      await insertPoint(pool, { layerId: active, deletedAt: new Date() });
      await insertPoint(pool, { layerId: inactive });

      const features = await repository.findAll({ layerIds: null });

      expect(features.map((f) => f.id)).toEqual([visible]);
    });

    it('filters by layer ids', async () => {
      const history = await insertLayer(pool, { slug: 'history' });
      const tourism = await insertLayer(pool, { slug: 'tourism' });
      await insertPoint(pool, { layerId: history });
      const t = await insertPoint(pool, { layerId: tourism });

      expect((await repository.findAll({ layerIds: [tourism] })).map((f) => f.id)).toEqual([t]);
      expect(await repository.findAll({ layerIds: [] })).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns description and images, main image first', async () => {
      const layerId = await insertLayer(pool, { slug: 'tourism' });
      const id = await insertPoint(pool, { layerId, name: 'Mirador', description: 'Vista' });
      await insertImage(pool, { pointId: id, filePath: 'b.jpg', sortOrder: 1 });
      await insertImage(pool, { pointId: id, filePath: 'c.jpg', sortOrder: 0 });
      await insertImage(pool, { pointId: id, filePath: 'a.jpg', sortOrder: 5, isMain: true });

      const point = await repository.findById(id);

      expect(point.properties.description).toBe('Vista');
      expect(point.properties.images.map((i) => i.filePath)).toEqual(['a.jpg', 'c.jpg', 'b.jpg']);
      expect(point.properties.images[0]).toEqual({
        filePath: 'a.jpg',
        altText: 'alt',
        credit: 'credito',
        isMain: true,
        kind: 'photo',
      });
    });

    it('returns panoramas with their kind', async () => {
      const layerId = await insertLayer(pool, { slug: 'tourism' });
      const id = await insertPoint(pool, { layerId });
      await insertImage(pool, { pointId: id, filePath: 'pano.jpg', kind: 'panorama' });
      const [image] = (await repository.findById(id)).properties.images;
      expect(image).toMatchObject({ filePath: 'pano.jpg', kind: 'panorama' });
    });

    it('returns an empty images array when the point has none', async () => {
      const layerId = await insertLayer(pool, { slug: 'tourism' });
      const id = await insertPoint(pool, { layerId });
      expect((await repository.findById(id)).properties.images).toEqual([]);
    });

    it('returns null for missing, soft-deleted or inactive-layer points', async () => {
      const active = await insertLayer(pool, { slug: 'history' });
      const inactive = await insertLayer(pool, { slug: 'energy', isActive: false });
      const deleted = await insertPoint(pool, { layerId: active, deletedAt: new Date() });
      const hidden = await insertPoint(pool, { layerId: inactive });

      expect(await repository.findById(999)).toBeNull();
      expect(await repository.findById(deleted)).toBeNull();
      expect(await repository.findById(hidden)).toBeNull();
    });
  });
});
