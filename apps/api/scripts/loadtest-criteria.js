/**
 * Evalúa el resultado de autocannon contra el criterio de aceptación:
 * latencia bajo el límite y cero errores. autocannon no entrega p95, así que se usa
 * p97.5, que es más exigente: si p97.5 cumple, p95 también cumple.
 *
 * @param {{ latency: { p97_5: number }, errors: number, timeouts: number,
 *   non2xx: number, requests: { total: number } }} result
 * @param {{ maxLatencyMs?: number }} [options]
 */
export function evaluateLoadTest(result, { maxLatencyMs = 200 } = {}) {
  const latencyMs = result.latency.p97_5;
  const errors = result.errors + result.timeouts + result.non2xx;
  return {
    passed: errors === 0 && latencyMs < maxLatencyMs,
    latencyMs,
    errors,
    requests: result.requests.total,
  };
}
