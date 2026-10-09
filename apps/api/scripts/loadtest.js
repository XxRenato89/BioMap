import autocannon from 'autocannon';
import { evaluateLoadTest } from './loadtest-criteria.js';

/**
 * CLI de prueba de carga contra una API ya levantada.
 * Por defecto: 50 conexiones durante 30 s sobre /api/points (más del doble de la
 * carga esperada: 6 personas en la pantalla y 15 teléfonos).
 */
const url = process.env.LOADTEST_URL ?? 'http://localhost:3000/api/points';
const connections = Number(process.env.LOADTEST_CONNECTIONS ?? 50);
const duration = Number(process.env.LOADTEST_DURATION ?? 30);
const maxLatencyMs = Number(process.env.LOADTEST_MAX_LATENCY_MS ?? 200);

console.log(`Load test: ${url} | ${connections} connections | ${duration}s`);
const result = await autocannon({ url, connections, duration });
const verdict = evaluateLoadTest(result, { maxLatencyMs });

console.log(
  `requests=${verdict.requests} p97.5=${verdict.latencyMs}ms errors=${verdict.errors} limit=${maxLatencyMs}ms`,
);
console.log(verdict.passed ? 'PASS' : 'FAIL');
process.exit(verdict.passed ? 0 : 1);
