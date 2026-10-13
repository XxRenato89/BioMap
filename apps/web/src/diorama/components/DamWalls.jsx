/**
 * Renderiza los muros de las presas a escala real en la maqueta 3D.
 *
 * @param {object} props
 * @param {Array<{ id: number, name?: string, geometry: import('three').BufferGeometry }>} props.dams
 * @param {import('three').Material} props.material
 * @param {boolean} [props.shadows=false]
 */
export function DamWalls({ dams = [], material, shadows = false }) {
  if (!dams || dams.length === 0) return null;

  return (
    <group name="dams-layer">
      {dams.map((dam) => (
        <mesh
          key={dam.id}
          geometry={dam.geometry}
          material={material}
          castShadow={shadows}
          receiveShadow
        />
      ))}
    </group>
  );
}

export default DamWalls;
