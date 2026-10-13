import { describe, expect, it } from 'vitest';
import { SAMPLE_LAYERS, SAMPLE_POINTS } from '../../seeds/sample-data.js';
import { createLayersMockRepository } from '../../src/layers/layers.mock.js';
import { createPointsMockRepository } from '../../src/points/points.mock.js';

describe('mock repositories (USE_MOCKS)', () => {
  it('serve the same layers and points as the seeds', async () => {
    expect(await createLayersMockRepository().findActive()).toHaveLength(SAMPLE_LAYERS.length);
    expect(await createPointsMockRepository().findAll({ layerIds: null })).toHaveLength(
      SAMPLE_POINTS.length,
    );
  });

  it('expose the guided tour in order, from the seeds', async () => {
    const points = await createPointsMockRepository().findAll({});
    const tour = points
      .filter((feature) => feature.properties.tourStop)
      .sort((a, b) => a.properties.tourStop - b.properties.tourStop)
      .map((feature) => feature.properties.name);
    expect(tour[0]).toBe('Central Hidroeléctrica Angostura');
    expect(new Set(points.map((f) => f.properties.tourStop).filter(Boolean)).size).toBe(
      tour.length,
    );
  });

  it('give each point its photos with credit, main photo first', async () => {
    const central = await createPointsMockRepository().findById(1);
    expect(central.properties.images.length).toBeGreaterThan(0);
    expect(central.properties.images[0].isMain).toBe(true);
    for (const image of central.properties.images) expect(image.credit).toMatch(/\S/);
    expect(await createPointsMockRepository().findById(9999)).toBeNull();
  });
});
