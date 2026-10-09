import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeWrapper } from '../test/providers.jsx';
import { useLayersQuery, usePointDetail, usePointsQuery } from './useApi.js';

const FAST = { refreshMs: 40, retryMs: 20 };
const LAYERS = [{ id: 1, slug: 'history', name: 'Historia', color: '#b4440e' }];

describe('useLayersQuery', () => {
  it('keeps the same array reference when a refresh returns equal data', async () => {
    const loadLayers = vi.fn(async () => structuredClone(LAYERS));
    const { result } = renderHook(() => useLayersQuery(FAST), {
      wrapper: makeWrapper({ api: { loadLayers } }),
    });
    await waitFor(() => expect(result.current.layers).toEqual(LAYERS));
    const first = result.current.layers;
    await waitFor(() => expect(loadLayers.mock.calls.length).toBeGreaterThan(2));
    expect(result.current.layers).toBe(first);
  });

  it('reports failure while there is no data, then recovers', async () => {
    const loadLayers = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(LAYERS);
    const { result } = renderHook(() => useLayersQuery({ refreshMs: 1000, retryMs: 300 }), {
      wrapper: makeWrapper({ api: { loadLayers } }),
    });
    await waitFor(() => expect(result.current.failing).toBe(true));
    await waitFor(() => expect(result.current.layers).toEqual(LAYERS));
    expect(result.current.failing).toBe(false);
  });
});

describe('usePointsQuery', () => {
  it('keeps the last good data and hides the error when a refresh fails', async () => {
    const points = { type: 'FeatureCollection', features: [{ id: 1 }] };
    const loadPoints = vi.fn().mockResolvedValueOnce(points).mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => usePointsQuery(FAST), {
      wrapper: makeWrapper({ api: { loadPoints } }),
    });
    await waitFor(() => expect(result.current.points).toEqual(points));
    await waitFor(() => expect(loadPoints.mock.calls.length).toBeGreaterThan(1));
    expect(result.current).toEqual({ points, failing: false });
  });
});

describe('usePointDetail', () => {
  it('loads the point detail by id', async () => {
    const loadPoint = vi.fn(async (id) => ({ id, properties: { name: 'Mirador' } }));
    const { result } = renderHook(() => usePointDetail(7), {
      wrapper: makeWrapper({ api: { loadPoint } }),
    });
    await waitFor(() => expect(result.current.data?.properties.name).toBe('Mirador'));
    expect(loadPoint).toHaveBeenCalledWith(7);
  });
});
