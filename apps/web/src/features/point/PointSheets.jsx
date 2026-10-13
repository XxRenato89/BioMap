import { AnimatePresence } from 'motion/react';
import { useState } from 'react';
import SheetMascot from '../avatar/SheetMascot.jsx';
import PointSheet from './PointSheet.jsx';

/**
 * Ficha del punto abierto, acoplada al costado derecho, con la mascota a su
 * lado presentándola. La maqueta 3D sigue visible detrás.
 *
 * @param {{ open: Array<{ feature: object, layer: object }>, onClose: (id: number) => void,
 *   onSelectPoint?: (id: number) => void, allPoints?: Array<object> }} props
 */
export default function PointSheets({ open, onClose, onSelectPoint, allPoints }) {
  const active = open && open.length > 0 ? open[open.length - 1] : null;
  /* Cada cambio en la ficha hace que la mascota gesticule hacia ella. */
  const [gesture, setGesture] = useState(0);

  return (
    <AnimatePresence>
      {active && (
        <SheetMascot key="mascot" gestureKey={`${active.feature.properties.id}-${gesture}`} />
      )}
      {active && (
        <PointSheet
          key={active.feature.properties.id}
          feature={active.feature}
          layer={active.layer}
          onClose={() => onClose(active.feature.properties.id)}
          onSelectNextPoint={onSelectPoint}
          allPoints={allPoints}
          onChange={() => setGesture((n) => n + 1)}
        />
      )}
    </AnimatePresence>
  );
}
