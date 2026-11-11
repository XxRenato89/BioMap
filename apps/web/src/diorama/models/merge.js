import { Group, Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Une las piezas de un modelo que comparten material en una sola malla: un
 * camping pasa de más de cien llamadas de dibujo a una por color. Las piezas
 * que no se pueden unir (reflejadas, o con otros atributos) quedan como estaban.
 *
 * @param {Group} model Modelo armado con piezas sueltas (ver materials.js).
 * @returns {Group}
 */
export function mergeByMaterial(model) {
  model.updateMatrixWorld(true);
  const byMaterial = new Map();
  const merged = new Group();
  model.traverse((object) => {
    if (!object.isMesh) return;
    /* Una pieza reflejada quedaría con las caras al revés: se deja suelta. */
    if (Array.isArray(object.material) || object.matrixWorld.determinant() < 0) {
      const loose = new Mesh(object.geometry, object.material);
      object.matrixWorld.decompose(loose.position, loose.quaternion, loose.scale);
      loose.castShadow = true;
      loose.receiveShadow = true;
      merged.add(loose);
      return;
    }
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (!byMaterial.has(object.material)) byMaterial.set(object.material, []);
    byMaterial.get(object.material).push(geometry.index ? geometry.toNonIndexed() : geometry);
  });
  for (const [material, geometries] of byMaterial) {
    /* Solo los atributos que todas las piezas tienen (algunas no traen uv). */
    const shared = Object.keys(geometries[0].attributes).filter((name) =>
      geometries.every((geometry) => geometry.attributes[name]),
    );
    for (const geometry of geometries)
      for (const name of Object.keys(geometry.attributes))
        if (!shared.includes(name)) geometry.deleteAttribute(name);
    const single = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
    for (const geometry of single ? [single] : geometries) {
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      merged.add(mesh);
    }
  }
  return merged;
}
