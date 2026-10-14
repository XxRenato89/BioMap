import { defineConfig } from '@playwright/test';

/*
 * Pruebas de extremo a extremo del kiosco: la API en modo de prueba
 * (USE_MOCKS, sin base de datos) y el visor de Vite, en puertos propios para
 * no chocar con los de desarrollo. WebGL corre por software (SwiftShader), así
 * que la maqueta va lenta: los tiempos de espera son generosos.
 */
const API_PORT = 3100;
const WEB_PORT = 5180;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 1920, height: 1080 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node apps/api/src/server.js',
      env: { USE_MOCKS: 'true', PORT: String(API_PORT), LOG_LEVEL: 'silent' },
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run dev -w apps/web -- --port ${WEB_PORT} --strictPort`,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}`, VITE_ATTRACT_DELAY_S: '0' },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
