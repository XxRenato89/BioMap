import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { declutter, visibleKinds } from '../utils/labels.js';
import { isOccluded } from '../utils/occlusion.js';

const projected = new Vector3();
const LABEL_HEIGHT = 30;

/**
 * Renderiza las etiquetas de hitos (volcanes, embalses, pueblos, cumbres)
 * con cálculo de oclusión por relieve y eliminación de solapamientos (declutter).
 *
 * @param {object} props
 * @param {Array<{ id: number|string, name: string, kind: string, rank: number, position: Vector3, width: number }>} props.labels
 * @param {(x: number, z: number) => number} props.heightAt
 * @param {{ width: number, depth: number }} props.projection
 */
export function LandmarkLabels({ labels = [], heightAt, projection }) {
  const controls = useThree((state) => state.controls);
  const size = useThree((state) => state.size);
  const elements = useRef(new Map());

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
    /* Los pines de los puntos de interés mandan: una etiqueta que los pise se oculta. */
    document.querySelectorAll('.poi-pin').forEach((pin, index) => {
      const rect = pin.getBoundingClientRect();
      if (rect.width > 0)
        candidates.push({
          id: `poi-${index}`,
          rank: 1e9,
          rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        });
    });
    const shown = declutter(candidates);
    for (const [id, element] of elements.current) {
      const hidden = String(!shown.has(id));
      if (element.dataset.hidden !== hidden) element.dataset.hidden = hidden;
    }
  });

  return (
    <group name="labels-layer">
      {labels.map((label) => (
        <Html key={label.id} position={label.position} zIndexRange={[2, 0]}>
          <span
            ref={(element) => {
              if (element) elements.current.set(label.id, element);
              else elements.current.delete(label.id);
            }}
            className="map-label pointer-events-none select-none text-sm font-bold text-white/90 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 whitespace-nowrap transition-opacity duration-200 data-[hidden=true]:opacity-0 data-[kind=road]:rounded-md data-[kind=road]:bg-[#f2c14e] data-[kind=road]:text-[#1d231c] data-[kind=road]:border-2 data-[kind=road]:border-[#1d231c] data-[kind=road]:tracking-wide"
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

export default LandmarkLabels;
