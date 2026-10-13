import { BufferAttribute, BufferGeometry, ShapeUtils, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { metersToY } from '../utils/projection.js';
import { RESERVOIR, within } from '../utils/reservoir.js';

/*
 * Cuánto queda el agua sobre su nivel (km): elevación mínima justa para cubrir
 * irregularidades del relieve manteniendo el agua ceñida a las orillas reales.
 */
export const WATER_LIFT = 0.0008;

/**
 * Agua (embalses y el cauce del Biobío): polígonos de OpenStreetMap apoyados
 * sobre el relieve, en una sola malla.
 *
 * @param {Array<{ outer: number[][], holes: number[][][] }>} polygons
 * @param {{ toWorld: Function }} projection
 * @param {(x: number, z: number) => number} heightAt
 * @returns {BufferGeometry}
 */
export function buildWater(polygons, projection, heightAt) {
  const parts = polygons.map(({ outer, holes }) => {
    const toVec = (ring) =>
      ring.slice(0, -1).map((point) => {
        const { x, z } = projection.toWorld(point);
        return new Vector2(x, z);
      });
    const contour = toVec(outer);
    const holeRings = holes.map(toVec);
    const faces = ShapeUtils.triangulateShape(contour, holeRings);
    const points = [...contour, ...holeRings.flat()];
    const rawPoints = [outer, ...holes].flatMap((ring) => ring.slice(0, -1));
    /* Nivel de cada punto de orilla (del build, ver inlay.js) o, si no hay, el terreno. */
    const levels = rawPoints.map((point) => point[2]);
    const position = new Float32Array(points.length * 3);
    points.forEach(({ x, y }, k) => {
      const pt = rawPoints[k];
      let level = levels[k];
      /* Espejo del embalse horizontal, a su cota (ver RESERVOIR). */
      if (pt && within(pt, RESERVOIR.surface))
        level = Math.max(level ?? RESERVOIR.level, RESERVOIR.level);
      position[k * 3] = x;
      position[k * 3 + 1] = (level === undefined ? heightAt(x, y) : metersToY(level)) + WATER_LIFT;
      position[k * 3 + 2] = y;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute(
      'normal',
      new BufferAttribute(
        new Float32Array(points.length * 3).map((_, k) => (k % 3 === 1 ? 1 : 0)),
        3,
      ),
    );
    geometry.setIndex(faces.flatMap(([a, b, c]) => [a, c, b]));
    return geometry;
  });
  return mergeGeometries(parts.filter((geometry) => geometry.index.count > 0));
}
