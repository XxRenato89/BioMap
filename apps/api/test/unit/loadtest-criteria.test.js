import { describe, expect, it } from 'vitest';
import { evaluateLoadTest } from '../../scripts/loadtest-criteria.js';

/**
 * Resultado mínimo con la misma forma que devuelve autocannon.
 */
function result({ p97_5 = 50, errors = 0, timeouts = 0, non2xx = 0, total = 1000 } = {}) {
  return { latency: { p97_5 }, errors, timeouts, non2xx, requests: { total } };
}

describe('evaluateLoadTest', () => {
  it('passes under the latency limit with no errors', () => {
    expect(evaluateLoadTest(result())).toEqual({
      passed: true,
      latencyMs: 50,
      errors: 0,
      requests: 1000,
    });
  });

  it('fails when latency reaches the limit', () => {
    expect(evaluateLoadTest(result({ p97_5: 200 })).passed).toBe(false);
  });

  it('fails on any error, timeout or non-2xx response', () => {
    expect(evaluateLoadTest(result({ errors: 1 })).passed).toBe(false);
    expect(evaluateLoadTest(result({ timeouts: 1 })).passed).toBe(false);
    expect(evaluateLoadTest(result({ non2xx: 1 })).errors).toBe(1);
  });

  it('accepts a custom latency limit', () => {
    expect(evaluateLoadTest(result({ p97_5: 300 }), { maxLatencyMs: 500 }).passed).toBe(true);
  });
});
