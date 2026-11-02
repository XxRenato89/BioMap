import { Group, IcosahedronGeometry, SphereGeometry } from 'three';
import { box, cone, cyl, mat, part } from './materials.js';

/*
 * Fauna de la zona del Angostura en low-poly, en metros y mirando a +z:
 * cisne de cuello negro y garza blanca (en el agua y la orilla), pudú y zorro
 * culpeo (en el borde del bosque).
 */
const white = () => mat('animalWhite', 0xf4f4f0);
const black = () => mat('animalBlack', 0x1d1d1f);

/** Bola achatada o estirada: el cuerpo de un animal. */
function body(rx, ry, rz, material, x, y, z) {
  const mesh = part(new SphereGeometry(1, 8, 6), material, x, y, z);
  mesh.scale.set(rx, ry, rz);
  return mesh;
}

/**
 * Cisne de cuello negro: cuerpo blanco que flota, cuello y cabeza negros,
 * pico gris azulado con la carúncula roja.
 */
export function buildSwan() {
  const g = new Group();
  g.add(body(0.32, 0.2, 0.62, white(), 0, 0.12, 0));
  const tail = cone(0.16, 0.36, 6, white(), 0, 0.2, -0.66);
  tail.rotation.x = -2.1;
  g.add(tail);
  const neck = cyl(0.05, 0.07, 0.62, 6, black(), 0, 0.5, 0.42);
  neck.rotation.x = -0.25;
  g.add(neck);
  g.add(body(0.08, 0.07, 0.12, black(), 0, 0.8, 0.52));
  g.add(box(0.05, 0.04, 0.14, mat('swanBill', 0x8a99a8), 0, 0.79, 0.67));
  g.add(body(0.035, 0.035, 0.035, mat('swanKnob', 0xd23b2f), 0, 0.82, 0.6));
  return g;
}

/**
 * Garza blanca: patas largas, cuerpo blanco, cuello en S y pico amarillo.
 */
export function buildEgret() {
  const g = new Group();
  [-0.06, 0.06].forEach((x) => g.add(cyl(0.012, 0.012, 0.55, 4, black(), x, 0.27, 0)));
  g.add(body(0.13, 0.13, 0.3, white(), 0, 0.62, -0.02));
  const neck = cyl(0.03, 0.04, 0.42, 5, white(), 0, 0.88, 0.16);
  neck.rotation.x = 0.45;
  g.add(neck);
  g.add(body(0.05, 0.05, 0.07, white(), 0, 1.06, 0.24));
  const bill = cone(0.02, 0.2, 4, mat('egretBill', 0xe7b928), 0, 1.06, 0.38);
  bill.rotation.x = Math.PI / 2;
  g.add(bill);
  return g;
}

/**
 * Pudú, el ciervo más pequeño del mundo: pardo rojizo, patas cortas,
 * orejas redondas y cuernos cortos y rectos.
 */
export function buildPudu() {
  const g = new Group();
  const fur = mat('puduFur', 0x7a5232);
  [
    [-0.1, -0.2],
    [0.1, -0.2],
    [-0.1, 0.2],
    [0.1, 0.2],
  ].forEach(([x, z]) => g.add(cyl(0.025, 0.02, 0.24, 4, mat('puduLeg', 0x4a3220), x, 0.12, z)));
  g.add(body(0.14, 0.13, 0.3, fur, 0, 0.32, 0));
  g.add(body(0.08, 0.08, 0.11, fur, 0, 0.46, 0.3));
  g.add(body(0.035, 0.03, 0.04, black(), 0, 0.44, 0.41));
  [-1, 1].forEach((side) => {
    g.add(body(0.05, 0.03, 0.02, fur, side * 0.07, 0.55, 0.27));
    g.add(cone(0.012, 0.07, 3, mat('puduAntler', 0x3a2a1c), side * 0.03, 0.57, 0.3));
  });
  return g;
}

/**
 * Zorro culpeo: pelaje gris rojizo, patas y cabeza rojizas, orejas en punta
 * y cola larga y tupida con la punta oscura.
 */
export function buildFox() {
  const g = new Group();
  const grey = mat('foxGrey', 0x8d7a66);
  const rust = mat('foxRust', 0xb2643a);
  [
    [-0.08, -0.22],
    [0.08, -0.22],
    [-0.08, 0.22],
    [0.08, 0.22],
  ].forEach(([x, z]) => g.add(cyl(0.025, 0.02, 0.3, 4, rust, x, 0.15, z)));
  g.add(body(0.12, 0.12, 0.35, grey, 0, 0.38, 0));
  g.add(body(0.09, 0.08, 0.1, rust, 0, 0.48, 0.36));
  const snout = cone(0.05, 0.16, 5, rust, 0, 0.45, 0.5);
  snout.rotation.x = Math.PI / 2;
  g.add(snout);
  [-1, 1].forEach((side) => g.add(cone(0.035, 0.1, 4, rust, side * 0.05, 0.6, 0.34)));
  const tail = part(new IcosahedronGeometry(1, 0), grey, 0, 0.36, -0.52);
  tail.scale.set(0.08, 0.08, 0.26);
  tail.rotation.x = -0.4;
  g.add(tail);
  g.add(body(0.05, 0.05, 0.06, black(), 0, 0.27, -0.74));
  return g;
}
