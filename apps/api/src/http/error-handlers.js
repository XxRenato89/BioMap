import { HttpError } from './errors.js';

/**
 * Responde 404 con el formato estándar a cualquier ruta inexistente.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}

/**
 * Crea el manejador central de errores.
 * Traduce los errores conocidos (HttpError y los del parser de JSON) a respuestas
 * claras. Cualquier otro error se registra en el log y se responde como 500,
 * sin mostrar el mensaje interno; el stack solo se expone en desarrollo.
 *
 * @param {{ exposeStack?: boolean, logger?: { error: Function } }} [options]
 */
export function createErrorHandler({ exposeStack = false, logger } = {}) {
  return (err, req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    if (err.type === 'entity.parse.failed') {
      return res
        .status(400)
        .json({ error: { code: 'INVALID_BODY', message: 'Malformed JSON body' } });
    }
    if (err.type === 'entity.too.large') {
      return res
        .status(413)
        .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
    }
    logger?.error({ err }, 'Unhandled error');
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error',
        ...(exposeStack ? { stack: err.stack } : {}),
      },
    });
  };
}
