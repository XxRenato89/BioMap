const ACTIONS = new Set(['create', 'update', 'delete', 'restore']);
const ENTITIES = new Set(['point', 'image', 'layer']);

/**
 * Registra una acción del panel de administración en audit_log.
 * Valida los datos antes de tocar la base de datos para que un error de
 * programación no termine como un error de restricción poco claro.
 * Lo usarán las rutas de escritura de la Iteración 5.
 *
 * @param {{ query: Function }} db
 * @param {{ userId?: number | null, action: string, entity: string,
 *   entityId: number, details?: object | null }} entry
 * @returns {Promise<string>} id del registro creado (bigint como texto)
 */
export async function recordAudit(db, { userId = null, action, entity, entityId, details = null }) {
  if (!ACTIONS.has(action)) throw new TypeError(`Invalid audit action: ${action}`);
  if (!ENTITIES.has(entity)) throw new TypeError(`Invalid audit entity: ${entity}`);
  if (!Number.isInteger(entityId) || entityId <= 0) {
    throw new TypeError(`Invalid audit entityId: ${entityId}`);
  }
  const { rows } = await db.query(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, action, entity, entityId, details === null ? null : JSON.stringify(details)],
  );
  return rows[0].id;
}
