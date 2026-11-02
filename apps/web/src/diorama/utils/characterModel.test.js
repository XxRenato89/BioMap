import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeClipInPlace, normalizeAnimationClips, STANDARD_ANIM_NAMES } from './characterModel.js';

describe('characterModel utils', () => {
  it('exposes standard animation names', () => {
    expect(STANDARD_ANIM_NAMES).toEqual(['walk', 'run']);
  });

  it('normalizes clips with canonical and alias names', () => {
    const runClip = new THREE.AnimationClip('Running', 1.0, []);
    const walkClip = new THREE.AnimationClip('AN_Quibar_WalkCycle', 1.2, []);
    const idleClip = new THREE.AnimationClip('mixamo.com|Idle', 2.0, []);

    const normalized = normalizeAnimationClips([runClip, walkClip, idleClip]);
    const names = normalized.map((c) => c.name);

    // Run aliases
    expect(names).toContain('Running');
    expect(names).toContain('run');
    expect(names).toContain('Run');

    // Walk aliases
    expect(names).toContain('walk');
    expect(names).toContain('Walk');
    expect(names).toContain('Walking');

    // Idle aliases
    expect(names).toContain('idle');
    expect(names).toContain('Idle');
  });

  it('removes forward root drift on hips position track', () => {
    const times = [0, 0.5, 1.0];
    // Start at Y = 0, End at Y = 80 (delta = 80)
    const values = [
      0, 0, 0,
      0, 40, 0,
      0, 80, 0,
    ];
    const track = new THREE.VectorKeyframeTrack('mixamorigHips.position', times, values);
    const clip = new THREE.AnimationClip('walk', 1.0, [track]);

    makeClipInPlace(clip);

    const resultValues = clip.tracks[0].values;
    expect(resultValues[1]).toBeCloseTo(0);
    expect(resultValues[4]).toBeCloseTo(0);
    expect(resultValues[7]).toBeCloseTo(0);
  });
});

