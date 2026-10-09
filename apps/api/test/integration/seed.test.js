import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { SAMPLE_LAYERS, SAMPLE_POINTS, seed } from '../../seeds/seed.js';
import { createTestPool, describeWithDb, resetDatabase, truncateAll } from './db-helper.js';

describeWithDb('seed', () => {
  let pool;

  beforeAll(async () => {
    pool = createTestPool();
    await resetDatabase(pool);
  });
  afterAll(async () => {
    await pool?.end();
  });
  beforeEach(async () => {
    await truncateAll(pool);
  });

  it('loads the sample layers and points', async () => {
    const result = await seed(pool);
    expect(result).toEqual({ layers: SAMPLE_LAYERS.length, pointsInserted: SAMPLE_POINTS.length });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM points_of_interest');
    expect(rows[0].n).toBe(SAMPLE_POINTS.length);
  });

  it('is idempotent', async () => {
    await seed(pool);
    const second = await seed(pool);
    expect(second.pointsInserted).toBe(0);
    const layers = await pool.query('SELECT count(*)::int AS n FROM layers');
    const points = await pool.query('SELECT count(*)::int AS n FROM points_of_interest');
    expect(layers.rows[0].n).toBe(SAMPLE_LAYERS.length);
    expect(points.rows[0].n).toBe(SAMPLE_POINTS.length);
  });

  it('updates an existing layer by slug', async () => {
    await pool.query(
      `INSERT INTO layers (slug, name, color) VALUES ('history', 'Nombre viejo', '#000000')`,
    );
    await seed(pool);
    const { rows } = await pool.query(`SELECT name FROM layers WHERE slug = 'history'`);
    expect(rows[0].name).toBe('Historia');
  });
});
