/**
 * Error HTTP controlado: el manejador central lo convierte en una respuesta
 * con su código de estado y su código de error, sin exponer detalles internos.
 */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}
