/**
 * Acceso SQL del panel de administración: el administrador, sus intentos de
 * ingreso, la edición de puntos, capas e imágenes, las visitas y el historial.
 *
 * @param {{ query: Function, connect?: Function }} db Pool de pg.
 */
export function createAdminRepository(db) {
  /* Varias escrituras que deben quedar todas o ninguna. */
  async function inTransaction(work) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const toUser = (row) =>
    row && {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      isActive: row.is_active,
      passwordChangedAt: row.password_changed_at,
      mustChangePassword: row.must_change_password,
      lastLoginAt: row.last_login_at,
    };

  const USER_COLUMNS = `id, username, password_hash, is_active, password_changed_at,
    must_change_password, last_login_at`;

  const POINT_SQL = `
    SELECT p.id, p.name, p.description, p.layer_id, p.tour_stop, p.is_secret,
           p.deleted_at, p.updated_at, ST_X(p.location) AS lng, ST_Y(p.location) AS lat,
           COALESCE(
             (SELECT json_agg(json_build_object(
                       'id', i.id, 'filePath', i.file_path, 'altText', i.alt_text,
                       'credit', i.credit, 'isMain', i.is_main, 'kind', i.kind,
                       'sortOrder', i.sort_order)
                     ORDER BY i.is_main DESC, i.sort_order, i.id)
                FROM images i WHERE i.point_id = p.id),
             '[]'::json) AS images
      FROM points_of_interest p`;

  const toPoint = (row) =>
    row && {
      id: row.id,
      name: row.name,
      description: row.description,
      layerId: row.layer_id,
      tourStop: row.tour_stop,
      isSecret: row.is_secret,
      lng: row.lng,
      lat: row.lat,
      deletedAt: row.deleted_at,
      updatedAt: row.updated_at,
      images: row.images,
    };

  return {
    async findUserByUsername(username) {
      const { rows } = await db.query(
        `SELECT ${USER_COLUMNS} FROM admin_users WHERE username = $1`,
        [username],
      );
      return toUser(rows[0]) ?? null;
    },

    async findUserById(id) {
      const { rows } = await db.query(`SELECT ${USER_COLUMNS} FROM admin_users WHERE id = $1`, [
        id,
      ]);
      return toUser(rows[0]) ?? null;
    },

    async recordLoginAttempt({ username, ip, succeeded }) {
      await db.query('INSERT INTO login_attempts (username, ip, succeeded) VALUES ($1, $2, $3)', [
        username,
        ip ?? null,
        succeeded,
      ]);
    },

    /** Intentos fallidos de ese usuario desde `since`. */
    async countFailures(username, since) {
      const { rows } = await db.query(
        `SELECT count(*)::int AS n FROM login_attempts
          WHERE lower(username) = lower($1) AND NOT succeeded AND attempted_at >= $2`,
        [username, since],
      );
      return rows[0].n;
    },

    async markLogin(id) {
      await db.query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [id]);
    },

    /** Guarda la contraseña nueva; devuelve la fecha del cambio. */
    async setPassword(id, passwordHash, { mustChange = false } = {}) {
      const { rows } = await db.query(
        `UPDATE admin_users
            SET password_hash = $2, password_changed_at = now(), must_change_password = $3
          WHERE id = $1
          RETURNING password_changed_at`,
        [id, passwordHash, mustChange],
      );
      return rows[0]?.password_changed_at ?? null;
    },

    /** Todos los puntos, también los eliminados, con sus imágenes. */
    async listPoints() {
      const { rows } = await db.query(`${POINT_SQL} ORDER BY p.deleted_at NULLS FIRST, p.name`);
      return rows.map(toPoint);
    },

    async findPoint(id) {
      const { rows } = await db.query(`${POINT_SQL} WHERE p.id = $1`, [id]);
      return toPoint(rows[0]) ?? null;
    },

    async createPoint(point, userId) {
      const { rows } = await db.query(
        `INSERT INTO points_of_interest
           (layer_id, name, description, location, tour_stop, is_secret, created_by, updated_by)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8, $8)
         RETURNING id`,
        [
          point.layerId,
          point.name,
          point.description ?? '',
          point.lng,
          point.lat,
          point.tourStop ?? null,
          point.isSecret ?? false,
          userId,
        ],
      );
      return rows[0].id;
    },

    /** Cambia solo los campos enviados; false si el punto no existe. */
    async updatePoint(id, changes, userId) {
      const columns = {
        name: 'name',
        description: 'description',
        layerId: 'layer_id',
        tourStop: 'tour_stop',
        isSecret: 'is_secret',
      };
      const sets = [];
      const values = [id, userId];
      for (const [key, column] of Object.entries(columns)) {
        if (changes[key] === undefined) continue;
        values.push(changes[key]);
        sets.push(`${column} = $${values.length}`);
      }
      if (changes.lng !== undefined && changes.lat !== undefined) {
        values.push(changes.lng, changes.lat);
        sets.push(
          `location = ST_SetSRID(ST_MakePoint($${values.length - 1}, $${values.length}), 4326)`,
        );
      }
      const { rowCount } = await db.query(
        `UPDATE points_of_interest SET ${[...sets, 'updated_by = $2'].join(', ')} WHERE id = $1`,
        values,
      );
      return rowCount > 0;
    },

    /** Eliminación lógica (o su reversión). Libera su parada del recorrido. */
    async setPointDeleted(id, deleted, userId) {
      const { rowCount } = await db.query(
        `UPDATE points_of_interest
            SET deleted_at = CASE WHEN $2 THEN now() ELSE NULL END,
                tour_stop = CASE WHEN $2 THEN NULL ELSE tour_stop END,
                updated_by = $3
          WHERE id = $1 AND (deleted_at IS NULL) = $2`,
        [id, deleted, userId],
      );
      return rowCount > 0;
    },

    async listLayers() {
      const { rows } = await db.query(
        `SELECT id, slug, name, color, icon, sort_order, is_active
           FROM layers ORDER BY sort_order, id`,
      );
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        color: row.color,
        icon: row.icon,
        sortOrder: row.sort_order,
        isActive: row.is_active,
      }));
    },

    async updateLayer(id, changes) {
      const columns = {
        name: 'name',
        color: 'color',
        sortOrder: 'sort_order',
        isActive: 'is_active',
      };
      const sets = [];
      const values = [id];
      for (const [key, column] of Object.entries(columns)) {
        if (changes[key] === undefined) continue;
        values.push(changes[key]);
        sets.push(`${column} = $${values.length}`);
      }
      if (sets.length === 0) return true;
      const { rowCount } = await db.query(
        `UPDATE layers SET ${sets.join(', ')} WHERE id = $1`,
        values,
      );
      return rowCount > 0;
    },

    /** Agrega una imagen; si es la principal, la anterior deja de serlo. */
    addImage(image) {
      return inTransaction(async (client) => {
        if (image.isMain) {
          await client.query('UPDATE images SET is_main = false WHERE point_id = $1', [
            image.pointId,
          ]);
        }
        const { rows } = await client.query(
          `INSERT INTO images (point_id, file_path, alt_text, credit, is_main, kind, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6,
                   (SELECT COALESCE(max(sort_order), 0) + 1 FROM images WHERE point_id = $1))
           RETURNING id`,
          [image.pointId, image.filePath, image.altText, image.credit, image.isMain, image.kind],
        );
        return rows[0].id;
      });
    },

    /** Cambia textos u orden de una imagen, o la vuelve principal. */
    updateImage(id, changes) {
      return inTransaction(async (client) => {
        const { rows } = await client.query('SELECT point_id FROM images WHERE id = $1', [id]);
        if (rows.length === 0) return false;
        if (changes.isMain) {
          await client.query('UPDATE images SET is_main = false WHERE point_id = $1', [
            rows[0].point_id,
          ]);
        }
        const columns = {
          altText: 'alt_text',
          credit: 'credit',
          sortOrder: 'sort_order',
          isMain: 'is_main',
        };
        const sets = [];
        const values = [id];
        for (const [key, column] of Object.entries(columns)) {
          if (changes[key] === undefined) continue;
          values.push(changes[key]);
          sets.push(`${column} = $${values.length}`);
        }
        if (sets.length > 0) {
          await client.query(`UPDATE images SET ${sets.join(', ')} WHERE id = $1`, values);
        }
        return true;
      });
    },

    /** Quita la imagen del punto (el archivo queda en disco); devuelve su punto. */
    async deleteImage(id) {
      const { rows } = await db.query('DELETE FROM images WHERE id = $1 RETURNING point_id', [id]);
      return rows[0]?.point_id ?? null;
    },

    async recordVisit({ pointId, type }) {
      await db.query(
        `INSERT INTO visit_events (point_id, type)
         SELECT $1, $2
          WHERE $1::int IS NULL
             OR EXISTS (SELECT 1 FROM points_of_interest WHERE id = $1 AND deleted_at IS NULL)`,
        [pointId ?? null, type],
      );
    },

    /** Visitas por lugar y por día entre `from` (incluido) y `to` (excluido). */
    async visitStats(from, to) {
      const [byPoint, byDay] = await Promise.all([
        db.query(
          `SELECT p.id, p.name, count(v.id)::int AS visits
             FROM points_of_interest p
             LEFT JOIN visit_events v
               ON v.point_id = p.id AND v.type = 'point_open'
              AND v.created_at >= $1 AND v.created_at < $2
            WHERE p.deleted_at IS NULL
            GROUP BY p.id, p.name
            ORDER BY visits DESC, p.name`,
          [from, to],
        ),
        db.query(
          `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'America/Santiago'), 'YYYY-MM-DD') AS day,
                  count(*) FILTER (WHERE type = 'point_open')::int AS visits,
                  count(*) FILTER (WHERE type = 'tour_complete')::int AS tours
             FROM visit_events
            WHERE created_at >= $1 AND created_at < $2
            GROUP BY 1 ORDER BY 1`,
          [from, to],
        ),
      ]);
      return { byPoint: byPoint.rows, byDay: byDay.rows };
    },

    async listAudit(limit = 100) {
      const { rows } = await db.query(
        `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.created_at, u.username
           FROM audit_log a LEFT JOIN admin_users u ON u.id = a.user_id
          ORDER BY a.created_at DESC, a.id DESC
          LIMIT $1`,
        [limit],
      );
      return rows.map((row) => ({
        id: row.id,
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id,
        details: row.details,
        createdAt: row.created_at,
        username: row.username,
      }));
    },
  };
}
