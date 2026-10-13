import { Group, SphereGeometry } from 'three';
import { cone, cyl, dark, mat, part, seeded, white } from './materials.js';

/**
 * Humedal: laguna con juncos y aves.
 *
 * @returns {Group}
 */
export function buildWetland() {
  const g = new Group();
  g.add(cyl(3.5, 3.7, 0.3, 24, mat('mud', 0x6c5b3d), 0, 0.15, 0));
  g.add(
    cyl(
      2.9,
      2.9,
      0.14,
      24,
      mat('pond', 0x5aa0b2, { transparent: true, opacity: 0.92, roughness: 0.1 }),
      0,
      0.33,
      0,
    ),
  );
  const random = seeded(11);
  for (let k = 0; k < 60; k += 1) {
    const a = random() * Math.PI * 2;
    const r = 2.3 + random() * 1.1;
    const h = 0.7 + random() * 0.9;
    const reed = cone(
      0.05,
      h,
      4,
      mat(k % 2 ? 'reed1' : 'reed2', k % 2 ? 0xb9c56c : 0x8aa34c),
      Math.cos(a) * r,
      h / 2 + 0.3,
      Math.sin(a) * r,
    );
    reed.rotation.z = (random() - 0.5) * 0.25;
    g.add(reed);
  }
  for (let q = 0; q < 2; q += 1) {
    const bird = new Group();
    const body = part(new SphereGeometry(0.28, 10, 8), white(), 0, 0.25, 0);
    body.scale.set(1.5, 0.9, 1);
    bird.add(body, part(new SphereGeometry(0.14, 8, 6), dark(), 0.34, 0.5, 0));
    bird.position.set(-0.8 + q * 1.4, 0.45, q ? 0.6 : -0.4);
    bird.rotation.y = random() * 6;
    g.add(bird);
  }
  return g;
}
