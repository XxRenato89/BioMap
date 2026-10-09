import { describe, expect, it, vi } from 'vitest';
import { fetchLayers, fetchPoint, fetchPoints } from './client.js';

/**
 * fetch falso que responde con el estado y el cuerpo indicados.
 */
function fakeFetch(status, body) {
  return vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));
}

describe('api client', () => {
  it('fetchLayers requests /api/layers with revalidation and returns the JSON', async () => {
    const fetchImpl = fakeFetch(200, [{ id: 1 }]);
    expect(await fetchLayers(fetchImpl)).toEqual([{ id: 1 }]);
    expect(fetchImpl).toHaveBeenCalledWith('/api/layers', {
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
  });

  it('fetchPoints requests /api/points', async () => {
    const fetchImpl = fakeFetch(200, { type: 'FeatureCollection', features: [] });
    expect(await fetchPoints(fetchImpl)).toEqual({ type: 'FeatureCollection', features: [] });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/points');
  });

  it('fetchPoint requests the point detail', async () => {
    const fetchImpl = fakeFetch(200, { id: 7 });
    expect(await fetchPoint(7, fetchImpl)).toEqual({ id: 7 });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/points/7');
  });

  it('throws on a non-2xx response', async () => {
    await expect(fetchLayers(fakeFetch(503, {}))).rejects.toThrow(
      'GET /api/layers failed with 503',
    );
  });
});
