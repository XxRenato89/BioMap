import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../../src/http/error-handlers.js';
import { HttpError } from '../../src/http/errors.js';

/**
 * App mínima con una ruta que lanza el error indicado,
 * para probar el manejador central de forma aislada.
 */
function appThrowing(error, options) {
  const app = express();
  app.get('/boom', () => {
    throw error;
  });
  app.use(createErrorHandler(options));
  return app;
}

describe('createErrorHandler', () => {
  it('maps HttpError to its status and code', async () => {
    const res = await request(appThrowing(new HttpError(404, 'POINT_NOT_FOUND', 'nope'))).get(
      '/boom',
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'POINT_NOT_FOUND', message: 'nope' } });
  });

  it('returns 500 INTERNAL_ERROR without a stack by default', async () => {
    const res = await request(appThrowing(new Error('secret detail'))).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret detail');
    expect(res.body.error.stack).toBeUndefined();
  });

  it('includes the stack when exposeStack is true', async () => {
    const res = await request(appThrowing(new Error('x'), { exposeStack: true })).get('/boom');
    expect(res.body.error.stack).toContain('Error: x');
  });
});
