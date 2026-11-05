import { describe, expect, it, vi } from 'vitest';
import { fetchLayers, fetchPoint, fetchPoints, recordEvent } from './client.js';

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

  it('a deleted point (404) is an error, never the old bundled copy', async () => {
    await expect(fetchPoint(1, fakeFetch(404, {}))).rejects.toThrow('failed with 404');
  });

  it('with no network it falls back to the bundled data', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const points = await fetchPoints(offline);
    expect(points.type).toBe('FeatureCollection');
    expect(points.features.length).toBeGreaterThan(0);
  });

  it('recordEvent posts the visit and never throws without an API', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    await recordEvent({ type: 'point_open', pointId: 4 }, fetchImpl);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ type: 'point_open', pointId: 4 });
    await expect(
      recordEvent({ type: 'tour_complete' }, () => Promise.reject(new TypeError())),
    ).resolves.toBeUndefined();
  });
});
