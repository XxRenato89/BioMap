import { describe, expect, it } from 'vitest';
import { checkTerrainMeta } from './resources.js';

describe('checkTerrainMeta', () => {
  it('throws mentioning build:diorama on invalid, empty or outdated metadata', () => {
    expect(() => checkTerrainMeta({})).toThrow(/build:diorama/);
    expect(() => checkTerrainMeta({ version: 1 })).toThrow(/build:diorama/);
    expect(() => checkTerrainMeta(null)).toThrow(/build:diorama/);
  });

  it('accepts valid version 2 meta', () => {
    expect(() => checkTerrainMeta({ version: 2 })).not.toThrow();
  });
});
