import { layerShape } from '../map/shapes.js';

/**
 * Figura de una capa (círculo, cuadrado o rombo con su color), igual a la de
 * sus alfileres en el mapa.
 *
 * @param {{ layer: { slug: string, color: string }, size?: 'sm' | 'md' | 'lg' }} props
 */
export default function LayerShape({ layer, size = 'md' }) {
  return (
    <span
      className={`shape shape--${layerShape(layer)} shape--${size}`}
      style={{ '--layer-color': layer.color }}
      aria-hidden="true"
    />
  );
}
