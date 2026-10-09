import pg from 'pg';
import { assertNotProduction, seed } from './seed.js';

/**
 * CLI: carga los datos de ejemplo sobre DATABASE_URL (nunca en producción).
 */
assertNotProduction();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  const result = await seed(pool);
  console.log(`Seed done: ${result.layers} layers, ${result.pointsInserted} new points`);
} finally {
  await pool.end();
}
