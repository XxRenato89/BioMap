-- Up Migration
/*
 * Recorrido guiado: la parada (1, 2, 3…) de cada punto que forma parte del
 * recorrido que hace la mascota; NULL si el punto no está en él. Dos puntos
 * vigentes no pueden ser la misma parada. Columna nula sin valor por defecto:
 * agregarla no reescribe la tabla.
 */
ALTER TABLE points_of_interest
  ADD COLUMN tour_stop smallint CONSTRAINT points_of_interest_tour_stop_check CHECK (tour_stop > 0);

CREATE UNIQUE INDEX points_of_interest_tour_stop_idx
  ON points_of_interest (tour_stop) WHERE tour_stop IS NOT NULL AND deleted_at IS NULL;

-- Down Migration
DROP INDEX IF EXISTS points_of_interest_tour_stop_idx;
ALTER TABLE points_of_interest DROP COLUMN IF EXISTS tour_stop;
