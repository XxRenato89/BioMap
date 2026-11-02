import { Group } from 'three';
import {
  box,
  concrete,
  concreteDark,
  cyl,
  dark,
  glass,
  mat,
  red,
  stone,
  white,
} from './materials.js';

/**
 * Presa de hormigón con compuertas, casa de máquinas, tuberías forzadas y aliviadero.
 * Modelo procedural 3D de alta fidelidad arquitectónica para puntos de interés hidroeléctricos.
 *
 * @returns {Group}
 */
export function buildDam() {
  const g = new Group();
  const wh = 6.5;

  // Muro principal de gravedad de hormigón (masivo)
  g.add(box(wh * 2, 5.6, 2.8, concrete(), 0, 2.8, 0));
  // Talud inclinado hacia aguas abajo
  g.add(box(wh * 2 - 0.4, 4.2, 2.0, concreteDark(), 0, 2.1, 1.4));
  // Carretera / Calzada superior de coronamiento
  g.add(box(wh * 2 + 0.2, 0.16, 2.2, dark(), 0, 5.68, 0));

  // Barandas protectoras a lo largo de ambos lados del coronamiento
  const railMat = mat('railMetal', 0xdedede, { metalness: 0.6, roughness: 0.3 });
  g.add(box(wh * 2, 0.22, 0.05, railMat, 0, 5.86, -1.05));
  g.add(box(wh * 2, 0.22, 0.05, railMat, 0, 5.86, 1.05));

  // Pilares y compuertas radiales de vertedero (Spillway)
  for (let k = -2; k <= 2; k += 1) {
    // Compuerta metálica azulada
    g.add(
      box(
        1.4,
        1.3,
        0.6,
        mat('gate', 0x2b4c6f, { metalness: 0.5, roughness: 0.4 }),
        k * 1.8,
        6.35,
        -0.6,
      ),
    );
    // Pilastras de hormigón armado entre compuertas
    g.add(box(0.35, 1.8, 0.9, white(), k * 1.8 + 0.9, 6.2, -0.45));
  }

  // Vertedero / aliviadero con salto de agua y espuma blanca aguas abajo
  const waterSpill = mat('spillWater', 0x5fa8c9, {
    transparent: true,
    opacity: 0.85,
    roughness: 0.1,
  });
  const foam = mat('foam', 0xeef9fc, { roughness: 0.2 });
  g.add(box(6.8, 0.18, 2.6, waterSpill, 0, 3.8, 1.6));
  g.add(box(7.2, 0.35, 1.4, foam, 0, 0.35, 2.8));

  // Pasarela de maniobras sobre las compuertas
  g.add(box(8.2, 0.32, 1.0, white(), 0, 7.15, -0.55));
  // Caseta / torre de mando central de compuertas
  g.add(box(1.6, 1.4, 1.2, white(), 0, 7.95, -0.55));
  g.add(box(1.8, 0.15, 1.4, mat('roofDark', 0x3d4449), 0, 8.7, -0.55));
  // Antena de telecomunicaciones
  g.add(cyl(0.03, 0.03, 1.8, 6, railMat, 0.4, 9.5, -0.55));

  // Pórticos amarillos de maniobra sobre las compuertas (característicos de Angostura)
  const yellowMat = mat('gantryYellow', 0xe8c21c, { roughness: 0.5 });
  for (let k = -2; k <= 2; k += 1) {
    g.add(box(0.18, 1.2, 0.18, yellowMat, k * 1.8 + 0.9, 7.7, -0.45));
  }
  g.add(box(7.6, 0.16, 0.2, yellowMat, 0, 8.3, -0.45));

  // Tuberías forzadas (Penstocks) de acero que alimentan las turbinas
  const penstockMat = mat('steelPenstock', 0x4a5358, { metalness: 0.7, roughness: 0.35 });
  for (let p = -1; p <= 1; p += 1) {
    const penstock = cyl(0.42, 0.42, 4.2, 12, penstockMat, -(wh + 0.4) + p * 1.3, 2.8, 0.8);
    penstock.rotation.x = Math.PI / 5;
    g.add(penstock);
  }

  // Edificio de control y mando con techo azul cobalto (como en la foto real de Angostura)
  const phX = -(wh + 0.4);
  const blueRoof = mat('roofBlue', 0x1d68aa, { roughness: 0.4 });
  g.add(box(5.4, 3.2, 3.8, white(), phX, 1.6, 3.2));
  g.add(box(5.6, 0.4, 4.1, blueRoof, phX, 3.35, 3.2));
  // Ventanales industriales de la sala de generadores
  for (let q = 0; q < 4; q += 1) {
    g.add(box(0.65, 1.4, 0.05, glass(), phX - 1.8 + q * 1.2, 2.1, 5.12));
  }

  // Subestación eléctrica exterior con transformadores y pórticos
  const subX = wh + 0.6;
  g.add(box(3.4, 0.4, 3.0, stone(), subX, 0.2, 1.8));
  for (let t = -1; t <= 1; t += 1) {
    // Transformadores
    g.add(box(0.7, 1.1, 0.7, concreteDark(), subX - 0.7 + t * 0.9, 0.95, 1.4));
    // Aisladores cilíndricos superiores
    g.add(cyl(0.08, 0.08, 0.5, 6, mat('porcelain', 0x7c4933), subX - 0.7 + t * 0.9, 1.6, 1.4));
  }

  return g;
}
