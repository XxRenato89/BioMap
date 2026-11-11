-- Up Migration
/*
 * Modelo 3D e icono del lugar, elegidos en el panel de administración. Antes
 * salían solo del nombre: renombrar un lugar le cambiaba el modelo. NULL deja
 * que el visor los deduzca del nombre, como hasta ahora; model_kind = 'none'
 * es "sin modelo". Los valores los interpreta el visor (los que no conoce los
 * ignora), así que aquí solo se limita la forma.
 */
ALTER TABLE points_of_interest
  ADD COLUMN model_kind text CHECK (model_kind ~ '^[A-Za-z]{1,24}$'),
  ADD COLUMN icon text CHECK (icon ~ '^[A-Za-z]{1,24}$');

-- Down Migration
ALTER TABLE points_of_interest
  DROP COLUMN IF EXISTS model_kind,
  DROP COLUMN IF EXISTS icon;
