import { Group, TorusGeometry } from 'three';
import { box, cone, cyl, mat, part, stone, white, wood } from './materials.js';

/**
 * Mirador: plataforma octogonal sobre pilotes con baranda, techo de tejuela,
 * escalera de acceso y una bandera.
 *
 * @returns {Group}
 */
export function buildLookout() {
  const g = new Group();
  [
    [1.2, 1.2],
    [-1.2, 1.2],
    [1.2, -1.2],
    [-1.2, -1.2],
  ].forEach(([x, z]) => g.add(cyl(0.17, 0.2, 2.2, 6, stone(), x, 1.1, z)));
  g.add(cyl(1.9, 1.9, 0.18, 8, wood(), 0, 2.2, 0));
  const ring = part(new TorusGeometry(1.75, 0.045, 5, 8), mat('rail', 0xe9e4d6), 0, 3, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  for (let k = 0; k < 8; k += 1) {
    const an = (k / 8) * Math.PI * 2;
    g.add(
      cyl(
        0.045,
        0.045,
        0.8,
        4,
        mat('rail', 0xe9e4d6),
        Math.cos(an) * 1.75,
        2.6,
        Math.sin(an) * 1.75,
      ),
    );
  }
  /* Techo sobre cuatro pilares. */
  [0.25, 1.82, 3.39, 4.96].forEach((an) =>
    g.add(cyl(0.07, 0.07, 1.9, 5, wood(), Math.cos(an) * 1.5, 3.2, Math.sin(an) * 1.5)),
  );
  const roof = cone(2.4, 1.1, 8, mat('shingle', 0x6b4630), 0, 4.65, 0);
  roof.rotation.y = Math.PI / 8;
  g.add(roof);
  /* Escalera. */
  for (let k = 0; k < 6; k += 1)
    g.add(box(0.8, 0.08, 0.35, wood(), 2.4 + k * 0.32, 2.05 - k * 0.36, 0));
  g.add(cyl(0.04, 0.04, 4.2, 6, white(), -0.7, 4.3, -0.7));
  g.add(box(0.9, 0.55, 0.03, mat('flag', 0xef7b5d), -0.25, 5.7, -0.7));
  return g;
}
