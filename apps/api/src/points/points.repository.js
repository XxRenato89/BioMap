/**
 * Consulta de la lista de puntos para el mapa: solo los datos necesarios
 * para dibujar los marcadores, sin descripción ni imágenes.
 * Excluye los puntos eliminados y los de capas inactivas.
 */
const LIST_SQL = `
  SELECT p.id, p.name, p.layer_id, l.slug AS layer_slug, p.tour_stop, p.is_secret,
         p.model_kind, p.icon,
         ST_X(p.location) AS lng, ST_Y(p.location) AS lat
    FROM points_of_interest p
    JOIN layers l ON l.id = p.layer_id
   WHERE p.deleted_at IS NULL
     AND l.is_active
     AND ($1::smallint[] IS NULL OR p.layer_id = ANY ($1::smallint[]))
   ORDER BY p.id`;

/**
 * Consulta de la ficha completa de un punto. Las imágenes se agregan con
 * json_agg en la misma consulta para evitar una consulta extra por imagen.
 */
const DETAIL_SQL = `
  SELECT p.id, p.name, p.description, p.layer_id, l.slug AS layer_slug, p.tour_stop, p.is_secret,
         p.model_kind, p.icon,
         ST_X(p.location) AS lng, ST_Y(p.location) AS lat,
         COALESCE(
           (SELECT json_agg(
                     json_build_object(
                       'filePath', i.file_path,
                       'altText', i.alt_text,
                       'credit', i.credit,
                       'isMain', i.is_main,
                       'kind', i.kind)
                     ORDER BY i.is_main DESC, i.sort_order, i.id)
              FROM images i
             WHERE i.point_id = p.id),
           '[]'::json) AS images
    FROM points_of_interest p
    JOIN layers l ON l.id = p.layer_id
   WHERE p.id = $1
     AND p.deleted_at IS NULL
     AND l.is_active`;

/**
 * Convierte una fila en un Feature GeoJSON. `tourStop` es la parada del
 * recorrido guiado (null si el punto no está en él).
 */
export function toFeature(row, extraProperties = {}) {
  return {
    type: 'Feature',
    id: row.id,
    geometry: { type: 'Point', coordinates: [row.lng, row.lat] },
    properties: {
      id: row.id,
      name: row.name,
      layerId: row.layer_id,
      layerSlug: row.layer_slug,
      tourStop: row.tour_stop ?? null,
      secret: row.is_secret ?? false,
      /* Modelo 3D e icono elegidos en el panel; null = el visor los deduce del nombre. */
      modelKind: row.model_kind ?? null,
      icon: row.icon ?? null,
      ...extraProperties,
    },
  };
}

/**
 * Acceso SQL a los puntos de interés.
 *
 * @param {{ query: Function }} db
 */
export function createPointsRepository(db) {
  return {
    /**
     * Lista de puntos visibles; `layerIds: null` significa todas las capas.
     *
     * @param {{ layerIds: number[] | null }} options
     */
    async findAll({ layerIds }) {
      const { rows } = await db.query(LIST_SQL, [layerIds]);
      return rows.map((row) => toFeature(row));
    },

    /**
     * Ficha de un punto con su descripción e imágenes, o null si no existe,
     * está eliminado o pertenece a una capa inactiva.
     *
     * @param {number} id
     */
    async findById(id) {
      const { rows } = await db.query(DETAIL_SQL, [id]);
      if (rows.length === 0) return null;
      const row = rows[0];
      return toFeature(row, { description: row.description, images: row.images });
    },
  };
}
