# BioMap — Monorepo skeleton + Database + REST API (design)

- **Date:** 2026-10-06
- **Status:** Approved in conversation, pending written review
- **EDT packages covered:** 1.3.1 (repository, CI and dev environment, overdue from Iteration 1) and 1.3.4 (database and REST API, Iteration 2)
- **Out of scope:** 1.3.3 local cartography (its own cycle), 1.3.5 map viewer, 1.3.7 authentication, 1.3.8 admin panel and write endpoints
- **Project context:** `../../../../BioMap_Documento_del_Proyecto.md`

## 1. Goal

Deliver a working monorepo that the whole team can build on. It contains:

- a read-only REST API over PostgreSQL/PostGIS that serves thematic layers and points of interest (POI), fast enough for concurrent use from the touch screen and the visitors' phones;
- the complete database schema for the MVP, including the tables that authentication and auditing will use later;
- tooling: lint, formatting, tests, CI and Docker Compose.

Docker is not installed on the development machine yet. All code and tests are written now. Tests that need a database are skipped locally and run in CI against a real PostGIS service. End-to-end verification with Docker is deferred.

## 2. Conventions

- **Language:** all identifiers, file and folder names, tables, columns, API routes, commit messages and repository documentation are in **English**. Code comments are in **Spanish** and always written as **blocks** (`/** ... */` or `/* ... */`) above the function or section, never as trailing line comments. User-facing content (layer names, POI texts) is Spanish data, not code.
- **JavaScript (ESM)** with JSDoc on public functions. No TypeScript.
- **npm workspaces** monorepo. Node.js 24.
- ESLint (flat config) + Prettier, shared at the root.
- TDD: test first, then implementation.

## 3. Repository layout

```
biomap/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── app.js            # createApp(deps): builds the Express app, no listen
│   │   │   ├── server.js         # loads config, creates pool, listens, graceful shutdown
│   │   │   ├── config.js         # env parsing/validation with zod
│   │   │   ├── db/pool.js        # pg Pool factory (pool size, statement_timeout)
│   │   │   ├── http/             # error handler, not-found, cache helpers
│   │   │   ├── layers/           # layers.routes.js + layers.repository.js
│   │   │   ├── points/           # points.routes.js + points.repository.js
│   │   │   ├── health/           # health.routes.js
│   │   │   └── audit/            # audit.service.js (no public route yet)
│   │   ├── migrations/           # node-pg-migrate, SQL
│   │   ├── seeds/                # sample data, never for production
│   │   ├── scripts/loadtest.js   # autocannon
│   │   └── test/
│   │       ├── unit/             # routes with fake repositories (no DB)
│   │       └── integration/      # repositories against real PostGIS
│   └── web/                      # minimal Vite + React skeleton (viewer comes in 1.3.5)
├── infra/tiles/                  # tileserver config, placeholder style, README with 1.3.3 steps
├── docs/superpowers/specs/
├── docker-compose.yml
├── .github/workflows/ci.yml
├── .env.example
├── PENDING.md
└── README.md
```

Each domain folder separates the **route** (HTTP: parsing, validation, status codes, caching) from the **repository** (SQL only). Routes receive their repositories through `createApp({ repositories, ... })`, so they can be tested without a database.

## 4. Database schema

PostgreSQL 17 + PostGIS 3.5. Migrations use **node-pg-migrate** with plain SQL. The first migration enables the `postgis` and `citext` extensions.

### 4.1 Tables

**layers**

| column                  | type                 | rules                           |
| ----------------------- | -------------------- | ------------------------------- |
| id                      | smallint identity PK |                                 |
| slug                    | text                 | unique, `^[a-z][a-z0-9-]*$`     |
| name                    | text                 | not null (Spanish display name) |
| color                   | text                 | not null, `^#[0-9a-fA-F]{6}$`   |
| icon                    | text                 | null                            |
| sort_order              | smallint             | not null default 0              |
| is_active               | boolean              | not null default true           |
| created_at / updated_at | timestamptz          | not null default now()          |

**points_of_interest**

| column                  | type                  | rules                  |
| ----------------------- | --------------------- | ---------------------- |
| id                      | integer identity PK   |                        |
| layer_id                | smallint              | FK → layers, not null  |
| name                    | text                  | not null, non-blank    |
| description             | text                  | not null default ''    |
| location                | geometry(Point, 4326) | not null               |
| created_by / updated_by | integer               | FK → admin_users, null |
| created_at / updated_at | timestamptz           | not null default now() |
| deleted_at              | timestamptz           | null; soft delete      |

Indexes: GIST on `location`; btree on `layer_id` with `WHERE deleted_at IS NULL`.

**images**

| column     | type                | rules                                                 |
| ---------- | ------------------- | ----------------------------------------------------- |
| id         | integer identity PK |                                                       |
| point_id   | integer             | FK → points_of_interest, not null, ON DELETE RESTRICT |
| file_path  | text                | not null (relative to MEDIA_DIR)                      |
| alt_text   | text                | not null, non-blank (accessibility)                   |
| credit     | text                | not null, non-blank (content authorization)           |
| is_main    | boolean             | not null default false                                |
| sort_order | smallint            | not null default 0                                    |
| created_at | timestamptz         | not null default now()                                |

Partial unique index on `(point_id) WHERE is_main` guarantees **at most one main image per point**.

**admin_users**: id, `username citext unique`, `password_hash text not null`, `role text not null default 'admin' check (role in ('admin'))`, `is_active boolean default true`, `last_login_at timestamptz`, `created_at`. No user is created in this cycle.

**login_attempts**: id bigint identity, `username text not null`, `ip inet`, `succeeded boolean not null`, `attempted_at timestamptz default now()`. Index on `(username, attempted_at)`.

**audit_log**: id bigint identity, `user_id` FK → admin_users null, `action text check in ('create','update','delete','restore')`, `entity text check in ('point','image','layer')`, `entity_id integer not null`, `details jsonb`, `created_at`. Index on `created_at`.

A shared trigger function `set_updated_at()` keeps `updated_at` current on `layers` and `points_of_interest`.

### 4.2 Decisions

- `geometry(Point, 4326)` instead of `geography`: it is faster, supports every PostGIS function and uses the same SRID as MapLibre. Distances in meters are not needed for the MVP.
- The main image is a flag on `images`, so there is no circular FK.
- Seeds are separate from migrations (`npm run db:seed`) and idempotent: layers are upserted by `slug`, and each sample POI is inserted only if no POI with the same name exists. They load the 3 layers (`history` "Historia", `ecology` "Ecología y Biodiversidad", `tourism` "Turismo") and 4 sample POIs near Angostura, named with the prefix "[Ejemplo]". Seeds must never run in production.

## 5. REST API

Express 5. All routes are under `/api`. Everything is served from the same origin (Vite proxy in development, reverse proxy on the mini PC), so there is **no CORS**.

| Route                                    | 200 response                                                                                                                                                                                  | Errors                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET /api/health`                        | `{ "status": "ok", "database": "up" }`                                                                                                                                                        | `503` `{ "status": "degraded", "database": "down" }`                                                               |
| `GET /api/layers`                        | `[{ id, slug, name, color, icon, sortOrder }]`, active layers only, ordered by `sort_order, id`                                                                                               | —                                                                                                                  |
| `GET /api/points?layers=history,tourism` | GeoJSON `FeatureCollection`; each feature has a Point geometry and properties `{ id, name, layerId, layerSlug }`. Without `layers`, returns every non-deleted point in active layers          | `400 INVALID_LAYER` if a slug does not match an active layer                                                       |
| `GET /api/points/:id`                    | GeoJSON `Feature` with properties `{ id, name, description, layerId, layerSlug, images: [{ url, altText, credit, isMain }] }`; images ordered with the main image first, then by `sort_order` | `400 INVALID_ID` (not a positive integer) · `404 POINT_NOT_FOUND` (missing, soft-deleted, or in an inactive layer) |
| `GET /media/*`                           | static image files from `MEDIA_DIR` (development; the reverse proxy serves them in production)                                                                                                | `404`                                                                                                              |

- **Error format:** `{ "error": { "code": "POINT_NOT_FOUND", "message": "..." } }`, produced by a central error handler. Unknown routes return `404 NOT_FOUND`. Stack traces only appear when `NODE_ENV=development`.
- **Casing:** JSON is camelCase; the database is snake_case. Repositories do the mapping.
- **Validation:** query and path parameters, and environment variables, are validated with zod. With invalid configuration the process exits at startup with a clear message.
- **Security baseline:** `helmet`, `express.json({ limit: '100kb' })`, `x-powered-by` disabled.
- **Logging:** `pino` + `pino-http`, JSON output.
- **Audit service:** `recordAudit(db, { userId, action, entity, entityId, details })` inserts one row into `audit_log`. It is tested now but not exposed; the write endpoints in Iteration 5 will call it.

## 6. Performance and load

Expected load is 6 people on the touch screen (one browser) plus up to 15 phones on the local wifi.

1. **Heavy traffic bypasses the API.** Tiles are served by tileserver-gl-light and images by the reverse proxy in production. The API only returns small JSON.
2. **In-memory cache** for `/api/layers` and the `/api/points` responses (keyed by the normalized layer filter). It exposes `invalidate()` for the Iteration 5 write endpoints. A TTL (default 60 s, configurable) bounds staleness in case the database is edited directly.
3. **ETag + `Cache-Control: no-cache`** on JSON responses. Clients revalidate and get `304` when nothing changed. Images get `Cache-Control: public, max-age=31536000, immutable`, because uploaded files will have unique names.
4. **gzip compression** for responses (`compression` middleware).
5. **One query per request.** POI detail aggregates its images with `json_agg` in the same query (no N+1).
6. **pg Pool** sized by `DB_POOL_MAX` (default 10). Each connection sets `statement_timeout` (default 2000 ms) so a slow query cannot block others.
7. **Graceful shutdown** on SIGTERM/SIGINT: stop accepting connections, finish in-flight requests, close the pool, and force exit after 10 s.
8. **Load test:** `npm run loadtest -w apps/api` runs autocannon against a running API. **Acceptance:** 50 concurrent connections for 30 s on `/api/points`, with p95 latency < 200 ms and 0 errors (non-2xx/3xx or socket errors).
9. **Single Node process.** No cluster unless the load test shows the need; several processes would complicate the in-memory cache.

## 7. Configuration (`.env.example`)

`NODE_ENV`, `PORT` (3000), `DATABASE_URL`, `TEST_DATABASE_URL`, `DB_POOL_MAX` (10), `DB_STATEMENT_TIMEOUT_MS` (2000), `CACHE_TTL_SECONDS` (60), `MEDIA_DIR` (./media), `MEDIA_BASE_URL` (/media), `LOG_LEVEL` (info).

## 8. Testing

- **Vitest + supertest.**
- **Unit tests (`test/unit`):** build the app with fake repositories. They cover status codes, validation errors, the GeoJSON shape, camelCase mapping, the error format, cache hits and invalidation, ETag/304, the health check when the DB is up or down, and config validation. They run with no database.
- **Integration tests (`test/integration`):** they run only when `TEST_DATABASE_URL` is set and are otherwise skipped with a visible message. Each run applies the migrations to a clean database. They cover the repository SQL, soft-delete exclusion, the inactive-layer exclusion, the layer filter, image ordering, the blank `alt_text`/`credit` rejection, the one-main-image rule, seed idempotency and `recordAudit`.
- Root scripts: `npm test`, `npm run lint`, `npm run format:check`.

## 9. CI (GitHub Actions)

On every push and pull request: checkout → Node 24 with npm cache → `npm ci` → `npm run lint` → `npm run format:check` → PostGIS service container (`postgis/postgis:17-3.5`) → `npm run db:migrate` against it → `npm test` with `TEST_DATABASE_URL` set. CI only runs once the repository is pushed to GitHub.

## 10. Docker Compose

| Service | Image                        | Notes                                                                     |
| ------- | ---------------------------- | ------------------------------------------------------------------------- |
| db      | postgis/postgis:17-3.5       | named volume, `pg_isready` healthcheck                                    |
| api     | node:24-alpine               | waits for a healthy `db`, runs migrations, then starts                    |
| web     | node:24-alpine               | Vite dev server, proxies `/api` and `/media` to `api`                     |
| tiles   | maptiler/tileserver-gl-light | `profiles: [tiles]`, disabled by default until 1.3.3 produces the MBTiles |

## 11. Web skeleton (minimal)

Vite + React app that renders a placeholder page and calls `/api/health`, to prove that the proxy and wiring work. It has no map; the viewer is 1.3.5.

## 12. Done criteria

- `npm run lint`, `npm run format:check` and `npm test` pass on the development machine (integration tests reported as skipped).
- Migrations, seeds, cache, ETag, compression, graceful shutdown and the load-test script are implemented.
- `README.md` (setup and run instructions, offline testing notes), `.env.example` and `PENDING.md` exist.
- Deferred until Docker Desktop is installed: running the migrations and seeds against real PostGIS, running the integration tests locally, and running the load test.

## 13. Pending items (go to PENDING.md)

- Minimum number of POIs for the MVP (needed to size the seed and content work).
- TI Colbún approval of the local server and the dedicated wifi.
- Official content sources and who validates them.
- Exact geographic bounds of the territory (needed later for the viewer's `maxBounds` and for validating POI writes).
- Docker Desktop installation on the development machines.
