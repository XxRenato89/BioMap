import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate.js';
import {
  createTestPool,
  describeWithDb,
  insertImage,
  insertLayer,
  insertPoint,
  resetDatabase,
  testDatabaseUrl,
  truncateAll,
} from './db-helper.js';

describeWithDb('database schema', () => {
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

  it('creates every MVP table', async () => {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const names = rows.map((r) => r.table_name);
    for (const table of [
      'layers',
      'points_of_interest',
      'images',
      'admin_users',
      'login_attempts',
      'audit_log',
    ]) {
      expect(names).toContain(table);
    }
  });

  it('is idempotent when migrations run twice', async () => {
    await expect(migrate(testDatabaseUrl)).resolves.not.toThrow();
  });

  it('rejects an invalid layer color', async () => {
    await expect(insertLayer(pool, { slug: 'x', color: 'red' })).rejects.toThrow(
      /check constraint/,
    );
  });

  it('rejects out-of-range coordinates', async () => {
    const layerId = await insertLayer(pool, { slug: 'history' });
    await expect(insertPoint(pool, { layerId, lng: 200, lat: -37 })).rejects.toThrow(
      /check constraint/,
    );
  });

  it('rejects a blank alt_text', async () => {
    const layerId = await insertLayer(pool, { slug: 'history' });
    const pointId = await insertPoint(pool, { layerId });
    await expect(insertImage(pool, { pointId, altText: '   ' })).rejects.toThrow(
      /check constraint/,
    );
  });

  it('rejects a blank credit', async () => {
    const layerId = await insertLayer(pool, { slug: 'history' });
    const pointId = await insertPoint(pool, { layerId });
    await expect(insertImage(pool, { pointId, credit: '' })).rejects.toThrow(/check constraint/);
  });

  it('allows only one main image per point', async () => {
    const layerId = await insertLayer(pool, { slug: 'history' });
    const pointId = await insertPoint(pool, { layerId });
    await insertImage(pool, { pointId, isMain: true });
    await expect(insertImage(pool, { pointId, isMain: true })).rejects.toThrow(/duplicate key/);
  });

  it('refreshes updated_at on update', async () => {
    const layerId = await insertLayer(pool, { slug: 'history' });
    const pointId = await insertPoint(pool, { layerId });
    /*
     * El trigger sobrescribe updated_at en cada UPDATE, así que se desactiva
     * un momento para dejar una fecha antigua y luego se vuelve a activar.
     */
    await pool.query(
      'ALTER TABLE points_of_interest DISABLE TRIGGER points_of_interest_set_updated_at',
    );
    await pool.query(
      `UPDATE points_of_interest SET updated_at = now() - interval '1 day' WHERE id = $1`,
      [pointId],
    );
    await pool.query(
      'ALTER TABLE points_of_interest ENABLE TRIGGER points_of_interest_set_updated_at',
    );
    const before = (
      await pool.query('SELECT updated_at FROM points_of_interest WHERE id = $1', [pointId])
    ).rows[0].updated_at;
    await pool.query(`UPDATE points_of_interest SET name = 'Nuevo' WHERE id = $1`, [pointId]);
    const after = (
      await pool.query('SELECT updated_at FROM points_of_interest WHERE id = $1', [pointId])
    ).rows[0].updated_at;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it('accepts photo and panorama images, and only photos as the main image', async () => {
    const layerId = await insertLayer(pool, { slug: 'history' });
    const pointId = await insertPoint(pool, { layerId });
    await insertImage(pool, { pointId, kind: 'panorama' });
    await expect(insertImage(pool, { pointId, kind: 'video' })).rejects.toThrow(
      /images_kind_check/,
    );
    await expect(insertImage(pool, { pointId, kind: 'panorama', isMain: true })).rejects.toThrow(
      /images_main_is_photo_check/,
    );
  });

  it('allows each tour stop once among live points', async () => {
    const layerId = await insertLayer(pool, { slug: 'tourism' });
    const first = await insertPoint(pool, { layerId, name: 'Uno' });
    const second = await insertPoint(pool, { layerId, name: 'Dos' });
    await pool.query('UPDATE points_of_interest SET tour_stop = 1 WHERE id = $1', [first]);
    await expect(
      pool.query('UPDATE points_of_interest SET tour_stop = 1 WHERE id = $1', [second]),
    ).rejects.toThrow(/points_of_interest_tour_stop_idx/);
    await expect(
      pool.query('UPDATE points_of_interest SET tour_stop = 0 WHERE id = $1', [second]),
    ).rejects.toThrow(/points_of_interest_tour_stop_check/);
    /* Un punto eliminado libera su parada. */
    await pool.query('UPDATE points_of_interest SET deleted_at = now() WHERE id = $1', [first]);
    await pool.query('UPDATE points_of_interest SET tour_stop = 1 WHERE id = $1', [second]);
  });
});
