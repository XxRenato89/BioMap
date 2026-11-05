-- Up Migration
/*
 * Panel de administración: un único administrador, que debe cambiar su
 * contraseña la primera vez y cada cierto tiempo; y registro de visitas a los
 * lugares para las estadísticas.
 */
ALTER TABLE admin_users
  ADD COLUMN password_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT true;

/* Un solo administrador: la tabla no admite una segunda fila. */
CREATE UNIQUE INDEX admin_users_single_idx ON admin_users ((true));

/*
 * Visitas: cada vez que se abre la ficha de un lugar (kiosco o teléfono) o se
 * completa el recorrido. Sin datos personales.
 */
CREATE TABLE visit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  point_id integer REFERENCES points_of_interest (id),
  type text NOT NULL CHECK (type IN ('point_open', 'tour_complete')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visit_events_created_at_idx ON visit_events (created_at);

-- Down Migration
DROP TABLE IF EXISTS visit_events;
DROP INDEX IF EXISTS admin_users_single_idx;
ALTER TABLE admin_users
  DROP COLUMN IF EXISTS must_change_password,
  DROP COLUMN IF EXISTS password_changed_at;
