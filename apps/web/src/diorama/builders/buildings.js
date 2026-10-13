import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';

/*
 * Colores de los edificios, como los de Mapbox: muros claros y cálidos que
 * se oscurecen hacia el suelo (sombra de contacto) y techos más claros.
 */
export const ROOF = [0.95, 0.93, 0.9];
export const WALL = [0.86, 0.82, 0.78];
export const WALL_BASE = [0.62, 0.59, 0.56];

/**
 * Edificios de OpenStreetMap levantados a su altura real: su planta se
 * extruye desde bajo el terreno hasta la altura del edificio sobre el punto
 * más alto de su planta, con los colores de Mapbox (ver ROOF y WALL).
 *
 * @param {Array<{ ring: number[][], height: number }>} buildings
 * @param {(x: number, z: number) => number} heightAt
 * @param {{ toWorld: Function }} projection
 * @returns {BufferGeometry}
 */
export function buildBuildings(buildings, heightAt, projection) {
  const positions = [];
  const colors = [];
  const tri = (a, b, c, tint) => {
    positions.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k += 1) colors.push(...tint);
  };
  for (const { ring: line, height } of buildings) {
    const ring = line.slice(0, -1).map((point) => projection.toWorld(point));
    if (ring.length < 3) continue;
    const ground = ring.map(({ x, z }) => heightAt(x, z));
    const base = Math.min(...ground) - 0.002;
    const top = Math.max(...ground) + height / 1000;
    const contour = ring.map(({ x, z }) => new Vector2(x, z));
    const clockwise = ShapeUtils.isClockWise(contour);
    for (const [a, b, c] of ShapeUtils.triangulateShape(contour, [])) {
      const at = (k) => [ring[k].x, top, ring[k].z];
      if (clockwise) tri(at(a), at(b), at(c), ROOF);
      else tri(at(a), at(c), at(b), ROOF);
    }
    ring.forEach((p, k) => {
      const q = ring[(k + 1) % ring.length];
      const [a, b] = clockwise ? [p, q] : [q, p];
      const low = (point) => ({ point: [point.x, base, point.z], tint: WALL_BASE });
      const high = (point) => ({ point: [point.x, top, point.z], tint: WALL });
      for (const face of [
        [low(a), low(b), high(b)],
        [low(a), high(b), high(a)],
      ]) {
        for (const { point, tint } of face) {
          positions.push(...point);
          colors.push(...tint);
        }
      }
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
