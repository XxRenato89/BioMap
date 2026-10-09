import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource-variable/bricolage-grotesque';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './i18n/index.js';
import './styles/index.css';

/**
 * Cliente de datos del visor. En un kiosco la ventana casi nunca pierde ni
 * recupera el foco, así que el refresco depende solo del sondeo periódico.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, refetchOnReconnect: true } },
});

/**
 * Monta el visor en el elemento #root de index.html. Fuentes, íconos y el
 * relieve de la maqueta van dentro del build: el visor no pide nada a internet.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
