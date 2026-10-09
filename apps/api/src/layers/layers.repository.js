/**
 * Acceso SQL a las capas temáticas.
 * Convierte las columnas snake_case de la base de datos a camelCase.
 *
 * @param {{ query: Function }} db
 */
export function createLayersRepository(db) {
  return {
    /**
     * Capas activas ordenadas para mostrarlas en el control del visor.
     *
     * @returns {Promise<Array<{ id: number, slug: string, name: string, color: string,
     *   icon: string | null, sortOrder: number }>>}
     */
    async findActive() {
      const { rows } = await db.query(
        `SELECT id, slug, name, color, icon, sort_order
           FROM layers
          WHERE is_active
          ORDER BY sort_order, id`,
      );
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        color: row.color,
        icon: row.icon,
        sortOrder: row.sort_order,
      }));
    },
  };
}
