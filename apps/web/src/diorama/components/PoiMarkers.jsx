import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Quaternion, Vector3 } from 'three';
import { publishAnchors } from '../../store/anchorStore.js';
import { useClearingStore } from '../../store/clearingStore.js';
import { useUserStore } from '../../store/userStore.js';
import { useDiorama } from './DioramaScene.jsx';
import { PoiModel } from './PoiModel.jsx';
import { PoiPin } from './PoiPin.jsx';
import { clusterPins, declutter } from '../utils/labels.js';
import {
  BRIDGE_DECK,
  BRIDGE_SPAN,
  modelKindFor,
  modelRadius,
  modelScale,
} from '../models/index.js';
import { cliffEdge, placeModels, riverCrossing, shoreSpot } from '../utils/placement.js';
import { RESERVOIR, within } from '../utils/reservoir.js';
import { isOccluded } from '../utils/occlusion.js';
import { waterTest } from '../utils/pathfinder.js';

/*
 * Puntos sin modelo propio: la Central queda sobre la presa (su casa de máquinas
 * es una caverna bajo el cerro), que ya se dibuja a escala real; el Mirador
 * Huequecura está en el mismo lugar que Parque Angostura y su plataforma es la
 * de ese modelo; el Centro de Visitantes son sus edificios de OpenStreetMap,
 * oscuros como en la foto.
 */
/* Modelos que van al borde del barranco más cercano, mirando al agua. */
const EDGE_KINDS = new Set(['forestTrail', 'meshDeck']);
/* Modelos que van en la orilla, con la playa tocando el agua. */
const SHORE_KINDS = new Set(['camping']);
/* Separación mínima entre dos miradores al borde (km). */
const EDGE_SPACING_KM = 0.04;

const TERRAIN_ONLY =
  /^(Central Hidroel[eé]ctrica Angostura|Sendero y Mirador Huequecura|Centro de Visitantes Angostura)$/;

/**
 * Rumbo (rad) hacia el agua más cercana desde (x, z), para que playas y
 * miradores la miren; 0 si no hay agua a menos de ~400 m.
 */
function facingWater(x, z, inWater, projection) {
  for (const reach of [0.1, 0.2, 0.4]) {
    for (let k = 0; k < 24; k += 1) {
      const angle = (k / 24) * Math.PI * 2;
      const dx = Math.sin(angle) * reach;
      const dz = Math.cos(angle) * reach;
      if (inWater(projection.toLngLat(x + dx, z + dz))) return angle;
    }
  }
  return 0;
}

/*
 * Medidas del pin en pantalla (px) para que las etiquetas no se tapen.
 */
const DOT = 52;
/* La insignia queda justo sobre su ancla (la punta del poste). */
const STEM = 0;
const LABEL_GAP = 0;
/* Pines a menos de esto (px) en pantalla se juntan en uno con el número de lugares. */
const CLUSTER_PX = 58;
const CHAR_WIDTH = 9.5;
const LABEL_PADDING = 30;
const projected = new Vector3();

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
  const { projection, heightAt, surfaceAt, dams, waterPolygons } = useDiorama();
  const inWater = useMemo(() => waterTest(waterPolygons ?? []), [waterPolygons]);
  const getPoiState = useUserStore((state) => state.getPoiState);
  /* Suscripciones para redibujar los candados al avanzar el recorrido. */
  useUserStore((state) => state.visitedPoints);
  /* Y para mostrar el lugar secreto apenas Quibar lo descubre. */
  useUserStore((state) => state.discoveredSecrets);
  const tour = useUserStore((state) => state.tour);
  const size = useThree((state) => state.size);
  const layerById = useMemo(() => new Map(layers.map((layer) => [layer.id, layer])), [layers]);
  const selected = new Set(selectedIds);

  /* Modelo de cada punto: las presas ya están levantadas a escala real desde OpenStreetMap. */
  const kindOf = (feature) => {
    if (TERRAIN_ONLY.test(feature.properties.name)) return null;
    const kind = modelKindFor(
      feature.properties.name,
      layerById.get(feature.properties.layerId)?.slug,
    );
    return kind === 'dam' && dams.length > 0 ? null : kind;
  };
  /*
   * Dónde se apoya cada modelo (de todos los puntos, visibles o no, para que no
   * salten al prender o apagar capas): plano, fuera del agua y sin chocar.
   */
  const spots = useMemo(() => {
    const items = points.features.flatMap((feature) => {
      const kind = kindOf(feature);
      if (!kind) return [];
      const { x, z } = projection.toWorld(feature.geometry.coordinates);
      if (Math.abs(x) > projection.width / 2 || Math.abs(z) > projection.depth / 2) return [];
      return [{ id: feature.properties.id, kind, x, z, radius: modelRadius(kind) }];
    });
    const ground = { heightAt, isWater: (x, z) => inWater(projection.toLngLat(x, z)) };
    /* Primero los de la orilla (su lugar es fijo); el resto se reparte sin pisarlos. */
    const shoreSpots = new Map();
    const taken = [];
    for (const item of items.filter((i) => SHORE_KINDS.has(i.kind))) {
      const shore = shoreSpot(item.x, item.z, item.radius, ground);
      const spot = shore ? { ...shore, scale: 1 } : placeModels([item], ground, taken).get(item.id);
      if (!spot) continue;
      shoreSpots.set(item.id, spot);
      taken.push({ x: spot.x, z: spot.z, r: item.radius * spot.scale });
    }
    /*
     * Puente colgante: tendido de orilla a orilla en el cruce más angosto del
     * río junto a su punto, con el largo justo y el tablero a la altura de la
     * orilla más baja.
     */
    for (const item of items.filter((i) => i.kind === 'bridge')) {
      const crossing = riverCrossing(item.x, item.z, ground.isWater);
      if (!crossing) continue;
      const { a, b } = crossing;
      const [dx, dz] = [b.x - a.x, b.z - a.z];
      const length = Math.hypot(dx, dz);
      const unit = modelScale('bridge');
      const scale = length / (BRIDGE_SPAN * unit);
      const bank = Math.min(heightAt(a.x, a.z), heightAt(b.x, b.z));
      const spot = {
        x: (a.x + b.x) / 2,
        z: (a.z + b.z) / 2,
        /* El tablero queda ~2 m sobre la orilla. */
        y: bank - BRIDGE_DECK * unit * scale + 0.002,
        scale,
        /* El largo del modelo va en x: se gira para que siga la recta entre orillas. */
        angle: Math.atan2(-dz, dx),
        span: true,
      };
      shoreSpots.set(item.id, spot);
      taken.push({ x: spot.x, z: spot.z, r: length / 2 });
    }
    const spots = placeModels(
      items.filter(
        (item) =>
          !EDGE_KINDS.has(item.kind) && !SHORE_KINDS.has(item.kind) && item.kind !== 'bridge',
      ),
      ground,
      taken,
    );
    for (const [id, spot] of shoreSpots) spots.set(id, spot);
    /* Miradores: al borde del barranco, mirando al embalse (como en sus fotos). */
    for (const feature of points.features) {
      if (!EDGE_KINDS.has(kindOf(feature))) continue;
      const { x, z } = projection.toWorld(feature.geometry.coordinates);
      /* Miran al embalse (en sus fotos se ve la barrera flotante), no al río de abajo. */
      const edge = cliffEdge(
        x,
        z,
        {
          heightAt,
          isWater: (wx, wz) => {
            const lngLat = projection.toLngLat(wx, wz);
            return within(lngLat, RESERVOIR.bed) && inWater(lngLat);
          },
        },
        { taken: [...spots.values()], spacing: EDGE_SPACING_KM },
      );
      if (edge) spots.set(feature.properties.id, { ...edge, scale: 1, edge: true });
    }
    return spots;
    // kindOf solo depende de layerById y dams.
  }, [points, layerById, dams, projection, heightAt, inWater]);
  /* El bosque se despeja donde va cada modelo (con un poco de holgura). */
  useEffect(() => {
    const kinds = new Map(points.features.map((f) => [f.properties.id, kindOf(f)]));
    const clearings = [...spots].map(([id, spot]) => ({
      x: spot.x,
      z: spot.z,
      r: modelRadius(kinds.get(id)) * (spot.scale ?? 1) * 1.15,
    }));
    useClearingStore.setState({ clearings });
    // kindOf solo depende de layerById y dams, ya incluidos en spots.
  }, [spots, points]);
  const registry = useRef(new Map()).current;
  const lastUpdate = useRef(-Infinity);
  const lastView = useRef({
    position: new Vector3(Infinity, 0, 0),
    quaternion: new Quaternion(),
    still: 0,
  });

  useFrame(({ camera }) => {
    /*
     * El reparto de insignias y etiquetas se rehace cada 150 ms, y solo con la
     * cámara quieta: mientras se arrastra o se hace zoom, nada salta.
     */
    const now = performance.now();
    const view = lastView.current;
    if (!camera.position.equals(view.position) || !camera.quaternion.equals(view.quaternion)) {
      view.position.copy(camera.position);
      view.quaternion.copy(camera.quaternion);
      view.still = now;
    }
    const isUpdateFrame = now - lastUpdate.current > 150 && now - view.still > 200;
    if (isUpdateFrame) lastUpdate.current = now;

    const anchors = {};
    let order = 0;
    const items = [];

    for (const [id, entry] of registry) {
      order += 1;
      const { element } = entry;

      // Proyectar solo si es el seleccionado (para la ficha) o si es cuadro de actualización
      if (entry.selected || isUpdateFrame) {
        projected.copy(entry.anchor).project(camera);
        if (projected.z > 1) {
          if (isUpdateFrame) element.dataset.occluded = 'true';
          continue;
        }
        if (entry.selected)
          anchors[id] = {
            x: (projected.x * 0.5 + 0.5) * size.width,
            y: (-projected.y * 0.5 + 0.5) * size.height,
          };
        /* El reparto se hace desde la punta del poste sin escalón. */
        projected.copy(entry.base ?? entry.anchor).project(camera);
        const x = (projected.x * 0.5 + 0.5) * size.width;
        const y = (-projected.y * 0.5 + 0.5) * size.height;

        if (isUpdateFrame) {
          const occluded =
            !entry.selected &&
            isOccluded(camera.position, entry.anchor, heightAt, projection, 0.003);
          if (element.dataset.occluded !== String(occluded))
            element.dataset.occluded = String(occluded);

          const labelWidth = entry.name.length * CHAR_WIDTH + LABEL_PADDING;
          /* Mandan el elegido y las paradas del recorrido; después, el orden de llegada. */
          const tourRank = tour.includes(Number(id)) ? 1_000 : 0;
          items.push({
            id,
            x,
            y,
            solo: entry.selected,
            rank: entry.selected ? 1_000_000 : tourRank - order,
            rect: {
              x: x - DOT / 2,
              y: y - STEM - DOT,
              width: DOT + LABEL_GAP + labelWidth,
              height: DOT,
            },
          });
        }
      }
    }

    if (isUpdateFrame && items.length > 0) {
      /*
       * Los pines que se pisan en pantalla se juntan en uno solo con el número
       * de lugares (se ve limpio); al acercarse se separan solos.
       */
      const groups = clusterPins(items, CLUSTER_PX);
      const leaderOf = new Map();
      for (const [leader, ids] of groups) for (const member of ids) leaderOf.set(member, leader);
      const withLabel = declutter(
        items.filter(({ id }) => groups.get(id)?.length === 1),
      );
      for (const [id, entry] of registry) {
        const { element } = entry;
        const ids = groups.get(id);
        const hidden = String(!ids && leaderOf.has(id));
        const count = ids && ids.length > 1 ? String(ids.length) : '';
        const compact = String(!withLabel.has(id));
        if (element.dataset.hidden !== hidden) element.dataset.hidden = hidden;
        /* React puede volver a dibujar el pin y vaciar el número: se reescribe siempre. */
        const badge = element.querySelector('.poi-pin__count');
        if (badge && badge.textContent !== count) badge.textContent = count;
        if ((element.dataset.count ?? '') !== count) {
          if (count) element.dataset.count = count;
          else delete element.dataset.count;
          /* Para lectores de pantalla: el líder y cuántos lugares más tiene junto. */
          element.dataset.label ??= element.getAttribute('aria-label') ?? '';
          element.setAttribute(
            'aria-label',
            count ? `${element.dataset.label} y ${count - 1} lugares más` : element.dataset.label,
          );
        }
        if (element.dataset.compact !== compact) element.dataset.compact = compact;
      }
    }

    if (Object.keys(anchors).length > 0) {
      publishAnchors(anchors);
    }
  });

  return points.features
    .filter((feature) => visibleLayerIds.has(feature.properties.layerId))
    .filter((feature) => layerById.has(feature.properties.layerId))
    .map((feature) => ({ feature, ...projection.toWorld(feature.geometry.coordinates) }))
    .filter(
      ({ x, z }) => Math.abs(x) <= projection.width / 2 && Math.abs(z) <= projection.depth / 2,
    )
    .map(({ feature, x, z }) => {
      const { id, layerId } = feature.properties;
      /* Sobre lo que se ve: un punto en un puente queda en su tablero, no en el fondo. */
      const y = surfaceAt(x, z);
      const kind = kindOf(feature);
      const spot = spots.get(id);

      const onSelect = (event) => {
        const native = event.nativeEvent;
        const fromScene = Boolean(event.intersections);
        if (fromScene && native.target.closest?.('[data-view]')?.dataset.view !== viewId) return;
        event.stopPropagation();
        /* Parada del recorrido aún bloqueada: no se abre. */
        if (getPoiState(id) === 'bloqueado') return;
        onSelectPoint(id, { x: native.clientX, y: native.clientY });
      };

      const isSecret =
        Boolean(feature.properties?.secret) && !useUserStore.getState().isSecretDiscovered(id);

      return (
        <group key={id}>
          {!isSecret && kind && spot && (
            <PoiModel
              kind={kind}
              position={[spot.x, spot.y - (spot.edge || spot.span ? 0 : 0.002), spot.z]}
              size={spot.scale}
              rotationY={spot.angle ?? facingWater(spot.x, spot.z, inWater, projection)}
              onSelect={onSelect}
            />
          )}
          <PoiPin
            position={spot?.edge ? [spot.x, spot.y, spot.z] : [x, y, z]}
            layer={layerById.get(layerId)}
            id={id}
            name={feature.properties.name}
            registry={registry}
            selected={selected.has(id)}
            onSelect={onSelect}
            state={getPoiState(id)}
            stop={tour.indexOf(Number(id)) + 1}
            isSecret={isSecret}
          />
        </group>
      );
    });
}
