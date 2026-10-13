import { Group } from 'three';
import { box, cyl, mat, prism, white, wood } from './materials.js';

/**
 * Informaciones turísticas: caseta de madera con techo a dos aguas, su
 * letrero azul con la "i" y una banca al frente.
 *
 * @returns {Group}
 */
export function buildInfo() {
  const g = new Group();
  g.add(box(4.2, 0.14, 3.4, mat('infoPad', 0xb8ad97), 0, 0.07, 0));
  g.add(box(2.6, 1.9, 2, wood(), 0, 1.09, -0.3));
  const roof = prism(3.2, 2.6, mat('roofRed', 0x9b3d2c), 0, 2.04, -0.3);
  roof.rotation.y = Math.PI / 2;
  g.add(roof);
  /* Ventanilla de atención. */
  g.add(box(1.3, 0.7, 0.05, mat('window', 0x2f4f5a), 0, 1.35, 0.72));
  g.add(box(1.5, 0.08, 0.35, white(), 0, 0.98, 0.85));
  /* Letrero: poste y panel azul con la "i". */
  g.add(cyl(0.06, 0.06, 2.6, 6, white(), 1.7, 1.3, 1.1));
  g.add(box(0.9, 0.9, 0.08, mat('infoBlue', 0x2563a8), 1.7, 2.7, 1.1));
  g.add(box(0.14, 0.45, 0.1, white(), 1.7, 2.6, 1.12));
  g.add(box(0.14, 0.12, 0.1, white(), 1.7, 2.97, 1.12));
  /* Banca. */
  g.add(box(1.4, 0.07, 0.4, wood(), -1.2, 0.55, 1.2));
  [-1.75, -0.65].forEach((x) => g.add(box(0.07, 0.48, 0.36, wood(), x, 0.32, 1.2)));
  return g;
}
