import { Group, TorusGeometry } from 'three';
import { box, cone, cyl, grassPad, mat, part, trunk, wood } from './materials.js';

/**
 * Arboreto: un claro con sendero circular, ejemplares de distintas especies
 * (copas redondas, cónicas y columnares) y un cerco de palos.
 *
 * @returns {Group}
 */
export function buildArboretum() {
  const g = new Group();
  g.add(cyl(4.6, 4.8, 0.14, 24, grassPad(), 0, 0.07, 0));
  const path = part(new TorusGeometry(2.6, 0.32, 4, 32), mat('gravel', 0xcbbf9f), 0, 0.15, 0);
  path.rotation.x = Math.PI / 2;
  path.scale.z = 0.25;
  g.add(path);
  const crowns = [0x3f7a3a, 0x5b8f3c, 0x2f5f3a, 0x7a9a3a, 0x9a6b2f, 0x4d7f4f];
  for (let k = 0; k < 9; k += 1) {
    const angle = (k / 9) * Math.PI * 2;
    const radius = k % 2 ? 1.5 : 3.6;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const color = mat(`crown${k % crowns.length}`, crowns[k % crowns.length], {
      flatShading: true,
    });
    g.add(cyl(0.08, 0.12, 1.2, 5, trunk(), x, 0.7, z));
    if (k % 3 === 0) g.add(cone(0.6, 1.8, 7, color, x, 2.0, z));
    else if (k % 3 === 1) g.add(cyl(0.5, 0.75, 1.3, 7, color, x, 1.8, z));
    else g.add(cyl(0.25, 0.35, 2.2, 6, color, x, 2.2, z));
  }
  /* Cerco de palos alrededor. */
  for (let k = 0; k < 20; k += 1) {
    const angle = (k / 20) * Math.PI * 2;
    g.add(cyl(0.05, 0.05, 0.7, 4, wood(), Math.cos(angle) * 4.4, 0.45, Math.sin(angle) * 4.4));
  }
  g.add(box(1.2, 0.6, 0.06, mat('signGreen', 0x2f5d43), 4.6, 1.1, 0));
  g.add(cyl(0.05, 0.05, 1.1, 4, wood(), 4.6, 0.55, 0));
  return g;
}
