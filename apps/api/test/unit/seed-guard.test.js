import { describe, expect, it } from 'vitest';
import { assertNotProduction } from '../../seeds/seed.js';

describe('assertNotProduction', () => {
  it('throws when NODE_ENV is production', () => {
    expect(() => assertNotProduction({ NODE_ENV: 'production' })).toThrow(/production/);
  });

  it('allows development and test', () => {
    expect(() => assertNotProduction({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertNotProduction({})).not.toThrow();
  });
});
