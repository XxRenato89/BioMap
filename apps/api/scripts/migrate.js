import { migrate } from '../src/db/migrate.js';

/**
 * CLI: aplica las migraciones sobre DATABASE_URL.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
await migrate(databaseUrl, { log: (message) => console.log(message) });
