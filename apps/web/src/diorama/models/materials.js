import { BoxGeometry, ConeGeometry, CylinderGeometry, Mesh, MeshStandardMaterial } from 'three';

const materials = new Map();

/**
 * Material compartido por color (y variante), para no multiplicar materiales en la GPU.
 *
 * @param {string} key
 * @param {number} color
 * @param {object} [extra={}]
 */
export function mat(key, color, extra = {}) {
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
export function part(geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export const box = (w, h, d, m, x, y, z) => part(new BoxGeometry(w, h, d), m, x, y, z);
export const cyl = (rt, rb, h, seg, m, x, y, z) =>
  part(new CylinderGeometry(rt, rb, h, seg), m, x, y, z);
export const cone = (r, h, seg, m, x, y, z) => part(new ConeGeometry(r, h, seg), m, x, y, z);

/**
 * Generador pseudoaleatorio con semilla (mulberry32), para modelos repetibles.
 */
export function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const concrete = () => mat('concrete', 0xcfd3cf);
export const concreteDark = () => mat('concreteDark', 0x98a09c);
export const stone = () => mat('stone', 0x8c887f);
export const wood = () => mat('wood', 0x8a5b37);
export const thatch = () => mat('thatch', 0xd8b45c);
export const white = () => mat('white', 0xf2f0e9);
export const glass = () => mat('glass', 0x74bdd6, { roughness: 0.1, metalness: 0.3 });
export const red = () => mat('red', 0xb8523a);
export const teal = () => mat('teal', 0x2c6a6b);
export const dark = () => mat('dark', 0x2d3532);
export const trunk = () => mat('trunk', 0x5a4634);

/**
 * Prisma triangular apoyado en y = 0 con el eje a lo largo de z (carpas,
 * techos a dos aguas): `width` de base y `length` de largo; alto 0,87·width.
 */
export function prism(width, length, m, x = 0, y = 0, z = 0) {
  const r = width / Math.sqrt(3);
  return part(
    new CylinderGeometry(r, r, length, 3).rotateX(-Math.PI / 2).translate(0, r / 2, 0),
    m,
    x,
    y,
    z,
  );
}

export const sand = () => mat('sand', 0xe3cf9c);
export const grassPad = () => mat('grassPad', 0x8ea566);
export const metal = () => mat('metal', 0x9aa3a6, { metalness: 0.5, roughness: 0.4 });
