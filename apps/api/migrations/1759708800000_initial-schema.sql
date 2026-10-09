-- Up Migration

/*
 * Esquema inicial del MVP de BioMap.
 * Incluye las tablas de autenticación y auditoría aunque se usen en
 * iteraciones posteriores, para no migrar el esquema a mitad del desarrollo.
 */
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

/*
 * Mantiene updated_at al día en cada UPDATE.
 */
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE admin_users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE layers (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9-]*$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  color text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER layers_set_updated_at
  BEFORE UPDATE ON layers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/*
 * Puntos de interés. deleted_at implementa la eliminación lógica:
 * un punto eliminado no se borra, solo deja de mostrarse.
 */
CREATE TABLE points_of_interest (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layer_id smallint NOT NULL REFERENCES layers (id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text NOT NULL DEFAULT '',
  location geometry(Point, 4326) NOT NULL
    CHECK (ST_X(location) BETWEEN -180 AND 180 AND ST_Y(location) BETWEEN -90 AND 90),
  created_by integer REFERENCES admin_users (id),
  updated_by integer REFERENCES admin_users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX points_of_interest_location_idx ON points_of_interest USING gist (location);
CREATE INDEX points_of_interest_active_layer_idx
  ON points_of_interest (layer_id) WHERE deleted_at IS NULL;

CREATE TRIGGER points_of_interest_set_updated_at
  BEFORE UPDATE ON points_of_interest FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/*
 * Imágenes de cada punto. El texto alternativo y el crédito son obligatorios
 * (accesibilidad y autorización del contenido). Solo una imagen principal por punto.
 */
CREATE TABLE images (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  point_id integer NOT NULL REFERENCES points_of_interest (id) ON DELETE RESTRICT,
  file_path text NOT NULL CHECK (btrim(file_path) <> ''),
  alt_text text NOT NULL CHECK (btrim(alt_text) <> ''),
  credit text NOT NULL CHECK (btrim(credit) <> ''),
  is_main boolean NOT NULL DEFAULT false,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX images_one_main_per_point_idx ON images (point_id) WHERE is_main;
CREATE INDEX images_point_idx ON images (point_id);

CREATE TABLE login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL,
  ip inet,
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_username_time_idx ON login_attempts (username, attempted_at);

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer REFERENCES admin_users (id),
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  entity text NOT NULL CHECK (entity IN ('point', 'image', 'layer')),
  entity_id integer NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_created_at_idx ON audit_log (created_at);

-- Down Migration

/*
 * Las extensiones no se eliminan: pueden estar en uso por otros esquemas.
 */
DROP TABLE IF EXISTS audit_log, login_attempts, images, points_of_interest, layers, admin_users;
DROP FUNCTION IF EXISTS set_updated_at();
