/**
 * Recorta un anillo abierto (sin repetir el primer punto) contra un borde,
 * con el algoritmo de Sutherland–Hodgman.
 *
 * @param {number[][]} ring
 * @param {(point: number[]) => boolean} inside
 * @param {(a: number[], b: number[]) => number[]} cross Punto donde el segmento a–b corta el borde.
 */
function clipEdge(ring, inside, cross) {
  const out = [];
  ring.forEach((current, k) => {
    const previous = ring[(k + ring.length - 1) % ring.length];
    const currentIn = inside(current);
    const previousIn = inside(previous);
    if (currentIn) {
      if (!previousIn) out.push(cross(previous, current));
      out.push(current);
    } else if (previousIn) {
      out.push(cross(previous, current));
    }
  });
  return out;
}

/**
 * Punto del segmento a–b donde la coordenada `axis` vale `value`.
 */
function crossAt(axis, value) {
  return (a, b) => {
    const t = (value - a[axis]) / (b[axis] - a[axis]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
}

/**
 * Recorta un anillo cerrado [lng, lat] al rectángulo; null si no queda nada.
 */
function clipRing(ring, [[west, south], [east, north]]) {
  const isClosed =
    ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1];
  let points = isClosed ? ring.slice(0, -1) : ring;
  const edges = [
    [(p) => p[0] >= west, crossAt(0, west)],
    [(p) => p[0] <= east, crossAt(0, east)],
    [(p) => p[1] >= south, crossAt(1, south)],
    [(p) => p[1] <= north, crossAt(1, north)],
  ];
  for (const [inside, cross] of edges) {
    if (points.length === 0) break;
    points = clipEdge(points, inside, cross);
  }
  if (points.length < 3) return null;
  return [...points, points[0]];
}

/**
 * Recorta un polígono (anillo exterior y agujeros, [lng, lat]) a los límites
 * de la maqueta, para que el agua no quede flotando fuera del borde. Devuelve
 * null si el polígono queda completamente afuera.
 *
 * @param {{ outer: number[][], holes: number[][][] }} polygon
 * @param {[[number, number], [number, number]]} bounds [[oeste, sur], [este, norte]]
 */
export function clipPolygonToBounds({ outer, holes }, bounds) {
  const clipped = clipRing(outer, bounds);
  if (!clipped) return null;
  return {
    outer: clipped,
    holes: holes.map((hole) => clipRing(hole, bounds)).filter(Boolean),
  };
}
