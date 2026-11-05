/*
 * Rutas de la mascota por la red de caminos de OpenStreetMap, sin cruzar el
 * agua salvo por puentes. Coordenadas [lng, lat]; distancias en km.
 */
const KM_PER_DEGREE = 111.32;
/* Paso al revisar si un tramo moja (km) y largo mojado tolerado: el borde
 * aproximado de los polígonos de agua roza caminos de orilla. */
const WATER_STEP_KM = 0.01;
const WET_TOLERANCE_KM = 0.03;
/* Extremos sueltos a menos de esto se unen (cortes de OSM y del recorte). */
const JOIN_KM = 0.015;
/* Hasta dónde se busca el camino más cercano a un punto. */
const MAX_SNAP_KM = 1.2;
const SNAP_CANDIDATES = 12;
/* Para un destino en el agua, hasta dónde se busca el camino de la orilla. */
const MAX_SHORE_KM = 1.5;
const SHORE_SPREAD_KM = 0.1;
/* Último paso fuera del camino hasta el lugar: más lejos, se queda en el camino
 * (si no, cruzaba el bosque en línea recta hasta un lugar sin camino cargado). */
const LAST_STEP_KM = 0.15;

/**
 * Distancia aproximada (km) entre dos [lng, lat] cercanos.
 */
export function distanceKm(a, b) {
  const cos = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * cos, a[1] - b[1]) * KM_PER_DEGREE;
}

function insideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}

/**
 * Prueba "¿este punto está en el agua?" sobre polígonos { outer, holes }.
 *
 * @param {Array<{ outer: number[][], holes?: number[][][] }>} polygons
 * @returns {(point: number[]) => boolean}
 */
export function waterTest(polygons = []) {
  const indexed = polygons.map((polygon) => {
    const xs = polygon.outer.map((p) => p[0]);
    const ys = polygon.outer.map((p) => p[1]);
    return {
      polygon,
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    };
  });
  return (point) =>
    indexed.some(
      ({ polygon, box }) =>
        point[0] >= box[0] &&
        point[0] <= box[2] &&
        point[1] >= box[1] &&
        point[1] <= box[3] &&
        insideRing(point, polygon.outer) &&
        !(polygon.holes ?? []).some((hole) => insideRing(point, hole)),
    );
}

/**
 * Largo mojado continuo más largo (km) del tramo a–b.
 */
function longestWetRun(a, b, inWater) {
  const length = distanceKm(a, b);
  const steps = Math.max(1, Math.ceil(length / WATER_STEP_KM));
  let run = 0;
  let longest = 0;
  for (let k = 0; k <= steps; k += 1) {
    const t = k / steps;
    if (inWater([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) {
      run += length / steps;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  return longest;
}

/**
 * Punto del tramo a–b más cercano a p, con su fracción t ∈ [0, 1].
 */
function projectOnSegment(p, a, b) {
  const cos = Math.cos((p[1] * Math.PI) / 180);
  const ax = (b[0] - a[0]) * cos;
  const ay = b[1] - a[1];
  const px = (p[0] - a[0]) * cos;
  const py = p[1] - a[1];
  const lengthSq = ax * ax + ay * ay;
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, (px * ax + py * ay) / lengthSq));
  return { t, point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
}

export class Pathfinder {
  /**
   * @param {Array<{ line: number[][], bridge?: boolean }>} roads
   * @param {{ water?: Array<{ outer: number[][], holes?: number[][][] }> }} [options]
   */
  constructor(roads, { water = [] } = {}) {
    this.inWater = waterTest(water);
    this.nodes = [];
    this.adj = [];
    this.edges = [];
    this.buildGraph(roads ?? []);
    this.labelComponents();
  }

  nodeId(point, ids) {
    const key = `${point[0]},${point[1]}`;
    if (!ids.has(key)) {
      ids.set(key, this.nodes.length);
      this.nodes.push(point);
      this.adj.push([]);
    }
    return ids.get(key);
  }

  addEdge(u, v) {
    if (u === v) return;
    const weight = distanceKm(this.nodes[u], this.nodes[v]);
    this.adj[u].push({ node: v, weight });
    this.adj[v].push({ node: u, weight });
    this.edges.push([u, v]);
  }

  /**
   * Un tramo es transitable si es puente o casi no pisa agua.
   */
  walkable(a, b, bridge = false) {
    return bridge || longestWetRun(a, b, this.inWater) <= WET_TOLERANCE_KM;
  }

  buildGraph(roads) {
    const ids = new Map();
    for (const road of roads) {
      const line = road.line ?? [];
      for (let i = 0; i < line.length - 1; i += 1) {
        if (!this.walkable(line[i], line[i + 1], road.bridge)) continue;
        this.addEdge(this.nodeId(line[i], ids), this.nodeId(line[i + 1], ids));
      }
    }
    /* Une extremos sueltos con el nodo más cercano, si no hay agua entre ellos. */
    const loose = this.adj.flatMap((edges, id) => (edges.length === 1 ? [id] : []));
    for (const u of loose) {
      let best = null;
      let bestDistance = JOIN_KM;
      for (let v = 0; v < this.nodes.length; v += 1) {
        if (v === u || this.adj[u].some((edge) => edge.node === v)) continue;
        const d = distanceKm(this.nodes[u], this.nodes[v]);
        if (d < bestDistance) {
          bestDistance = d;
          best = v;
        }
      }
      if (best !== null && this.walkable(this.nodes[u], this.nodes[best])) this.addEdge(u, best);
    }
  }

  labelComponents() {
    this.component = new Int32Array(this.nodes.length).fill(-1);
    let label = 0;
    for (let start = 0; start < this.nodes.length; start += 1) {
      if (this.component[start] !== -1) continue;
      const stack = [start];
      this.component[start] = label;
      while (stack.length > 0) {
        const u = stack.pop();
        for (const { node } of this.adj[u]) {
          if (this.component[node] === -1) {
            this.component[node] = label;
            stack.push(node);
          }
        }
      }
      label += 1;
    }
  }

  /**
   * Tramos de camino más cercanos a un punto, a los que se puede llegar a pie
   * sin cruzar agua.
   */
  snapCandidates(coord, { overWater = false } = {}) {
    return this.edges
      .map(([u, v]) => {
        const { t, point } = projectOnSegment(coord, this.nodes[u], this.nodes[v]);
        return { u, v, t, point, distance: distanceKm(coord, point) };
      })
      .filter((c) => c.distance <= (overWater ? MAX_SHORE_KM : MAX_SNAP_KM))
      .sort((a, b) => a.distance - b.distance)
      .filter((c, k, all) =>
        /* Hacia el agua: puntos repartidos por la orilla (no todos en el mismo camino). */
        overWater
          ? all.slice(0, k).every((other) => distanceKm(other.point, c.point) >= SHORE_SPREAD_KM)
          : k < SNAP_CANDIDATES,
      )
      .slice(0, SNAP_CANDIDATES)
      .filter((c) => overWater || this.walkable(coord, c.point));
  }

  /**
   * Ruta de `startCoord` a `endCoord` por caminos, o null si no hay una que
   * evite el agua. Incluye los dos extremos.
   *
   * @param {number[]} startCoord
   * @param {number[]} endCoord
   * @returns {number[][] | null}
   */
  findPath(startCoord, endCoord) {
    /*
     * Partiendo sobre el agua (parado en un puente), solo desde la orilla más
     * cercana: si no, una orilla lejana con un camino más corto ganaba y el
     * primer tramo cruzaba el embalse en línea recta.
     */
    const startOnWater = this.inWater(startCoord);
    const starts = this.snapCandidates(startCoord, { overWater: startOnWater }).slice(
      0,
      startOnWater ? 1 : undefined,
    );
    /*
     * Un destino en el agua (el embalse) no se pisa: la ruta llega al camino
     * de la orilla más cercano y termina ahí.
     */
    const onWater = this.inWater(endCoord);
    const ends = this.snapCandidates(endCoord, { overWater: onWater });
    let best = null;
    for (const end of ends) {
      for (const start of starts) {
        if (this.component[start.u] !== this.component[end.u]) continue;
        const route = this.route(start, end);
        if (!route) continue;
        const total = route.length + start.distance;
        if (!best || total < best.total) best = { total, nodes: route.nodes, start, end };
      }
      /* Priorizar el punto de llegada más cercano al destino real */
      if (best) break;
    }
    if (!best) return null;
    const middle = best.nodes.map((id) => this.nodes[id]);
    const path = [startCoord, best.start.point, ...middle, best.end.point];
    const reachable = best.end.distance <= LAST_STEP_KM && this.walkable(best.end.point, endCoord);
    return reachable ? [...path, endCoord] : path;
  }

  /**
   * A* entre dos puntos sobre tramos (u–v en la fracción t).
   */
  route(start, end) {
    const START = -1;
    const END = -2;
    const edgeCost = (snap, id) => distanceKm(snap.point, this.nodes[id]);
    const sameEdge =
      (start.u === end.u && start.v === end.v) || (start.u === end.v && start.v === end.u);
    if (sameEdge) return { length: distanceKm(start.point, end.point), nodes: [] };

    const target = end.point;
    const h = (id) => distanceKm(this.nodes[id], target);
    const dist = new Map();
    const prev = new Map();
    const open = new MinHeap();
    for (const id of [start.u, start.v]) {
      const d = edgeCost(start, id);
      if (d < (dist.get(id) ?? Infinity)) {
        dist.set(id, d);
        prev.set(id, START);
        open.push(id, d + h(id));
      }
    }
    const endIds = new Map([
      [end.u, edgeCost(end, end.u)],
      [end.v, edgeCost(end, end.v)],
    ]);
    let bestEnd = null;
    let bestLength = Infinity;
    const closed = new Set();
    while (open.size > 0) {
      const u = open.pop();
      if (closed.has(u)) continue;
      closed.add(u);
      const du = dist.get(u);
      if (du >= bestLength) break;
      if (endIds.has(u) && du + endIds.get(u) < bestLength) {
        bestLength = du + endIds.get(u);
        bestEnd = u;
      }
      for (const { node, weight } of this.adj[u]) {
        const alt = du + weight;
        if (alt < (dist.get(node) ?? Infinity)) {
          dist.set(node, alt);
          prev.set(node, u);
          open.push(node, alt + h(node));
        }
      }
    }
    if (bestEnd === null) return null;
    const nodes = [];
    for (let id = bestEnd; id !== START && id !== END; id = prev.get(id)) nodes.push(id);
    return { length: bestLength, nodes: nodes.reverse() };
  }
}

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(value, priority) {
    const items = this.items;
    items.push({ value, priority });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].priority <= items[i].priority) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left].priority < items[smallest].priority) smallest = left;
        if (right < items.length && items[right].priority < items[smallest].priority)
          smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top.value;
  }
}
