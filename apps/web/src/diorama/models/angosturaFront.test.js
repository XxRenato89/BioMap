import { describe, expect, it } from 'vitest';
import { FRONT_BOX, FRONT_HEIGHT, FRONT_LENGTH, buildAngosturaFront } from './angosturaFront.js';
import { fitDamFront } from '../components/AngosturaDam.jsx';
import { benchRoad, carveDamToe, markWater } from '../terrain/damToe.js';

describe('muro frontal de Angostura', () => {
  it('arma el muro y pone el vertedero en el extremo pedido', () => {
    expect(FRONT_BOX.max.z - FRONT_BOX.min.z).toBe(FRONT_LENGTH);
    expect(FRONT_BOX.max.y).toBe(FRONT_HEIGHT);
    /* Las compuertas (material azul de doble cara) quedan del lado del vertedero. */
    const gatesZ = (front) => {
      const z = [];
      front.traverse(
        (o) => o.isMesh && o.material.name === '' && o.material.side === 2 && z.push(o.position.z),
      );
      return z;
    };
    const south = buildAngosturaFront({ spillwayEnd: -1 });
    const north = buildAngosturaFront({ spillwayEnd: 1 });
    expect(south.children.length).toBeGreaterThan(60);
    expect(Math.max(...gatesZ(south).slice(0, 6))).toBeLessThan(0);
    expect(Math.min(...gatesZ(north).slice(0, 6))).toBeGreaterThan(0);
  });

  it('encaja el muro a lo largo de la planta y con la cara hacia el embalse', () => {
    const box = FRONT_BOX;
    /* Planta de 0,3 km a lo largo de z, 5 m de ancho; embalse en +x. */
    const points = [
      { x: 0, z: 0 },
      { x: 0, z: 0.3 },
      { x: -0.005, z: 0.3 },
      { x: -0.005, z: 0 },
    ];
    const fit = fitDamFront(points, { x: 1, z: 0.15 }, box, { base: 0, crest: 0.07 });
    expect(fit.scale[0]).toBeCloseTo(0.3 / FRONT_LENGTH);
    expect(fit.scale[1]).toBeCloseTo(0.07 / FRONT_HEIGHT);
    /* La cara aguas arriba (+x local) apunta al embalse: (cos θ, −sin θ) ≈ (1, 0). */
    expect(Math.cos(fit.rotationY)).toBeCloseTo(1);
    /* El primer punto (z = 0) queda en el extremo −z del modelo. */
    expect(fit.startEnd).toBe(-1);
    expect(fit.position[0]).toBeCloseTo(0);
    expect(fit.position[2]).toBeCloseTo(0.15);
  });

  it('talla el relieve solo aguas abajo del muro', () => {
    const meta = {
      bounds: { west: -0.005, east: 0.005, south: -0.005, north: 0.005 },
      columns: 41,
      rows: 41,
    };
    const heights = new Uint16Array(41 * 41).fill(300);
    heights[20 * 41 + 18] = 280; // fondo del cauce, al oeste (aguas abajo)
    /* Muro norte-sur en lng = 0; embalse al este. */
    const line = [
      [0, 0.002],
      [0, -0.002],
      [-0.0003, -0.002],
      [-0.0003, 0.002],
      [0, 0.002],
    ];
    carveDamToe(meta, heights, line, [0.004, 0]);
    expect(heights[20 * 41 + 19]).toBe(280); // al oeste, junto al muro: tallado
    expect(heights[20 * 41 + 30]).toBe(300); // al este (embalse): intacto
  });

  it('marca agua dentro de un polígono y aplana el camino en terraza', () => {
    const meta = {
      bounds: { west: -0.005, east: 0.005, south: -0.005, north: 0.005 },
      columns: 41,
      rows: 41,
    };
    const shore = new Uint8Array(41 * 41);
    markWater(meta, shore, [
      [-0.001, -0.001],
      [0.001, -0.001],
      [0.001, 0.001],
      [-0.001, 0.001],
    ]);
    expect(shore[20 * 41 + 20]).toBe(20);
    expect(shore[20 * 41 + 35]).toBe(0);

    const heights = new Uint16Array(41 * 41).fill(300);
    heights[20 * 41 + 20] = 340; // un pico bajo el camino
    benchRoad(meta, heights, [
      [-0.004, 0],
      [0.004, 0],
    ]);
    expect(heights[20 * 41 + 20]).toBe(300);
  });
});

describe('raiseCauseway', () => {
  it('levanta la corona y los taludes sin bajar nada', async () => {
    const { raiseCauseway } = await import('../terrain/damToe.js');
    const meta = { bounds: { west: 0, south: 0, east: 0.001, north: 0.001 }, columns: 11, rows: 11 };
    const heights = new Uint16Array(121).fill(300);
    heights[0] = 400;
    raiseCauseway(meta, heights, [[0, 0.0005], [0.001, 0.0005]], { crest: 330 });
    expect(heights[5 * 11 + 5]).toBe(330);
    expect(heights[0]).toBe(400);
    expect(heights[0 * 11 + 5]).toBeGreaterThan(300);
    expect(heights[0 * 11 + 5]).toBeLessThan(330);
  });
});
