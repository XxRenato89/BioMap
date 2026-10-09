import { useLayoutEffect, useRef, useState } from 'react';
import { placeCards } from '../../map/cardPlacement.js';
import { useAnchorStore } from '../../store/anchorStore.js';
import PointSheet from './PointSheet.jsx';

/**
 * Rectángulos de los paneles que las fichas no deben tapar (marcados con
 * data-obstacle), relativos al visor.
 */
function obstacleRects(viewer) {
  const origin = viewer.getBoundingClientRect();
  return [...viewer.querySelectorAll('[data-obstacle]')]
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left - origin.left,
        top: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

/**
 * Las fichas abiertas (varias personas pueden explorar a la vez), cada una al
 * lado de su pin. Se ubican juntas para no taparse entre sí ni tapar los
 * paneles, y cada una conserva su lado mientras le quepa: al mover la cámara
 * siguen a su pin sin saltar de un lado a otro.
 *
 * @param {{ open: Array<{ feature: object, layer: object }>, onClose: (id: number) => void }} props
 */
export default function PointSheets({ open, onClose }) {
  const anchors = useAnchorStore((state) => state.anchors);
  const elements = useRef(new Map());
  const previous = useRef({});
  const [placements, setPlacements] = useState({});
  const ids = open.map(({ feature }) => feature.properties.id).join(',');

  useLayoutEffect(() => {
    const first = elements.current.values().next().value;
    const viewer = first?.closest('.viewer');
    if (!viewer) return;
    const placed = open
      .map(({ feature }) => feature.properties.id)
      .filter((id) => anchors[id] && elements.current.get(id))
      .map((id) => ({ id, ...anchors[id] }));
    if (placed.length === 0) return;
    const results = placeCards(placed, {
      card: { width: first.offsetWidth, height: first.offsetHeight },
      viewport: { width: viewer.clientWidth, height: viewer.clientHeight },
      obstacles: obstacleRects(viewer),
      previous: previous.current,
    });
    const next = Object.fromEntries(results.map((result) => [result.id, result]));
    previous.current = next;
    setPlacements(next);
    // `ids` resume `open`: se recalcula al abrir o cerrar una ficha y al moverse un pin.
  }, [anchors, ids]);

  return open.map(({ feature, layer }) => {
    const { id } = feature.properties;
    return (
      <PointSheet
        key={id}
        ref={(element) => {
          if (element) elements.current.set(id, element);
          else elements.current.delete(id);
        }}
        feature={feature}
        layer={layer}
        placement={placements[id] ?? null}
        onClose={() => onClose(id)}
      />
    );
  });
}
