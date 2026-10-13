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

/**
 * Escalona insignias que se pisan: de mayor a menor prioridad, cada una sube
 * `step` px por nivel (alargando su poste) hasta quedar libre, hasta
 * `maxLift` niveles. Las que no caben quedan fuera del resultado.
 *
 * @param {Array<{ id: string|number, rect: { x: number, y: number, width: number, height: number }, rank: number }>} items
 * @param {{ step: number, maxLift?: number }} options
 * @returns {Map<string|number, number>} Nivel (0 = sin subir) de cada insignia que cabe.
 */
export function liftBadges(items, { step, maxLift = 3 }) {
  const placed = [];
  const lifts = new Map();
  const overlaps = (a, b) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  for (const item of [...items].sort((a, b) => b.rank - a.rank)) {
    for (let lift = 0; lift <= maxLift; lift += 1) {
      const rect = { ...item.rect, y: item.rect.y - lift * step };
      if (placed.some((other) => overlaps(other, rect))) continue;
      placed.push(rect);
      lifts.set(item.id, lift);
      break;
    }
  }
  return lifts;
}
