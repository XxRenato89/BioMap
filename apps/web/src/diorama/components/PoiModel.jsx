import { memo, useEffect, useMemo, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPoiModel, modelScale } from '../models/index.js';

/*
 * Modelos 3D reales (.glb) que reemplazan a los hechos a mano: se listan en
 * /models/manifest.json (ver public/models/README.md). Se lee una sola vez;
 * sin manifiesto, se usan los modelos hechos a mano y no se pide nada más.
 */
let manifest = null;
function availableModels() {
  manifest ??= fetch('/models/manifest.json')
    .then((response) => (response.ok ? response.json() : { models: [] }))
    .then((data) => new Set(data.models ?? []))
    .catch(() => new Set());
  return manifest;
}

const loader = new GLTFLoader();
const scenes = new Map();

function loadScene(kind) {
  if (!scenes.has(kind)) {
    scenes.set(
      kind,
      loader.loadAsync(`/models/${kind}.glb`).then((gltf) => {
        gltf.scene.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        return gltf.scene;
      }),
    );
  }
  return scenes.get(kind);
}

/**
 * Modelo 3D de un punto de interés (presa, mirador, playa…): el .glb real si
 * está en el manifiesto, o el modelo hecho a mano mientras tanto.
 *
 * @param {object} props
 * @param {string} props.kind
 * @param {[number, number, number]} props.position
 * @param {number} [props.size] Achica el modelo si no cabía a su tamaño (ver placeModels).
 * @param {number} [props.rotationY] Giro (rad): el frente del modelo (+z) mira hacia ahí.
 * @param {(event: any) => void} [props.onSelect]
 */
export const PoiModel = memo(function PoiModel({
  kind,
  position,
  size = 1,
  rotationY = 0,
  onSelect,
}) {
  const procedural = useMemo(() => createPoiModel(kind), [kind]);
  const [real, setReal] = useState(null);

  useEffect(() => {
    let mounted = true;
    availableModels()
      .then((models) => (models.has(kind) ? loadScene(kind) : null))
      .then((scene) => mounted && scene && setReal(scene.clone(true)))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [kind]);

  const model = real ?? procedural;
  if (!model) return null;
  return (
    <primitive
      object={model}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={modelScale(kind) * size}
      onClick={onSelect}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    />
  );
}, sameModel);

/* La posición llega como arreglo nuevo en cada dibujo: se compara por valor. */
function sameModel(a, b) {
  return (
    a.kind === b.kind &&
    a.size === b.size &&
    a.rotationY === b.rotationY &&
    a.onSelect === b.onSelect &&
    a.position.every((value, index) => value === b.position[index])
  );
}

export default PoiModel;
