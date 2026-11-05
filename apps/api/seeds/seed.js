import { SAMPLE_IMAGES, SAMPLE_LAYERS, SAMPLE_POINTS } from './sample-data.js';

export { SAMPLE_IMAGES, SAMPLE_LAYERS, SAMPLE_POINTS };

/**
 * Impide cargar datos de ejemplo en producción.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function assertNotProduction(env = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to load sample data in production');
  }
}

/**
 * Carga las capas y los puntos de ejemplo en una sola transacción.
 * Es idempotente: las capas se actualizan por slug, cada punto se inserta
 * solo si todavía no existe un punto con el mismo nombre y las imágenes se asocian a sus puntos.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ layers: number, pointsInserted: number, imagesInserted: number }>}
 */
export async function seed(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const layer of SAMPLE_LAYERS) {
      await client.query(
        `INSERT INTO layers (slug, name, color, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name, color = EXCLUDED.color,
               icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order`,
        [layer.slug, layer.name, layer.color, layer.icon, layer.sortOrder],
      );
    }
    let pointsInserted = 0;
    for (const point of SAMPLE_POINTS) {
      const { rowCount } = await client.query(
        `INSERT INTO points_of_interest (layer_id, name, description, location, tour_stop, is_secret)
         SELECT l.id, $2::text, $3::text, ST_SetSRID(ST_MakePoint($4::float8, $5::float8), 4326),
                $6::smallint, $7::boolean
           FROM layers l
          WHERE l.slug = $1::text
            AND NOT EXISTS (SELECT 1 FROM points_of_interest p WHERE p.name = $2::text)`,
        [
          point.layerSlug,
          point.name,
          point.description,
          point.lng,
          point.lat,
          point.tourStop ?? null,
          point.secret ?? false,
        ],
      );
      pointsInserted += rowCount;
    }
    /*
     * Parada del recorrido y ubicación corregida también en bases ya cargadas
     * (los puntos existentes no se reinsertan). Solo datos de ejemplo: el seed
     * se niega a correr en producción.
     */
    for (const point of SAMPLE_POINTS) {
      await client.query(
        `UPDATE points_of_interest
            SET tour_stop = $2::smallint,
                location = ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326),
                is_secret = $5::boolean
          WHERE name = $1::text
            AND (tour_stop IS DISTINCT FROM $2::smallint
                 OR is_secret IS DISTINCT FROM $5::boolean
                 OR NOT ST_Equals(location, ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326)))`,
        [point.name, point.tourStop ?? null, point.lng, point.lat, point.secret ?? false],
      );
    }

    /* Las fotos de ejemplo pasaron de PNG a JPG: corrige bases cargadas antes. */
    await client.query(
      `UPDATE images SET file_path = regexp_replace(file_path, '\\.png$', '.jpg')
        WHERE file_path ~ '\\.png$'`,
    );

    let imagesInserted = 0;
    for (const img of SAMPLE_IMAGES) {
      const { rowCount } = await client.query(
        `INSERT INTO images (point_id, file_path, alt_text, credit, is_main, kind, sort_order)
         SELECT p.id, $2::text, $3::text, $4::text, $5::boolean, $6::text, $7::smallint
           FROM points_of_interest p
          WHERE p.name = $1::text
            AND NOT EXISTS (
              SELECT 1 FROM images i WHERE i.point_id = p.id AND i.file_path = $2::text
            )`,
        [img.pointName, img.filePath, img.altText, img.credit, img.isMain, img.kind, img.sortOrder],
      );
      imagesInserted += rowCount;
    }

    await client.query('COMMIT');
    return { layers: SAMPLE_LAYERS.length, pointsInserted, imagesInserted };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
