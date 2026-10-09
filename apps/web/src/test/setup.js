import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '../i18n/index.js';
import { clearTestQueryClients } from './providers.jsx';

/**
 * Piezas del navegador que jsdom no trae y que usan algunas librerías
 * (el carrusel y las animaciones). Solo existen en los tests.
 */
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

globalThis.ResizeObserver ??= NoopObserver;
globalThis.IntersectionObserver ??= NoopObserver;
window.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
});

afterEach(() => {
  cleanup();
  clearTestQueryClients();
});
