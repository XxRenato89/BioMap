# Detailed 4K Diorama — Design

**Date:** 2026-10-07
**Status:** approved in conversation, pending written-spec review
**Scope:** `apps/web` (viewer) and `apps/web/scripts/build-diorama.mjs` (offline asset build)

## 1. Goal

External feedback on the 3D viewer: the terrain reads as flat, the markers are rudimentary floating
primitives, and nothing identifies the Angostura area (reservoirs, dams, differentiated vegetation).
The kiosk is a **55" 4K touch screen** in the museum, fully offline.

Agreed direction (user, 2026-10-07):

- Keep the current **cartographic diorama look** («naturaleza clara», design canvas
  «BioMap · Diseño del visor»), but much more detailed. No satellite orthophoto.
- The model must **fit the screen**: the whole basin framed in the free area between panels, on
  4K, 1080p and phones.
- One shared camera: tapping a point flies the camera to it and opens a side sheet
  (**already implemented**, see §3).
- The kiosk hardware is unknown. Design for integrated graphics (Intel Iris Xe class) and scale
  quality up automatically when the GPU allows it.
- The user does all visual verification personally. Plans must not include agent-driven browser
  checks; agents stop at tests, lint and build.

## 2. Current state (what already works)

- Real DEM: Terrarium (SRTM) z12 sampled to a 16-bit grid of 1536 × 1109 (~80 m/cell),
  `public/diorama/terrain.bin` + `terrain.json`, built once by `build-diorama.mjs`.
- Three.js via react-three-fiber, a single canvas rendering on demand (`frameloop="demand"`),
  max anisotropic filtering, colour and object-space normal maps baked **in the browser** at load.
- OSM water polygons (`src/data/water.json`), instanced cone forest, strata sides, pedestal.
- 100 % local: Node API + static web on the kiosk PC; phones reach it through the kiosk Wi-Fi (QR).

Problems observed in the running viewer:

| Problem                                                               | Cause                                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Central valley reads as a flat green sheet                            | No hillshade/AO in the colour; one colour ramp by elevation only; ×2 exaggeration on a 123 km wide model |
| Toy-like trees in close views                                         | Cone 0.26 units tall = ~260 m at 1 unit = 1 km                                                           |
| Water floats outside the model edge                                   | OSM polygons are not clipped to the model bounds                                                         |
| Camera can end up under the terrain (trees seen from below)           | No terrain clearance check in `CameraRig`                                                                |
| Initial view crops the model (left and bottom edges) and wastes space | Fixed `initialView` range, independent of viewport and HUD                                               |
| Markers are a stem + sphere/cube/octahedron                           | Original MVP markers                                                                                     |

## 3. Done: single-camera interaction (implemented 2026-10-07)

Removed: exploration windows (`features/explorer/`), «Nueva vista 3D», window footprints, guided
tours (`features/tours/`), the fly joystick, window colours, `maxWindows` / `windowIdleMs`
(`VITE_WINDOW_IDLE_S`). Added `features/point/PointSheet.jsx`: tapping a point (or its entry in the
screen-reader list) sets `selectedPointId`, the camera flies to the point (range 6 km, pitch −32°,
current heading kept) and the sheet shows layer, name, photos, 360° and description. Closing the
sheet returns to the home view. Tests, lint, build pass.

`DioramaView` keeps drei `View` even though there is now a single view; simplifying it is out of
scope.

## 4. Design

### 4.1 Offline asset build (`build-diorama.mjs`)

The script stays the single reproducible pipeline (no manual Blender/QGIS steps). It runs once with
internet and writes everything the viewer needs into `public/diorama/`. It is split into modules
under `apps/web/scripts/diorama/` so each step is testable; pure helpers live in
`apps/web/src/diorama/` when the browser also needs them.

| Output           | Content                                                                                                                                              | Approx. size |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `terrain.bin`    | Uint16 metres, **4096 columns** × ~2958 rows (~30 m/cell, SRTM's real resolution), north→south rows. Sampled bilinearly from Terrarium **z13**       | ~24 MB       |
| `terrain.json`   | As today plus `version: 2`                                                                                                                           | —            |
| `surface.webp`   | Baked colour, 4096 wide: land-cover tint × elevation ramp × hillshade × ambient occlusion, rock on steep slopes, snow on high flat ground, riverbeds | ~6–10 MB     |
| `normal.webp`    | Object-space normals, 4096 wide, **lossless**                                                                                                        | ~15–20 MB    |
| `landcover.bin`  | Uint8 class per cell on a 2048-column grid, for tree placement                                                                                       | ~3 MB        |
| `landmarks.json` | Dams (with their OSM line), reservoirs, volcanoes/peaks, towns: `{ id, kind, name, coordinates, line? , rank }`                                      | small        |
| `water.json`     | Moved here from `src/data/`, polygons **clipped to the bounds**                                                                                      | small        |

Sources (all fetched at build time only):

- **Elevation:** Terrarium tiles, AWS Open Data (as today, z13 instead of z12).
- **Land cover:** ESA WorldCover 2021 v200, 10 m, CC BY 4.0, Cloud-Optimised GeoTIFF tiles on AWS
  Open Data (`S39W075`, `S39W072` cover the bounds), read by window with the `geotiff` package
  (HTTP range requests). Reclassified to: tree cover, shrubland, grassland, cropland, built-up,
  bare/sparse, snow/ice, water, wetland.
- **Landmarks and water:** OpenStreetMap through the Overpass API: `waterway=dam` ways named
  Angostura, Ralco and Pangue; `natural=water` + `water=reservoir|lake`; `natural=volcano|peak`
  with a name and `ele`; `place=town|village`. The build **fails loudly** if any of the three dams
  is missing inside the bounds.
- New dev dependencies: `geotiff`, `sharp` (WebP encoding). No new runtime dependency.

Baking (moved from the browser to the build):

- **Hillshade:** multi-directional (dominant light from the north-west, matching the scene's key
  light), computed on the exaggerated surface.
- **Ambient occlusion:** horizon-based sampling of the heightmap (8 directions, radius ~1.5 km),
  darkens ravines and valley bottoms.
- **Land-cover tint:** each class has a palette in the «naturaleza clara» range (native forest
  deep green, plantations bluish green, cropland straw/olive mosaic, grassland light green, built-up
  warm grey, bare/rock ochre-grey, snow white); blended with the elevation ramp so the cordillera
  keeps its rock/snow banding.

Vertical exaggeration goes from 2 to **2.5** (`VERTICAL_EXAGGERATION`, the single constant).

### 4.2 Terrain mesh with level of detail

- The 4096 grid is split into a fixed grid of chunks (target 32 × 24). Each chunk can be built at
  steps 16, 8, 4, 2, 1 (cells per vertex).
- Each frame the camera is moving, a pure function `chooseLod(chunkBounds, cameraPosition,
viewportHeight, fov, tier)` picks a step per chunk from its projected screen-space error. The
  tier caps the finest step (low: 2, medium/high: 1).
- Chunk geometries are built lazily and kept in an LRU cache with a vertex budget per tier, so
  full-resolution geometry only exists near the camera.
- Cracks between neighbouring LODs are hidden with **skirts** (a vertical strip along each chunk
  edge, 0.3 units deep), not with index stitching.
- `heightAt` keeps sampling the full-resolution Uint16 grid on the CPU.

### 4.3 Rendering performance and quality tiers

- **Adaptive DPR:** while the camera moves, the canvas renders at the tier's moving DPR. When the
  camera rests (camera-controls `rest` event), one extra frame is drawn at the still DPR. With
  on-demand rendering a still model costs nothing more, so the 4K screen gets full sharpness when
  people read it.
- **Tiers** (`apps/web/src/diorama/quality.js`):

  | Tier   | DPR moving / still | Finest LOD step | Trees  | Dynamic shadows             |
  | ------ | ------------------ | --------------- | ------ | --------------------------- |
  | low    | 1 / 1.5            | 2               | 8 000  | off                         |
  | medium | 1 / 2              | 1               | 20 000 | off                         |
  | high   | 1.5 / 2            | 1               | 40 000 | on (trees and markers only) |

- Start at **medium**. drei `PerformanceMonitor` steps down on decline and up on incline; the
  chosen tier is remembered per device in `localStorage` (wrapped in try/catch, works without it).
  `VITE_QUALITY=low|medium|high` pins a tier and disables auto-switching.
- Terrain shadows come from the baked hillshade/AO, so the dynamic 4096 shadow map on the terrain
  is removed.
- `?debug` in the URL shows a small overlay with FPS, tier, DPR and visible vertex count, so the
  user can measure on the real kiosk.

### 4.4 Framing the screen and camera safety

- `fitHomeView(model, viewport, freeRect, fov, heading, pitch)` (pure, in `cameraMath.js`) returns
  the `range` at which the 8 corners of the model's bounding box (including the pedestal) project
  inside `freeRect`, solved by bisection on the distance. `freeRect` is the viewport minus the HUD
  panels (`[data-obstacle]` rects, already used elsewhere). Heading and pitch stay those of
  `config.initialView`.
- The home view is recomputed on resize and when the HUD changes size (text scale), and is what
  «Reiniciar vista», closing the sheet and inactivity reset return to.
- The «Región» zoom level uses the fitted range instead of the fixed 125 km.
- **Terrain clearance:** after every camera update, if the camera is less than 0.25 units above
  `heightAt(camera.x, camera.z)`, it is lifted by reducing the polar angle around the target.
- **Exhibition table background:** a soft radial gradient behind the canvas (CSS, theme tokens) and
  a blurred contact shadow under the pedestal (drei `ContactShadows`, baked once, `frames={1}`),
  replacing the flat near-black.

### 4.5 Vegetation

- Trees at diorama scale: ~60 m tall (0.06 units before exaggeration), ~4× smaller than today.
- Placement only where `landcover.bin` says tree cover (or sparse shrub, at lower density), never on
  water, built-up or steep slopes.
- Two instanced meshes: **native forest** (low-poly rounded crown + trunk, varied greens) and
  **plantation** (narrow cone, regular rows aligned to the slope, uniform bluish green).
  WorldCover does not separate plantations from native forest, so tree-cover cells use a rule:
  plantation below 900 m on slopes gentler than 20°, native forest elsewhere.
- Tree count comes from the quality tier.

### 4.6 Angostura landmarks

- **Dams** (Angostura, Ralco, Pangue): procedural concrete walls built from each OSM dam line. The
  wall follows the line, its crest is the highest terrain height at the two ends, its base the
  lowest terrain point under the line, thickness 0.08 units, light concrete material, with a
  slightly darker downstream face. Pure geometry builder `buildDamWall(line, heightAt)`.
- **Reservoirs** get a slightly deeper, calmer water tint than rivers (polygon attribute from OSM).
- **Labels:** drei `Html` labels in the cartographic style of the design (display font, white halo,
  no box) for reservoirs, volcanoes, dams and towns.
  - Visibility by zoom level: «Región» → volcanoes, reservoirs, dams; «Zona» → plus towns;
    «Detalle» → everything within view.
  - **Decluttering:** when the camera rests, a pure function `declutter(labels)` takes each
    label's screen rect and `rank` and hides lower-ranked labels that overlap higher-ranked ones.
    No per-frame work.

### 4.7 Point-of-interest markers

Replace stem + 3D primitive with:

- A floating **label pill** (drei `Html`): layer icon/shape and colour + point name, ≥ 64 px touch
  target, the whole pill is the tap target.
- A thin **leader line** from the pill to the ground.
- A **ground ring** lying on the terrain in the layer colour.
- Selected point: bigger pill, filled ring, and a pulse for 3 s after selection (the only
  continuous animation, so on-demand rendering is preserved the rest of the time).
- Constant screen size within limits, as today.
- Points share the label decluttering with landmarks, with a higher rank than any landmark.

### 4.8 Attribution

`attribution` text adds ESA WorldCover and OpenStreetMap contributors for landmarks, e.g.
«Relieve: SRTM (Mapzen Terrain Tiles) · Cobertura: ESA WorldCover 2021 · Agua e hitos: ©
OpenStreetMap».

## 5. Error handling

- Build script: any failed download retries 3 times and then aborts without overwriting the
  existing `public/diorama/` files (write to a temp folder, then move).
- Viewer: if `landmarks.json` or `landcover.bin` fails to load, the diorama renders without
  landmarks or trees; if `terrain.bin` / `surface.webp` fail, the existing Suspense fallback and
  offline status apply.
- A model built with the old format (`terrain.json` without `version: 2`) is rejected with a
  console error telling the developer to rerun the build script.

## 6. Testing

Unit tests (Vitest) for every pure function: `fitHomeView`, `chooseLod`, tier stepping and
`VITE_QUALITY` parsing, `declutter`, `clipPolygonToBounds`, `buildDamWall`, land-cover
reclassification and palette, hillshade and AO on small synthetic grids, skirt generation, and the
Overpass response parser. Component tests for the new marker pill (accessible name, tap) and the
debug overlay. Existing tests keep passing; lint, prettier and `vite build` pass.

No agent-driven visual verification: the user checks the result in the browser and on the kiosk.

## 7. Out of scope

Satellite imagery, Electron packaging (Chrome `--kiosk` against the local server is enough and
keeps the QR/phone flow), GLB/Draco meshes, GSAP, Tailwind, multi-view/drei `View` removal.

## 8. Pending from the client

- Kiosk hardware (CPU, GPU, RAM) and the screen's real resolution and Windows scaling — decides
  the default tier. Tracked in `PENDING.md`.
