/**
 * Pide un cuadro nuevo al canvas de la maqueta desde fuera de él. El canvas
 * dibuja "a pedido", así que mover una ventana o cambiar de pestaña necesita
 * avisarle.
 */
let requester = () => {};

export function setFrameRequester(invalidate) {
  requester = invalidate;
}

export function requestFrame() {
  requester();
}
