import { describe, expect, it } from 'vitest';
import { buildConfig } from './config.js';

describe('buildConfig', () => {
  it('uses the documented defaults', () => {
    expect(buildConfig({})).toMatchObject({
      initialView: { center: [-71.801, -37.724], range: 5_200, heading: 0, pitch: -33 },
      maxBounds: [
        [-71.855, -37.7672],
        [-71.75374, -37.672],
      ],
      minRange: 150,
      maxRange: 12_000,
      zoomLevels: { region: 8_500, zone: 5_200, detail: 1_400 },
      restDelayMs: 45_000,
      idleTimeoutMs: 120_000,
      idleWarningMs: 10_000,
      attractDelayMs: 60_000,
      refreshMs: 60_000,
      retryMs: 10_000,
      publicUrl: '',
      kioskWifi: 'BioMap-Angostura',
    });
  });

  it('reads overrides from the environment and ignores malformed values', () => {
    const config = buildConfig({
      VITE_MAP_BOUNDS: '-73,-39,-71,-37',
      VITE_IDLE_WARNING_S: '15',
      VITE_IDLE_TIMEOUT_S: 'abc',
      VITE_PUBLIC_URL: 'http://biomap.local',
    });
    expect(config.maxBounds).toEqual([
      [-73, -39],
      [-71, -37],
    ]);
    expect(config.idleWarningMs).toBe(15_000);
    expect(config.idleTimeoutMs).toBe(120_000);
    expect(config.publicUrl).toBe('http://biomap.local');
  });
});
