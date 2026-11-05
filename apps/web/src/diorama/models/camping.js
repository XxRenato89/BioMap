import {
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import {
  box,
  cone,
  cyl,
  grassPad,
  mat,
  part,
  prism,
  sand,
  stone,
  thatch,
  trunk,
} from './materials.js';

/* Colores de las fotos de Los Notros: kayaks rojo y amarillo, baranda y postes
   rojos, madera oscura de las reposeras, techo turquesa de la lancha. */
const railRed = () => mat('campRail', 0xb8322a);
const darkWood = () => mat('campDarkWood', 0x5b3a26);
const concreteWalk = () => mat('campWalk', 0xd9d5cb);
const curve = (points) => new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)));

/**
 * Quitasol de paja con flecos sobre poste rojo y base cuadrada de piedra.
 */
function umbrella(g, x, z) {
  g.add(box(0.6, 0.32, 0.6, stone(), x, 0.32, z));
  g.add(cyl(0.05, 0.05, 1.5, 6, railRed(), x, 1.2, z));
  g.add(cone(0.95, 0.42, 12, thatch(), x, 2.05, z));
  /* Flecos: un anillo corto y algo más ancho bajo el techo. */
  g.add(cyl(0.98, 1.0, 0.16, 12, thatch(), x, 1.78, z));
}

/**
 * Reposera de madera oscura con el respaldo alzado, mirando al agua (+z).
 */
function lounger(g, x, z, turn = 0) {
  const chair = new Group();
  chair.add(box(0.45, 0.06, 1.05, darkWood(), 0, 0.26, 0.1));
  const back = box(0.45, 0.06, 0.55, darkWood(), 0, 0.46, -0.52);
  back.rotation.x = -0.85;
  chair.add(back);
  [-0.19, 0.19].forEach((dx) => chair.add(box(0.05, 0.24, 0.95, darkWood(), dx, 0.12, 0.05)));
  chair.position.set(x, 0.16, z);
  chair.rotation.y = turn;
  g.add(chair);
}

/**
 * Kayak varado en la arena.
 */
function kayak(g, x, z, color, turn) {
  const k = new Group();
  const hull = part(new SphereGeometry(0.5, 10, 6), mat(`kayak${color}`, color));
  hull.scale.set(0.42, 0.22, 2.3);
  k.add(hull);
  k.add(box(0.24, 0.05, 0.5, mat('cockpit', 0x22262a), 0, 0.1, 0));
  k.position.set(x, 0.24, z);
  k.rotation.y = turn;
  g.add(k);
}

/**
 * Lancha de paseo blanca con techo turquesa, amarrada al muelle.
 */
function boat(g, x, z) {
  const b = new Group();
  const hull = part(
    new SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    mat('boatHull', 0xf4f4ef),
  );
  hull.rotation.x = Math.PI;
  hull.scale.set(1.0, 0.45, 3.0);
  b.add(hull);
  b.add(box(0.95, 0.1, 2.6, mat('boatDeck', 0xd9d3c4), 0, 0.02, 0));
  [-0.4, 0.4].forEach((dx) =>
    [-0.9, 0.9].forEach((dz) =>
      b.add(cyl(0.03, 0.03, 0.75, 4, mat('boatPost', 0xe8e8e8), dx, 0.42, dz)),
    ),
  );
  b.add(box(1.05, 0.08, 2.3, mat('boatRoof', 0x2fb8b0), 0, 0.82, 0));
  b.position.set(x, 0.12, z);
  b.rotation.y = Math.PI / 2;
  g.add(b);
}

/**
 * Baranda roja a lo largo de una curva, del lado del agua.
 */
function railing(g, path, posts) {
  const pts = path.getSpacedPoints(posts);
  pts.forEach((p) => g.add(box(0.07, 0.8, 0.07, railRed(), p.x, 0.6, p.z)));
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const length = a.distanceTo(b);
    const turn = Math.atan2(b.x - a.x, b.z - a.z);
    [0.95, 0.62].forEach((y) => {
      const rail = box(0.05, 0.05, length, railRed(), (a.x + b.x) / 2, y, (a.z + b.z) / 2);
      rail.rotation.y = turn;
      g.add(rail);
    });
  }
}

/**
 * Árbol grande de copa ancha, como el de la punta de Los Notros.
 */
function bigTree(g, x, z) {
  g.add(cyl(0.16, 0.26, 2.0, 7, trunk(), x, 1.1, z));
  [
    [0, 2.5, 0, 1.25],
    [0.9, 2.3, 0.3, 0.95],
    [-0.8, 2.4, -0.2, 0.9],
    [0.2, 2.9, -0.6, 0.85],
    [-0.3, 2.2, 0.8, 0.8],
  ].forEach(([dx, y, dz, r]) => {
    const crown = part(new IcosahedronGeometry(r, 1), mat('campTree', 0x3b6331), x + dx, y, z + dz);
    crown.scale.y = 0.62;
    g.add(crown);
  });
}

/**
 * Carpa iglú (domo) con su entrada.
 */
function domeTent(g, x, z, color, turn) {
  const t = new Group();
  const dome = part(
    new SphereGeometry(0.8, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(`tent${color}`, color),
  );
  dome.scale.set(1.15, 0.85, 1);
  t.add(dome);
  t.add(prism(0.7, 0.5, mat('tentDoor', 0x2d2a26), 0, 0, 0.75));
  t.position.set(x, 0.16, z);
  t.rotation.y = turn;
  g.add(t);
}

/**
 * Mesa de picnic con bancas.
 */
function picnicTable(g, x, z, turn) {
  const table = new Group();
  table.add(box(1.6, 0.08, 0.7, darkWood(), 0, 0.75, 0));
  table.add(box(1.6, 0.06, 0.28, darkWood(), 0, 0.42, 0.62));
  table.add(box(1.6, 0.06, 0.28, darkWood(), 0, 0.42, -0.62));
  [-0.65, 0.65].forEach((dx) => table.add(box(0.08, 0.75, 1.5, darkWood(), dx, 0.38, 0)));
  table.position.set(x, 0.16, z);
  table.rotation.y = turn;
  g.add(table);
}

/**
 * Camping a orillas del embalse según las fotos aéreas de Los Notros: una
 * playa de arena con quitasoles de paja sobre bases de piedra y reposeras de
 * madera; una barra de arena curva que encierra la zona de baño, con el muelle
 * y la lancha de paseo; un paseo de hormigón con baranda roja hasta la punta,
 * donde está el árbol grande; y atrás, en el pasto, carpas iglú, el quincho,
 * mesas de picnic y la fogata. El agua queda hacia +z (el modelo se gira para
 * mirarla).
 *
 * @returns {Group}
 */
export function buildCamping() {
  const g = new Group();

  /* Terraza de pasto, algo más ancha que honda. */
  const pad = cyl(4.4, 4.6, 0.16, 28, grassPad(), 0, 0.08, 0);
  pad.scale.set(1.15, 1, 1);
  g.add(pad);

  /* Playa: media luna de arena hacia el agua. */
  const beach = part(
    new CylinderGeometry(4.0, 4.3, 0.18, 24, 1, false, -Math.PI / 2, Math.PI),
    sand(),
    -0.4,
    0.1,
    0.6,
  );
  beach.scale.set(1.05, 1, 0.95);
  g.add(beach);

  /* Barra de arena curva que nace en la playa y encierra la zona de baño. */
  const spit = curve([
    [-4.3, 2.4],
    [-4.8, 4.4],
    [-3.6, 6.0],
    [-1.4, 6.6],
    [0.6, 6.4],
  ]);
  const spitMesh = part(new TubeGeometry(spit, 32, 0.5, 6, false), sand(), 0, 0.1, 0);
  spitMesh.scale.y = 0.35;
  g.add(spitMesh);

  /* Línea de boyas que cierra la zona de baño, de la punta de la barra al paseo. */
  curve([
    [0.6, 6.4],
    [2.0, 5.6],
    [3.4, 4.5],
  ])
    .getSpacedPoints(8)
    .forEach((p, i) =>
      g.add(
        part(
          new SphereGeometry(0.1, 6, 4),
          mat(i % 2 ? 'buoyW' : 'buoyO', i % 2 ? 0xf2f0e9 : 0xf07a28),
          p.x,
          0.12,
          p.z,
        ),
      ),
    );

  /* Muelle de madera en la barra, con la lancha de paseo. */
  g.add(box(2.4, 0.08, 0.7, mat('pier', 0x9a7350), -2.0, 0.24, 5.9));
  boat(g, -2.0, 5.15);

  /* Paseo de hormigón con baranda roja por la orilla derecha, hasta la punta. */
  const walk = curve([
    [1.8, -0.6],
    [3.0, 0.8],
    [3.8, 2.6],
    [4.2, 4.2],
  ]);
  walk.getSpacedPoints(14).forEach((p, i, all) => {
    if (i === all.length - 1) return;
    const q = all[i + 1];
    const slab = box(
      0.9,
      0.06,
      p.distanceTo(q) + 0.05,
      concreteWalk(),
      (p.x + q.x) / 2,
      0.2,
      (p.z + q.z) / 2,
    );
    slab.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
    g.add(slab);
  });
  railing(
    g,
    curve([
      [2.3, -0.8],
      [3.5, 0.6],
      [4.3, 2.5],
      [4.7, 4.2],
    ]),
    10,
  );
  bigTree(g, 3.9, 4.9);

  /* Quitasoles en fila frente al agua, y reposeras en el borde del pasto. */
  [-2.6, -0.9, 0.8].forEach((x) => umbrella(g, x, 1.6));
  [-3.0, -2.3, -1.4, -0.6, 0.3, 1.1].forEach((x, i) =>
    lounger(g, x, 0.25, (i % 2 ? -1 : 1) * 0.06),
  );

  /* Kayaks en la arena, junto a la barra. */
  kayak(g, -3.3, 3.3, 0xd8402f, 0.5);
  kayak(g, -2.6, 3.6, 0xf2c230, 0.35);
  kayak(g, -1.9, 3.9, 0xd8402f, 0.2);

  /* Atrás, en el pasto: carpas iglú, quincho, mesas y fogata. */
  domeTent(g, -3.2, -2.6, 0xe0702e, 0.3);
  domeTent(g, -1.6, -3.3, 0x2e7dd1, 0);
  domeTent(g, 0.0, -3.0, 0x5aa04a, -0.25);

  /* Quincho de madera con techo a dos aguas y parrilla de ladrillo. */
  const [qx, qz] = [2.4, -2.6];
  [-0.75, 0.75].forEach((dx) =>
    [-0.55, 0.55].forEach((dz) =>
      g.add(cyl(0.06, 0.06, 1.2, 5, darkWood(), qx + dx, 0.76, qz + dz)),
    ),
  );
  const roof = prism(1.9, 1.6, mat('quinchoRoof', 0x6b4a32), qx, 1.36, qz);
  roof.rotation.y = Math.PI / 2;
  g.add(roof);
  g.add(box(0.5, 0.7, 0.4, mat('brick', 0xa0523a), qx + 0.5, 0.5, qz - 0.3));
  picnicTable(g, qx - 0.2, qz + 0.05, 0);

  picnicTable(g, -0.3, -1.3, 0.35);

  /* Fogata: anillo de piedras, troncos y llama. */
  const ring = part(new TorusGeometry(0.42, 0.11, 6, 12), stone(), 1.2, 0.26, -1.2);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  [0, 1.2, 2.4].forEach((turn) => {
    const log = cyl(0.06, 0.06, 0.7, 5, mat('log', 0x5a3d26), 1.2, 0.32, -1.2);
    log.rotation.set(Math.PI / 2, turn, 0.3);
    g.add(log);
  });
  g.add(
    cone(
      0.18,
      0.6,
      6,
      mat('fire', 0xffa640, { emissive: 0xff7a1a, emissiveIntensity: 0.9 }),
      1.2,
      0.62,
      -1.2,
    ),
  );
  return g;
}
