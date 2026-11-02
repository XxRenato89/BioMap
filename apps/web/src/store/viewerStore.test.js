import { beforeEach, describe, expect, it } from 'vitest';
import { initialViewerState, MAX_OPEN_CARDS, useViewerStore } from './viewerStore.js';

const store = () => useViewerStore.getState();

beforeEach(() => useViewerStore.setState(initialViewerState()));

describe('viewerStore', () => {
  it('toggles a layer off and on', () => {
    store().toggleLayer(1);
    expect([...store().hiddenLayerIds]).toEqual([1]);
    store().toggleLayer(1);
    expect(store().hiddenLayerIds.size).toBe(0);
  });

  it('forgets hidden layers that disappeared, keeping the same Set otherwise', () => {
    store().toggleLayer(1);
    store().toggleLayer(3);
    const before = store().hiddenLayerIds;
    store().pruneHiddenLayers(new Set([1, 3]));
    expect(store().hiddenLayerIds).toBe(before);
    store().pruneHiddenLayers(new Set([1]));
    expect([...store().hiddenLayerIds]).toEqual([1]);
  });

  it('keeps several sheets open, brings a reopened one to the front and closes one', () => {
    store().openPoint(10);
    store().openPoint(20);
    store().openPoint(10);
    expect(store().selectedPointIds).toEqual([20, 10]);
    store().closePoint(20);
    expect(store().selectedPointIds).toEqual([10]);
  });

  it('closes the oldest sheet when too many are open', () => {
    for (let id = 1; id <= MAX_OPEN_CARDS + 1; id += 1) store().openPoint(id);
    expect(store().selectedPointIds).toHaveLength(MAX_OPEN_CARDS);
    expect(store().selectedPointIds[0]).toBe(2);
  });

  it('resetExploration closes the sheet and shows every layer, keeping reading settings', () => {
    store().toggleLayer(1);
    store().openPoint(10);
    store().setLang('en');
    store().cycleTextScale();
    store().resetExploration();
    expect(store()).toMatchObject({ selectedPointIds: [], lang: 'en', textScale: 1 });
    expect(store().hiddenLayerIds.size).toBe(0);
  });

  it('setTextScale picks one of the text sizes directly', () => {
    store().setTextScale(2);
    expect(store().textScale).toBe(2);
  });

  it('resetAll returns everything to the initial state', () => {
    store().openPoint(10);
    store().setLang('en');
    store().toggleContrast();
    store().setPitched(false);
    store().resetAll();
    expect(store()).toMatchObject({ ...initialViewerState(), hiddenLayerIds: new Set() });
  });
});
