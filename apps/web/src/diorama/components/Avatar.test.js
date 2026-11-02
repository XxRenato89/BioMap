import { describe, expect, it, vi } from 'vitest';

vi.mock('../utils/characterModel.js', () => ({ useCharacterModel: () => ({}) }));
vi.mock('./DioramaScene.jsx', () => ({ useDiorama: () => ({}) }));

const { nextWanderIndex, pickPause, PAUSES } = await import('./Avatar.jsx');

const pois = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: 10, z: 0 },
];

describe('nextWanderIndex', () => {
  it('elige un lugar cercano distinto del actual', () => {
    for (const r of [0, 0.5, 0.99]) expect(nextWanderIndex(pois, 0, pois[0], () => r)).toBe(1);
  });

  it('sin lugares cerca, elige cualquiera menos el actual', () => {
    expect([0, 1]).toContain(nextWanderIndex(pois, 2, pois[2], () => 0.7));
    expect(nextWanderIndex(pois, 2, pois[2], () => 0.7)).not.toBe(2);
  });
});

describe('pickPause', () => {
  it('solo elige pausas con su animación cargada', () => {
    const actions = { Look: {}, Clapping: {} };
    for (const r of [0, 0.49, 0.5, 0.99])
      expect(['Look', 'Clapping']).toContain(pickPause(actions, () => r).anim);
  });

  it('sin animaciones de pausa, no hay pausa', () => {
    expect(pickPause({ Walking: {} }, () => 0.9)).toBeNull();
  });
});
