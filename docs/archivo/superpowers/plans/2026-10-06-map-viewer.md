# Touch-screen Map Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the web skeleton with a full-screen touch viewer: MapLibre map of the Biobío territory, thematic layer switches, markers from the API, zoom/3D/reset controls and an inactivity reset (HU-01, HU-02).

**Architecture:** Only `map/MapView.jsx` imports `maplibre-gl`; it receives plain data and numeric "signals" (reset, zoom) as props. State lives in small hooks (`usePolling`, `useLayers`, `usePoints`, `useInactivity`) that are tested with fake timers and no WebGL. `App.jsx` composes hooks and presentational components.

**Tech Stack:** React 19, Vite 7, MapLibre GL JS 5, Vitest 3 + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-06-map-viewer-design.md`

## Global Constraints

- **Do NOT run `git commit`** (the user has not configured an author identity). Each "Checkpoint" step runs `git status` only.
- English identifiers and file names; Spanish block comments (`/** */`, `/* */`) above code, never trailing `//`; user-facing text in Spanish.
- JavaScript ESM + JSX, no TypeScript.
- Only `apps/web/src/map/MapView.jsx` may import `maplibre-gl`.
- Default style URL: `https://tiles.openfreemap.org/styles/liberty` (temporary, online; does NOT meet RNF-08). Production uses `/tiles/styles/biomap/style.json`.
- Initial view: center `[-71.83, -37.68]`, zoom 11, pitch 45, bearing 0. `maxBounds` `[[-72.6, -38.1], [-71.2, -37.3]]`; `minZoom` 9; `maxZoom` 17.
- Timings: idle 120 s, warning 10 s, refresh 60 s, retry 10 s. Env overrides: `VITE_MAP_STYLE_URL`, `VITE_MAP_BOUNDS` (`west,south,east,north`), `VITE_IDLE_TIMEOUT_S`, `VITE_IDLE_WARNING_S`, `VITE_REFRESH_S`.
- Touch targets ≥ 64 px. Banner texts: «Sin conexión con el servidor. Reintentando…» and «No se pudo cargar el mapa base».
- Run web tests with `npm test -w apps/web`.

## Review Focus

1. **A point whose layer is not in the layer list** (inactive or deleted layer): no marker and no crash. → Task 6.
2. **API down at start, then it recovers:** the banner disappears and the data appears without a reload. → Task 2.
3. **A flood of interactions** (wheel events, fast taps): no re-render or timer storm; the idle countdown restarts from the last interaction. → Task 3.
4. **An idle kiosk that nobody touches:** it never shows the inactivity warning. → Task 3.
5. **«Reiniciar vista» pressed while the warning is open:** the warning closes and every layer turns back on. → Task 7.

> Plan note vs spec §4: the spec lists an `onInteraction()` prop on `MapView`. It is not needed: every map gesture is a `pointerdown`/`wheel` that bubbles to `window`, where `App` already listens. The plan omits the prop.

---

### Task 1: MapLibre dependency, configuration and API client

**Files:**

- Modify: `apps/web/package.json` (dependency `maplibre-gl`)
- Create: `apps/web/src/config.js`, `apps/web/src/api/client.js`
- Test: `apps/web/src/config.test.js`, `apps/web/src/api/client.test.js`

**Interfaces:**

- Produces: `buildConfig(env) => { styleUrl, initialView: { center, zoom, pitch, bearing }, maxBounds, minZoom, maxZoom, idleTimeoutMs, idleWarningMs, refreshMs, retryMs }`; `config` (built from `import.meta.env`); `fetchLayers(fetchImpl?) => Promise<Layer[]>`; `fetchPoints(fetchImpl?) => Promise<FeatureCollection>` (both throw `Error('GET <path> failed with <status>')` on non-2xx).

- [ ] **Step 1: Install MapLibre**

Run: `npm install -w apps/web --save maplibre-gl@5`
Expected: `maplibre-gl` appears under `dependencies` of `apps/web/package.json`.

- [ ] **Step 2: Write the failing tests**

`apps/web/src/config.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { buildConfig } from './config.js';

describe('buildConfig', () => {
  it('uses the documented defaults', () => {
    expect(buildConfig({})).toEqual({
      styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
      initialView: { center: [-71.83, -37.68], zoom: 11, pitch: 45, bearing: 0 },
      maxBounds: [
        [-72.6, -38.1],
        [-71.2, -37.3],
      ],
      minZoom: 9,
      maxZoom: 17,
      idleTimeoutMs: 120_000,
      idleWarningMs: 10_000,
      refreshMs: 60_000,
      retryMs: 10_000,
    });
  });

  it('reads overrides from the environment', () => {
    const config = buildConfig({
      VITE_MAP_STYLE_URL: '/tiles/styles/biomap/style.json',
      VITE_MAP_BOUNDS: '-73,-39,-71,-37',
      VITE_IDLE_TIMEOUT_S: '30',
      VITE_IDLE_WARNING_S: '5',
      VITE_REFRESH_S: '15',
    });
    expect(config.styleUrl).toBe('/tiles/styles/biomap/style.json');
    expect(config.maxBounds).toEqual([
      [-73, -39],
      [-71, -37],
    ]);
    expect(config.idleTimeoutMs).toBe(30_000);
    expect(config.idleWarningMs).toBe(5_000);
    expect(config.refreshMs).toBe(15_000);
  });

  it('ignores malformed numbers and bounds', () => {
    const config = buildConfig({ VITE_MAP_BOUNDS: '1,2,3', VITE_IDLE_TIMEOUT_S: 'abc' });
    expect(config.maxBounds).toEqual([
      [-72.6, -38.1],
      [-71.2, -37.3],
    ]);
    expect(config.idleTimeoutMs).toBe(120_000);
  });
});
```

`apps/web/src/api/client.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';
import { fetchLayers, fetchPoints } from './client.js';

/**
 * fetch falso que responde con el estado y el cuerpo indicados.
 */
function fakeFetch(status, body) {
  return vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));
}

describe('api client', () => {
  it('fetchLayers requests /api/layers with revalidation and returns the JSON', async () => {
    const fetchImpl = fakeFetch(200, [{ id: 1 }]);
    expect(await fetchLayers(fetchImpl)).toEqual([{ id: 1 }]);
    expect(fetchImpl).toHaveBeenCalledWith('/api/layers', {
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
  });

  it('fetchPoints requests /api/points', async () => {
    const fetchImpl = fakeFetch(200, { type: 'FeatureCollection', features: [] });
    expect(await fetchPoints(fetchImpl)).toEqual({ type: 'FeatureCollection', features: [] });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/points');
  });

  it('throws on a non-2xx response', async () => {
    await expect(fetchLayers(fakeFetch(503, {}))).rejects.toThrow(
      'GET /api/layers failed with 503',
    );
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npm test -w apps/web`
Expected: FAIL — `./config.js` and `./client.js` cannot be resolved.

- [ ] **Step 4: Implement**

`apps/web/src/config.js`:

```js
/**
 * Valores por defecto del visor. Los límites del territorio son provisionales
 * (pendientes con el cliente) y el estilo en línea es temporal hasta tener los
 * tiles locales del paquete 1.3.3; ambos se pueden cambiar por variables VITE_*.
 */
const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_BOUNDS = [
  [-72.6, -38.1],
  [-71.2, -37.3],
];

/**
 * Convierte un texto en número; si falta o no es válido, usa el valor por defecto.
 */
function toNumber(value, fallback) {
  const number = Number(value);
  return value === undefined || value === '' || Number.isNaN(number) ? fallback : number;
}

/**
 * Lee límites con el formato "oeste,sur,este,norte"; si el formato no es válido, devuelve null.
 */
function toBounds(value) {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null;
  const [west, south, east, north] = parts;
  return [
    [west, south],
    [east, north],
  ];
}

/**
 * Construye la configuración del visor a partir de las variables de entorno.
 *
 * @param {Record<string, string | undefined>} env
 */
export function buildConfig(env) {
  return {
    styleUrl: env.VITE_MAP_STYLE_URL || DEFAULT_STYLE_URL,
    initialView: { center: [-71.83, -37.68], zoom: 11, pitch: 45, bearing: 0 },
    maxBounds: toBounds(env.VITE_MAP_BOUNDS) ?? DEFAULT_BOUNDS,
    minZoom: 9,
    maxZoom: 17,
    idleTimeoutMs: toNumber(env.VITE_IDLE_TIMEOUT_S, 120) * 1000,
    idleWarningMs: toNumber(env.VITE_IDLE_WARNING_S, 10) * 1000,
    refreshMs: toNumber(env.VITE_REFRESH_S, 60) * 1000,
    retryMs: 10_000,
  };
}

export const config = buildConfig(import.meta.env);
```

`apps/web/src/api/client.js`:

```js
/**
 * Pide un recurso JSON a la API. `cache: 'no-cache'` obliga al navegador a
 * revalidar con el ETag: si nada cambió, recibe un 304 vacío y reutiliza su copia.
 */
async function getJson(path, fetchImpl) {
  const response = await fetchImpl(path, {
    cache: 'no-cache',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`GET ${path} failed with ${response.status}`);
  return response.json();
}

/**
 * Capas temáticas activas.
 */
export function fetchLayers(fetchImpl = fetch) {
  return getJson('/api/layers', fetchImpl);
}

/**
 * Todos los puntos visibles como GeoJSON FeatureCollection.
 */
export function fetchPoints(fetchImpl = fetch) {
  return getJson('/api/points', fetchImpl);
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -w apps/web` → Expected: config (3) and client (3) pass; the old `App.test.jsx` still passes.

- [ ] **Step 6: Checkpoint (no commit)** — `git status`.

---

### Task 2: Polling, layers and points hooks

**Files:**

- Create: `apps/web/src/hooks/usePolling.js`, `apps/web/src/hooks/useLayers.js`, `apps/web/src/hooks/usePoints.js`
- Test: `apps/web/src/hooks/usePolling.test.js`, `apps/web/src/hooks/useLayers.test.js`

**Interfaces:**

- Consumes: a loader `() => Promise<T>` (Task 1's `fetchLayers` / `fetchPoints`).
- Produces:
  - `usePolling(loader, { intervalMs, retryMs }) => { data: T | null, error: Error | null }`. It loads immediately. On success it schedules the next load after `intervalMs`. On failure with no data it sets `error` and retries after `retryMs`; on failure with data it keeps the data, leaves `error` null and retries after `intervalMs`.
  - `useLayers(loader, options) => { layers: Layer[], visibleLayerIds: Set<number>, toggle(id), showAll(), error }`. Layers seen for the first time (including ones that reappear) become visible.
  - `usePoints(loader, options) => { points: FeatureCollection, error }` (an empty FeatureCollection while loading).

- [ ] **Step 1: Write the failing tests**

`apps/web/src/hooks/usePolling.test.js`:

```js
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './usePolling.js';

const OPTIONS = { intervalMs: 60_000, retryMs: 10_000 };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * Deja correr las promesas pendientes sin avanzar el reloj.
 */
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));

describe('usePolling', () => {
  it('loads immediately and refreshes after the interval', async () => {
    const loader = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
    const { result } = renderHook(() => usePolling(loader, OPTIONS));
    await flush();
    expect(result.current).toEqual({ data: 'a', error: null });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(result.current.data).toBe('b');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('reports the error and retries fast while there is no data, then recovers', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('ok');
    const { result } = renderHook(() => usePolling(loader, OPTIONS));
    await flush();
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(result.current).toEqual({ data: 'ok', error: null });
  });

  it('keeps the last good data and hides the error when a refresh fails', async () => {
    const loader = vi.fn().mockResolvedValueOnce('a').mockRejectedValueOnce(new Error('down'));
    const { result } = renderHook(() => usePolling(loader, OPTIONS));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(result.current).toEqual({ data: 'a', error: null });
  });

  it('stops polling after unmount', async () => {
    const loader = vi.fn().mockResolvedValue('a');
    const { unmount } = renderHook(() => usePolling(loader, OPTIONS));
    await flush();
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(180_000));
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
```

`apps/web/src/hooks/useLayers.test.js`:

```js
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayers } from './useLayers.js';

const OPTIONS = { intervalMs: 60_000, retryMs: 10_000 };
const HISTORY = { id: 1, slug: 'history', name: 'Historia', color: '#b45309' };
const TOURISM = { id: 3, slug: 'tourism', name: 'Turismo', color: '#1d4ed8' };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const flush = () => act(() => vi.advanceTimersByTimeAsync(0));

describe('useLayers', () => {
  it('shows every layer at start', async () => {
    const { result } = renderHook(() => useLayers(async () => [HISTORY, TOURISM], OPTIONS));
    await flush();
    expect(result.current.layers).toEqual([HISTORY, TOURISM]);
    expect([...result.current.visibleLayerIds]).toEqual([1, 3]);
  });

  it('toggles a layer off and on', async () => {
    const { result } = renderHook(() => useLayers(async () => [HISTORY, TOURISM], OPTIONS));
    await flush();
    act(() => result.current.toggle(1));
    expect([...result.current.visibleLayerIds]).toEqual([3]);
    act(() => result.current.toggle(1));
    expect(result.current.visibleLayerIds.has(1)).toBe(true);
  });

  it('showAll turns every layer back on', async () => {
    const { result } = renderHook(() => useLayers(async () => [HISTORY, TOURISM], OPTIONS));
    await flush();
    act(() => result.current.toggle(1));
    act(() => result.current.toggle(3));
    expect(result.current.visibleLayerIds.size).toBe(0);
    act(() => result.current.showAll());
    expect([...result.current.visibleLayerIds].sort()).toEqual([1, 3]);
  });

  it('makes a layer visible again when it reappears after a refresh', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce([HISTORY, TOURISM])
      .mockResolvedValueOnce([HISTORY])
      .mockResolvedValueOnce([HISTORY, TOURISM]);
    const { result } = renderHook(() => useLayers(loader, OPTIONS));
    await flush();
    act(() => result.current.toggle(3));
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(result.current.layers).toEqual([HISTORY]);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(result.current.visibleLayerIds.has(3)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w apps/web` → Expected: FAIL — hook modules not found.

- [ ] **Step 3: Implement**

`apps/web/src/hooks/usePolling.js`:

```js
import { useEffect, useRef, useState } from 'react';

/**
 * Carga un recurso al montar y lo vuelve a pedir periódicamente.
 * Si todavía no hay datos y la carga falla, informa el error y reintenta pronto.
 * Si ya hay datos y una actualización falla, conserva los datos sin mostrar error.
 *
 * @template T
 * @param {() => Promise<T>} loader
 * @param {{ intervalMs: number, retryMs: number }} options
 * @returns {{ data: T | null, error: Error | null }}
 */
export function usePolling(loader, { intervalMs, retryMs }) {
  const [state, setState] = useState({ data: null, error: null });
  const hasData = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function load() {
      try {
        const data = await loader();
        if (cancelled) return;
        hasData.current = true;
        setState({ data, error: null });
        timer = setTimeout(load, intervalMs);
      } catch (error) {
        if (cancelled) return;
        if (hasData.current) {
          timer = setTimeout(load, intervalMs);
        } else {
          setState({ data: null, error });
          timer = setTimeout(load, retryMs);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loader, intervalMs, retryMs]);

  return state;
}
```

`apps/web/src/hooks/useLayers.js`:

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePolling } from './usePolling.js';

const NO_LAYERS = [];

/**
 * Capas temáticas y cuáles están encendidas.
 * Toda capa que aparece por primera vez (o que vuelve tras haber desaparecido)
 * queda encendida, para que el visitante siempre vea el contenido disponible.
 *
 * @param {() => Promise<Array<{ id: number }>>} loader
 * @param {{ intervalMs: number, retryMs: number }} options
 */
export function useLayers(loader, options) {
  const { data, error } = usePolling(loader, options);
  const layers = data ?? NO_LAYERS;
  const [visibleLayerIds, setVisibleLayerIds] = useState(() => new Set());
  const knownIds = useRef(new Set());

  useEffect(() => {
    const currentIds = new Set(layers.map((layer) => layer.id));
    const newIds = [...currentIds].filter((id) => !knownIds.current.has(id));
    knownIds.current = currentIds;
    if (newIds.length > 0) {
      setVisibleLayerIds((previous) => new Set([...previous, ...newIds]));
    }
  }, [layers]);

  const toggle = useCallback((id) => {
    setVisibleLayerIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setVisibleLayerIds(new Set(knownIds.current));
  }, []);

  return { layers, visibleLayerIds, toggle, showAll, error };
}
```

`apps/web/src/hooks/usePoints.js`:

```js
import { usePolling } from './usePolling.js';

const EMPTY = { type: 'FeatureCollection', features: [] };

/**
 * Puntos de interés como FeatureCollection, actualizados periódicamente.
 * Mientras no haya datos devuelve una colección vacía.
 *
 * @param {() => Promise<object>} loader
 * @param {{ intervalMs: number, retryMs: number }} options
 */
export function usePoints(loader, options) {
  const { data, error } = usePolling(loader, options);
  return { points: data ?? EMPTY, error };
}
```

- [ ] **Step 4: Run the tests** — `npm test -w apps/web` → Expected: usePolling (4) and useLayers (4) pass.

- [ ] **Step 5: Checkpoint (no commit)** — `git status`.

---

### Task 3: Inactivity hook

**Files:**

- Create: `apps/web/src/hooks/useInactivity.js`
- Test: `apps/web/src/hooks/useInactivity.test.js`

**Interfaces:**

- Produces: `useInactivity({ timeoutMs, warningMs, onReset }) => { phase: 'clean' | 'active' | 'warning', secondsLeft: number, markActive(), markClean() }`. `markActive` records the time in a ref and only changes state when leaving `clean` or `warning` (no re-render per event). When the countdown ends it calls `onReset()` once and returns to `clean`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/hooks/useInactivity.test.js`:

```js
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInactivity } from './useInactivity.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * Monta el hook con 120 s de inactividad y 10 s de aviso.
 */
function setup() {
  const onReset = vi.fn();
  const hook = renderHook(() => useInactivity({ timeoutMs: 120_000, warningMs: 10_000, onReset }));
  return { ...hook, onReset };
}

const advance = (ms) => act(() => vi.advanceTimersByTime(ms));

describe('useInactivity', () => {
  it('never warns while nobody has touched the screen', () => {
    const { result, onReset } = setup();
    advance(600_000);
    expect(result.current.phase).toBe('clean');
    expect(onReset).not.toHaveBeenCalled();
  });

  it('shows the warning 120 s after the last interaction', () => {
    const { result } = setup();
    act(() => result.current.markActive());
    advance(119_000);
    expect(result.current.phase).toBe('active');
    advance(1_000);
    expect(result.current.phase).toBe('warning');
    expect(result.current.secondsLeft).toBe(10);
  });

  it('counts down and resets when the warning ends', () => {
    const { result, onReset } = setup();
    act(() => result.current.markActive());
    advance(120_000);
    advance(3_000);
    expect(result.current.secondsLeft).toBe(7);
    advance(7_000);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('clean');
  });

  it('keeps exploring when there is an interaction during the warning', () => {
    const { result, onReset } = setup();
    act(() => result.current.markActive());
    advance(120_000);
    act(() => result.current.markActive());
    expect(result.current.phase).toBe('active');
    advance(30_000);
    expect(onReset).not.toHaveBeenCalled();
  });

  it('counts from the last interaction, without re-rendering on every event', () => {
    let renders = 0;
    const onReset = vi.fn();
    const { result } = renderHook(() => {
      renders += 1;
      return useInactivity({ timeoutMs: 120_000, warningMs: 10_000, onReset });
    });
    act(() => result.current.markActive());
    const rendersAfterFirst = renders;
    advance(100_000);
    for (let i = 0; i < 50; i += 1) act(() => result.current.markActive());
    expect(renders - rendersAfterFirst).toBeLessThanOrEqual(1);
    advance(100_000);
    expect(result.current.phase).toBe('active');
    advance(20_000);
    expect(result.current.phase).toBe('warning');
  });

  it('markClean stops the timer', () => {
    const { result, onReset } = setup();
    act(() => result.current.markActive());
    act(() => result.current.markClean());
    advance(300_000);
    expect(result.current.phase).toBe('clean');
    expect(onReset).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — `npm test -w apps/web` → Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`apps/web/src/hooks/useInactivity.js`:

```js
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Control de inactividad del kiosco.
 * - "clean": nadie tocó la pantalla desde el último reinicio; no corre ningún contador.
 * - "active": hubo interacción; si pasan `timeoutMs` sin otra, se muestra el aviso.
 * - "warning": cuenta regresiva de `warningMs`; al terminar se llama a `onReset`.
 * La hora de la última interacción se guarda en una referencia para no
 * provocar un render por cada evento (rueda del mouse, toques repetidos).
 *
 * @param {{ timeoutMs: number, warningMs: number, onReset: () => void }} options
 */
export function useInactivity({ timeoutMs, warningMs, onReset }) {
  const totalSeconds = Math.ceil(warningMs / 1000);
  const [phase, setPhase] = useState('clean');
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const lastActivity = useRef(0);
  const onResetRef = useRef(onReset);

  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  /*
   * Fase activa: revisa si pasó el tiempo desde la última interacción;
   * si no, vuelve a programarse por el tiempo que falta.
   */
  useEffect(() => {
    if (phase !== 'active') return undefined;
    let timer;
    const check = () => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= timeoutMs) setPhase('warning');
      else timer = setTimeout(check, timeoutMs - idle);
    };
    timer = setTimeout(check, timeoutMs);
    return () => clearTimeout(timer);
  }, [phase, timeoutMs]);

  /*
   * Fase de aviso: cuenta regresiva de un segundo en un segundo.
   */
  useEffect(() => {
    if (phase !== 'warning') return undefined;
    let left = totalSeconds;
    setSecondsLeft(left);
    const interval = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(interval);
        setPhase('clean');
        onResetRef.current();
      } else {
        setSecondsLeft(left);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, totalSeconds]);

  const markActive = useCallback(() => {
    lastActivity.current = Date.now();
    setPhase((current) => (current === 'active' ? current : 'active'));
  }, []);

  const markClean = useCallback(() => setPhase('clean'), []);

  return { phase, secondsLeft, markActive, markClean };
}
```

- [ ] **Step 4: Run the tests** — `npm test -w apps/web` → Expected: useInactivity (6) pass.

- [ ] **Step 5: Checkpoint (no commit)** — `git status`.

---

### Task 4: Marker elements and global styles

**Files:**

- Create: `apps/web/src/map/markers.js`, `apps/web/src/styles.css`
- Test: `apps/web/src/map/markers.test.js`

**Interfaces:**

- Produces: `createMarkerElement(feature, layer) => HTMLButtonElement` with class `marker marker--<circle|square|diamond>` (history → circle, ecology → square, tourism → diamond, otherwise circle), the CSS variable `--layer-color`, `aria-label` `"<name> (<layer name>)"` and a child `.marker__letter` holding the first letter of the layer name in upper case.

- [ ] **Step 1: Write the failing test**

`apps/web/src/map/markers.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { createMarkerElement } from './markers.js';

const feature = { properties: { id: 7, name: 'Mirador del embalse' } };

describe('createMarkerElement', () => {
  it.each([
    ['history', 'Historia', 'marker--circle', 'H'],
    ['ecology', 'Ecología y Biodiversidad', 'marker--square', 'E'],
    ['tourism', 'Turismo', 'marker--diamond', 'T'],
    ['energy', 'energía', 'marker--circle', 'E'],
  ])('renders the %s layer shape and letter', (slug, name, shapeClass, letter) => {
    const el = createMarkerElement(feature, { id: 1, slug, name, color: '#1d4ed8' });
    expect(el.tagName).toBe('BUTTON');
    expect(el.classList.contains('marker')).toBe(true);
    expect(el.classList.contains(shapeClass)).toBe(true);
    expect(el.querySelector('.marker__letter').textContent).toBe(letter);
  });

  it('sets the layer color and an accessible label', () => {
    const el = createMarkerElement(feature, {
      id: 3,
      slug: 'tourism',
      name: 'Turismo',
      color: '#1d4ed8',
    });
    expect(el.style.getPropertyValue('--layer-color')).toBe('#1d4ed8');
    expect(el.getAttribute('aria-label')).toBe('Mirador del embalse (Turismo)');
    expect(el.type).toBe('button');
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`apps/web/src/map/markers.js`:

```js
/**
 * Forma de cada capa, para no depender solo del color (WCAG 1.4.1):
 * Historia círculo, Ecología cuadrado, Turismo rombo.
 */
const SHAPES = { history: 'circle', ecology: 'square', tourism: 'diamond' };

/**
 * Crea el elemento HTML de un marcador: un botón con la forma, el color y la
 * inicial de su capa, y una etiqueta accesible con el nombre del punto.
 *
 * @param {{ properties: { name: string } }} feature
 * @param {{ slug: string, name: string, color: string }} layer
 * @returns {HTMLButtonElement}
 */
export function createMarkerElement(feature, layer) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `marker marker--${SHAPES[layer.slug] ?? 'circle'}`;
  element.style.setProperty('--layer-color', layer.color);
  element.setAttribute('aria-label', `${feature.properties.name} (${layer.name})`);

  const letter = document.createElement('span');
  letter.className = 'marker__letter';
  letter.textContent = layer.name.charAt(0).toUpperCase();
  element.append(letter);
  return element;
}
```

`apps/web/src/styles.css`:

```css
/*
 * Estilos del visor táctil. Tamaños pensados para una pantalla de 55–65"
 * usada de pie: objetivos táctiles de al menos 64 px y texto grande.
 */
:root {
  --ink: #1f2933;
  --muted: #52606d;
  --card: #ffffff;
  --border: #3e4c59;
  --accent: #1f3a5f;
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: var(--ink);
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  height: 100%;
  overflow: hidden;
}

.viewer {
  position: relative;
  width: 100%;
  height: 100%;
}

.map {
  position: absolute;
  inset: 0;
}

.card {
  position: absolute;
  background: var(--card);
  border: 2px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}

.header-card {
  left: 24px;
  top: 24px;
  padding: 16px 24px;
  max-width: 560px;
}

.header-card h1 {
  margin: 0;
  font-size: 28px;
}

.header-card p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 18px;
}

.layer-panel {
  left: 24px;
  top: 150px;
  width: 360px;
  overflow: hidden;
}

.layer-panel h2 {
  margin: 0;
  padding: 16px 18px;
  font-size: 22px;
  border-bottom: 2px solid var(--border);
}

.layer-switch {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 76px;
  padding: 0 18px;
  border: 0;
  border-bottom: 1px solid #cbd2d9;
  background: none;
  font-size: 20px;
  text-align: left;
  cursor: pointer;
}

.layer-switch__track {
  margin-left: auto;
  width: 64px;
  height: 34px;
  border-radius: 17px;
  border: 2px solid var(--border);
  background: #e4e7eb;
  position: relative;
  flex: none;
}

.layer-switch__track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #9aa5b1;
  transition: left 0.15s;
}

.layer-switch[aria-checked='true'] .layer-switch__track {
  background: var(--layer-color, var(--accent));
}

.layer-switch[aria-checked='true'] .layer-switch__track::after {
  left: 33px;
  background: #ffffff;
}

.controls {
  position: absolute;
  right: 24px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.control-button {
  min-width: 72px;
  min-height: 72px;
  padding: 0 18px;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  font-size: 22px;
  font-weight: 600;
  cursor: pointer;
}

.control-button--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}

.control-button[aria-pressed='true'] {
  background: #d9e2ec;
}

.marker {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 3px solid #ffffff;
  background: var(--layer-color, var(--accent));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.marker::before {
  content: '';
  position: absolute;
  inset: -12px;
}

.marker--circle {
  border-radius: 50%;
}

.marker--square {
  border-radius: 6px;
}

.marker--diamond {
  transform: rotate(45deg);
  border-radius: 4px;
}

.marker__letter {
  color: #ffffff;
  font-weight: 700;
  font-size: 18px;
}

.marker--diamond .marker__letter {
  transform: rotate(-45deg);
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(31, 41, 51, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.warning-card {
  position: relative;
  width: min(720px, 90%);
  padding: 40px;
  text-align: center;
}

.warning-card h2 {
  margin: 0;
  font-size: 38px;
}

.warning-card p {
  font-size: 22px;
  color: var(--muted);
}

.status-banner {
  position: absolute;
  left: 50%;
  top: 24px;
  transform: translateX(-50%);
  padding: 12px 20px;
  border-radius: 10px;
  background: #fff3c4;
  border: 2px solid #c99a2e;
  font-size: 18px;
  z-index: 5;
}
```

- [ ] **Step 4: Run the tests** — Expected: markers (5) pass.

- [ ] **Step 5: Checkpoint (no commit)** — `git status`.

---

### Task 5: Presentational components

**Files:**

- Create: `apps/web/src/components/HeaderCard.jsx`, `LayerPanel.jsx`, `MapControls.jsx`, `InactivityWarning.jsx`, `StatusBanner.jsx`
- Test: `apps/web/src/components/components.test.jsx`

**Interfaces:**

- Produces:
  - `HeaderCard()`
  - `LayerPanel({ layers, visibleLayerIds, onToggle(id) })`: one `role="switch"` button per layer, with `aria-checked`
  - `MapControls({ onZoomIn, onZoomOut, pitched, onTogglePitch, onReset })`: buttons labelled «Acercar», «Alejar», «3D» (`aria-pressed`) and «Reiniciar vista»
  - `InactivityWarning({ secondsLeft, onKeepExploring })`: `role="alertdialog"`
  - `StatusBanner({ messages })`: renders nothing when `messages` is empty

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/components.test.jsx`:

```jsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InactivityWarning from './InactivityWarning.jsx';
import LayerPanel from './LayerPanel.jsx';
import MapControls from './MapControls.jsx';
import StatusBanner from './StatusBanner.jsx';

afterEach(cleanup);

const LAYERS = [
  { id: 1, slug: 'history', name: 'Historia', color: '#b45309' },
  { id: 3, slug: 'tourism', name: 'Turismo', color: '#1d4ed8' },
];

describe('LayerPanel', () => {
  it('reflects which layers are visible and toggles on tap', () => {
    const onToggle = vi.fn();
    render(<LayerPanel layers={LAYERS} visibleLayerIds={new Set([3])} onToggle={onToggle} />);
    const history = screen.getByRole('switch', { name: /Historia/ });
    const tourism = screen.getByRole('switch', { name: /Turismo/ });
    expect(history.getAttribute('aria-checked')).toBe('false');
    expect(tourism.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(history);
    expect(onToggle).toHaveBeenCalledWith(1);
  });
});

describe('MapControls', () => {
  it('calls each control callback', () => {
    const props = {
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onTogglePitch: vi.fn(),
      onReset: vi.fn(),
    };
    render(<MapControls pitched {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alejar' }));
    fireEvent.click(screen.getByRole('button', { name: '3D' }));
    fireEvent.click(screen.getByRole('button', { name: /Reiniciar vista/ }));
    expect(props.onZoomIn).toHaveBeenCalledTimes(1);
    expect(props.onZoomOut).toHaveBeenCalledTimes(1);
    expect(props.onTogglePitch).toHaveBeenCalledTimes(1);
    expect(props.onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('InactivityWarning', () => {
  it('shows the countdown and keeps exploring', () => {
    const onKeepExploring = vi.fn();
    render(<InactivityWarning secondsLeft={7} onKeepExploring={onKeepExploring} />);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText(/7 segundos/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir explorando' }));
    expect(onKeepExploring).toHaveBeenCalledTimes(1);
  });
});

describe('StatusBanner', () => {
  it('renders nothing without messages', () => {
    const { container } = render(<StatusBanner messages={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows every message', () => {
    render(<StatusBanner messages={['Uno', 'Dos']} />);
    expect(screen.getByRole('status').textContent).toBe('Uno · Dos');
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — Expected: FAIL, components not found.

- [ ] **Step 3: Implement**

`apps/web/src/components/HeaderCard.jsx`:

```jsx
/**
 * Título del visor e instrucción breve para el visitante.
 */
export default function HeaderCard() {
  return (
    <header className="card header-card">
      <h1>BioMap · Mapa Vivo del Bío Bío</h1>
      <p>Explora el territorio: mueve el mapa con un dedo y acerca con dos.</p>
    </header>
  );
}
```

`apps/web/src/components/LayerPanel.jsx`:

```jsx
/**
 * Panel de capas temáticas: un interruptor grande por capa.
 * Usa role="switch" y aria-checked para que los lectores de pantalla
 * anuncien si la capa está encendida.
 *
 * @param {{ layers: Array<{ id: number, name: string, color: string }>,
 *   visibleLayerIds: Set<number>, onToggle: (id: number) => void }} props
 */
export default function LayerPanel({ layers, visibleLayerIds, onToggle }) {
  return (
    <nav className="card layer-panel" aria-label="Capas temáticas">
      <h2>Capas temáticas</h2>
      {layers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          role="switch"
          aria-checked={visibleLayerIds.has(layer.id)}
          className="layer-switch"
          style={{ '--layer-color': layer.color }}
          onClick={() => onToggle(layer.id)}
        >
          {layer.name}
          <span className="layer-switch__track" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
```

`apps/web/src/components/MapControls.jsx`:

```jsx
/**
 * Controles del mapa para quien no domina los gestos táctiles.
 *
 * @param {{ onZoomIn: () => void, onZoomOut: () => void, pitched: boolean,
 *   onTogglePitch: () => void, onReset: () => void }} props
 */
export default function MapControls({ onZoomIn, onZoomOut, pitched, onTogglePitch, onReset }) {
  return (
    <div className="controls">
      <button type="button" className="control-button" aria-label="Acercar" onClick={onZoomIn}>
        +
      </button>
      <button type="button" className="control-button" aria-label="Alejar" onClick={onZoomOut}>
        −
      </button>
      <button
        type="button"
        className="control-button"
        aria-pressed={pitched}
        onClick={onTogglePitch}
      >
        3D
      </button>
      <button type="button" className="control-button control-button--primary" onClick={onReset}>
        ⟲ Reiniciar vista
      </button>
    </div>
  );
}
```

`apps/web/src/components/InactivityWarning.jsx`:

```jsx
/**
 * Aviso previo al reinicio automático por inactividad.
 *
 * @param {{ secondsLeft: number, onKeepExploring: () => void }} props
 */
export default function InactivityWarning({ secondsLeft, onKeepExploring }) {
  return (
    <div className="overlay">
      <div
        className="card warning-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="inactivity-title"
      >
        <h2 id="inactivity-title">¿Sigues explorando?</h2>
        <p>La vista volverá al inicio en {secondsLeft} segundos.</p>
        <button
          type="button"
          className="control-button control-button--primary"
          onClick={onKeepExploring}
        >
          Seguir explorando
        </button>
      </div>
    </div>
  );
}
```

`apps/web/src/components/StatusBanner.jsx`:

```jsx
/**
 * Aviso discreto de problemas de conexión o del mapa base.
 *
 * @param {{ messages: string[] }} props
 */
export default function StatusBanner({ messages }) {
  if (messages.length === 0) return null;
  return (
    <div className="status-banner" role="status">
      {messages.join(' · ')}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests** — Expected: components (5) pass.

- [ ] **Step 5: Checkpoint (no commit)** — `git status`.

---

### Task 6: MapView (MapLibre wrapper)

**Files:**

- Create: `apps/web/src/map/MapView.jsx`
- Test: `apps/web/src/map/MapView.test.jsx`

**Interfaces:**

- Consumes: `createMarkerElement` (Task 4), the `config` shape (Task 1).
- Produces: `MapView({ config, points, layers, visibleLayerIds, resetSignal, pitched, zoomSignal, onStyleError })`, with `zoomSignal = { delta: number, n: number }`. Effects:
  - mount: `new maplibregl.Map({ container, style, center, zoom, pitch, bearing, maxBounds, minZoom, maxZoom })`;
  - `map.on('error', …)` calls `onStyleError()`;
  - when `points` or `layers` change, markers are rebuilt only for points whose layer is in `layers`;
  - visible markers get `addTo(map)` and hidden ones `remove()`;
  - when `resetSignal` changes (not on mount): `flyTo({ ...initialView, duration: 800 })`;
  - when `zoomSignal.n` changes: `zoomTo(getZoom() + delta, { duration: 300 })`;
  - when `pitched` changes (not on mount): `easeTo({ pitch: pitched ? initialView.pitch : 0, duration: 500 })`;
  - unmount: `map.remove()`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/map/MapView.test.jsx`:

```jsx
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConfig } from '../config.js';
import MapView from './MapView.jsx';

/*
 * maplibre-gl necesita WebGL, que jsdom no tiene: se reemplaza por clases falsas
 * que registran cómo las usa MapView.
 */
const fake = vi.hoisted(() => {
  const state = { maps: [], markers: [] };
  class FakeMap {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.flyTo = vi.fn();
      this.easeTo = vi.fn();
      this.zoomTo = vi.fn();
      this.getZoom = vi.fn(() => 11);
      this.remove = vi.fn();
      state.maps.push(this);
    }
    on(event, handler) {
      this.handlers[event] = handler;
      return this;
    }
  }
  class FakeMarker {
    constructor({ element }) {
      this.element = element;
      this.setLngLat = vi.fn(() => this);
      this.addTo = vi.fn(() => this);
      this.remove = vi.fn(() => this);
      state.markers.push(this);
    }
  }
  return { state, FakeMap, FakeMarker };
});

vi.mock('maplibre-gl', () => ({ default: { Map: fake.FakeMap, Marker: fake.FakeMarker } }));

const config = buildConfig({});
const LAYERS = [
  { id: 1, slug: 'history', name: 'Historia', color: '#b45309' },
  { id: 3, slug: 'tourism', name: 'Turismo', color: '#1d4ed8' },
];
const feature = (id, layerId) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates: [-71.8, -37.7] },
  properties: { id, name: `Punto ${id}`, layerId, layerSlug: '' },
});
const POINTS = { type: 'FeatureCollection', features: [feature(10, 1), feature(30, 3)] };

/**
 * Props base del componente; cada test reemplaza lo que necesita.
 */
function props(overrides = {}) {
  return {
    config,
    points: POINTS,
    layers: LAYERS,
    visibleLayerIds: new Set([1, 3]),
    resetSignal: 0,
    pitched: true,
    zoomSignal: { delta: 0, n: 0 },
    onStyleError: vi.fn(),
    ...overrides,
  };
}

const markerFor = (id) =>
  fake.state.markers.find((m) => m.element.getAttribute('aria-label').startsWith(`Punto ${id} `));

beforeEach(() => {
  fake.state.maps.length = 0;
  fake.state.markers.length = 0;
});
afterEach(cleanup);

describe('MapView', () => {
  it('creates the map with the configured style, view and bounds', () => {
    render(<MapView {...props()} />);
    expect(fake.state.maps).toHaveLength(1);
    expect(fake.state.maps[0].options).toMatchObject({
      style: config.styleUrl,
      center: config.initialView.center,
      zoom: config.initialView.zoom,
      pitch: config.initialView.pitch,
      bearing: config.initialView.bearing,
      maxBounds: config.maxBounds,
      minZoom: 9,
      maxZoom: 17,
    });
  });

  it('adds markers for visible layers and removes them when a layer is hidden', () => {
    const { rerender } = render(<MapView {...props({ visibleLayerIds: new Set([1]) })} />);
    expect(markerFor(10).addTo).toHaveBeenCalled();
    expect(markerFor(30).addTo).not.toHaveBeenCalled();
    rerender(<MapView {...props({ visibleLayerIds: new Set() })} />);
    expect(markerFor(10).remove).toHaveBeenCalled();
  });

  it('skips points whose layer is not in the layer list', () => {
    const points = { type: 'FeatureCollection', features: [feature(10, 1), feature(99, 7)] };
    render(<MapView {...props({ points })} />);
    expect(fake.state.markers).toHaveLength(1);
    expect(markerFor(10)).toBeDefined();
  });

  it('flies to the initial view when resetSignal changes, not on mount', () => {
    const { rerender } = render(<MapView {...props()} />);
    const map = fake.state.maps[0];
    expect(map.flyTo).not.toHaveBeenCalled();
    rerender(<MapView {...props({ resetSignal: 1 })} />);
    expect(map.flyTo).toHaveBeenCalledWith({ ...config.initialView, duration: 800 });
  });

  it('zooms by the requested delta', () => {
    const { rerender } = render(<MapView {...props()} />);
    rerender(<MapView {...props({ zoomSignal: { delta: 1, n: 1 } })} />);
    expect(fake.state.maps[0].zoomTo).toHaveBeenCalledWith(12, { duration: 300 });
  });

  it('flattens and restores the pitch, not on mount', () => {
    const { rerender } = render(<MapView {...props()} />);
    const map = fake.state.maps[0];
    expect(map.easeTo).not.toHaveBeenCalled();
    rerender(<MapView {...props({ pitched: false })} />);
    expect(map.easeTo).toHaveBeenCalledWith({ pitch: 0, duration: 500 });
  });

  it('reports map errors and removes the map on unmount', () => {
    const onStyleError = vi.fn();
    const { unmount } = render(<MapView {...props({ onStyleError })} />);
    const map = fake.state.maps[0];
    map.handlers.error({ error: new Error('style failed') });
    expect(onStyleError).toHaveBeenCalledTimes(1);
    unmount();
    expect(map.remove).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — Expected: FAIL, `./MapView.jsx` not found.

- [ ] **Step 3: Implement**

`apps/web/src/map/MapView.jsx`:

```jsx
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { createMarkerElement } from './markers.js';

/**
 * Ejecuta `action` cuando `value` cambia, pero no al montar el componente.
 * La comparación se hace dentro del efecto (no durante el render) para que
 * funcione igual con el doble render y el doble montaje de StrictMode.
 */
function useOnChange(value, action) {
  const previous = useRef(value);
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    actionRef.current(value);
  }, [value]);
}

/**
 * Único componente que conoce MapLibre. Crea el mapa, dibuja los marcadores de
 * las capas visibles y aplica las órdenes que llegan como props.
 *
 * @param {object} props
 * @param {ReturnType<import('../config.js').buildConfig>} props.config
 * @param {{ features: Array<object> }} props.points
 * @param {Array<{ id: number, slug: string, name: string, color: string }>} props.layers
 * @param {Set<number>} props.visibleLayerIds
 * @param {number} props.resetSignal
 * @param {boolean} props.pitched
 * @param {{ delta: number, n: number }} props.zoomSignal
 * @param {() => void} props.onStyleError
 */
export default function MapView({
  config,
  points,
  layers,
  visibleLayerIds,
  resetSignal,
  pitched,
  zoomSignal,
  onStyleError,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const onStyleErrorRef = useRef(onStyleError);

  useEffect(() => {
    onStyleErrorRef.current = onStyleError;
  }, [onStyleError]);

  /*
   * Creación del mapa (una sola vez) con la vista inicial y los límites del territorio.
   */
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: config.styleUrl,
      center: config.initialView.center,
      zoom: config.initialView.zoom,
      pitch: config.initialView.pitch,
      bearing: config.initialView.bearing,
      maxBounds: config.maxBounds,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
    });
    map.on('error', () => onStyleErrorRef.current?.());
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [config]);

  /*
   * Marcadores: se reconstruyen cuando cambian los puntos o las capas.
   * Los puntos de capas que no están en la lista se omiten.
   */
  useEffect(() => {
    const layerById = new Map(layers.map((layer) => [layer.id, layer]));
    const created = points.features
      .filter((feature) => layerById.has(feature.properties.layerId))
      .map((feature) => {
        const layer = layerById.get(feature.properties.layerId);
        const marker = new maplibregl.Marker({ element: createMarkerElement(feature, layer) });
        marker.setLngLat(feature.geometry.coordinates);
        return { marker, layerId: layer.id };
      });
    markersRef.current = created;
    return () => created.forEach(({ marker }) => marker.remove());
  }, [points, layers]);

  /*
   * Visibilidad: agrega al mapa los marcadores de capas encendidas y quita el resto.
   */
  useEffect(() => {
    const map = mapRef.current;
    markersRef.current.forEach(({ marker, layerId }) => {
      if (visibleLayerIds.has(layerId)) marker.addTo(map);
      else marker.remove();
    });
  }, [visibleLayerIds, points, layers]);

  /*
   * Órdenes: reiniciar, acercar o alejar e inclinar. Solo reaccionan a cambios.
   */
  useOnChange(resetSignal, () => {
    mapRef.current.flyTo({ ...config.initialView, duration: 800 });
  });

  useOnChange(zoomSignal.n, () => {
    const map = mapRef.current;
    map.zoomTo(map.getZoom() + zoomSignal.delta, { duration: 300 });
  });

  useOnChange(pitched, (value) => {
    mapRef.current.easeTo({ pitch: value ? config.initialView.pitch : 0, duration: 500 });
  });

  return <div ref={containerRef} className="map" role="region" aria-label="Mapa del territorio" />;
}
```

- [ ] **Step 4: Run the tests** — Expected: MapView (7) pass.

- [ ] **Step 5: Checkpoint (no commit)** — `git status`.

---

### Task 7: App composition

**Files:**

- Modify (replace): `apps/web/src/App.jsx`, `apps/web/src/App.test.jsx`, `apps/web/src/main.jsx`

**Interfaces:**

- Consumes: everything above.
- Produces: `App({ loadLayers = fetchLayers, loadPoints = fetchPoints, mapConfig = config })`.

The skeleton's health-status page and its test are replaced: the viewer supersedes them.

- [ ] **Step 1: Write the failing test** (replace the file)

`apps/web/src/App.test.jsx`:

```jsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { buildConfig } from './config.js';

/*
 * MapView se reemplaza por un componente que guarda sus últimas props,
 * para verificar el estado que App le entrega sin necesitar WebGL.
 */
const spy = vi.hoisted(() => ({ props: null }));
vi.mock('./map/MapView.jsx', () => ({
  default: (props) => {
    spy.props = props;
    return <div data-testid="map" />;
  },
}));

const LAYERS = [
  { id: 1, slug: 'history', name: 'Historia', color: '#b45309' },
  { id: 3, slug: 'tourism', name: 'Turismo', color: '#1d4ed8' },
];
const POINTS = { type: 'FeatureCollection', features: [] };
const mapConfig = buildConfig({ VITE_IDLE_TIMEOUT_S: '1', VITE_IDLE_WARNING_S: '1' });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/**
 * Monta App con cargadores falsos.
 */
function renderApp(overrides = {}) {
  return render(
    <App
      loadLayers={async () => LAYERS}
      loadPoints={async () => POINTS}
      mapConfig={mapConfig}
      {...overrides}
    />,
  );
}

describe('App', () => {
  it('passes the loaded layers and points to the map, all layers visible', async () => {
    renderApp();
    await waitFor(() => expect(spy.props.layers).toEqual(LAYERS));
    expect(spy.props.points).toEqual(POINTS);
    expect([...spy.props.visibleLayerIds]).toEqual([1, 3]);
  });

  it('toggling a switch hides that layer on the map', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('switch', { name: /Historia/ }));
    expect([...spy.props.visibleLayerIds]).toEqual([3]);
  });

  it('reset turns every layer on and sends a reset signal', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('switch', { name: /Historia/ }));
    fireEvent.click(screen.getByRole('button', { name: /Reiniciar vista/ }));
    expect([...spy.props.visibleLayerIds].sort()).toEqual([1, 3]);
    expect(spy.props.resetSignal).toBe(1);
  });

  it('zoom and 3D buttons send their signals', async () => {
    renderApp();
    await screen.findByRole('switch', { name: /Historia/ });
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(spy.props.zoomSignal).toEqual({ delta: 1, n: 1 });
    fireEvent.click(screen.getByRole('button', { name: '3D' }));
    expect(spy.props.pitched).toBe(false);
  });

  it('shows the connection banner while the API is down', async () => {
    renderApp({ loadLayers: async () => Promise.reject(new Error('down')) });
    expect(await screen.findByText(/Sin conexión con el servidor/)).toBeTruthy();
  });

  it('shows the basemap banner when the map reports an error', async () => {
    renderApp();
    await waitFor(() => expect(spy.props).not.toBeNull());
    act(() => spy.props.onStyleError());
    expect(await screen.findByText(/No se pudo cargar el mapa base/)).toBeTruthy();
  });

  it('reset closes the inactivity warning', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderApp();
    await screen.findByRole('switch', { name: /Historia/ });
    fireEvent.pointerDown(window);
    await act(() => vi.advanceTimersByTimeAsync(1_100));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Reiniciar vista/ }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
```

> The last test clicks «Reiniciar vista» behind the overlay. In the real UI the overlay covers the controls, but the requirement ("reset closes the warning") belongs to the handler, which this test pins.

- [ ] **Step 2: Run it to verify it fails** — `npm test -w apps/web` → Expected: FAIL (the old App renders the health page; no switches, no MapView).

- [ ] **Step 3: Implement** (replace the files)

`apps/web/src/App.jsx`:

```jsx
import { useCallback, useEffect, useState } from 'react';
import { fetchLayers, fetchPoints } from './api/client.js';
import HeaderCard from './components/HeaderCard.jsx';
import InactivityWarning from './components/InactivityWarning.jsx';
import LayerPanel from './components/LayerPanel.jsx';
import MapControls from './components/MapControls.jsx';
import StatusBanner from './components/StatusBanner.jsx';
import { config } from './config.js';
import { useInactivity } from './hooks/useInactivity.js';
import { useLayers } from './hooks/useLayers.js';
import { usePoints } from './hooks/usePoints.js';
import MapView from './map/MapView.jsx';

const INTERACTION_EVENTS = ['pointerdown', 'wheel', 'keydown'];

/**
 * Visor táctil de BioMap: mapa a pantalla completa, capas, controles y
 * reinicio por inactividad. Los cargadores y la configuración se inyectan
 * para poder probar el visor sin red ni WebGL.
 *
 * @param {{ loadLayers?: () => Promise<object[]>, loadPoints?: () => Promise<object>,
 *   mapConfig?: ReturnType<import('./config.js').buildConfig> }} props
 */
export default function App({
  loadLayers = fetchLayers,
  loadPoints = fetchPoints,
  mapConfig = config,
}) {
  const polling = { intervalMs: mapConfig.refreshMs, retryMs: mapConfig.retryMs };
  const {
    layers,
    visibleLayerIds,
    toggle,
    showAll,
    error: layersError,
  } = useLayers(loadLayers, polling);
  const { points, error: pointsError } = usePoints(loadPoints, polling);
  const [resetSignal, setResetSignal] = useState(0);
  const [pitched, setPitched] = useState(true);
  const [zoomSignal, setZoomSignal] = useState({ delta: 0, n: 0 });
  const [styleError, setStyleError] = useState(false);

  /*
   * Deja el visor como al inicio: vista inicial, inclinación y todas las capas.
   */
  const resetView = useCallback(() => {
    setResetSignal((n) => n + 1);
    setPitched(true);
    showAll();
  }, [showAll]);

  const { phase, secondsLeft, markActive, markClean } = useInactivity({
    timeoutMs: mapConfig.idleTimeoutMs,
    warningMs: mapConfig.idleWarningMs,
    onReset: resetView,
  });

  /*
   * Cualquier toque, rueda o tecla cuenta como interacción, también sobre el mapa,
   * porque esos eventos suben hasta window.
   */
  useEffect(() => {
    INTERACTION_EVENTS.forEach((type) =>
      window.addEventListener(type, markActive, { passive: true }),
    );
    return () => INTERACTION_EVENTS.forEach((type) => window.removeEventListener(type, markActive));
  }, [markActive]);

  const handleReset = () => {
    resetView();
    markClean();
  };
  const zoomBy = (delta) => setZoomSignal((current) => ({ delta, n: current.n + 1 }));
  const handleStyleError = useCallback(() => setStyleError(true), []);

  const messages = [];
  if (layersError || pointsError) messages.push('Sin conexión con el servidor. Reintentando…');
  if (styleError) messages.push('No se pudo cargar el mapa base');

  return (
    <main className="viewer">
      <MapView
        config={mapConfig}
        points={points}
        layers={layers}
        visibleLayerIds={visibleLayerIds}
        resetSignal={resetSignal}
        pitched={pitched}
        zoomSignal={zoomSignal}
        onStyleError={handleStyleError}
      />
      <HeaderCard />
      <LayerPanel layers={layers} visibleLayerIds={visibleLayerIds} onToggle={toggle} />
      <MapControls
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        pitched={pitched}
        onTogglePitch={() => setPitched((value) => !value)}
        onReset={handleReset}
      />
      <StatusBanner messages={messages} />
      {phase === 'warning' && (
        <InactivityWarning secondsLeft={secondsLeft} onKeepExploring={markActive} />
      )}
    </main>
  );
}
```

`apps/web/src/main.jsx`:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

/**
 * Monta el visor en el elemento #root de index.html.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

> `polling` is a new object on every render, but `usePolling` depends only on `loader`, `intervalMs` and `retryMs`, so its effect does not restart. `fetchLayers`/`fetchPoints` are stable module functions; in the test, `renderApp` creates its loaders once per mount and App re-renders keep the same props, so polling does not restart either.

- [ ] **Step 4: Run the tests** — `npm test -w apps/web` → Expected: every web test passes (App 7 plus earlier tasks).

- [ ] **Step 5: Checkpoint (no commit)** — `git status`.

---

### Task 8: Docs and verification

**Files:**

- Modify: `PENDING.md`, `README.md`

- [ ] **Step 1: Update `PENDING.md`** (append a row)

```
| Local basemap: the viewer uses the online OpenFreeMap style until EDT 1.3.3 produces local tiles (set VITE_MAP_STYLE_URL=/tiles/styles/biomap/style.json) | Team | RNF-08 (offline) on the kiosk |
```

- [ ] **Step 2: Update `README.md`** — add after "API only":

````markdown
### Web viewer

```bash
npm run dev -w apps/web   # http://localhost:5173 (proxies /api to http://localhost:3000)
```

Viewer settings (`apps/web/.env.local`): `VITE_MAP_STYLE_URL`, `VITE_MAP_BOUNDS`
(`west,south,east,north`), `VITE_IDLE_TIMEOUT_S`, `VITE_IDLE_WARNING_S`, `VITE_REFRESH_S`.
The default basemap is the online OpenFreeMap style (temporary; it needs internet).
````

- [ ] **Step 3: Full verification**

Run:

```bash
npm run format && npm run lint && npm run format:check
npm test
npm run build -w apps/web
```

Expected: lint and format clean; API tests unchanged (pass, or skip without a database); all web tests pass; build succeeds.

- [ ] **Step 4: Visual verification** — with the local API and database running, open http://localhost:5173 and check: basemap visible, three layer switches, colored markers with shapes, toggles hide and show markers, «Reiniciar vista» flies back. Take a screenshot.

- [ ] **Step 5: Checkpoint (no commit)** — `git status`.
