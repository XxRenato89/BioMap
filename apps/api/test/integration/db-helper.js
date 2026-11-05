import pg from 'pg';
import { describe } from 'vitest';
import { migrate } from '../../src/db/migrate.js';
import { assertTestDatabase } from './db-guard.js';

/**
 * Los tests de integración solo corren si existe TEST_DATABASE_URL
 * (siempre en CI). Sin ella se saltan con un aviso visible.
 */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.warn('[integration] TEST_DATABASE_URL is not set: database tests are skipped.');
}

export const describeWithDb = testDatabaseUrl ? describe : describe.skip;

export function createTestPool() {
  return new pg.Pool({ connectionString: testDatabaseUrl, max: 4 });
}

/**
 * Deja la base de pruebas vacía y con todas las migraciones aplicadas.
 * Se llama una vez por archivo de test (en beforeAll). Antes verifica que la
 * base sea de pruebas, porque esta operación borra todos sus datos.
 */
export async function resetDatabase(pool) {
  assertTestDatabase(testDatabaseUrl);
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await migrate(testDatabaseUrl);
}

/**
 * Vacía todas las tablas entre un test y otro, reiniciando los identificadores.
 */
export async function truncateAll(pool) {
  await pool.query(
    'TRUNCATE visit_events, audit_log, login_attempts, images, points_of_interest, layers, admin_users RESTART IDENTITY CASCADE',
  );
}

export async function insertLayer(
  pool,
  { slug, name = 'Capa', color = '#123456', icon = null, sortOrder = 0, isActive = true },
) {
  const { rows } = await pool.query(
    `INSERT INTO layers (slug, name, color, icon, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [slug, name, color, icon, sortOrder, isActive],
  );
  return rows[0].id;
}

export async function insertPoint(
  pool,
  { layerId, name = 'Punto', description = '', lng = -71.8, lat = -37.7, deletedAt = null },
) {
  const { rows } = await pool.query(
    `INSERT INTO points_of_interest (layer_id, name, description, location, deleted_at)
     VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4::float8, $5::float8), 4326), $6)
     RETURNING id`,
    [layerId, name, description, lng, lat, deletedAt],
  );
  return rows[0].id;
}

export async function insertImage(
  pool,
  {
    pointId,
    filePath = 'a.jpg',
    altText = 'alt',
    credit = 'credito',
    isMain = false,
    sortOrder = 0,
    kind = 'photo',
  },
) {
  const { rows } = await pool.query(
    `INSERT INTO images (point_id, file_path, alt_text, credit, is_main, sort_order, kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [pointId, filePath, altText, credit, isMain, sortOrder, kind],
  );
  return rows[0].id;
}
