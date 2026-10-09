import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { useDiorama } from './DioramaScene.jsx';
import { declutter, visibleKinds } from './labels.js';
import { isOccluded } from './occlusion.js';

const projected = new Vector3();

/*
 * Tamaño aproximado de una etiqueta en pantalla (px), para evitar que se tapen.
 */
const CHAR_WIDTH = 9;
const LABEL_PADDING = 34;
const LABEL_HEIGHT = 30;

/**
 * Hitos reales de la maqueta, de OpenStreetMap: los muros de las presas a
 * escala real y las etiquetas de volcanes, embalses, pueblos, cumbres y
 * lagunas. Las etiquetas aparecen según la distancia, no se tapan entre sí
 * (gana la de mayor prioridad) y se ocultan cuando el relieve las tapa.
 *
 * @param {{ shadows?: boolean }} props
 */
export default function Landmarks({ shadows = false }) {
  const { dams, landmarks, projection, heightAt, materials } = useDiorama();
  const controls = useThree((state) => state.controls);
  const size = useThree((state) => state.size);
  const elements = useRef(new Map());
  const labels = useMemo(
    () =>
      landmarks.labels.map((label) => {
        const { x, z } = projection.toWorld(label.coordinates);
        return {
          ...label,
          position: new Vector3(x, heightAt(x, z) + 0.012, z),
          width: label.name.length * CHAR_WIDTH + LABEL_PADDING,
        };
      }),
    [landmarks, projection, heightAt],
  );

  useFrame(({ camera }) => {
    if (!controls) return;
    const kinds = visibleKinds(controls.distance * 1000);
    const candidates = [];
    for (const label of labels) {
      if (!kinds.has(label.kind)) continue;
      projected.copy(label.position).project(camera);
      if (projected.z > 1 || Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1) continue;
      if (isOccluded(camera.position, label.position, heightAt, projection, 0.003)) continue;
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      candidates.push({
        id: label.id,
        rank: label.rank,
        rect: {
          x: x - label.width / 2,
          y: y - LABEL_HEIGHT,
          width: label.width,
          height: LABEL_HEIGHT,
        },
      });
    }
    const shown = declutter(candidates);
    for (const [id, element] of elements.current) {
      const hidden = String(!shown.has(id));
      if (element.dataset.hidden !== hidden) element.dataset.hidden = hidden;
    }
  });

  return (
    <group>
      {dams.map((dam) => (
        <mesh
          key={dam.id}
          geometry={dam.geometry}
          material={materials.dam}
          castShadow={shadows}
          receiveShadow
        />
      ))}
      {labels.map((label) => (
        <Html key={label.id} position={label.position} zIndexRange={[5, 0]}>
          <span
            ref={(element) => {
              if (element) elements.current.set(label.id, element);
              else elements.current.delete(label.id);
            }}
            className="map-label"
            data-kind={label.kind}
            data-hidden="true"
          >
            {label.name}
          </span>
        </Html>
      ))}
    </group>
  );
}
