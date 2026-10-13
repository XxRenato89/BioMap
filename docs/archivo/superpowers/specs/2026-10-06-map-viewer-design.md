# BioMap — Touch-screen map viewer (design)

- **Date:** 2026-10-06
- **Status:** Approved in conversation, pending written review
- **EDT package:** 1.3.5 (Iteration 3): HU-01 (explore the map) and HU-02 (thematic layers)
- **Builds on:** `2026-10-06-skeleton-db-api-design.md` (API `GET /api/layers`, `GET /api/points`)
- **Design reference:** wireframes in `../../../../Diseno_1.3.2/` (touch viewer, initial state and active layer)
- **Out of scope:** point detail panel (HU-03, Iteration 4), large-text and contrast buttons, real QR card (1.3.9), real 3D terrain (needs the 1.3.3 terrain tiles), mobile layout, admin panel

## 1. Goal

A full-screen touch viewer in `apps/web` that a visitor can use without instructions. It shows the Biobío territory with the thematic layers and points from the API, toggles layers instantly, keeps the view inside the territory, and returns to the initial view on demand or after inactivity.

Acceptance criteria (from the formulation report):

- **HU-01:** navigation without extra instructions; zoom and pan respond in under 1 s; a reset button returns the map to its initial state.
- **HU-02:** at least three thematic layers work; turning a layer on shows only its points; with every layer off, no point is visible.

## 2. Conventions

The same conventions as the backend apply: English identifiers and file names, Spanish block comments, JavaScript ESM (JSX), TDD, Prettier and ESLint. User-facing text is Spanish.

## 3. Basemap decision (temporary)

The map style URL comes from `VITE_MAP_STYLE_URL`.

- **Development default:** `https://tiles.openfreemap.org/styles/liberty` (public, free, no token). **This needs internet and therefore does NOT meet RNF-08 while it is used.**
- **Production / kiosk:** `/tiles/styles/biomap/style.json`, served by the local tile server once EDT 1.3.3 produces the MBTiles.

Switching is configuration only; no code references the online style except the default in `config.js`.

## 4. Structure (`apps/web/src/`)

| File                               | Responsibility                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.js`                        | Initial view, bounds, zoom limits, style URL, timings. Reads `import.meta.env.VITE_*` with defaults                                                             |
| `api/client.js`                    | `fetchLayers()` and `fetchPoints()`: `fetch` with `cache: 'no-cache'` (the browser revalidates with ETag); they throw on non-2xx responses                      |
| `hooks/useLayers.js`               | Loads layers and refreshes them every 60 s; holds the set of visible layer ids; `toggle(id)`, `showAll()`                                                       |
| `hooks/usePoints.js`               | Loads points; refreshes every 60 s; keeps the last good data when a refresh fails; exposes `error`                                                              |
| `hooks/useInactivity.js`           | Inactivity timer with a warning phase (see 5.4)                                                                                                                 |
| `map/MapView.jsx`                  | The ONLY module that imports `maplibre-gl`. Creates the map, renders markers, applies visibility, flies to the initial view on reset, reports style load errors |
| `map/markers.js`                   | `createMarkerElement(feature, layer)`: a `<button>` with the layer shape class, the layer letter, the layer color and an `aria-label`                           |
| `components/HeaderCard.jsx`        | Title and one-line instruction                                                                                                                                  |
| `components/LayerPanel.jsx`        | One large switch per layer (`role="switch"`, `aria-checked`)                                                                                                    |
| `components/MapControls.jsx`       | Zoom in, zoom out, 3D (pitch) toggle, «Reiniciar vista»                                                                                                         |
| `components/InactivityWarning.jsx` | Modal «¿Sigues explorando?» with a countdown and «Seguir explorando»                                                                                            |
| `components/StatusBanner.jsx`      | Discreet banner for connection or basemap errors                                                                                                                |
| `App.jsx`                          | Composes everything and owns the shared state                                                                                                                   |

`MapView` receives plain data and signals: `points` (FeatureCollection), `layers` (array), `visibleLayerIds` (Set), `resetSignal` (number that increments on each reset), `pitched` (boolean), `zoomSignal` ({ delta, n }), `onInteraction()` and `onStyleError()`.

## 5. Behavior

### 5.1 Initial view and bounds

- Center `[-71.83, -37.68]` (Angostura reservoir), zoom 11, pitch 45, bearing 0.
- `maxBounds` `[[-72.6, -38.1], [-71.2, -37.3]]` (provisional, configurable through `VITE_MAP_BOUNDS`; the exact bounds are pending with the client); `minZoom` 9, `maxZoom` 17.

### 5.2 Gestures and controls

- MapLibre defaults: drag to pan, pinch to zoom, two-finger rotate and pitch.
- `+` / `−` zoom by one level with a short animation. `3D` toggles the pitch between 45 and 0.
- Every touch target is at least 64 px.

### 5.3 Layers

- All layers are visible at start.
- Points are loaded once (`GET /api/points`, no filter) and filtered in the browser, so a toggle never waits for the network (under 1 s).
- A marker is shown only if its `layerId` is in `visibleLayerIds`. With no visible layer, no marker is shown.

### 5.4 Reset and inactivity

- «Reiniciar vista»: `flyTo` the initial view (about 800 ms), show all layers, close the warning.
- The inactivity timer runs only while the view is "dirty", that is, after a user interaction since the last reset. An idle kiosk never shows the warning.
- After 120 s without interaction (`VITE_IDLE_TIMEOUT_S`), the warning appears with a 10 s countdown (`VITE_IDLE_WARNING_S`). «Seguir explorando» closes it and restarts the timer. If the countdown ends, the view resets and the state becomes clean.
- Interactions: `pointerdown`, `wheel` and `keydown` on the window, plus map movement started by the user.

### 5.5 Refresh

- Layers and points refresh every 60 s (`VITE_REFRESH_S`). The browser revalidates with ETag, so an unchanged resource costs an empty 304. A layer that becomes inactive disappears from the panel on the next refresh; a layer that reappears comes back visible.

## 6. Errors

- **API unreachable at start:** the basemap still shows; the banner says «Sin conexión con el servidor. Reintentando…»; retry every 10 s until the data loads.
- **A periodic refresh fails:** keep the last good data, with no banner (the next refresh retries).
- **Basemap style fails to load:** banner «No se pudo cargar el mapa base».

## 7. Testing

- **Hooks** (`renderHook` + fake timers): inactivity phases (idle → warning → reset, "keep exploring", clean state does not run the timer), points refresh and keeping data on error, layer toggling and `showAll`.
- **Components** (Testing Library): switches reflect and change state; controls call their callbacks; the countdown decreases.
- **`markers.js`:** shape class per layer slug, letter, color and `aria-label`.
- **`MapView`** with `maplibre-gl` mocked (`vi.mock`): the map is created with the configured style, center, bounds and zoom limits; markers are added for visible layers and removed when a layer is hidden; `flyTo` is called when `resetSignal` changes; `onStyleError` fires on a map `error` event.
- **`App`** with `MapView` mocked: data from the mocked API reaches `MapView`; toggling a switch changes `visibleLayerIds`; reset restores every layer and increments `resetSignal`.
- **Manual verification:** run the web app against the local API and database and take a screenshot.

## 8. Dependencies

`maplibre-gl` (v5) as a runtime dependency of `apps/web`. No other new runtime dependency.

## 9. Done criteria

- All web tests pass; lint and format are clean; `vite build` succeeds.
- The viewer renders against the local API with the three layers and the sample points; toggles and reset work by hand.
- HU-01 and HU-02 acceptance criteria are met, except "without internet", which waits for EDT 1.3.3 (documented in `PENDING.md`).
