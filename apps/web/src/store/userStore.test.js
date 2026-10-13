import { beforeEach, describe, expect, it } from 'vitest';
import { tourFrom, useUserStore } from './userStore.js';

const feature = (id, tourStop) => ({ properties: { id, tourStop } });

describe('guided tour', () => {
  beforeEach(() => useUserStore.setState({ tour: [], visitedPoints: [] }));

  it('takes its stops from the data, in tourStop order', () => {
    expect(tourFrom([feature(5, 2), feature(9, null), feature(1, 1), feature(7, 3)])).toEqual([
      1, 5, 7,
    ]);
  });

  it('unlocks each stop once the previous one is visited; other points are always free', () => {
    const store = useUserStore.getState();
    store.setTour([1, 5, 7]);
    expect(store.getPoiState(1)).toBe('disponible');
    expect(store.getPoiState(5)).toBe('bloqueado');
    expect(store.getPoiState(9)).toBe('disponible');
    store.visitPoint(1);
    expect(useUserStore.getState().getPoiState(1)).toBe('visitado');
    expect(useUserStore.getState().getPoiState(5)).toBe('disponible');
  });

  it('knows when the tour is complete, and forgets it for the next visitor', () => {
    const store = useUserStore.getState();
    store.setTour([1, 5]);
    store.visitPoint(1);
    expect(useUserStore.getState().tourCompleted()).toBe(false);
    store.visitPoint(5);
    expect(useUserStore.getState().tourCompleted()).toBe(true);
    store.resetProgress();
    expect(useUserStore.getState().visitedPoints).toEqual([]);
  });
});
