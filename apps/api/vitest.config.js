import { defineConfig } from 'vitest/config';

/**
 * Los tests de integración comparten una misma base de datos,
 * por eso los archivos se ejecutan en serie y no en paralelo.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 30_000,
  },
});
