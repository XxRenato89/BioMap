import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiContext } from '../hooks/useApi.js';

const clients = new Set();

/**
 * Cliente de React Query aislado para cada test, sin caché compartida.
 */
export function createTestQueryClient() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  clients.add(client);
  return client;
}

/**
 * Detiene sondeos y reintentos pendientes de los clientes creados en el test.
 */
export function clearTestQueryClients() {
  clients.forEach((client) => {
    client.cancelQueries();
    client.clear();
  });
  clients.clear();
}

/**
 * Envuelve un componente con React Query y cargadores falsos.
 *
 * @param {{ api?: object, client?: QueryClient }} options
 */
export function makeWrapper({ api = {}, client = createTestQueryClient() } = {}) {
  const loaders = {
    loadLayers: async () => [],
    loadPoints: async () => ({ type: 'FeatureCollection', features: [] }),
    loadPoint: async (id) => ({ id, properties: { id, description: '', images: [] } }),
    ...api,
  };
  return function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>
        <ApiContext.Provider value={loaders}>{children}</ApiContext.Provider>
      </QueryClientProvider>
    );
  };
}
