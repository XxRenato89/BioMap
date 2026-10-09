import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';

/*
 * Modelos 3D de los puntos de interés (portados de ejemplo.html). Cada uno
 * se construye en unidades "de ejemplo" apoyado en y = 0. Para dejarlos a
 * escala real (1 unidad de la maqueta = 1 km), cada tipo tiene sus metros
 * por unidad de ejemplo, calculados con una medida conocida: una ruka de
 * ~10 m de diámetro, araucarias de ~35 m, lengas de ~25 m, un mirador de
 * ~8 m, un puente colgante de ~100 m, etc.
 */
const METERS_PER_UNIT = {
  dam: 30,
  bridge: 6.5,
  ruka: 4.3,
  araucaria: 10,
  lenga: 7.4,
  wetland: 20,
  visitors: 7.4,
  lookout: 2.1,
  camping: 6.6,
};

/**
 * Escala para llevar el modelo `kind` a su tamaño real en la maqueta.
 *
 * @param {string} kind
 */
export function modelScale(kind) {
  return (METERS_PER_UNIT[kind] ?? 10) / 1000;
}

const materials = new Map();

/**
 * Material compartido por color (y variante), para no multiplicar materiales en la GPU.
 */
function mat(key, color, extra = {}) {
  if (!materials.has(key)) {
    materials.set(
      key,
      new MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03, ...extra }),
    );
  }
  return materials.get(key);
}

/**
 * Malla con sombra en una posición.
 */
function part(geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
const box = (w, h, d, m, x, y, z) => part(new BoxGeometry(w, h, d), m, x, y, z);
const cyl = (rt, rb, h, seg, m, x, y, z) => part(new CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const cone = (r, h, seg, m, x, y, z) => part(new ConeGeometry(r, h, seg), m, x, y, z);

/**
 * Generador pseudoaleatorio con semilla (mulberry32), para modelos repetibles.
 */
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const concrete = () => mat('concrete', 0xcfd3cf);
const concreteDark = () => mat('concreteDark', 0x98a09c);
const stone = () => mat('stone', 0x8c887f);
const wood = () => mat('wood', 0x8a5b37);
const thatch = () => mat('thatch', 0xd8b45c);
const white = () => mat('white', 0xf2f0e9);
const glass = () => mat('glass', 0x74bdd6, { roughness: 0.1, metalness: 0.3 });
const red = () => mat('red', 0xb8523a);
const teal = () => mat('teal', 0x2c6a6b);
const dark = () => mat('dark', 0x2d3532);
const trunk = () => mat('trunk', 0x5a4634);

/**
 * Presa de hormigón con compuertas y casa de máquinas.
 */
function buildDam() {
  const g = new Group();
  const wh = 6;
  g.add(box(wh * 2, 5.6, 2.4, concrete(), 0, 2.8, 0));
  g.add(box(wh * 2 + 0.1, 0.14, 1.7, dark(), 0, 5.7, -0.1));
  for (let k = -1; k <= 1; k += 1) {
    g.add(box(1.3, 1.2, 0.5, mat('gate', 0x3a5b7a), k * 2.1, 6.4, -0.55));
    g.add(box(0.3, 1.6, 0.7, white(), k * 2.1 + 1.05, 6.25, -0.4));
  }
  g.add(box(2.6, 0.28, 0.8, white(), 0, 7.05, -0.5));
  g.add(box(4.6, 2.8, 3.4, white(), -(wh + 0.4), 1.4, 2.6));
  g.add(box(4.8, 0.3, 3.6, red(), -(wh + 0.4), 2.95, 2.6));
  for (let q = 0; q < 3; q += 1)
    g.add(box(0.5, 0.9, 0.04, glass(), -(wh + 0.4) - 1.4 + q * 1.4, 1.9, 4.33));
  return g;
}

/**
 * Puente colgante de madera con torres de piedra y cables.
 */
function buildBridge() {
  const g = new Group();
  const half = 7;
  const y = 1.5;
  g.add(box(half * 2, 0.2, 1.2, wood(), 0, y, 0));
  [-1, 1].forEach((side) => {
    g.add(box(1.5, 3.2, 1.9, stone(), side * half, y - 1.5 + 1.6, 0));
    [-0.55, 0.55].forEach((o) =>
      g.add(box(0.3, 2.9, 0.3, concreteDark(), side * (half - 1), y + 1.45, o)),
    );
    g.add(box(0.3, 0.3, 1.4, concreteDark(), side * (half - 1), y + 2.85, 0));
  });
  [-0.55, 0.55].forEach((o) => {
    for (let k = 0; k <= 12; k += 1) {
      const t = k / 12;
      const x = (t * 2 - 1) * (half - 1);
      const sag = y + 2.85 - 4.3 * (1 - Math.pow(2 * t - 1, 2));
      g.add(cyl(0.05, 0.05, 1.2, 4, dark(), x, sag, o));
    }
  });
  return g;
}

/**
 * Ruka mapuche: base de madera y techo de paja cónico.
 */
function ruka(g, ox, oz, s) {
  g.add(cyl(0.78 * s, 0.82 * s, 0.55 * s, 10, wood(), ox, 0.27 * s, oz));
  g.add(cone(1.05 * s, 1.05 * s, 10, thatch(), ox, 1.05 * s, oz));
  g.add(box(0.3 * s, 0.42 * s, 0.05, dark(), ox, 0.24 * s, oz + 0.8 * s));
}
function buildRuka() {
  const g = new Group();
  ruka(g, 0, 0, 1.4);
  ruka(g, -2.6, 1.8, 1.1);
  ruka(g, 2.4, 2.1, 1.0);
  return g;
}

/**
 * Araucaria: tronco alto y copa en paraguas.
 */
function araucaria(g, x, z, s) {
  g.add(cyl(0.13 * s, 0.2 * s, 2.7 * s, 6, trunk(), x, 1.3 * s, z));
  g.add(cyl(1.15 * s, 0.25 * s, 0.55 * s, 9, mat('arau', 0x2f5b3b), x, 2.85 * s, z));
  g.add(cyl(0.8 * s, 0.2 * s, 0.4 * s, 9, mat('arau', 0x2f5b3b), x, 2.2 * s, z));
}
function buildAraucarias() {
  const g = new Group();
  [
    [0, 0, 1.25],
    [-2.1, 1.3, 0.95],
    [1.9, 1.6, 1],
    [-0.6, -2.2, 0.8],
    [2.5, -1.4, 0.85],
  ].forEach(([x, z, s]) => araucaria(g, x, z, s));
  return g;
}

/**
 * Lengas de otoño: copas rojas y naranjas.
 */
function buildLengas() {
  const g = new Group();
  const random = seeded(23);
  const colors = [0xd0602e, 0xe38b2c, 0xb8432b, 0xe8a23a];
  for (let k = 0; k < 11; k += 1) {
    const a = random() * 6.28;
    const r = random() * 3.4;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const s = 0.8 + random() * 0.7;
    const c = colors[k % 4];
    g.add(cyl(0.09 * s, 0.14 * s, 1.6 * s, 5, mat('lengaTrunk', 0x5b4634), x, 0.8 * s, z));
    g.add(part(new IcosahedronGeometry(0.9 * s, 0), mat(`lenga${c}`, c), x, 2 * s, z));
    g.add(
      part(
        new IcosahedronGeometry(0.62 * s, 0),
        mat(`lenga${c}`, c),
        x + 0.3 * s,
        2.7 * s,
        z + 0.1 * s,
      ),
    );
  }
  return g;
}

/**
 * Humedal: laguna con juncos y dos aves.
 */
function buildWetland() {
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

/**
 * Centro de visitantes con estacionamiento y bandera.
 */
function buildVisitorCenter() {
  const g = new Group();
  g.add(box(5.4, 0.8, 3.8, concreteDark(), 0, 0.4, 0));
  g.add(box(4.5, 1.3, 2.6, white(), 0, 1.45, -0.2));
  const roof = box(5.2, 0.2, 3.3, teal(), 0, 2.2, -0.2);
  roof.rotation.z = -0.07;
  g.add(roof);
  g.add(box(3.7, 0.8, 0.05, glass(), 0, 1.45, 1.12));
  g.add(box(1.1, 1.2, 0.9, mat('wood2', 0xb98b5a), 1.9, 1.4, 1.1));
  g.add(box(3.4, 0.04, 2.2, dark(), -3.4, 0.82, 2.4));
  [
    [-4.1, 2.1, 0xc0392b],
    [-3.2, 2.7, 0x2c6aa0],
    [-2.6, 2.1, 0xe0b341],
  ].forEach(([x, z, c]) => g.add(box(0.9, 0.34, 0.42, mat(`car${c}`, c), x, 1.02, z)));
  g.add(cyl(0.04, 0.04, 2.6, 6, white(), 2.5, 2.1, 2.2));
  g.add(box(0.8, 0.5, 0.03, mat('flag', 0xef7b5d), 2.9, 3.1, 2.2));
  return g;
}

/**
 * Mirador: plataforma octogonal sobre pilotes con baranda.
 */
function buildLookout() {
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
  g.add(cyl(0.04, 0.04, 2.8, 6, white(), -0.7, 3.6, -0.7));
  g.add(box(0.9, 0.55, 0.03, mat('flag', 0xef7b5d), -0.25, 4.7, -0.7));
  return g;
}

/**
 * Camping: cuatro carpas alrededor de una fogata.
 */
function buildCamping() {
  const g = new Group();
  g.add(cyl(3.6, 3.8, 0.2, 18, mat('pad2', 0x9da56d), 0, 0.1, 0));
  [
    [-1.7, 0.6, 0xe0813a],
    [1.5, 1.1, 0x3a82b8],
    [-0.2, -1.7, 0x5fae6a],
    [1.8, -1.2, 0xe5c14a],
  ].forEach(([x, z, c], k) => {
    const tent = cone(1.05, 1.1, 4, mat(`tent${c}`, c), x, 0.75, z);
    tent.rotation.y = Math.PI / 4 + k * 0.4;
    g.add(tent);
  });
  const ring = part(new TorusGeometry(0.32, 0.09, 6, 12), stone(), 0, 0.3, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  g.add(
    cone(
      0.14,
      0.5,
      5,
      mat('fire', 0xffa640, { emissive: 0xff7a1a, emissiveIntensity: 0.8 }),
      0,
      0.55,
      0,
    ),
  );
  return g;
}

const BUILDERS = {
  dam: buildDam,
  bridge: buildBridge,
  ruka: buildRuka,
  araucaria: buildAraucarias,
  lenga: buildLengas,
  wetland: buildWetland,
  visitors: buildVisitorCenter,
  lookout: buildLookout,
  camping: buildCamping,
};

/*
 * Palabras del nombre del punto que eligen el modelo. Los puentes de
 * caminos ya se ven como caminos reales: solo un puente colgante usa el modelo.
 */
const KEYWORDS = [
  [/presa|central|angostura|hidro/i, 'dam'],
  [/puente colgante/i, 'bridge'],
  [/ruka|pehuenche|mapuche/i, 'ruka'],
  [/araucaria|pehu[eé]n/i, 'araucaria'],
  [/lenga/i, 'lenga'],
  [/humedal|laguna|aves/i, 'wetland'],
  [/visitante|centro/i, 'visitors'],
  [/mirador|vista/i, 'lookout'],
  [/camping|camp|acampar/i, 'camping'],
];
/*
 * Sin coincidencia no se dibuja modelo: un modelo genérico (una ruka, unas
 * araucarias) en un lugar real que no los tiene confundiría al visitante.
 */
const LAYER_DEFAULT = {};

/**
 * Elige el modelo de un punto según su nombre y capa.
 *
 * @param {string} name
 * @param {string} [layerSlug]
 * @returns {keyof typeof BUILDERS | null}
 */
export function modelKindFor(name, layerSlug) {
  const hit = KEYWORDS.find(([pattern]) => pattern.test(name ?? ''));
  return hit ? hit[1] : (LAYER_DEFAULT[layerSlug] ?? null);
}

const cache = new Map();

/**
 * Instancia del modelo (comparte geometrías y materiales entre copias).
 *
 * @param {keyof typeof BUILDERS} kind
 */
export function createPoiModel(kind) {
  if (!cache.has(kind)) cache.set(kind, BUILDERS[kind]());
  return cache.get(kind).clone();
}
