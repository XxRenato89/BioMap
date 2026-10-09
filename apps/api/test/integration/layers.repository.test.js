import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createLayersRepository } from '../../src/layers/layers.repository.js';
import {
  createTestPool,
  describeWithDb,
  insertLayer,
  resetDatabase,
  truncateAll,
} from './db-helper.js';

describeWithDb('layers repository', () => {
  let pool;
  let repository;

  beforeAll(async () => {
    pool = createTestPool();
    await resetDatabase(pool);
    repository = createLayersRepository(pool);
  });
  afterAll(async () => {
    await pool?.end();
  });
  beforeEach(async () => {
    await truncateAll(pool);
  });

  it('returns only active layers ordered by sort_order then id, in camelCase', async () => {
    await insertLayer(pool, { slug: 'tourism', name: 'Turismo', sortOrder: 2, icon: 'binoculars' });
    await insertLayer(pool, { slug: 'history', name: 'Historia', sortOrder: 1 });
    await insertLayer(pool, { slug: 'energy', name: 'Energía', sortOrder: 0, isActive: false });

    const layers = await repository.findActive();

    expect(layers.map((l) => l.slug)).toEqual(['history', 'tourism']);
    expect(layers[1]).toEqual({
      id: 1,
      slug: 'tourism',
      name: 'Turismo',
      color: '#123456',
      icon: 'binoculars',
      sortOrder: 2,
    });
  });
});
