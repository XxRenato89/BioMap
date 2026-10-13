import { CylinderGeometry, Group } from 'three';
import { box, concrete, concreteDark, cyl, dark, mat, part, stone } from './materials.js';

/**
 * Central Angostura: la casa de máquinas es una caverna bajo el cerro (59 m
 * de alto, 177 m de largo), así que en superficie se ve lo de las fotos de
 * la obra: el corte de roca en la ladera con el portal del túnel de acceso,
 * la losa de compuertas de la toma y la grúa pórtico amarilla sobre rieles
 * que las maniobra, con sus contenedores de faena.
 *
 * @returns {Group}
 */
export function buildPowerhouse() {
  const g = new Group();
  const yellow = mat('gantry', 0xe8c21c, { roughness: 0.5 });
  const blue = mat('hoist', 0x2f5fa8);
  /* Explanada y corte de roca en la ladera. */
  g.add(box(9, 0.2, 7, concreteDark(), 0, 0.1, 0));
  g.add(box(9, 4.2, 1.2, stone(), 0, 2.2, -3.4));
  /* Portal del túnel: marco de hormigón con la boca en arco, hacia la caverna. */
  g.add(box(2.6, 2.6, 0.6, concrete(), -2.4, 1.4, -2.6));
  const mouth = part(
    new CylinderGeometry(0.85, 0.85, 0.62, 16, 1, false, 0, Math.PI),
    dark(),
    -2.4,
    1.45,
    -2.58,
  );
  mouth.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  g.add(mouth);
  g.add(box(1.7, 1.0, 0.62, dark(), -2.4, 0.75, -2.58));
  /* Losa de la toma con las ranuras de las compuertas. */
  g.add(box(4.6, 0.7, 3.2, concrete(), 1.9, 0.55, -0.6));
  [0.8, 1.9, 3.0].forEach((x) => g.add(box(0.5, 0.06, 2.4, dark(), x, 0.92, -0.6)));
  /* Rieles y grúa pórtico amarilla con su carro y polipasto azul. */
  [-0.95, 1.85].forEach((z) =>
    g.add(box(5.4, 0.08, 0.12, mat('rail', 0x6b6f72), 1.9, 0.95, z - 0.45)),
  );
  [-0.3, 4.1].forEach((x) =>
    [-1.4, 1.4].forEach((dz) => g.add(box(0.22, 3.2, 0.22, yellow, x, 2.55, -0.6 + dz))),
  );
  [-1.4, 1.4].forEach((dz) => g.add(box(4.8, 0.4, 0.3, yellow, 1.9, 4.2, -0.6 + dz)));
  g.add(box(1.0, 0.6, 3.2, blue, 1.4, 4.65, -0.6));
  g.add(cyl(0.03, 0.03, 2.2, 4, dark(), 1.4, 3.3, -0.6));
  /* Contenedores de faena. */
  g.add(box(2.4, 1.1, 1.0, yellow, 2.6, 0.75, 2.4));
  g.add(box(2.0, 1.1, 1.0, mat('containerWhite', 0xe9e8e2), -0.6, 0.75, 2.4));
  return g;
}
