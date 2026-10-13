import { layerShape } from '../map/shapes.js';

/**
 * Figura de una capa (círculo, cuadrado o rombo con su color), igual a la de
 * sus alfileres en el mapa.
 *
 * @param {{ layer: { slug: string, color: string }, size?: 'sm' | 'md' | 'lg' }} props
 */
export default function LayerShape({ layer, size = 'md' }) {
  const shape = layerShape(layer);
  const sizeClasses =
    {
      sm: 'w-2.5 h-2.5',
      md: 'w-3.5 h-3.5',
      lg: 'w-4.5 h-4.5',
    }[size] || 'w-3.5 h-3.5';

  const shapeClasses =
    {
      circle: 'rounded-full',
      square: 'rounded-[3px]',
      diamond: 'rounded-[2px] rotate-45',
    }[shape] || 'rounded-full';

  return (
    <span
      className={`inline-block shrink-0 ${sizeClasses} ${shapeClasses}`}
      style={{ backgroundColor: layer.color }}
      aria-hidden="true"
    />
  );
}
