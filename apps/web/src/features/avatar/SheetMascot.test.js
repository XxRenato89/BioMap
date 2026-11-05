import { describe, expect, it } from 'vitest';
import { waveTargets } from './SheetMascot.jsx';

describe('waveTargets', () => {
  it('raises the arm gradually, out to its own side, with the forearm pointing up', () => {
    expect(waveTargets(0, -1).blend).toBe(0);
    expect(waveTargets(2, -1).blend).toBe(1);
    const { upper, fore } = waveTargets(1, -1);
    expect(upper.x).toBeLessThan(0);
    expect(upper.y).toBeGreaterThan(0);
    expect(fore.y).toBe(1);
    expect(waveTargets(1, 1).upper.x).toBeGreaterThan(0);
  });

  it('swings the hand from side to side', () => {
    const xs = [0, 0.2, 0.4, 0.6, 0.8].map((t) => waveTargets(t, 1).fore.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.5);
  });
});
