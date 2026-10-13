import { useMemo } from 'react';
import { Vector3 } from 'three';
import { useDiorama } from './DioramaScene.jsx';
import { DamWalls } from './DamWalls.jsx';
import { LandmarkLabels } from './LandmarkLabels.jsx';

/*
 * Tamaño aproximado de una etiqueta en pantalla (px), para evitar que se tapen.
 */
const CHAR_WIDTH = 10;
const LABEL_PADDING = 34;
/* Separación mínima (km) entre dos letreros de la misma ruta. */
const SHIELD_SPACING = 1.4;

/**
 * Letreros con el número de cada ruta (Q-61…), repartidos a lo largo de ella:
 * le dicen al visitante por qué camino se llega a cada lugar.
 */
function routeShields(roads) {
  const shields = [];
  for (const road of roads) {
    if (!road.ref || road.line.length < 2) continue;
    const middle = road.line[Math.floor(road.line.length / 2)];
    const tooClose = shields.some(
      (shield) =>
        shield.name === road.ref &&
        Math.hypot(
          (shield.coordinates[0] - middle[0]) * 88,
          (shield.coordinates[1] - middle[1]) * 111,
        ) < SHIELD_SPACING,
    );
    if (tooClose) continue;
    shields.push({
      id: `road-${shields.length}`,
      kind: 'road',
      name: road.ref,
      rank: 50,
      coordinates: middle,
    });
  }
  return shields;
}

/**
 * Hitos reales de la maqueta, de OpenStreetMap: los muros de las presas a
 * escala real, las etiquetas de volcanes, embalses, pueblos, cumbres y
 * lagunas, y los números de ruta.
 *
 * @param {{ shadows?: boolean }} props
 */
export default function Landmarks({ shadows = false }) {
  const { dams, landmarks, projection, heightAt, materials } = useDiorama();

  const labels = useMemo(
    () =>
      [...landmarks.labels, ...routeShields(landmarks.roads ?? [])].map((label) => {
        const { x, z } = projection.toWorld(label.coordinates);
        return {
          ...label,
          position: new Vector3(x, heightAt(x, z) + 0.012, z),
          width: label.name.length * CHAR_WIDTH + LABEL_PADDING,
        };
      }),
    [landmarks, projection, heightAt],
  );

  return (
    <group>
      <DamWalls dams={dams} material={materials.dam} shadows={shadows} />
      <LandmarkLabels labels={labels} heightAt={heightAt} projection={projection} />
    </group>
  );
}
