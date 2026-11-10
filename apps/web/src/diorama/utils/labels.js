/**
 * Tipos de etiqueta que se muestran según la distancia de la cámara (m): de
 * lejos solo lo grande (volcanes, embalses, presas, ciudades); al acercarse,
 * pueblos y cumbres; de cerca, también lagunas.
 *
 * @param {number} range
 * @returns {Set<string>}
 */
export function visibleKinds(range) {
  const kinds = new Set(['volcano', 'reservoir', 'dam', 'town', 'river']);
  if (range < 12_000) {
    kinds.add('river');
    kinds.add('village');
    kinds.add('peak');
    kinds.add('lookout');
    kinds.add('camping');
    kinds.add('visitors');
    kinds.add('road');
  }
  if (range < 5_000) {
    kinds.add('lake');
    kinds.add('bridge');
  }
  return kinds;
}

/**
 * Elige qué etiquetas caben en pantalla sin taparse: recorre de mayor a
 * menor prioridad y descarta las que chocan con una ya elegida, con un
 * obstáculo (p. ej. el círculo de otro pin) o se salen de la pantalla. Si la
 * etiqueta trae un lugar de reserva (`alt`, p. ej. a la izquierda del pin),
 * lo prueba antes de descartarla.
 *
 * @param {Array<{ id: string, rect: Rect, alt?: Rect, rank: number }>} items
 * @param {{ obstacles?: Rect[], width?: number }} [options]
 * @returns {Map<string, 'main' | 'alt'>} Etiquetas que se muestran y en qué lugar.
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 */
export function declutter(items, { obstacles = [], width = Infinity } = {}) {
  const shown = [...obstacles];
  const result = new Map();
  const overlaps = (a, b) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const fits = (rect) =>
    rect.x >= 0 && rect.x + rect.width <= width && !shown.some((other) => overlaps(other, rect));
  for (const item of [...items].sort((a, b) => b.rank - a.rank)) {
    const side = fits(item.rect) ? 'main' : item.alt && fits(item.alt) ? 'alt' : null;
    if (!side) continue;
    shown.push(side === 'main' ? item.rect : item.alt);
    result.set(item.id, side);
  }
  return result;
}

/**
 * Agrupa pines que en pantalla quedan a menos de `radius` px: de mayor a
 * menor prioridad, cada pin se suma al grupo más cercano a su alcance o abre
 * uno nuevo (y es su líder, el que se dibuja). Los `solo` (el elegido) nunca
 * se agrupan: siempre se ven tal cual.
 *
 * @param {Array<{ id: string|number, x: number, y: number, rank: number, solo?: boolean }>} items
 * @param {number} radius
 * @returns {Map<string|number, Array<string|number>>} Ids de cada grupo, por id de su líder.
 */
export function clusterPins(items, radius) {
  const groups = [];
  for (const item of [...items].sort((a, b) => b.rank - a.rank)) {
    const near = item.solo
      ? null
      : groups.find((g) => !g.solo && Math.hypot(g.x - item.x, g.y - item.y) < radius);
    if (near) near.ids.push(item.id);
    else groups.push({ x: item.x, y: item.y, solo: item.solo, ids: [item.id] });
  }
  return new Map(groups.map((g) => [g.ids[0], g.ids]));
}

/**
 * Abanico para abrir un grupo de pines que siguen juntos aun de cerca: `n`
 * desplazamientos (px) en círculo alrededor del grupo, empezando arriba, con
 * el radio justo para que no se toquen (al menos `radius`).
 *
 * @param {number} n
 * @param {number} radius
 * @returns {Array<{ dx: number, dy: number }>}
 */
export function fanOffsets(n, radius) {
  if (n < 2) return [{ dx: 0, dy: 0 }];
  /* Cuerda entre vecinos ≥ radius: r = radius / (2 sin(π/n)). */
  const r = Math.max(radius, radius / (2 * Math.sin(Math.PI / n)));
  return Array.from({ length: n }, (_, k) => {
    const angle = -Math.PI / 2 + (k / n) * Math.PI * 2;
    return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
  });
}
