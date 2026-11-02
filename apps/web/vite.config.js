import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * En desarrollo, Vite reenvía /api a la API para que todo salga
 * del mismo origen (sin CORS). En Docker, API_PROXY_TARGET apunta al servicio `api`.
 */
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    /* /media sale de public/media (mismas fotos que la API): así se ven aunque la API esté apagada. */
    proxy: { '/api': apiTarget },
  },
  build: {
    /*
     * El motor 3D (three.js y react-three) va en su propio archivo para que el
     * navegador lo guarde en caché aparte del código del visor.
     */
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['src/test/setup.js'],
  },
});
