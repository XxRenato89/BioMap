import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource-variable/bricolage-grotesque';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index.js';
import './styles/index.css';

/**
 * Cliente de datos del visor. En un kiosco la ventana casi nunca pierde ni
 * recupera el foco, así que el refresco depende solo del sondeo periódico.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, refetchOnReconnect: true } },
});

/*
 * Teléfono (pantalla angosta) o `?movil`: BioMap Mobile, una pantalla distinta y
 * liviana. Cada vista se carga por separado, así el teléfono no baja la maqueta 3D
 * ni el kiosco el mapa móvil.
 */
const isPhone =
  window.matchMedia('(max-width: 820px)').matches ||
  new URLSearchParams(window.location.search).has('movil');
const Viewer = lazy(() => (isPhone ? import('./mobile/MobileApp.jsx') : import('./App.jsx')));

/*
 * Kiosco táctil: mantener el dedo presionado no abre el menú del navegador.
 */
if (!isPhone) window.addEventListener('contextmenu', (event) => event.preventDefault());

/**
 * Monta el visor en el elemento #root de index.html. Fuentes, íconos y el
 * relieve de la maqueta van dentro del build: el visor no pide nada a internet.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <Viewer />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>,
);
