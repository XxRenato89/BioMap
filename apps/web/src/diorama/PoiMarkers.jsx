import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, MeshStandardMaterial, RingGeometry, Vector3 } from 'three';
import LayerShape from '../components/LayerShape.jsx';
import { publishAnchors } from '../store/anchorStore.js';
import { useDiorama } from './DioramaScene.jsx';
import { declutter } from './labels.js';
import { createPoiModel, modelKindFor, modelScale } from './models.js';
import { isOccluded } from './occlusion.js';

/*
 * Aro en el suelo bajo cada pin, compartido por todas las vistas.
 */
const RING = new RingGeometry(0.32, 0.46, 32).rotateX(-Math.PI / 2);
const materials = new Map();

/**
 * Material de una capa (uno por color, reutilizado).
 */
function layerMaterial(color) {
  if (!materials.has(color)) {
    materials.set(
      color,
      new MeshStandardMaterial({
        color: new Color(color),
        emissive: new Color(color),
        emissiveIntensity: 0.25,
        roughness: 0.35,
      }),
    );
  }
  return materials.get(color);
}

/**
 * Escala para que el marcador se vea del mismo tamaño en pantalla al acercarse
 * o alejarse (dentro de un rango).
 */
function useConstantSize(groupRef, base = 1) {
  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;
    const scale = Math.min(Math.max(camera.position.distanceTo(group.position) / 140, 0.012), 1);
    group.scale.setScalar(scale * base);
  });
}

/*
 * Altura del pin sobre el suelo (unidades): la punta de su mástil queda aquí.
 */
const PIN_HEIGHT = 0.012;

/*
 * Medidas del pin en pantalla (px) para que las etiquetas no se tapen: disco,
 * mástil, separación de la etiqueta y ancho aproximado por letra.
 */
const DOT = 48;
const STEM = 16;
const LABEL_GAP = 10;
const CHAR_WIDTH = 9.5;
const LABEL_PADDING = 30;
const projected = new Vector3();

/**
 * Un punto de interés: pin HTML con la figura y el color de su capa y el
 * nombre del lugar, más un aro en el suelo. Es un botón real: se alcanza con
 * teclado y lector de pantalla. Se anota en `registry` para que PoiMarkers
 * decida en cada cuadro si se atenúa (tapado por el relieve) o si muestra
 * solo el disco (su etiqueta chocaría con otra).
 */
function Poi({ id, position, layer, name, selected, onSelect, registry }) {
  const ring = useRef(null);
  const anchor = useMemo(
    () => new Vector3(position[0], position[1] + PIN_HEIGHT, position[2]),
    [position],
  );
  useConstantSize(ring, selected ? 1.5 : 1);
  const register = (element) => {
    if (element) registry.set(id, { element, anchor, name, selected });
    else registry.delete(id);
  };
  return (
    <group>
      <group ref={ring} position={position}>
        <mesh geometry={RING} material={layerMaterial(layer.color)} position={[0, 0.02, 0]} />
      </group>
      <Html position={anchor} zIndexRange={[selected ? 30 : 20, 10]}>
        <button
          ref={register}
          type="button"
          className="poi-pin"
          data-selected={selected || undefined}
          style={{ '--layer-color': layer.color }}
          onClick={onSelect}
        >
          <span className="poi-pin__dot">
            <LayerShape layer={layer} size="sm" />
          </span>
          <span className="poi-pin__label">{name}</span>
        </button>
      </Html>
    </group>
  );
}

/**
 * Modelo 3D del lugar (presa, ruka, mirador...) apoyado en el relieve. También
 * responde al toque, igual que el marcador.
 */
function PoiModel({ kind, position, onSelect }) {
  const model = useMemo(() => createPoiModel(kind), [kind]);
  return (
    <primitive
      object={model}
      position={position}
      scale={modelScale(kind)}
      onClick={onSelect}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    />
  );
}

/**
 * Puntos de interés de las capas visibles, apoyados sobre el relieve: el
 * modelo 3D del lugar y su pin con nombre. Los modelos solo responden a
 * toques sobre su propia vista (`viewId`), no a paneles que estén encima.
 *
 * @param {object} props
 * @param {{ features: Array<object> }} props.points
 * @param {Array<{ id: number, slug: string, color: string }>} props.layers
 * @param {Set<number>} props.visibleLayerIds
 * @param {number[]} [props.selectedIds]
 * @param {string} props.viewId
 * @param {(id: number, screen: { x: number, y: number }) => void} props.onSelectPoint
 */
export function PoiMarkers({
  points,
  layers,
  visibleLayerIds,
  selectedIds = [],
  viewId,
  onSelectPoint,
}) {
  const { projection, heightAt, dams } = useDiorama();
  const size = useThree((state) => state.size);
  const layerById = useMemo(() => new Map(layers.map((layer) => [layer.id, layer])), [layers]);
  const selected = new Set(selectedIds);
  const registry = useRef(new Map()).current;

  /*
   * En cada cuadro: atenúa los pines que tapa el relieve, deja solo el disco
   * en los que su etiqueta chocaría con otra (gana el seleccionado y luego el
   * orden de la lista) y publica dónde quedó el pin seleccionado, para su ficha.
   */
  useFrame(({ camera }) => {
    const items = [];
    const anchors = {};
    let order = 0;
    for (const [id, entry] of registry) {
      order += 1;
      const { element } = entry;
      const occluded =
        !entry.selected && isOccluded(camera.position, entry.anchor, heightAt, projection, 0.003);
      if (element.dataset.occluded !== String(occluded))
        element.dataset.occluded = String(occluded);
      projected.copy(entry.anchor).project(camera);
      if (projected.z > 1) continue;
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      if (entry.selected) anchors[id] = { x, y };
      const labelWidth = entry.name.length * CHAR_WIDTH + LABEL_PADDING;
      items.push({
        id,
        rank: entry.selected ? 1_000_000 : -order,
        rect: {
          x: x - DOT / 2,
          y: y - STEM - DOT,
          width: DOT + LABEL_GAP + labelWidth,
          height: DOT,
        },
      });
    }
    const withLabel = declutter(items);
    for (const [id, { element }] of registry) {
      const compact = String(!withLabel.has(id));
      if (element.dataset.compact !== compact) element.dataset.compact = compact;
    }
    publishAnchors(anchors);
  });
  return (
    points.features
      .filter((feature) => visibleLayerIds.has(feature.properties.layerId))
      .filter((feature) => layerById.has(feature.properties.layerId))
      .map((feature) => ({ feature, ...projection.toWorld(feature.geometry.coordinates) }))
      /* Solo los puntos que caen sobre la maqueta. */
      .filter(
        ({ x, z }) => Math.abs(x) <= projection.width / 2 && Math.abs(z) <= projection.depth / 2,
      )
      .map(({ feature, x, z }) => {
        const { id, layerId } = feature.properties;
        const y = heightAt(x, z);
        const modelKind = modelKindFor(feature.properties.name, layerById.get(layerId).slug);
        /* Las presas ya están levantadas a escala real desde OpenStreetMap. */
        const kind = modelKind === 'dam' && dams.length > 0 ? null : modelKind;
        /*
         * Toque en el modelo 3D (evento de la escena, solo si cae sobre esta
         * vista) o en el pin (botón HTML).
         */
        const onSelect = (event) => {
          const native = event.nativeEvent;
          const fromScene = Boolean(event.intersections);
          if (fromScene && native.target.closest?.('[data-view]')?.dataset.view !== viewId) return;
          event.stopPropagation();
          onSelectPoint(id, { x: native.clientX, y: native.clientY });
        };
        return (
          <group key={id}>
            {kind && <PoiModel kind={kind} position={[x, y - 0.004, z]} onSelect={onSelect} />}
            <Poi
              position={[x, y, z]}
              layer={layerById.get(layerId)}
              id={id}
              name={feature.properties.name}
              registry={registry}
              selected={selected.has(id)}
              onSelect={onSelect}
            />
          </group>
        );
      })
  );
}
