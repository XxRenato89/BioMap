# Monorepo Skeleton + Database + REST API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the BioMap monorepo with a fast, read-only REST API over PostgreSQL/PostGIS (layers and points of interest), the full MVP database schema, sample seeds, tests, CI and Docker Compose.

**Architecture:** npm-workspaces monorepo with `apps/api` (Express 5, plain SQL through `pg`, migrations with node-pg-migrate) and a minimal `apps/web` (Vite + React). Each API domain splits the HTTP route from the SQL repository; routes receive repositories through `createApp(deps)`, so they are unit-tested with fakes. Repositories are integration-tested against real PostGIS when `TEST_DATABASE_URL` is set (always in CI).

**Tech Stack:** Node.js 24, JavaScript ESM, Express 5, pg 8, node-pg-migrate 8, zod 4, helmet, compression, pino / pino-http, Vitest 3, supertest, autocannon, React 19 + Vite 7, ESLint 9 (flat config) + Prettier 3, PostgreSQL 17 + PostGIS 3.5, GitHub Actions, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-06-skeleton-db-api-design.md`

## Global Constraints

- **Do NOT run `git commit`.** The user has not configured an author identity yet. Every "Checkpoint" step only runs `git status` for review.
- All identifiers, file and folder names, tables, columns, API routes and repository docs are in **English**.
- Code comments are in **Spanish** and always **block comments** (`/** ... */` or `/* ... */`) placed above the function or section. Never write trailing `//` line comments.
- User-facing strings (layer names, UI text) are Spanish.
- JavaScript ESM only (`"type": "module"`); no TypeScript. JSDoc on exported functions.
- Node.js 24; npm workspaces (no pnpm or yarn).
- All API routes live under `/api`. No CORS.
- JSON responses are camelCase; database columns are snake_case.
- Error body format: `{ "error": { "code": "...", "message": "..." } }`.
- Database image: `postgis/postgis:17-3.5`. Geometry column: `geometry(Point, 4326)`.
- Performance acceptance: 50 concurrent connections for 30 s on `/api/points` → p95 < 200 ms (measured with autocannon's p97.5, which is stricter) and 0 errors.
- Seeds must never run with `NODE_ENV=production`.
- Docker is NOT installed on the dev machine: integration tests must skip cleanly without `TEST_DATABASE_URL`.

## Review Focus

1. **Messy `layers` query strings** (`?layers=Tourism, history,,history`, or repeated `?layers=history&layers=tourism`). Expected: trimmed, lower-cased and de-duplicated, with the same result (and cache entry) as `?layers=history,tourism`. → Task 6.
2. **Out-of-range point ids** (`/api/points/99999999999`). Expected: `400 INVALID_ID`, not a 500 from an integer overflow in Postgres. → Task 7.
3. **Many visitors opening the map at the same moment** (concurrent cache misses). Expected: the loader runs once and every request gets the same result. → Task 2.
4. **Database failure while serving cached routes.** Expected: a JSON `500 INTERNAL_ERROR`, and the failure is NOT cached (the next request retries). → Tasks 2 and 5.
5. **Image paths with spaces or a leading slash** (`/fotos/mi mirador.jpg`). Expected: URL `/media/fotos/mi%20mirador.jpg`. → Task 7.

---

## File Map

| File                                                                                                                      | Responsibility                            |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `package.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.gitattributes`, `.env.example` | Root workspace and tooling                |
| `apps/api/src/config.js`                                                                                                  | Parse and validate environment variables  |
| `apps/api/src/http/memory-cache.js`                                                                                       | TTL cache with in-flight de-duplication   |
| `apps/api/src/http/errors.js`                                                                                             | `HttpError` class                         |
| `apps/api/src/http/error-handlers.js`                                                                                     | 404 handler and central error handler     |
| `apps/api/src/http/shutdown.js`                                                                                           | Graceful shutdown                         |
| `apps/api/src/app.js`                                                                                                     | `createApp(deps)`: middleware and routers |
| `apps/api/src/server.js`                                                                                                  | Process entry point (wires real deps)     |
| `apps/api/src/db/pool.js`                                                                                                 | `pg.Pool` factory                         |
| `apps/api/src/db/migrate.js`                                                                                              | Programmatic migration runner             |
| `apps/api/migrations/1759708800000_initial-schema.sql`                                                                    | Full schema                               |
| `apps/api/src/health/health.routes.js`                                                                                    | `GET /api/health`                         |
| `apps/api/src/layers/layers.repository.js` / `layers.routes.js`                                                           | Layers SQL and route                      |
| `apps/api/src/points/points.repository.js` / `points.routes.js`                                                           | Points SQL and routes                     |
| `apps/api/src/audit/audit.service.js`                                                                                     | `recordAudit`                             |
| `apps/api/seeds/sample-data.js`, `seed.js`, `run.js`                                                                      | Sample data loader                        |
| `apps/api/scripts/migrate.js`, `loadtest.js`, `loadtest-criteria.js`                                                      | CLI scripts                               |
| `apps/api/test/unit/*`, `apps/api/test/integration/*`                                                                     | Tests                                     |
| `apps/web/*`                                                                                                              | Minimal Vite + React skeleton             |
| `apps/api/Dockerfile`, `.dockerignore`, `docker-compose.yml`, `infra/tiles/*`                                             | Containers and tile-server placeholder    |
| `.github/workflows/ci.yml`, `README.md`, `PENDING.md`                                                                     | CI and docs                               |

---

### Task 1: Workspace tooling and configuration module

**Files:**

- Create: `package.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.gitattributes`, `.env.example`
- Create: `apps/api/package.json`, `apps/api/vitest.config.js`, `apps/api/src/config.js`
- Test: `apps/api/test/unit/config.test.js`

**Interfaces:**

- Produces: `loadConfig(env?: Record<string,string|undefined>) => Config`, where `Config = { nodeEnv, port, databaseUrl, dbPoolMax, dbStatementTimeoutMs, cacheTtlSeconds, mediaDir, mediaBaseUrl, logLevel }`. Throws `Error('Invalid configuration: <key>: <message>; ...')`.

- [ ] **Step 1: Create the root workspace files**

`package.json`:

```json
{
  "name": "biomap",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*"],
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:migrate": "npm run db:migrate -w apps/api",
    "db:seed": "npm run db:seed -w apps/api"
  }
}
```

`.prettierrc.json`:

```json
{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all", "endOfLine": "lf" }
```

`.prettierignore`:

```
node_modules
package-lock.json
coverage
dist
*.mbtiles
```

`.gitignore`:

```
node_modules/
.env
coverage/
dist/
media/*
!media/.gitkeep
infra/tiles/mbtiles/*.mbtiles
```

`.gitattributes`:

```
* text=auto eol=lf
```

`.env.example`:

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://biomap:biomap@localhost:5432/biomap
TEST_DATABASE_URL=postgres://biomap:biomap@localhost:5432/biomap_test
DB_POOL_MAX=10
DB_STATEMENT_TIMEOUT_MS=2000
CACHE_TTL_SECONDS=60
MEDIA_DIR=../../media
MEDIA_BASE_URL=/media
LOG_LEVEL=info
```

`eslint.config.js`:

```js
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import prettier from 'eslint-config-prettier';

/**
 * Configuración compartida de ESLint para todo el monorepo.
 * El backend usa globales de Node; el frontend, globales de navegador y JSX.
 * eslint-config-prettier va al final para desactivar reglas de formato.
 */
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['apps/web/**/*.{js,jsx}'],
    ...react.configs.flat.recommended,
    ...react.configs.flat['jsx-runtime'],
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      'react/prop-types': 'off',
    },
  },
  prettier,
];
```

- [ ] **Step 2: Create the API package and install dependencies**

`apps/api/package.json`:

```json
{
  "name": "@biomap/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch --env-file-if-exists=../../.env src/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "node --env-file-if-exists=../../.env scripts/migrate.js",
    "db:seed": "node --env-file-if-exists=../../.env seeds/run.js",
    "loadtest": "node scripts/loadtest.js"
  }
}
```

`apps/api/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

/**
 * Los tests de integración comparten una misma base de datos,
 * por eso los archivos se ejecutan en serie y no en paralelo.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 30_000,
  },
});
```

Run from the repo root:

```bash
npm install -D eslint@9 @eslint/js@9 globals eslint-plugin-react@7 eslint-config-prettier@10 prettier@3
npm install -w apps/api express@5 pg@8 zod@4 helmet@8 compression@1 pino@9 pino-http@10 node-pg-migrate@8
npm install -w apps/api -D vitest@3 supertest@7 autocannon@8
```

Expected: installs without errors and creates `package-lock.json`.

- [ ] **Step 3: Write the failing config tests**

`apps/api/test/unit/config.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const DATABASE_URL = 'postgres://biomap:biomap@localhost:5432/biomap';

describe('loadConfig', () => {
  it('applies defaults when only DATABASE_URL is set', () => {
    expect(loadConfig({ DATABASE_URL })).toEqual({
      nodeEnv: 'development',
      port: 3000,
      databaseUrl: DATABASE_URL,
      dbPoolMax: 10,
      dbStatementTimeoutMs: 2000,
      cacheTtlSeconds: 60,
      mediaDir: './media',
      mediaBaseUrl: '/media',
      logLevel: 'info',
    });
  });

  it('coerces numeric strings', () => {
    const config = loadConfig({ DATABASE_URL, PORT: '8080', DB_POOL_MAX: '20' });
    expect(config.port).toBe(8080);
    expect(config.dbPoolMax).toBe(20);
  });

  it('treats empty strings as unset', () => {
    expect(loadConfig({ DATABASE_URL, PORT: '', LOG_LEVEL: '' }).port).toBe(3000);
  });

  it('removes trailing slashes from MEDIA_BASE_URL', () => {
    expect(loadConfig({ DATABASE_URL, MEDIA_BASE_URL: '/media//' }).mediaBaseUrl).toBe('/media');
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => loadConfig({ DATABASE_URL, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects a MEDIA_BASE_URL that does not start with a slash', () => {
    expect(() => loadConfig({ DATABASE_URL, MEDIA_BASE_URL: 'media' })).toThrow(/MEDIA_BASE_URL/);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -w apps/api`
Expected: FAIL, cannot resolve `../../src/config.js`.

- [ ] **Step 5: Implement `config.js`**

`apps/api/src/config.js`:

```js
import { z } from 'zod';

/**
 * Esquema de las variables de entorno de la API.
 * Los valores llegan como texto y se convierten al tipo correcto;
 * si falta algo obligatorio o un valor es inválido, la API no debe arrancar.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).default(2000),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(60),
  MEDIA_DIR: z.string().default('./media'),
  MEDIA_BASE_URL: z
    .string()
    .regex(/^\//, 'must start with "/"')
    .transform((value) => value.replace(/\/+$/, '') || '/')
    .default('/media'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

/**
 * Lee y valida la configuración desde un objeto de entorno.
 * Las variables definidas como texto vacío se tratan como no definidas,
 * para que Docker o un .env incompleto no rompan los valores por defecto.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ nodeEnv: string, port: number, databaseUrl: string, dbPoolMax: number,
 *   dbStatementTimeoutMs: number, cacheTtlSeconds: number, mediaDir: string,
 *   mediaBaseUrl: string, logLevel: string }}
 */
export function loadConfig(env = process.env) {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${details}`);
  }
  const c = result.data;
  return {
    nodeEnv: c.NODE_ENV,
    port: c.PORT,
    databaseUrl: c.DATABASE_URL,
    dbPoolMax: c.DB_POOL_MAX,
    dbStatementTimeoutMs: c.DB_STATEMENT_TIMEOUT_MS,
    cacheTtlSeconds: c.CACHE_TTL_SECONDS,
    mediaDir: c.MEDIA_DIR,
    mediaBaseUrl: c.MEDIA_BASE_URL,
    logLevel: c.LOG_LEVEL,
  };
}
```

- [ ] **Step 6: Run the tests and lint**

Run: `npm test -w apps/api` → Expected: 8 passed.
Run: `npm run lint` → Expected: no errors.

- [ ] **Step 7: Checkpoint (no commit)**

Run: `git status` and review the new files. Do NOT commit.

---

### Task 2: In-memory cache with in-flight de-duplication

**Files:**

- Create: `apps/api/src/http/memory-cache.js`
- Test: `apps/api/test/unit/memory-cache.test.js`

**Interfaces:**

- Produces: `createMemoryCache({ ttlMs: number, now?: () => number }) => { getOrLoad(key: string, loader: () => Promise<T>): Promise<T>, invalidate(): void }`. When `ttlMs` is 0, nothing is cached.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/unit/memory-cache.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';
import { createMemoryCache } from '../../src/http/memory-cache.js';

describe('createMemoryCache', () => {
  it('calls the loader once and reuses the value within the TTL', async () => {
    const cache = createMemoryCache({ ttlMs: 1000 });
    const loader = vi.fn(async () => 'value');
    expect(await cache.getOrLoad('k', loader)).toBe('value');
    expect(await cache.getOrLoad('k', loader)).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads after the TTL expires', async () => {
    let clock = 0;
    const cache = createMemoryCache({ ttlMs: 1000, now: () => clock });
    const loader = vi.fn(async () => clock);
    await cache.getOrLoad('k', loader);
    clock = 1001;
    expect(await cache.getOrLoad('k', loader)).toBe(1001);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('keeps separate entries per key', async () => {
    const cache = createMemoryCache({ ttlMs: 1000 });
    expect(await cache.getOrLoad('a', async () => 1)).toBe(1);
    expect(await cache.getOrLoad('b', async () => 2)).toBe(2);
  });

  it('runs the loader once for concurrent misses on the same key', async () => {
    const cache = createMemoryCache({ ttlMs: 1000 });
    let resolve;
    const loader = vi.fn(() => new Promise((r) => (resolve = r)));
    const pending = Array.from({ length: 20 }, () => cache.getOrLoad('k', loader));
    resolve('shared');
    expect(await Promise.all(pending)).toEqual(Array(20).fill('shared'));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed load', async () => {
    const cache = createMemoryCache({ ttlMs: 1000 });
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('recovered');
    await expect(cache.getOrLoad('k', loader)).rejects.toThrow('db down');
    expect(await cache.getOrLoad('k', loader)).toBe('recovered');
  });

  it('invalidate() clears every entry', async () => {
    const cache = createMemoryCache({ ttlMs: 1000 });
    const loader = vi.fn(async () => 'v');
    await cache.getOrLoad('k', loader);
    cache.invalidate();
    await cache.getOrLoad('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not cache anything when ttlMs is 0', async () => {
    const cache = createMemoryCache({ ttlMs: 0 });
    const loader = vi.fn(async () => 'v');
    await cache.getOrLoad('k', loader);
    await cache.getOrLoad('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w apps/api -- memory-cache`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the cache**

`apps/api/src/http/memory-cache.js`:

```js
/**
 * Caché en memoria con tiempo de expiración (TTL).
 * Guarda la promesa y no solo el valor: si llegan muchas peticiones a la vez
 * y la entrada no existe, todas esperan la misma carga en lugar de consultar
 * la base de datos una vez cada una. Si la carga falla, la entrada se elimina
 * para que la siguiente petición vuelva a intentarlo.
 *
 * @param {{ ttlMs: number, now?: () => number }} options
 */
export function createMemoryCache({ ttlMs, now = () => Date.now() }) {
  const store = new Map();

  return {
    /**
     * Devuelve el valor de la clave o lo carga con `loader` si no existe o expiró.
     *
     * @template T
     * @param {string} key
     * @param {() => Promise<T>} loader
     * @returns {Promise<T>}
     */
    getOrLoad(key, loader) {
      const hit = store.get(key);
      if (hit && hit.expiresAt > now()) return hit.promise;

      const promise = Promise.resolve().then(loader);
      if (ttlMs > 0) {
        store.set(key, { promise, expiresAt: now() + ttlMs });
        promise.catch(() => {
          if (store.get(key)?.promise === promise) store.delete(key);
        });
      }
      return promise;
    },

    /**
     * Borra todas las entradas. Lo usarán las rutas de escritura del panel.
     */
    invalidate() {
      store.clear();
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -w apps/api -- memory-cache`
Expected: 7 passed.

- [ ] **Step 5: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 3: App shell (errors, health, security, static media)

**Files:**

- Create: `apps/api/src/http/errors.js`, `apps/api/src/http/error-handlers.js`, `apps/api/src/health/health.routes.js`, `apps/api/src/app.js`
- Create: `apps/api/test/unit/fakes.js`
- Test: `apps/api/test/unit/app.test.js`, `apps/api/test/unit/error-handlers.test.js`

**Interfaces:**

- Produces:
  - `class HttpError extends Error { constructor(status: number, code: string, message: string) }`
  - `notFoundHandler(req, res)` and `createErrorHandler({ exposeStack?: boolean, logger?: { error: Function } })`
  - `createHealthRouter({ db: { query(sql: string): Promise<unknown> } })`
  - `createApp({ db, repositories?: { layers?, points? }, cache?, logger?, mediaDir?, mediaBaseUrl?: string, exposeStack?: boolean }) => express.Application`
  - Test helpers in `fakes.js`: `fakeDb({ fail?: boolean })`, `buildTestApp(overrides?)`

- [ ] **Step 1: Write the test helpers**

`apps/api/test/unit/fakes.js`:

```js
import { createApp } from '../../src/app.js';
import { createMemoryCache } from '../../src/http/memory-cache.js';

/**
 * Base de datos falsa para tests unitarios: responde a cualquier consulta
 * o falla siempre, según la opción `fail`.
 */
export function fakeDb({ fail = false } = {}) {
  return {
    async query() {
      if (fail) throw new Error('connection refused');
      return { rows: [{ '?column?': 1 }] };
    },
  };
}

/**
 * Construye la app con dependencias falsas. Cada test puede reemplazar
 * cualquier dependencia mediante `overrides`.
 */
export function buildTestApp(overrides = {}) {
  return createApp({
    db: fakeDb(),
    repositories: {},
    cache: createMemoryCache({ ttlMs: 60_000 }),
    mediaBaseUrl: '/media',
    ...overrides,
  });
}
```

- [ ] **Step 2: Write the failing app tests**

`apps/api/test/unit/app.test.js`:

```js
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, fakeDb } from './fakes.js';

describe('GET /api/health', () => {
  it('returns 200 when the database answers', async () => {
    const res = await request(buildTestApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('returns 503 when the database fails', async () => {
    const res = await request(buildTestApp({ db: fakeDb({ fail: true }) })).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', database: 'down' });
  });
});

describe('app shell', () => {
  it('returns the JSON error format for unknown routes', async () => {
    const res = await request(buildTestApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('hides x-powered-by and sets helmet headers', async () => {
    const res = await request(buildTestApp()).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects malformed JSON with 400 INVALID_BODY', async () => {
    const res = await request(buildTestApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_BODY');
  });

  it('rejects bodies over 100kb with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(buildTestApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ big: 'x'.repeat(110 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('serves media files with a long immutable cache', async () => {
    const mediaDir = mkdtempSync(join(tmpdir(), 'biomap-media-'));
    writeFileSync(join(mediaDir, 'test.txt'), 'hello');
    const res = await request(buildTestApp({ mediaDir })).get('/media/test.txt');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });
});
```

`apps/api/test/unit/error-handlers.test.js`:

```js
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../../src/http/error-handlers.js';
import { HttpError } from '../../src/http/errors.js';

/**
 * App mínima con una ruta que lanza el error indicado,
 * para probar el manejador central de forma aislada.
 */
function appThrowing(error, options) {
  const app = express();
  app.get('/boom', () => {
    throw error;
  });
  app.use(createErrorHandler(options));
  return app;
}

describe('createErrorHandler', () => {
  it('maps HttpError to its status and code', async () => {
    const res = await request(appThrowing(new HttpError(404, 'POINT_NOT_FOUND', 'nope'))).get(
      '/boom',
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'POINT_NOT_FOUND', message: 'nope' } });
  });

  it('returns 500 INTERNAL_ERROR without a stack by default', async () => {
    const res = await request(appThrowing(new Error('secret detail'))).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret detail');
    expect(res.body.error.stack).toBeUndefined();
  });

  it('includes the stack when exposeStack is true', async () => {
    const res = await request(appThrowing(new Error('x'), { exposeStack: true })).get('/boom');
    expect(res.body.error.stack).toContain('Error: x');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -w apps/api`
Expected: FAIL, `src/app.js` and `src/http/*` not found.

- [ ] **Step 4: Implement errors, handlers, health and app**

`apps/api/src/http/errors.js`:

```js
/**
 * Error HTTP controlado: el manejador central lo convierte en una respuesta
 * con su código de estado y su código de error, sin exponer detalles internos.
 */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}
```

`apps/api/src/http/error-handlers.js`:

```js
import { HttpError } from './errors.js';

/**
 * Responde 404 con el formato estándar a cualquier ruta inexistente.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}

/**
 * Crea el manejador central de errores.
 * Traduce los errores conocidos (HttpError y los del parser de JSON) a respuestas
 * claras. Cualquier otro error se registra en el log y se responde como 500,
 * sin mostrar el mensaje interno; el stack solo se expone en desarrollo.
 *
 * @param {{ exposeStack?: boolean, logger?: { error: Function } }} [options]
 */
export function createErrorHandler({ exposeStack = false, logger } = {}) {
  return (err, req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    if (err.type === 'entity.parse.failed') {
      return res
        .status(400)
        .json({ error: { code: 'INVALID_BODY', message: 'Malformed JSON body' } });
    }
    if (err.type === 'entity.too.large') {
      return res
        .status(413)
        .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
    }
    logger?.error({ err }, 'Unhandled error');
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error',
        ...(exposeStack ? { stack: err.stack } : {}),
      },
    });
  };
}
```

`apps/api/src/health/health.routes.js`:

```js
import { Router } from 'express';

/**
 * Ruta de salud para el monitoreo del mini PC.
 * Responde 200 si la base de datos contesta y 503 si no; nunca usa caché.
 *
 * @param {{ db: { query(sql: string): Promise<unknown> } }} deps
 */
export function createHealthRouter({ db }) {
  const router = Router();
  router.get('/', async (_req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });
  return router;
}
```

`apps/api/src/app.js`:

```js
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { createHealthRouter } from './health/health.routes.js';
import { createErrorHandler, notFoundHandler } from './http/error-handlers.js';

/**
 * Agrega `Cache-Control: no-cache` a las respuestas JSON: el navegador debe
 * revalidar siempre, pero con el ETag recibe un 304 vacío si nada cambió.
 */
function noCache(_req, res, next) {
  res.set('Cache-Control', 'no-cache');
  next();
}

/**
 * Construye la aplicación Express sin abrir ningún puerto.
 * Todas las dependencias se inyectan, para poder probarla con objetos falsos.
 *
 * @param {object} deps
 * @param {{ query: Function }} deps.db
 * @param {import('pino').Logger} [deps.logger]
 * @param {string} [deps.mediaDir]
 * @param {string} [deps.mediaBaseUrl]
 * @param {boolean} [deps.exposeStack]
 */
export function createApp({ db, logger, mediaDir, mediaBaseUrl = '/media', exposeStack = false }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(compression());
  if (logger) app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use(noCache);
  api.use('/health', createHealthRouter({ db }));
  app.use('/api', api);

  /*
   * Imágenes estáticas. En producción las sirve el proxy inverso; aquí quedan
   * para desarrollo. Llevan caché larga porque cada archivo tendrá un nombre único.
   */
  if (mediaDir) {
    app.use(mediaBaseUrl, express.static(mediaDir, { immutable: true, maxAge: '365d' }));
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler({ exposeStack, logger }));
  return app;
}
```

> `createApp` does not take `repositories` or `cache` yet (they would be unused and fail lint). Task 5 adds them to the signature. `buildTestApp` already passes them; extra keys are harmless.

- [ ] **Step 5: Run the tests and lint**

Run: `npm test -w apps/api` → Expected: all tests pass (config, cache, app, error handlers).
Run: `npm run lint` → Expected: no errors.

- [ ] **Step 6: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 4: Database schema, migration runner and integration-test helpers

**Files:**

- Create: `apps/api/migrations/1759708800000_initial-schema.sql`
- Create: `apps/api/src/db/migrate.js`, `apps/api/src/db/pool.js`, `apps/api/scripts/migrate.js`
- Create: `apps/api/test/integration/db-helper.js`
- Test: `apps/api/test/integration/schema.test.js`

**Interfaces:**

- Produces:
  - `migrate(databaseUrl: string, { log?: (msg: string) => void }?) => Promise<unknown>`
  - `createPool({ databaseUrl, max, statementTimeoutMs }) => pg.Pool`
  - Test helpers: `describeWithDb`, `createTestPool()`, `resetDatabase(pool)`, `truncateAll(pool)`, `insertLayer(pool, opts) => Promise<number>`, `insertPoint(pool, opts) => Promise<number>`, `insertImage(pool, opts) => Promise<number>`

- [ ] **Step 1: Write the migration**

`apps/api/migrations/1759708800000_initial-schema.sql`:

```sql
-- Up Migration

/*
 * Esquema inicial del MVP de BioMap.
 * Incluye las tablas de autenticación y auditoría aunque se usen en
 * iteraciones posteriores, para no migrar el esquema a mitad del desarrollo.
 */
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

/*
 * Mantiene updated_at al día en cada UPDATE.
 */
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE admin_users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE layers (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9-]*$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  color text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER layers_set_updated_at
  BEFORE UPDATE ON layers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/*
 * Puntos de interés. deleted_at implementa la eliminación lógica:
 * un punto eliminado no se borra, solo deja de mostrarse.
 */
CREATE TABLE points_of_interest (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layer_id smallint NOT NULL REFERENCES layers (id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text NOT NULL DEFAULT '',
  location geometry(Point, 4326) NOT NULL
    CHECK (ST_X(location) BETWEEN -180 AND 180 AND ST_Y(location) BETWEEN -90 AND 90),
  created_by integer REFERENCES admin_users (id),
  updated_by integer REFERENCES admin_users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX points_of_interest_location_idx ON points_of_interest USING gist (location);
CREATE INDEX points_of_interest_active_layer_idx
  ON points_of_interest (layer_id) WHERE deleted_at IS NULL;

CREATE TRIGGER points_of_interest_set_updated_at
  BEFORE UPDATE ON points_of_interest FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/*
 * Imágenes de cada punto. El texto alternativo y el crédito son obligatorios
 * (accesibilidad y autorización del contenido). Solo una imagen principal por punto.
 */
CREATE TABLE images (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  point_id integer NOT NULL REFERENCES points_of_interest (id) ON DELETE RESTRICT,
  file_path text NOT NULL CHECK (btrim(file_path) <> ''),
  alt_text text NOT NULL CHECK (btrim(alt_text) <> ''),
  credit text NOT NULL CHECK (btrim(credit) <> ''),
  is_main boolean NOT NULL DEFAULT false,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX images_one_main_per_point_idx ON images (point_id) WHERE is_main;
CREATE INDEX images_point_idx ON images (point_id);

CREATE TABLE login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL,
  ip inet,
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_username_time_idx ON login_attempts (username, attempted_at);

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer REFERENCES admin_users (id),
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  entity text NOT NULL CHECK (entity IN ('point', 'image', 'layer')),
  entity_id integer NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_created_at_idx ON audit_log (created_at);

-- Down Migration

/*
 * Las extensiones no se eliminan: pueden estar en uso por otros esquemas.
 */
DROP TABLE IF EXISTS audit_log, login_attempts, images, points_of_interest, layers, admin_users;
DROP FUNCTION IF EXISTS set_updated_at();
```

- [ ] **Step 2: Write the migration runner, pool and CLI**

`apps/api/src/db/migrate.js`:

```js
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';

/**
 * Carpeta de migraciones, resuelta desde este archivo para que funcione
 * sin importar desde qué directorio se ejecute el proceso.
 */
const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

/**
 * Aplica todas las migraciones pendientes. Se usa desde el script de CLI
 * y desde los tests de integración.
 *
 * @param {string} databaseUrl
 * @param {{ log?: (message: string) => void }} [options]
 */
export function migrate(databaseUrl, { log = () => {} } = {}) {
  return runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    checkOrder: true,
    log,
  });
}
```

`apps/api/src/db/pool.js`:

```js
import pg from 'pg';

/**
 * Crea el pool de conexiones a PostgreSQL.
 * statement_timeout corta cualquier consulta lenta para que no bloquee
 * al resto de los visitantes; los demás tiempos evitan conexiones colgadas.
 *
 * @param {{ databaseUrl: string, max: number, statementTimeoutMs: number }} options
 */
export function createPool({ databaseUrl, max, statementTimeoutMs }) {
  return new pg.Pool({
    connectionString: databaseUrl,
    max,
    statement_timeout: statementTimeoutMs,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
```

`apps/api/scripts/migrate.js`:

```js
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
```

- [ ] **Step 3: Write the integration-test helpers**

`apps/api/test/integration/db-helper.js`:

```js
import pg from 'pg';
import { describe } from 'vitest';
import { migrate } from '../../src/db/migrate.js';

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
 * Se llama una vez por archivo de test (en beforeAll).
 */
export async function resetDatabase(pool) {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await migrate(testDatabaseUrl);
}

/**
 * Vacía todas las tablas entre un test y otro, reiniciando los identificadores.
 */
export async function truncateAll(pool) {
  await pool.query(
    'TRUNCATE audit_log, login_attempts, images, points_of_interest, layers, admin_users RESTART IDENTITY CASCADE',
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
  },
) {
  const { rows } = await pool.query(
    `INSERT INTO images (point_id, file_path, alt_text, credit, is_main, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [pointId, filePath, altText, credit, isMain, sortOrder],
  );
  return rows[0].id;
}
```

- [ ] **Step 4: Write the schema integration tests**

`apps/api/test/integration/schema.test.js`:

```js
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
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test -w apps/api`
Expected locally (no database): the warning `[integration] TEST_DATABASE_URL is not set` and the schema suite reported as **skipped**; every unit test still passes.
Expected in CI or with Docker: the 8 schema tests pass.

- [ ] **Step 6: Lint, then checkpoint (no commit)**

Run: `npm run lint` (Expected: clean), then `git status`. Do NOT commit.

---

### Task 5: Layers repository and `GET /api/layers`

**Files:**

- Create: `apps/api/src/layers/layers.repository.js`, `apps/api/src/layers/layers.routes.js`
- Modify: `apps/api/src/app.js` (add `repositories` and `cache` to the signature, mount the router)
- Modify: `apps/api/test/unit/fakes.js` (add layer fixtures and fake repository)
- Test: `apps/api/test/unit/layers.routes.test.js`, `apps/api/test/integration/layers.repository.test.js`

**Interfaces:**

- Consumes: `createMemoryCache` (Task 2), `createApp` (Task 3), the db helpers (Task 4).
- Produces:
  - `createLayersRepository(db) => { findActive(): Promise<Layer[]> }`, where `Layer = { id: number, slug: string, name: string, color: string, icon: string|null, sortOrder: number }`
  - `createLayersRouter({ layersRepository, cache })`. Cache key: `'layers'` (also used by the points router in Task 6).
  - Fakes: `LAYERS` (history id 1, ecology id 2, tourism id 3), `fakeLayersRepository(layers?, { fail? })`, with `calls.findActive` counting calls.

- [ ] **Step 1: Extend the fakes**

Replace `apps/api/test/unit/fakes.js` with:

```js
import { createApp } from '../../src/app.js';
import { createMemoryCache } from '../../src/http/memory-cache.js';

/**
 * Capas de ejemplo con los mismos identificadores que usan todos los tests.
 */
export const LAYERS = [
  { id: 1, slug: 'history', name: 'Historia', color: '#b45309', icon: 'landmark', sortOrder: 1 },
  {
    id: 2,
    slug: 'ecology',
    name: 'Ecología y Biodiversidad',
    color: '#15803d',
    icon: 'leaf',
    sortOrder: 2,
  },
  { id: 3, slug: 'tourism', name: 'Turismo', color: '#1d4ed8', icon: 'binoculars', sortOrder: 3 },
];

/**
 * Base de datos falsa para tests unitarios: responde a cualquier consulta
 * o falla siempre, según la opción `fail`.
 */
export function fakeDb({ fail = false } = {}) {
  return {
    async query() {
      if (fail) throw new Error('connection refused');
      return { rows: [{ '?column?': 1 }] };
    },
  };
}

/**
 * Repositorio de capas falso que cuenta cuántas veces se consultó,
 * para verificar que la caché evita consultas repetidas.
 */
export function fakeLayersRepository(layers = LAYERS, { fail = false } = {}) {
  const calls = { findActive: 0 };
  return {
    calls,
    async findActive() {
      calls.findActive += 1;
      if (fail) throw new Error('db down');
      return layers;
    },
  };
}

/**
 * Construye la app con dependencias falsas. Cada test puede reemplazar
 * cualquier dependencia mediante `overrides`.
 */
export function buildTestApp(overrides = {}) {
  return createApp({
    db: fakeDb(),
    repositories: { layers: fakeLayersRepository() },
    cache: createMemoryCache({ ttlMs: 60_000 }),
    mediaBaseUrl: '/media',
    ...overrides,
  });
}
```

- [ ] **Step 2: Write the failing route tests**

`apps/api/test/unit/layers.routes.test.js`:

```js
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
```

- [ ] **Step 3: Write the failing repository integration test**

`apps/api/test/integration/layers.repository.test.js`:

```js
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
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -w apps/api -- layers`
Expected: FAIL. The route returns 404 and the repository module does not exist (the integration test is skipped locally).

- [ ] **Step 5: Implement the repository, the router and the mounting**

`apps/api/src/layers/layers.repository.js`:

```js
/**
 * Acceso SQL a las capas temáticas.
 * Convierte las columnas snake_case de la base de datos a camelCase.
 *
 * @param {{ query: Function }} db
 */
export function createLayersRepository(db) {
  return {
    /**
     * Capas activas ordenadas para mostrarlas en el control del visor.
     *
     * @returns {Promise<Array<{ id: number, slug: string, name: string, color: string,
     *   icon: string | null, sortOrder: number }>>}
     */
    async findActive() {
      const { rows } = await db.query(
        `SELECT id, slug, name, color, icon, sort_order
           FROM layers
          WHERE is_active
          ORDER BY sort_order, id`,
      );
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        color: row.color,
        icon: row.icon,
        sortOrder: row.sort_order,
      }));
    },
  };
}
```

`apps/api/src/layers/layers.routes.js`:

```js
import { Router } from 'express';

/**
 * Ruta GET /api/layers. Las capas casi nunca cambian, así que se sirven
 * desde la caché bajo la clave 'layers' (compartida con la ruta de puntos).
 *
 * @param {{ layersRepository: { findActive: Function }, cache: { getOrLoad: Function } }} deps
 */
export function createLayersRouter({ layersRepository, cache }) {
  const router = Router();
  router.get('/', async (_req, res) => {
    const layers = await cache.getOrLoad('layers', () => layersRepository.findActive());
    res.json(layers);
  });
  return router;
}
```

In `apps/api/src/app.js`, add the import, add the two dependencies to the signature and its JSDoc, and mount the router after the health route:

```js
import { createLayersRouter } from './layers/layers.routes.js';
```

```js
 * @param {{ layers?: object, points?: object }} [deps.repositories]
 * @param {{ getOrLoad: Function, invalidate: Function }} [deps.cache]
```

```js
export function createApp({
  db,
  repositories = {},
  cache,
  logger,
  mediaDir,
  mediaBaseUrl = '/media',
  exposeStack = false,
}) {
```

```js
api.use('/health', createHealthRouter({ db }));
api.use('/layers', createLayersRouter({ layersRepository: repositories.layers, cache }));
```

- [ ] **Step 6: Run the tests and lint**

Run: `npm test -w apps/api` → Expected: all unit tests pass; integration suites skipped locally.
Run: `npm run lint` → Expected: clean.

- [ ] **Step 7: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 6: Points repository (list) and `GET /api/points`

**Files:**

- Create: `apps/api/src/points/points.repository.js`, `apps/api/src/points/points.routes.js`
- Modify: `apps/api/src/app.js`, `apps/api/test/unit/fakes.js`
- Test: `apps/api/test/unit/points-list.routes.test.js`, `apps/api/test/integration/points.repository.test.js`

**Interfaces:**

- Consumes: `LAYERS` and the `'layers'` cache key (Task 5), `HttpError` (Task 3).
- Produces:
  - `createPointsRepository(db) => { findAll({ layerIds: number[] | null }): Promise<Feature[]>, findById(id: number): Promise<Feature | null> }`. `findById` is implemented in Task 7.
  - List `Feature = { type: 'Feature', id, geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { id, name, layerId, layerSlug } }`.
  - `createPointsRouter({ pointsRepository, layersRepository, cache, mediaBaseUrl })`. Cache keys: `'points:*'` (all) and `'points:<sorted ids joined by ",">'`.
  - Fakes: `pointFeature(id, layer)`, `fakePointsRepository({ points?, details? })` with `calls.findAll` (array of args) and `calls.findById`.

`layers` query rules: absent → all points. Present → split by commas, trim, lower-case, drop empty values, de-duplicate and sort. If that leaves an empty list → `{ type: 'FeatureCollection', features: [] }` without querying. Any slug that is not an active layer → `400 INVALID_LAYER`.

- [ ] **Step 1: Extend the fakes**

Add to `apps/api/test/unit/fakes.js` (below `fakeLayersRepository`):

```js
/**
 * Crea un Feature de lista con coordenadas cercanas a Angostura.
 */
export function pointFeature(id, layer) {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-71.8 - id / 1000, -37.7] },
    properties: { id, name: `Punto ${id}`, layerId: layer.id, layerSlug: layer.slug },
  };
}

/**
 * Repositorio de puntos falso. findAll filtra por layerIds igual que el real,
 * y registra los argumentos de cada llamada para verificarlos en los tests.
 */
export function fakePointsRepository({ points = [], details = {} } = {}) {
  const calls = { findAll: [], findById: [] };
  return {
    calls,
    async findAll(options) {
      calls.findAll.push(options);
      const { layerIds } = options;
      return layerIds === null
        ? points
        : points.filter((feature) => layerIds.includes(feature.properties.layerId));
    },
    async findById(id) {
      calls.findById.push(id);
      return details[id] ?? null;
    },
  };
}
```

And change `buildTestApp`'s `repositories` to:

```js
    repositories: { layers: fakeLayersRepository(), points: fakePointsRepository() },
```

- [ ] **Step 2: Write the failing route tests**

`apps/api/test/unit/points-list.routes.test.js`:

```js
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
```

- [ ] **Step 3: Write the failing repository integration tests**

`apps/api/test/integration/points.repository.test.js`:

```js
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPointsRepository } from '../../src/points/points.repository.js';
import {
  createTestPool,
  describeWithDb,
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
          properties: { id, name: 'Santa Bárbara', layerId, layerSlug: 'history' },
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
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -w apps/api -- points`
Expected: FAIL (the route returns 404; the repository module is missing).

- [ ] **Step 5: Implement the repository (list part)**

`apps/api/src/points/points.repository.js`:

```js
/**
 * Consulta de la lista de puntos para el mapa: solo los datos necesarios
 * para dibujar los marcadores, sin descripción ni imágenes.
 * Excluye los puntos eliminados y los de capas inactivas.
 */
const LIST_SQL = `
  SELECT p.id, p.name, p.layer_id, l.slug AS layer_slug,
         ST_X(p.location) AS lng, ST_Y(p.location) AS lat
    FROM points_of_interest p
    JOIN layers l ON l.id = p.layer_id
   WHERE p.deleted_at IS NULL
     AND l.is_active
     AND ($1::smallint[] IS NULL OR p.layer_id = ANY ($1::smallint[]))
   ORDER BY p.id`;

/**
 * Convierte una fila en un Feature GeoJSON. El `id` también va en la raíz
 * del Feature para que MapLibre pueda usar feature-state.
 */
function toFeature(row, extraProperties = {}) {
  return {
    type: 'Feature',
    id: row.id,
    geometry: { type: 'Point', coordinates: [row.lng, row.lat] },
    properties: {
      id: row.id,
      name: row.name,
      layerId: row.layer_id,
      layerSlug: row.layer_slug,
      ...extraProperties,
    },
  };
}

/**
 * Acceso SQL a los puntos de interés.
 *
 * @param {{ query: Function }} db
 */
export function createPointsRepository(db) {
  return {
    /**
     * Lista de puntos visibles; `layerIds: null` significa todas las capas.
     *
     * @param {{ layerIds: number[] | null }} options
     */
    async findAll({ layerIds }) {
      const { rows } = await db.query(LIST_SQL, [layerIds]);
      return rows.map((row) => toFeature(row));
    },
  };
}
```

- [ ] **Step 6: Implement the router (list) and mount it**

`apps/api/src/points/points.routes.js`:

```js
import { Router } from 'express';
import { HttpError } from '../http/errors.js';

/**
 * Normaliza el parámetro `layers` de la URL.
 * Devuelve null si no se envió (todas las capas). Si se envió, devuelve los slugs
 * en minúsculas, sin espacios, sin vacíos, sin repetidos y ordenados, para que
 * filtros equivalentes compartan la misma entrada de caché.
 *
 * @param {unknown} value
 * @returns {string[] | null}
 */
function parseLayersParam(value) {
  if (value === undefined) return null;
  const parts = (Array.isArray(value) ? value : [value]).filter((v) => typeof v === 'string');
  const slugs = parts
    .flatMap((part) => part.split(','))
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(slugs)].sort();
}

/**
 * Rutas de puntos de interés.
 *
 * @param {{ pointsRepository: object, layersRepository: object,
 *   cache: { getOrLoad: Function }, mediaBaseUrl: string }} deps
 */
export function createPointsRouter({ pointsRepository, layersRepository, cache }) {
  const router = Router();

  /*
   * GET /api/points: lista liviana de puntos como FeatureCollection.
   * Los slugs se validan contra las capas activas (también en caché).
   */
  router.get('/', async (req, res) => {
    const requested = parseLayersParam(req.query.layers);
    let features;

    if (requested === null) {
      features = await cache.getOrLoad('points:*', () =>
        pointsRepository.findAll({ layerIds: null }),
      );
    } else if (requested.length === 0) {
      features = [];
    } else {
      const layers = await cache.getOrLoad('layers', () => layersRepository.findActive());
      const idBySlug = new Map(layers.map((layer) => [layer.slug, layer.id]));
      const unknown = requested.filter((slug) => !idBySlug.has(slug));
      if (unknown.length > 0) {
        throw new HttpError(
          400,
          'INVALID_LAYER',
          `Unknown or inactive layer(s): ${unknown.join(', ')}`,
        );
      }
      const layerIds = requested.map((slug) => idBySlug.get(slug)).sort((a, b) => a - b);
      features = await cache.getOrLoad(`points:${layerIds.join(',')}`, () =>
        pointsRepository.findAll({ layerIds }),
      );
    }

    res.json({ type: 'FeatureCollection', features });
  });

  return router;
}
```

In `apps/api/src/app.js`, add the import and mount the router after `/layers`:

```js
import { createPointsRouter } from './points/points.routes.js';
```

```js
api.use(
  '/points',
  createPointsRouter({
    pointsRepository: repositories.points,
    layersRepository: repositories.layers,
    cache,
    mediaBaseUrl,
  }),
);
```

- [ ] **Step 7: Run the tests, format and lint**

Run: `npm test -w apps/api` → Expected: all unit tests pass.
Run: `npm run format && npm run lint` → Expected: clean.

- [ ] **Step 8: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 7: Point detail, `GET /api/points/:id`

**Files:**

- Modify: `apps/api/src/points/points.repository.js` (add `findById`)
- Modify: `apps/api/src/points/points.routes.js` (add the detail route and URL mapping)
- Test: `apps/api/test/unit/points-detail.routes.test.js`; extend `apps/api/test/integration/points.repository.test.js`

**Interfaces:**

- Consumes: `fakePointsRepository({ details })` (Task 6), `toFeature` (same file).
- Produces:
  - `findById(id: number) => Promise<Feature | null>`, with `properties: { id, name, description, layerId, layerSlug, images: [{ filePath, altText, credit, isMain }] }`. Images are ordered `is_main DESC, sort_order, id`; there is no image cache.
  - HTTP response: the same Feature, with each image as `{ url, altText, credit, isMain }`. `url = mediaBaseUrl + '/' + encoded path`.

- [ ] **Step 1: Write the failing route tests**

`apps/api/test/unit/points-detail.routes.test.js`:

```js
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
```

- [ ] **Step 2: Add the failing repository tests**

Inside `describeWithDb('points repository', ...)` in `apps/api/test/integration/points.repository.test.js`, add (and add `insertImage` to the import from `./db-helper.js`):

```js
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
    });
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -w apps/api -- points-detail`
Expected: FAIL (`/api/points/7` returns 404 NOT_FOUND because the route does not exist).

- [ ] **Step 4: Implement `findById`**

In `apps/api/src/points/points.repository.js`, add below `LIST_SQL`:

```js
/**
 * Consulta de la ficha completa de un punto. Las imágenes se agregan con
 * json_agg en la misma consulta para evitar una consulta extra por imagen.
 */
const DETAIL_SQL = `
  SELECT p.id, p.name, p.description, p.layer_id, l.slug AS layer_slug,
         ST_X(p.location) AS lng, ST_Y(p.location) AS lat,
         COALESCE(
           (SELECT json_agg(
                     json_build_object(
                       'filePath', i.file_path,
                       'altText', i.alt_text,
                       'credit', i.credit,
                       'isMain', i.is_main)
                     ORDER BY i.is_main DESC, i.sort_order, i.id)
              FROM images i
             WHERE i.point_id = p.id),
           '[]'::json) AS images
    FROM points_of_interest p
    JOIN layers l ON l.id = p.layer_id
   WHERE p.id = $1
     AND p.deleted_at IS NULL
     AND l.is_active`;
```

and add this method next to `findAll` inside the returned object:

```js
    /**
     * Ficha de un punto con su descripción e imágenes, o null si no existe,
     * está eliminado o pertenece a una capa inactiva.
     *
     * @param {number} id
     */
    async findById(id) {
      const { rows } = await db.query(DETAIL_SQL, [id]);
      if (rows.length === 0) return null;
      const row = rows[0];
      return toFeature(row, { description: row.description, images: row.images });
    },
```

- [ ] **Step 5: Implement the detail route**

In `apps/api/src/points/points.routes.js`:

1. Add the import `import { z } from 'zod';`
2. Add below `parseLayersParam`:

```js
/**
 * Identificador de punto: entero positivo sin ceros a la izquierda y dentro
 * del rango de `integer` de PostgreSQL, para no provocar errores de desborde.
 */
const pointIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/)
  .transform(Number)
  .refine((n) => n <= 2_147_483_647);

/**
 * Construye la URL pública de una imagen, codificando cada segmento de la ruta
 * (espacios, tildes) y quitando barras iniciales sobrantes.
 */
function toMediaUrl(mediaBaseUrl, filePath) {
  const encoded = filePath
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${mediaBaseUrl}/${encoded}`;
}

/**
 * Reemplaza la ruta interna de cada imagen (filePath) por su URL pública.
 */
function withPublicImages(feature, mediaBaseUrl) {
  const { images, ...properties } = feature.properties;
  return {
    ...feature,
    properties: {
      ...properties,
      images: images.map(({ filePath, ...image }) => ({
        url: toMediaUrl(mediaBaseUrl, filePath),
        ...image,
      })),
    },
  };
}
```

3. Change the router signature to also receive `mediaBaseUrl`:

```js
export function createPointsRouter({ pointsRepository, layersRepository, cache, mediaBaseUrl }) {
```

4. Add the route before `return router;`:

```js
/*
 * GET /api/points/:id: ficha completa de un punto (al tocarlo en el mapa).
 * No usa caché: es una sola consulta por índice primario.
 */
router.get('/:id', async (req, res) => {
  const parsed = pointIdSchema.safeParse(req.params.id);
  if (!parsed.success) {
    throw new HttpError(400, 'INVALID_ID', 'Point id must be a positive integer');
  }
  const point = await pointsRepository.findById(parsed.data);
  if (!point) {
    throw new HttpError(404, 'POINT_NOT_FOUND', `Point ${parsed.data} not found`);
  }
  res.json(withPublicImages(point, mediaBaseUrl));
});
```

- [ ] **Step 6: Run the tests, format and lint**

Run: `npm test -w apps/api` → Expected: all unit tests pass (including the 6 `INVALID_ID` cases).
Run: `npm run format && npm run lint` → Expected: clean.

- [ ] **Step 7: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 8: Audit service

**Files:**

- Create: `apps/api/src/audit/audit.service.js`
- Test: `apps/api/test/unit/audit.service.test.js`, `apps/api/test/integration/audit.service.test.js`

**Interfaces:**

- Produces: `recordAudit(db, { userId?: number|null, action: 'create'|'update'|'delete'|'restore', entity: 'point'|'image'|'layer', entityId: number, details?: object|null }) => Promise<string>`, which returns the new `audit_log.id` (bigint as a string). Throws `TypeError` for invalid input before touching the database.

- [ ] **Step 1: Write the failing unit tests**

`apps/api/test/unit/audit.service.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { recordAudit } from '../../src/audit/audit.service.js';

/**
 * Base de datos falsa que guarda la última consulta recibida.
 */
function capturingDb() {
  const db = {
    last: null,
    async query(sql, params) {
      db.last = { sql, params };
      return { rows: [{ id: '42' }] };
    },
  };
  return db;
}

describe('recordAudit', () => {
  it('inserts one audit row and returns its id', async () => {
    const db = capturingDb();
    const id = await recordAudit(db, {
      userId: 5,
      action: 'update',
      entity: 'point',
      entityId: 9,
      details: { field: 'name' },
    });
    expect(id).toBe('42');
    expect(db.last.sql).toContain('INSERT INTO audit_log');
    expect(db.last.params).toEqual([5, 'update', 'point', 9, '{"field":"name"}']);
  });

  it('defaults userId and details to null', async () => {
    const db = capturingDb();
    await recordAudit(db, { action: 'create', entity: 'image', entityId: 1 });
    expect(db.last.params).toEqual([null, 'create', 'image', 1, null]);
  });

  it.each([
    [{ action: 'drop', entity: 'point', entityId: 1 }, /action/],
    [{ action: 'create', entity: 'user', entityId: 1 }, /entity/],
    [{ action: 'create', entity: 'point', entityId: 0 }, /entityId/],
    [{ action: 'create', entity: 'point', entityId: 1.5 }, /entityId/],
  ])('rejects invalid input %j', async (input, message) => {
    const db = capturingDb();
    await expect(recordAudit(db, input)).rejects.toThrow(message);
    expect(db.last).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing integration test**

`apps/api/test/integration/audit.service.test.js`:

```js
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { recordAudit } from '../../src/audit/audit.service.js';
import { createTestPool, describeWithDb, resetDatabase, truncateAll } from './db-helper.js';

describeWithDb('recordAudit (database)', () => {
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

  it('stores the row with jsonb details', async () => {
    const id = await recordAudit(pool, {
      action: 'delete',
      entity: 'point',
      entityId: 3,
      details: { reason: 'duplicado' },
    });
    const { rows } = await pool.query('SELECT * FROM audit_log WHERE id = $1', [id]);
    expect(rows[0]).toMatchObject({
      user_id: null,
      action: 'delete',
      entity: 'point',
      entity_id: 3,
      details: { reason: 'duplicado' },
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -w apps/api -- audit`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement the service**

`apps/api/src/audit/audit.service.js`:

```js
const ACTIONS = new Set(['create', 'update', 'delete', 'restore']);
const ENTITIES = new Set(['point', 'image', 'layer']);

/**
 * Registra una acción del panel de administración en audit_log.
 * Valida los datos antes de tocar la base de datos para que un error de
 * programación no termine como un error de restricción poco claro.
 * Lo usarán las rutas de escritura de la Iteración 5.
 *
 * @param {{ query: Function }} db
 * @param {{ userId?: number | null, action: string, entity: string,
 *   entityId: number, details?: object | null }} entry
 * @returns {Promise<string>} id del registro creado (bigint como texto)
 */
export async function recordAudit(db, { userId = null, action, entity, entityId, details = null }) {
  if (!ACTIONS.has(action)) throw new TypeError(`Invalid audit action: ${action}`);
  if (!ENTITIES.has(entity)) throw new TypeError(`Invalid audit entity: ${entity}`);
  if (!Number.isInteger(entityId) || entityId <= 0) {
    throw new TypeError(`Invalid audit entityId: ${entityId}`);
  }
  const { rows } = await db.query(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, action, entity, entityId, details === null ? null : JSON.stringify(details)],
  );
  return rows[0].id;
}
```

- [ ] **Step 5: Run the tests and lint**

Run: `npm test -w apps/api` → Expected: all unit tests pass.
Run: `npm run lint` → Expected: clean.

- [ ] **Step 6: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 9: Sample-data seeds

**Files:**

- Create: `apps/api/seeds/sample-data.js`, `apps/api/seeds/seed.js`, `apps/api/seeds/run.js`
- Test: `apps/api/test/unit/seed-guard.test.js`, `apps/api/test/integration/seed.test.js`

**Interfaces:**

- Produces: `SAMPLE_LAYERS`, `SAMPLE_POINTS`; `assertNotProduction(env?)` (throws in production); `seed(pool) => Promise<{ layers: number, pointsInserted: number }>`. It runs in one transaction and is idempotent.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/unit/seed-guard.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { assertNotProduction } from '../../seeds/seed.js';

describe('assertNotProduction', () => {
  it('throws when NODE_ENV is production', () => {
    expect(() => assertNotProduction({ NODE_ENV: 'production' })).toThrow(/production/);
  });

  it('allows development and test', () => {
    expect(() => assertNotProduction({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertNotProduction({})).not.toThrow();
  });
});
```

`apps/api/test/integration/seed.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w apps/api -- seed`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the seeds**

`apps/api/seeds/sample-data.js`:

```js
/**
 * Datos de EJEMPLO para desarrollo y demostraciones. No son contenido oficial:
 * los textos y coordenadas son aproximados y se reemplazarán por el contenido
 * validado por el Centro de Visitantes (paquete 1.3.11).
 */
export const SAMPLE_LAYERS = [
  { slug: 'history', name: 'Historia', color: '#b45309', icon: 'landmark', sortOrder: 1 },
  {
    slug: 'ecology',
    name: 'Ecología y Biodiversidad',
    color: '#15803d',
    icon: 'leaf',
    sortOrder: 2,
  },
  { slug: 'tourism', name: 'Turismo', color: '#1d4ed8', icon: 'binoculars', sortOrder: 3 },
];

export const SAMPLE_POINTS = [
  {
    layerSlug: 'history',
    name: '[Ejemplo] Pueblo de Santa Bárbara',
    description: 'Texto de ejemplo sobre la historia de Santa Bárbara.',
    lng: -72.0206,
    lat: -37.6656,
  },
  {
    layerSlug: 'ecology',
    name: '[Ejemplo] Arboreto del Parque Angostura',
    description: 'Texto de ejemplo sobre la flora nativa del arboreto.',
    lng: -71.81,
    lat: -37.69,
  },
  {
    layerSlug: 'tourism',
    name: '[Ejemplo] Mirador del embalse Angostura',
    description: 'Texto de ejemplo sobre el mirador.',
    lng: -71.83,
    lat: -37.68,
  },
  {
    layerSlug: 'tourism',
    name: '[Ejemplo] Playa de libre acceso',
    description: 'Texto de ejemplo sobre la playa del parque.',
    lng: -71.84,
    lat: -37.685,
  },
];
```

`apps/api/seeds/seed.js`:

```js
import { SAMPLE_LAYERS, SAMPLE_POINTS } from './sample-data.js';

export { SAMPLE_LAYERS, SAMPLE_POINTS };

/**
 * Impide cargar datos de ejemplo en producción.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function assertNotProduction(env = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to load sample data in production');
  }
}

/**
 * Carga las capas y los puntos de ejemplo en una sola transacción.
 * Es idempotente: las capas se actualizan por slug y cada punto se inserta
 * solo si todavía no existe un punto con el mismo nombre.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ layers: number, pointsInserted: number }>}
 */
export async function seed(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const layer of SAMPLE_LAYERS) {
      await client.query(
        `INSERT INTO layers (slug, name, color, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name, color = EXCLUDED.color,
               icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order`,
        [layer.slug, layer.name, layer.color, layer.icon, layer.sortOrder],
      );
    }
    let pointsInserted = 0;
    for (const point of SAMPLE_POINTS) {
      const { rowCount } = await client.query(
        `INSERT INTO points_of_interest (layer_id, name, description, location)
         SELECT l.id, $2::text, $3::text, ST_SetSRID(ST_MakePoint($4::float8, $5::float8), 4326)
           FROM layers l
          WHERE l.slug = $1::text
            AND NOT EXISTS (SELECT 1 FROM points_of_interest p WHERE p.name = $2::text)`,
        [point.layerSlug, point.name, point.description, point.lng, point.lat],
      );
      pointsInserted += rowCount;
    }
    await client.query('COMMIT');
    return { layers: SAMPLE_LAYERS.length, pointsInserted };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

`apps/api/seeds/run.js`:

```js
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
```

- [ ] **Step 4: Run the tests and lint**

Run: `npm test -w apps/api` → Expected: unit tests pass; the seed integration suite is skipped locally.
Run: `npm run format && npm run lint` → Expected: clean.

- [ ] **Step 5: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 10: Server entry point and graceful shutdown

**Files:**

- Create: `apps/api/src/http/shutdown.js`, `apps/api/src/server.js`
- Test: `apps/api/test/unit/shutdown.test.js`

**Interfaces:**

- Consumes: `loadConfig`, `createPool`, `createLayersRepository`, `createPointsRepository`, `createMemoryCache`, `createApp`.
- Produces: `createGracefulShutdown({ server, pool, logger, timeoutMs?: number, exit?: (code: number) => void }) => (signal: string) => void`.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/unit/shutdown.test.js`:

```js
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGracefulShutdown } from '../../src/http/shutdown.js';

const logger = { info: vi.fn(), error: vi.fn() };
const flush = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  vi.useRealTimers();
});

describe('createGracefulShutdown', () => {
  it('closes the server, then the pool, then exits with 0', async () => {
    const order = [];
    const server = {
      close: vi.fn((cb) => {
        order.push('server');
        cb();
      }),
      closeIdleConnections: vi.fn(),
    };
    const pool = { end: vi.fn(async () => order.push('pool')) };
    const exit = vi.fn();

    createGracefulShutdown({ server, pool, logger, exit })('SIGTERM');
    await flush();

    expect(order).toEqual(['server', 'pool']);
    expect(server.closeIdleConnections).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('ignores a second signal', async () => {
    const server = { close: vi.fn((cb) => cb()) };
    const pool = { end: vi.fn(async () => {}) };
    const shutdown = createGracefulShutdown({ server, pool, logger, exit: vi.fn() });
    shutdown('SIGTERM');
    shutdown('SIGINT');
    await flush();
    expect(server.close).toHaveBeenCalledTimes(1);
  });

  it('exits with 1 when the pool fails to close', async () => {
    const server = { close: vi.fn((cb) => cb()) };
    const pool = {
      end: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    const exit = vi.fn();
    createGracefulShutdown({ server, pool, logger, exit })('SIGTERM');
    await flush();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('forces exit with 1 after the timeout', () => {
    vi.useFakeTimers();
    const server = { close: vi.fn() };
    const pool = { end: vi.fn() };
    const exit = vi.fn();
    createGracefulShutdown({ server, pool, logger, exit, timeoutMs: 10_000 })('SIGTERM');
    vi.advanceTimersByTime(10_000);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w apps/api -- shutdown`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement shutdown and the server**

`apps/api/src/http/shutdown.js`:

```js
/**
 * Crea la función de apagado ordenado.
 * Deja de aceptar conexiones, espera las peticiones en curso, cierra el pool
 * de la base de datos y termina el proceso. Si algo se cuelga, fuerza la salida
 * cuando se cumple el tiempo máximo. Las señales repetidas se ignoran.
 *
 * @param {{ server: { close: Function, closeIdleConnections?: Function },
 *   pool: { end: Function }, logger: { info: Function, error: Function },
 *   timeoutMs?: number, exit?: (code: number) => void }} deps
 * @returns {(signal: string) => void}
 */
export function createGracefulShutdown({
  server,
  pool,
  logger,
  timeoutMs = 10_000,
  exit = (code) => process.exit(code),
}) {
  let started = false;

  return function shutdown(signal) {
    if (started) return;
    started = true;
    logger.info({ signal }, 'Shutting down');

    const timer = setTimeout(() => {
      logger.error({ timeoutMs }, 'Forced shutdown after timeout');
      exit(1);
    }, timeoutMs);
    timer.unref?.();

    server.close(async (error) => {
      let code = error ? 1 : 0;
      try {
        await pool.end();
      } catch (poolError) {
        logger.error({ err: poolError }, 'Error closing the database pool');
        code = 1;
      }
      clearTimeout(timer);
      exit(code);
    });
    server.closeIdleConnections?.();
  };
}
```

`apps/api/src/server.js`:

```js
import pino from 'pino';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createMemoryCache } from './http/memory-cache.js';
import { createGracefulShutdown } from './http/shutdown.js';
import { createLayersRepository } from './layers/layers.repository.js';
import { createPointsRepository } from './points/points.repository.js';

/**
 * Punto de entrada del proceso: lee la configuración, crea las dependencias
 * reales, abre el puerto y registra el apagado ordenado.
 * Si la configuración es inválida, termina con un mensaje claro.
 */
let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const logger = pino({ level: config.logLevel });
const pool = createPool({
  databaseUrl: config.databaseUrl,
  max: config.dbPoolMax,
  statementTimeoutMs: config.dbStatementTimeoutMs,
});
pool.on('error', (error) => logger.error({ err: error }, 'Unexpected idle database client error'));

const app = createApp({
  db: pool,
  repositories: {
    layers: createLayersRepository(pool),
    points: createPointsRepository(pool),
  },
  cache: createMemoryCache({ ttlMs: config.cacheTtlSeconds * 1000 }),
  logger,
  mediaDir: config.mediaDir,
  mediaBaseUrl: config.mediaBaseUrl,
  exposeStack: config.nodeEnv === 'development',
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'BioMap API listening');
});

const shutdown = createGracefulShutdown({ server, pool, logger });
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 4: Run the tests and check startup behavior**

Run: `npm test -w apps/api` → Expected: all unit tests pass.
Run: `npm run lint` → Expected: clean.
Run (without a `.env`): `node apps/api/src/server.js`
Expected: it prints `Invalid configuration: DATABASE_URL: ...` and exits with code 1.

- [ ] **Step 5: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 11: Load-test script

**Files:**

- Create: `apps/api/scripts/loadtest-criteria.js`, `apps/api/scripts/loadtest.js`
- Test: `apps/api/test/unit/loadtest-criteria.test.js`

**Interfaces:**

- Produces: `evaluateLoadTest(result, { maxLatencyMs?: number }) => { passed: boolean, latencyMs: number, errors: number, requests: number }`. It uses `result.latency.p97_5` (autocannon has no p95; p97.5 is stricter), and `errors = result.errors + result.timeouts + result.non2xx`.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/unit/loadtest-criteria.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { evaluateLoadTest } from '../../scripts/loadtest-criteria.js';

/**
 * Resultado mínimo con la misma forma que devuelve autocannon.
 */
function result({ p97_5 = 50, errors = 0, timeouts = 0, non2xx = 0, total = 1000 } = {}) {
  return { latency: { p97_5 }, errors, timeouts, non2xx, requests: { total } };
}

describe('evaluateLoadTest', () => {
  it('passes under the latency limit with no errors', () => {
    expect(evaluateLoadTest(result())).toEqual({
      passed: true,
      latencyMs: 50,
      errors: 0,
      requests: 1000,
    });
  });

  it('fails when latency reaches the limit', () => {
    expect(evaluateLoadTest(result({ p97_5: 200 })).passed).toBe(false);
  });

  it('fails on any error, timeout or non-2xx response', () => {
    expect(evaluateLoadTest(result({ errors: 1 })).passed).toBe(false);
    expect(evaluateLoadTest(result({ timeouts: 1 })).passed).toBe(false);
    expect(evaluateLoadTest(result({ non2xx: 1 })).errors).toBe(1);
  });

  it('accepts a custom latency limit', () => {
    expect(evaluateLoadTest(result({ p97_5: 300 }), { maxLatencyMs: 500 }).passed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w apps/api -- loadtest`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the criteria and the CLI**

`apps/api/scripts/loadtest-criteria.js`:

```js
/**
 * Evalúa el resultado de autocannon contra el criterio de aceptación:
 * latencia bajo el límite y cero errores. autocannon no entrega p95, así que se usa
 * p97.5, que es más exigente: si p97.5 cumple, p95 también cumple.
 *
 * @param {{ latency: { p97_5: number }, errors: number, timeouts: number,
 *   non2xx: number, requests: { total: number } }} result
 * @param {{ maxLatencyMs?: number }} [options]
 */
export function evaluateLoadTest(result, { maxLatencyMs = 200 } = {}) {
  const latencyMs = result.latency.p97_5;
  const errors = result.errors + result.timeouts + result.non2xx;
  return {
    passed: errors === 0 && latencyMs < maxLatencyMs,
    latencyMs,
    errors,
    requests: result.requests.total,
  };
}
```

`apps/api/scripts/loadtest.js`:

```js
import autocannon from 'autocannon';
import { evaluateLoadTest } from './loadtest-criteria.js';

/**
 * CLI de prueba de carga contra una API ya levantada.
 * Por defecto: 50 conexiones durante 30 s sobre /api/points (más del doble de la
 * carga esperada: 6 personas en la pantalla y 15 teléfonos).
 */
const url = process.env.LOADTEST_URL ?? 'http://localhost:3000/api/points';
const connections = Number(process.env.LOADTEST_CONNECTIONS ?? 50);
const duration = Number(process.env.LOADTEST_DURATION ?? 30);
const maxLatencyMs = Number(process.env.LOADTEST_MAX_LATENCY_MS ?? 200);

console.log(`Load test: ${url} | ${connections} connections | ${duration}s`);
const result = await autocannon({ url, connections, duration });
const verdict = evaluateLoadTest(result, { maxLatencyMs });

console.log(
  `requests=${verdict.requests} p97.5=${verdict.latencyMs}ms errors=${verdict.errors} limit=${maxLatencyMs}ms`,
);
console.log(verdict.passed ? 'PASS' : 'FAIL');
process.exit(verdict.passed ? 0 : 1);
```

- [ ] **Step 4: Run the tests and lint**

Run: `npm test -w apps/api` → Expected: all unit tests pass.
Run: `npm run format && npm run lint` → Expected: clean.
(Running `npm run loadtest -w apps/api` needs a running API with a database; it is deferred until Docker is installed.)

- [ ] **Step 5: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 12: Minimal web skeleton

**Files:**

- Create: `apps/web/package.json`, `apps/web/vite.config.js`, `apps/web/index.html`, `apps/web/src/main.jsx`, `apps/web/src/App.jsx`
- Test: `apps/web/src/App.test.jsx`

**Interfaces:**

- Consumes: `GET /api/health` → `{ status: 'ok' | 'degraded', database }`.
- Produces: `App({ fetchImpl?: typeof fetch })`, which renders `role="status"` text: `Verificando conexión con el servidor…`, `Servidor conectado`, `Servidor con problemas de base de datos`, or `Servidor no disponible`.

- [ ] **Step 1: Create the package and install dependencies**

`apps/web/package.json`:

```json
{
  "name": "@biomap/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

Run from the repo root:

```bash
npm install -w apps/web react@19 react-dom@19
npm install -w apps/web -D vite@7 @vitejs/plugin-react@5 vitest@3 jsdom@26 @testing-library/react@16 @testing-library/dom@10
```

`apps/web/vite.config.js`:

```js
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * En desarrollo, Vite reenvía /api y /media a la API para que todo salga
 * del mismo origen (sin CORS). En Docker, API_PROXY_TARGET apunta al servicio `api`.
 */
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': apiTarget, '/media': apiTarget },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BioMap – Mapa Vivo del Bío Bío</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Write the failing test**

`apps/web/src/App.test.jsx`:

```jsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

afterEach(cleanup);

/**
 * Respuesta mínima compatible con fetch para los tests.
 */
const jsonResponse = (body) => Promise.resolve({ json: () => Promise.resolve(body) });

describe('App', () => {
  it('shows "Servidor conectado" when the API is healthy', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ status: 'ok', database: 'up' }));
    render(<App fetchImpl={fetchImpl} />);
    expect(await screen.findByText('Servidor conectado')).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledWith('/api/health');
  });

  it('shows the degraded state when the database is down', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ status: 'degraded', database: 'down' }));
    render(<App fetchImpl={fetchImpl} />);
    expect(await screen.findByText('Servidor con problemas de base de datos')).toBeTruthy();
  });

  it('shows "Servidor no disponible" when the request fails', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('offline')));
    render(<App fetchImpl={fetchImpl} />);
    expect(await screen.findByText('Servidor no disponible')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -w apps/web`
Expected: FAIL, cannot resolve `./App.jsx`.

- [ ] **Step 4: Implement the app**

`apps/web/src/App.jsx`:

```jsx
import { useEffect, useState } from 'react';

/**
 * Textos visibles para cada estado de la conexión con la API.
 */
const LABELS = {
  checking: 'Verificando conexión con el servidor…',
  ok: 'Servidor conectado',
  degraded: 'Servidor con problemas de base de datos',
  unreachable: 'Servidor no disponible',
};

/**
 * Página provisoria: solo verifica que el proxy y la API respondan.
 * El visor del mapa se construye en el paquete 1.3.5 (Iteración 3).
 *
 * @param {{ fetchImpl?: typeof fetch }} props
 */
export default function App({ fetchImpl = fetch }) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    fetchImpl('/api/health')
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) setStatus(body.status === 'ok' ? 'ok' : 'degraded');
      })
      .catch(() => {
        if (!cancelled) setStatus('unreachable');
      });
    return () => {
      cancelled = true;
    };
  }, [fetchImpl]);

  return (
    <main>
      <h1>BioMap – Mapa Vivo del Bío Bío</h1>
      <p role="status">{LABELS[status]}</p>
    </main>
  );
}
```

`apps/web/src/main.jsx`:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

/**
 * Monta la aplicación React en el elemento #root de index.html.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Run the tests, build and lint**

Run: `npm test -w apps/web` → Expected: 3 passed.
Run: `npm run build -w apps/web` → Expected: build succeeds and writes `apps/web/dist`.
Run: `npm run format && npm run lint` → Expected: clean.

- [ ] **Step 6: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 13: Docker Compose and tile-server placeholder

**Files:**

- Create: `apps/api/Dockerfile`, `.dockerignore`, `docker-compose.yml`, `media/.gitkeep`
- Create: `infra/tiles/config.json`, `infra/tiles/styles/placeholder/style.json`, `infra/tiles/fonts/.gitkeep`, `infra/tiles/mbtiles/.gitkeep`, `infra/tiles/README.md`

**Interfaces:**

- Consumes: `npm run db:migrate` (`scripts/migrate.js`) and `src/server.js`.
- Produces: services `db`, `api`, `web` and `tiles` (profile `tiles`). Ports: db 5432, api 3000, web 5173, tiles 8080.

- [ ] **Step 1: Write the API Dockerfile and .dockerignore**

`apps/api/Dockerfile`:

```dockerfile
# Imagen de la API. Se construye desde la raíz del repositorio (contexto ".")
# para poder usar el package-lock.json del monorepo.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/api
COPY apps/api apps/api
ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
EXPOSE 3000
# Aplica las migraciones pendientes y luego arranca la API.
CMD ["sh", "-c", "node scripts/migrate.js && node src/server.js"]
```

`.dockerignore`:

```
**/node_modules
.git
.env
coverage
**/dist
media
infra/tiles/mbtiles
```

- [ ] **Step 2: Write `docker-compose.yml`**

```yaml
# Entorno de desarrollo de BioMap.
# `docker compose up` levanta la base de datos, la API y el frontend.
# El servidor de tiles se activa con `docker compose --profile tiles up`
# cuando existan los MBTiles reales (paquete 1.3.3).
services:
  db:
    image: postgis/postgis:17-3.5
    environment:
      POSTGRES_USER: biomap
      POSTGRES_PASSWORD: biomap
      POSTGRES_DB: biomap
    ports:
      - '5432:5432'
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U biomap -d biomap']
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: development
      PORT: 3000
      DATABASE_URL: postgres://biomap:biomap@db:5432/biomap
      MEDIA_DIR: /data/media
      MEDIA_BASE_URL: /media
      LOG_LEVEL: info
    volumes:
      - ./media:/data/media:ro
    ports:
      - '3000:3000'
    depends_on:
      db:
        condition: service_healthy

  web:
    image: node:24-alpine
    working_dir: /app
    command: sh -c "npm ci && npm run dev -w apps/web -- --host 0.0.0.0"
    environment:
      API_PROXY_TARGET: http://api:3000
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - '5173:5173'
    depends_on:
      - api

  tiles:
    image: maptiler/tileserver-gl-light:v5.0.0
    profiles: [tiles]
    command: ['--config', '/data/config.json']
    volumes:
      - ./infra/tiles:/data:ro
    ports:
      - '8080:8080'

volumes:
  db-data:
```

- [ ] **Step 3: Write the tile-server placeholder**

`infra/tiles/config.json`:

```json
{
  "options": {
    "paths": {
      "root": "/data",
      "styles": "styles",
      "fonts": "fonts",
      "mbtiles": "mbtiles"
    }
  },
  "styles": {
    "placeholder": { "style": "placeholder/style.json" }
  },
  "data": {}
}
```

`infra/tiles/styles/placeholder/style.json`:

```json
{
  "version": 8,
  "name": "BioMap placeholder",
  "sources": {},
  "layers": [
    { "id": "background", "type": "background", "paint": { "background-color": "#e8efe6" } }
  ]
}
```

Create the empty files `infra/tiles/fonts/.gitkeep`, `infra/tiles/mbtiles/.gitkeep` and `media/.gitkeep`.

`infra/tiles/README.md`:

````markdown
# Local tiles (EDT 1.3.3)

This folder holds the tile-server configuration. The map must work **without internet**,
so every tile, font and sprite is served from here by `tileserver-gl-light`.

The current style is a placeholder (a plain background). The real cartography is produced
in its own cycle (EDT package 1.3.3):

1. **Vector tiles:** download the Chile extract from Geofabrik and generate
   `mbtiles/biobio.mbtiles` for the Biobío bounds with Planetiler (requires Java 21+)
   or tilemaker.
2. **Terrain tiles:** download a DEM covering the region and convert it to
   `mbtiles/terrain.mbtiles` (Terrain-RGB) with GDAL and `rio-rgbify`.
3. **Style:** edit the style in Maputnik, using only local sources, and save it as
   `styles/biomap/style.json`. Include the OpenStreetMap attribution.
4. **Fonts and sprites:** place the glyph PBFs in `fonts/` and the sprites in `sprites/`.
5. Register the data and the style in `config.json`, then run:

```bash
docker compose --profile tiles up tiles
```

Acceptance (EDT 1.3.3): the map shows 3D terrain, labels and the OpenStreetMap attribution,
with the internet connection unplugged.
````

- [ ] **Step 4: Validate the files without Docker**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('infra/tiles/config.json','utf8')); JSON.parse(require('fs').readFileSync('infra/tiles/styles/placeholder/style.json','utf8')); console.log('json ok')"
npm run format:check
```

Expected: `json ok` and Prettier clean. (`docker compose config` and `docker compose up` are deferred until Docker Desktop is installed.)

> Known risk for later: `npm ci` inside the Linux `web` container uses a lockfile generated on Windows, and npm sometimes omits Linux-only optional binaries (for example `@rollup/rollup-linux-x64-musl`). If `vite` fails to start in the container, run `npm install` instead of `npm ci` in the `web` command.

- [ ] **Step 5: Checkpoint (no commit)**

Run: `git status`. Do NOT commit.

---

### Task 14: CI workflow, README, PENDING and final verification

**Files:**

- Create: `.github/workflows/ci.yml`, `README.md`, `PENDING.md`

**Interfaces:**

- Consumes: root scripts `lint`, `format:check`, `test`, `db:migrate` and `db:seed`.

- [ ] **Step 1: Write the CI workflow**

`.github/workflows/ci.yml`:

```yaml
# Integración continua: lint, formato y todos los tests.
# Los tests de integración corren contra un PostGIS real levantado como servicio.
name: CI

on:
  push:
    branches: ['**']
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:17-3.5
        env:
          POSTGRES_USER: biomap
          POSTGRES_PASSWORD: biomap
          POSTGRES_DB: biomap_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U biomap -d biomap_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgres://biomap:biomap@localhost:5432/biomap_test
      TEST_DATABASE_URL: postgres://biomap:biomap@localhost:5432/biomap_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run db:migrate
      - run: npm run db:seed
      - run: npm test
```

- [ ] **Step 2: Write `README.md`**

````markdown
# BioMap – Mapa Vivo del Bío Bío

Interactive, fully offline map of the Biobío river territory for the Centro de Visitantes
Angostura (Colbún S.A.). Capstone project, INACAP, Ingeniería en Informática.

## Structure

| Path               | Content                                                      |
| ------------------ | ------------------------------------------------------------ |
| `apps/api`         | REST API (Node.js 24, Express 5, PostgreSQL + PostGIS)       |
| `apps/web`         | Frontend (React + Vite); the map viewer arrives in EDT 1.3.5 |
| `infra/tiles`      | Local tile server configuration (EDT 1.3.3)                  |
| `docs/superpowers` | Design specs and implementation plans                        |

## Requirements

- Node.js 24+
- Docker Desktop (for PostgreSQL/PostGIS and the full stack)

## Getting started

```bash
npm install
cp .env.example .env
```

### Full stack with Docker

```bash
docker compose up --build        # db + api + web
docker compose exec api node seeds/run.js   # optional sample data (never in production)
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/health

### API only (database already running)

```bash
npm run db:migrate
npm run db:seed
npm run dev -w apps/api
```

## Scripts

| Command                           | What it does                                                          |
| --------------------------------- | --------------------------------------------------------------------- |
| `npm test`                        | All tests. Integration tests run only when `TEST_DATABASE_URL` is set |
| `npm run lint`                    | ESLint                                                                |
| `npm run format` / `format:check` | Prettier                                                              |
| `npm run db:migrate`              | Apply database migrations                                             |
| `npm run db:seed`                 | Load sample data (refuses to run in production)                       |
| `npm run loadtest -w apps/api`    | Load test against a running API: 50 connections, 30 s                 |

## API

| Route                                    | Description                                      |
| ---------------------------------------- | ------------------------------------------------ |
| `GET /api/health`                        | `200` when the database answers, `503` otherwise |
| `GET /api/layers`                        | Active thematic layers                           |
| `GET /api/points?layers=history,tourism` | Points as a GeoJSON FeatureCollection            |
| `GET /api/points/:id`                    | Full point record with images                    |

Errors always use `{ "error": { "code": "...", "message": "..." } }`.

## Offline check

The system must work without internet. With the stack running, unplug the network
connection and verify that `http://localhost:5173` and `/api/health` keep answering.
No runtime code may load assets from a CDN or any external service.

## Conventions

- Code, file names, database objects, API routes and commits are in English.
- Code comments are in Spanish and written as block comments (`/** ... */`) above the code.
- TDD: write the failing test first.
````

- [ ] **Step 3: Write `PENDING.md`**

```markdown
# Pending items (depend on the client or on the environment)

| Item                                                      | Owner                  | Needed for                                                  |
| --------------------------------------------------------- | ---------------------- | ----------------------------------------------------------- |
| Minimum number of points of interest for the MVP          | Client (Rodrigo Román) | Content work (1.3.11), final seed size                      |
| TI Colbún approval of the local server and dedicated wifi | Client / TI Colbún     | Deployment on the mini PC (1.3.10)                          |
| Official content sources and who validates them           | Client                 | Content (1.3.11)                                            |
| Exact geographic bounds of the territory                  | Client / team          | Viewer `maxBounds` (1.3.5), validating point writes (1.3.8) |
| Docker Desktop installed on the development machines      | Team                   | Running the stack, local integration tests, load test       |
| Git author identity and GitHub repository                 | Team                   | Commits and CI                                              |
```

- [ ] **Step 4: Run the final verification**

Run from the repo root:

```bash
npm run format
npm run lint
npm run format:check
npm test
```

Expected:

- lint and format:check finish with no errors;
- `apps/api`: every unit test passes, and the integration suites are reported as skipped with the `TEST_DATABASE_URL is not set` warning;
- `apps/web`: 3 tests pass.

- [ ] **Step 5: Checkpoint (no commit)**

Run: `git status` and list the created files for the user. Do NOT commit.
