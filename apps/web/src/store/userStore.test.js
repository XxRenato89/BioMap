import { beforeEach, describe, expect, it } from 'vitest';
import { stopsFor, tourFrom, useUserStore } from './userStore.js';

const feature = (id, tourStop, name = `p${id}`) => ({ properties: { id, tourStop, name } });

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

  it('themed tours find their stops by place name, whatever the ids are', () => {
    const features = [
      feature(40, null, 'Camping Los Notros'),
      feature(41, null, 'Arboretum'),
      feature(42, null, 'Cerro el Calvario'),
    ];
    expect(stopsFor('nature', features)).toEqual([41, 42, 40]);
  });

  it('the inactivity reset goes back to the general tour', () => {
    const store = useUserStore.getState();
    store.setFeatures([feature(3, 1), feature(41, null, 'Arboretum')]);
    store.setActiveTour('nature');
    expect(useUserStore.getState().tour).toEqual([41]);
    useUserStore.getState().resetProgress();
    expect(useUserStore.getState().activeTourId).toBe('general');
    expect(useUserStore.getState().tour).toEqual([3]);
  });
});
