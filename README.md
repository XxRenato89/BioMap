# BioMap – Mapa Vivo del Bío Bío

Interactive, fully offline map of the Biobío river territory for the Centro de Visitantes
Angostura (Colbún S.A.). Capstone project, INACAP, Ingeniería en Informática.

## Structure

| Path               | Content                                                  |
| ------------------ | -------------------------------------------------------- |
| `apps/api`         | REST API (Node.js 24, Express 5, PostgreSQL + PostGIS)   |
| `apps/web`         | Touch viewer: 3D diorama (React 19, Vite, Three.js, R3F) |
| `infra/tiles`      | Local tile server configuration (EDT 1.3.3)              |
| `docs/superpowers` | Design specs and implementation plans                    |

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
docker compose up --build                   # db + api + web
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

### Web viewer

```bash
npm run dev -w apps/web   # http://localhost:5173 (proxies /api to http://localhost:3000)
```

Viewer settings (`apps/web/.env.local`, see `.env.example`): `VITE_MAP_BOUNDS`
(`west,south,east,north`), `VITE_IDLE_TIMEOUT_S`, `VITE_IDLE_WARNING_S`,
`VITE_ATTRACT_DELAY_S` (`0` disables the attract mode), `VITE_REFRESH_S`, `VITE_PUBLIC_URL` and
`VITE_KIOSK_WIFI` (QR card).

### The 3D diorama

The map is a stylized 3D model (a "digital diorama") of the Biobío territory drawn with Three.js
through React Three Fiber. It needs no map server and no internet:

- **Relief:** real elevation (Terrarium/SRTM, zoom 12) baked into `apps/web/public/diorama/`
  (`terrain.bin` + `terrain.json`). Regenerate it, with internet, only if the bounds change:
  `node apps/web/scripts/build-diorama.mjs`.
- **Look:** color by altitude and slope, an object-space normal map and a fine detail texture
  baked in the browser (mipmaps + maximum anisotropic filtering), contour lines every 200 m,
  soil strata on the sides, a pedestal, water from OpenStreetMap (`src/data/water.json`) and
  thousands of instanced trees. Soft shadows (PCF soft) from a warm key light.
- **Performance:** one WebGL canvas for every view (drei `View`), on-demand rendering, terrain
  split in chunks (frustum culling) with a lighter mesh for the overview, and automatic DPR
  reduction when the GPU falls behind.
- **Point sheet:** tapping a point flies the camera smoothly to it and opens a side sheet with its
  text, photos and 360° panorama. Closing the sheet frames the whole model again.

## Integration tests

Integration tests run against a real PostgreSQL + PostGIS database and only when
`TEST_DATABASE_URL` is set. Vitest does not read `.env`, so pass it explicitly:

```bash
TEST_DATABASE_URL=postgres://biomap:biomap@localhost:5432/biomap_test npm test
```

The Docker `db` service creates `biomap_test` the first time it starts. The tests drop and
recreate the whole schema, so they refuse to run unless the database name ends in `_test`.

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
