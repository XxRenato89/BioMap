-- Up Migration
/*
 * Lugar secreto: no se muestra en el mapa hasta que la mascota pasa cerca y lo
 * descubre. Valor por defecto constante: agregar la columna no reescribe la tabla.
 */
ALTER TABLE points_of_interest ADD COLUMN is_secret boolean NOT NULL DEFAULT false;

-- Down Migration
ALTER TABLE points_of_interest DROP COLUMN IF EXISTS is_secret;
