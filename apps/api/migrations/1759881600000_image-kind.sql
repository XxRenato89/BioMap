-- Up Migration
/*
 * Tipo de imagen: fotografía común o panorama 360° (equirectangular), que el
 * visor muestra en su visor esférico. Un panorama no puede ser la imagen
 * principal del punto, porque se ve deformado como foto plana.
 * El valor por defecto es constante, así que agregar la columna no reescribe la tabla.
 */
ALTER TABLE images
  ADD COLUMN kind text NOT NULL DEFAULT 'photo'
    CONSTRAINT images_kind_check CHECK (kind IN ('photo', 'panorama')),
  ADD CONSTRAINT images_main_is_photo_check CHECK (NOT is_main OR kind = 'photo');

-- Down Migration
ALTER TABLE images
  DROP CONSTRAINT IF EXISTS images_main_is_photo_check,
  DROP COLUMN IF EXISTS kind;
