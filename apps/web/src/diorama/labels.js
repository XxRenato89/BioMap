/**
 * Tipos de etiqueta que se muestran según la distancia de la cámara (m): de
 * lejos solo lo grande (volcanes, embalses, presas, ciudades); al acercarse,
 * pueblos y cumbres; de cerca, también lagunas.
 *
 * @param {number} range
 * @returns {Set<string>}
 */
export function visibleKinds(range) {
  const kinds = new Set(['volcano', 'reservoir', 'dam', 'town']);
  if (range < 8_000) {
    kinds.add('village');
    kinds.add('peak');
  }
  if (range < 3_000) kinds.add('lake');
  return kinds;
}

/**
 * Elige qué etiquetas caben en pantalla sin taparse: recorre de mayor a
 * menor prioridad y descarta las que chocan con una ya elegida.
 *
 * @param {Array<{ id: string, rect: { x: number, y: number, width: number, height: number }, rank: number }>} items
 * @returns {Set<string>} Ids de las etiquetas que se muestran.
 */
export function declutter(items) {
  const shown = [];
  const result = new Set();
  const overlaps = (a, b) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  for (const item of [...items].sort((a, b) => b.rank - a.rank)) {
    if (shown.some((rect) => overlaps(rect, item.rect))) continue;
    shown.push(item.rect);
    result.add(item.id);
  }
  return result;
}
