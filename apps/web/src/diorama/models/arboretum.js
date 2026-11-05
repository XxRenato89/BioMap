import { CircleGeometry, Group, IcosahedronGeometry, TorusGeometry } from 'three';
import { box, cone, cyl, grassPad, mat, part, seeded, trunk, white, wood } from './materials.js';

/** Copa facetada entera (no un cilindro cortado): esfera achatada o alargada. */
function crown(g, color, x, y, z, radius, stretch = 1) {
  const leaves = mat(`arbo-${color.toString(16)}`, color, { flatShading: true });
  const mesh = part(new IcosahedronGeometry(radius, 1), leaves, x, y, z);
  mesh.scale.set(1, stretch, 1);
  g.add(mesh);
}

/**
 * Arboretum de Quilaco (sus fotos de Google Maps): un claro de pasto con un
 * sendero interpretativo de ripio en lazo, ejemplares adultos de especies
 * nativas (copas redondas, un ciprés columnar, araucarias con su copa en
 * paraguas), arbolitos recién plantados con su tutor y su placa junto al
 * sendero, bancas y el letrero de la entrada: un muro verde con el logo.
 *
 * @returns {Group}
 */
export function buildArboretum() {
  const g = new Group();
  g.add(cyl(4.6, 4.8, 0.14, 28, grassPad(), 0, 0.07, 0));

  /* Sendero de ripio en lazo. */
  const path = part(new TorusGeometry(2.6, 0.3, 4, 40), mat('gravel', 0xcbbf9f), 0, 0.15, 0);
  path.rotation.x = Math.PI / 2;
  path.scale.z = 0.25;
  g.add(path);

  /* Ejemplares adultos fuera del lazo, con la copa entera sobre el tronco. */
  const adults = [
    [0.4, 0x3f7a3a, 1.1, 1],
    [1.3, 0x5b8f3c, 0.9, 1.15],
    [2.4, 0x2f5f3a, 1, 0.9],
    [3.5, 0x7a9a3a, 0.8, 1.1],
    [4.6, 0x4d7f4f, 1.05, 1],
  ];
  for (const [angle, color, radius, stretch] of adults) {
    const [x, z] = [Math.cos(angle) * 3.7, Math.sin(angle) * 3.7];
    g.add(cyl(0.09, 0.14, 1.4, 6, trunk(), x, 0.84, z));
    crown(g, color, x, 1.5 + radius * stretch * 0.8, z, radius, stretch);
  }
  /* Ciprés columnar. */
  g.add(cyl(0.07, 0.1, 0.6, 5, trunk(), -0.9, 0.44, 3.6));
  crown(g, 0x2f5a3a, -0.9, 1.9, 3.6, 0.42, 3);
  /* Araucarias: tronco alto y recto, copa en paraguas. */
  for (const [x, z] of [
    [-3.4, 1.6],
    [3.3, -1.9],
  ]) {
    g.add(cyl(0.1, 0.14, 3, 6, mat('araucariaBark', 0x6a5444), x, 1.64, z));
    const umbrella = cone(1, 0.7, 9, mat('araucaria', 0x2e4f2e, { flatShading: true }), x, 3.35, z);
    g.add(umbrella);
    g.add(cone(0.85, 0.35, 9, mat('araucaria', 0x2e4f2e), x, 3.05, z).rotateX(Math.PI));
  }

  /* Arbolitos recién plantados junto al sendero: tutor, copa chica y placa. */
  const random = seeded(31);
  for (let k = 0; k < 12; k += 1) {
    const angle = (k / 12) * Math.PI * 2 + 0.15;
    const r = k % 2 ? 2.05 : 3.1;
    const [x, z] = [Math.cos(angle) * r, Math.sin(angle) * r];
    g.add(cyl(0.025, 0.035, 0.7, 4, trunk(), x, 0.48, z));
    g.add(cyl(0.02, 0.02, 0.85, 4, mat('stake', 0xc9a87a), x + 0.08, 0.56, z));
    crown(g, random() < 0.5 ? 0x6fa04a : 0x4f8a3e, x, 0.95, z, 0.22 + random() * 0.08);
    g.add(box(0.16, 0.12, 0.02, mat('plaque', 0x2f5d43), x + 0.2, 0.25, z + 0.1));
  }

  /* Bancas mirando al centro. */
  for (const angle of [1.9, 5.1]) {
    const [x, z] = [Math.cos(angle) * 1.4, Math.sin(angle) * 1.4];
    const bench = box(0.8, 0.07, 0.28, wood(), x, 0.32, z);
    bench.rotation.y = -angle;
    g.add(bench);
  }

  /* Letrero de la entrada: muro verde con el logo (disco blanco y araucaria). */
  g.add(box(0.2, 1.4, 1.3, mat('livingWall', 0x4e7d3a, { flatShading: true }), 4.5, 0.84, 0));
  const logo = part(new CircleGeometry(0.42, 20), white(), 4.61, 0.95, 0);
  logo.rotation.y = Math.PI / 2;
  g.add(logo);
  g.add(cyl(0.02, 0.02, 0.36, 4, mat('logoTrunk', 0x5a4634), 4.63, 0.9, 0));
  g.add(cone(0.18, 0.12, 7, mat('araucaria', 0x2e4f2e), 4.63, 1.12, 0));
  return g;
}
