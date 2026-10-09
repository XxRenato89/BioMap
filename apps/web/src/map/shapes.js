/**
 * Forma de cada capa, para no depender solo del color (WCAG 1.4.1):
 * Historia círculo, Ecología cuadrado, Turismo rombo.
 */
const SHAPES = { history: 'circle', ecology: 'square', tourism: 'diamond' };

/**
 * Forma de una capa; las capas nuevas usan el círculo.
 *
 * @param {{ slug: string }} layer
 */
export function layerShape(layer) {
  return SHAPES[layer.slug] ?? 'circle';
}
