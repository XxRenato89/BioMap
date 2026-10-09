# Detailed 4K Diorama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the offline 3D diorama detailed enough for a 55" 4K kiosk: 30 m relief with LOD, baked
hillshade/AO/land cover, scaled vegetation, Angostura landmarks, new markers, screen-fitted framing
and automatic quality tiers.

**Architecture:** `apps/web/scripts/build-diorama.mjs` (run once, online) writes every asset to
`public/diorama/`; heavy baking moves there. Pure, Node-testable helpers live in
`apps/web/src/diorama/*.js`; React/three components consume them. One camera, on-demand rendering;
DPR and detail come from a quality tier.

**Tech Stack:** React 19, react-three-fiber 9, drei 10, three 0.185, camera-controls (via drei),
Vitest 3. Build-only dev deps: `geotiff`, `sharp`, `pngjs` (existing).

**Spec:** `docs/superpowers/specs/2026-10-07-detailed-diorama-4k-design.md`

## Global Constraints

- **Do NOT run `git commit`** (no git author identity). Checkpoints run `git status` only.
- **No agent-driven visual verification** (no browser, no screenshots). Each task ends with
  `npm test -w apps/web`, `npx eslint apps/web` and, where code ships, `npx vite build` in `apps/web`.
- English identifiers and file names; Spanish block comments above code (`/** */`, `/* */`), no
  trailing `//`; user-facing text in Spanish (and English in `en.json`).
- JavaScript ESM + JSX, no TypeScript. Files written with LF endings (`npx prettier --write`).
- 1 model unit = 1 km; X east, Z south, Y up. `VERTICAL_EXAGGERATION = 2.5`.
- Bounds `[[-72.6, -38.1], [-71.2, -37.3]]`; terrain grid **4096** columns, rows
  `round(4096 * depthKm / widthKm)`; land-cover grid **2048** columns.
- Dams by OSM way id: Angostura `738577784`, Pangue `335658430`, Ralco `335646301`.
- Tiers: low `{ dprMoving: 1, dprStill: 1.5, finestStep: 2, trees: 8000, shadows: false }`,
  medium `{ 1, 2, 1, 20000, false }`, high `{ 1.5, 2, 1, 40000, true }`; default medium;
  `VITE_QUALITY` pins one.
- Touch targets ≥ 64 px on the kiosk.

## Review Focus

1. **Window resized or text scale changed while a point sheet is open** → home view is recomputed
   but the camera stays on the point. Test in Task 6 (`shouldApplyHome`).
2. **A label pill near the screen edge or many points in one valley** → POIs are never hidden by
   declutter, landmark labels are. Test in Task 8 (`declutter`).
3. **Polygon that lies completely outside the bounds or crosses a corner** → dropped / clipped, no
   degenerate triangles. Test in Task 1 (`clipPolygonToBounds`).
4. **Old `terrain.json` (no `version: 2`)** → clear console error, no crash loop. Test in Task 3
   (`checkTerrainMeta`).
5. **`localStorage` throws (private mode)** → tier falls back to default without errors. Test in
   Task 5 (`loadTier`).

---

### Task 1: Pure geometry and baking helpers

**Files:**

- Create: `apps/web/src/diorama/bake.js`, `apps/web/src/diorama/bake.test.js`
- Create: `apps/web/src/diorama/landcover.js`, `apps/web/src/diorama/landcover.test.js`
- Create: `apps/web/src/diorama/geo.js`, `apps/web/src/diorama/geo.test.js`
- Modify: `apps/web/src/diorama/projection.js` (`VERTICAL_EXAGGERATION = 2.5`)

**Interfaces (produces):**

- `hillshade(heights, columns, rows, cellX, cellZ) → Float32Array` (0–1, NW light, on exaggerated heights)
- `ambientOcclusion(heights, columns, rows, cellX, cellZ, { radiusKm, directions, scale }) → Float32Array` (0–1, 1 = open)
- `bakeSurface(meta, heights, { landcover, landcoverColumns, landcoverRows }, cellX, cellZ) → { color: Uint8Array(RGB), normal: Uint8Array(RGB) }`
- `LANDCOVER` (WorldCover code/10 → name), `reclassify(worldCoverCode) → 0..11`, `landcoverTint(cls) → [r,g,b] | null`
- `clipPolygonToBounds({ outer, holes }, bounds) → { outer, holes } | null` (Sutherland–Hodgman on lng/lat rect)

**Tests:** flat grid → hillshade constant, AO = 1; a pit → AO < 1 at bottom; slope facing NW
brighter than facing SE; `reclassify(10) === 1`, `reclassify(80) === 8`, unknown → 0; clip of a
polygon fully outside → `null`, crossing the east edge → every vertex `lng <= east`, inside →
unchanged.

### Task 2: Offline build pipeline

**Files:**

- Create: `apps/web/scripts/diorama/fetch.mjs` (retrying fetch, pool), `terrain.mjs` (Terrarium z13 mosaic → Uint16 grid), `landcover.mjs` (WorldCover COG via `geotiff` `readRasters({ bbox, width, height })`), `osm.mjs` (Overpass query + `parseOverpass`), `osm.test.js` lives in `apps/web/src/diorama/osm.test.js` against `apps/web/src/diorama/osm.js` (pure parser)
- Rewrite: `apps/web/scripts/build-diorama.mjs` (orchestrates, writes to `public/diorama.tmp/`, then replaces `public/diorama/`)
- Modify: `apps/web/package.json` (devDeps `geotiff`, `sharp`; script `"build:diorama": "node scripts/build-diorama.mjs"`)

**Outputs:** `terrain.bin`, `terrain.json` (`version: 2`, `columns`, `rows`, `widthKm`, `depthKm`,
`minHeight`, `maxHeight`, `landcover: { columns, rows }`, `sources`), `surface.webp` (q 90),
`normal.webp` (lossless), `landcover.bin`, `landmarks.json`
(`{ dams: [{ id, name, line }], labels: [{ id, kind, name, coordinates, rank }] }`).

**Interfaces:** `parseOverpass(json, damIds) → { dams, labels }`; ranks: volcano 90, reservoir 80,
dam 75, peak ≥ 2000 m 60, town/city 55, village 40.

**Tests:** `parseOverpass` on a fixture with a dam way (geometry), a named volcano node, a reservoir
way with center and an unnamed peak → dam line in `[lng, lat]`, unnamed dropped, ranks as above.

**Run:** `npm run build:diorama -w apps/web` (online). Expected: `listo: 4096×2958`.

### Task 3: Load v2 assets and LOD terrain

**Files:**

- Create: `apps/web/src/diorama/lod.js` (+ test): `chooseStep({ center, radius }, cameraPosition, { pixelsPerRadian, cellKm, finestStep, maxErrorPx }) → 1|2|4|8|16`; `buildChunk(meta, heights, chunk, step, skirtDepth) → BufferGeometry` with skirts; `chunkGrid(meta, [32, 24]) → chunk[]`
- Create: `apps/web/src/diorama/TerrainLod.jsx` (lazy build, ≤ 6 builds per frame, LRU by vertex budget)
- Rewrite: `apps/web/src/diorama/resources.js` (fetch v2, `checkTerrainMeta`, textures with `flipY = false`, water clipped, landmarks, landcover)
- Modify: `DioramaScene.jsx`, `DioramaView.jsx` (drop `detail`), `builders.js` (drop browser bake, chunks)

**Tests:** `chooseStep` returns 1 near and 16 far, never finer than `finestStep`; `buildChunk` vertex
count = `(w*h) + 4 skirt strips`; `checkTerrainMeta({})` throws mentioning `build:diorama`.

### Task 4: (folded into Task 3 — water clipping is applied in `resources.js`)

### Task 5: Quality tiers, adaptive DPR, debug overlay

**Files:**

- Create: `apps/web/src/diorama/quality.js` (+ test): `TIERS`, `parseQuality(value) → tier | null`, `stepTier(name, ±1)`, `loadTier(storage)`, `saveTier(storage, name)`, zustand `useRenderStore` `{ tier, pinned, moving, stats }`
- Create: `apps/web/src/components/DebugOverlay.jsx`
- Modify: `DioramaCanvas.jsx` (dpr from tier + moving), `CameraRig.jsx` (`wake`/`sleep` → `moving`), `DioramaScene.jsx` (shadows from tier), `App.jsx` (`?debug`)

**Tests:** `parseQuality('high')`, `parseQuality('x') === null`, `stepTier('low', -1) === 'low'`,
`loadTier` with throwing storage → `'medium'`.

### Task 6: Fit to screen, clearance, exhibition background

**Files:**

- Modify: `apps/web/src/diorama/cameraMath.js` (+ test): `fitRange({ corners, target, fovDeg, aspect, heading, pitch, fit: { width, height } }) → meters`; `viewOffset(viewport, freeRect) → { x, y }`; `shouldApplyHome({ selected, attract }) → boolean`
- Modify: `CameraRig.jsx` (`setFrame(freeRect)`, view offset, clearance on `update`), `App.jsx` (measure `[data-obstacle]`, region level = fitted range), `DioramaScene.jsx` (`ContactShadows`), `styles/index.css` (table gradient)

**Tests:** bigger free rect → smaller range; centred box fits (all projected corners within
`fit`); `shouldApplyHome({ selected: true })` false.

### Task 7: Vegetation by land cover

**Files:**

- Modify: `apps/web/src/diorama/builders.js` (+ `builders.test.js`): `buildForest(meta, heights, landcover, { count }) → { native, plantation }` each `{ geometry, matrix, color, count }`; `treeKind(meters, slopeDeg) → 'plantation' | 'native'`
- Modify: `DioramaScene.jsx`

**Tests:** `treeKind(500, 10) === 'plantation'`, `treeKind(1200, 10) === 'native'`,
`treeKind(500, 30) === 'native'`; no tree on a cell whose class is not tree/shrub.

### Task 8: Landmarks and labels

**Files:**

- Create: `apps/web/src/diorama/labels.js` (+ test): `declutter(items) → Set(id)` (items `{ id, rect, rank, fixed }`), `visibleKinds(range, levels) → Set(kind)`
- Create: `apps/web/src/diorama/Landmarks.jsx` (dam walls + `Html` labels)
- Modify: `builders.js`: `buildDamWall(line, heightAt, projection) → BufferGeometry` (+ test)
- Modify: `styles/map.css` (`.map-label`)

**Tests:** overlapping lower rank hidden, `fixed` never hidden; region → no villages; dam wall top
≥ max end height.

### Task 9: New POI markers

**Files:**

- Rewrite: `apps/web/src/diorama/PoiMarkers.jsx` (pill `Html` button, leader line, ground ring, 3 s CSS pulse)
- Modify: `App.jsx` (remove sr-only list: pills are real buttons), `styles/map.css` (`.poi-pill`)
- Test: `apps/web/src/components/components.test.jsx` → `PoiPill` (accessible name, click)

### Task 10: Attribution, docs, final checks

**Files:** `i18n/es.json`, `i18n/en.json` (attribution), `README.md` (diorama section, build
command), spec deviations noted at the end of this plan.

## Deviations from the spec

- Dams are selected by OSM way id (the Angostura wall has no name in OSM).
- Water stays in `src/data/water.json` (clipped at load). It has no reservoir/river attribute, so
  the separate reservoir tint is dropped.
