/*
 * Service worker de BioMap Mobile: guarda el visor y sus datos en el teléfono
 * para seguir usándolo sin el Wi‑Fi del kiosco. Solo se registra por https o
 * localhost (ver main.jsx).
 * shortcut: una sola caché sin límite de tamaño ni versión por archivo; si el
 * contenido crece o cambia seguido, pasar a Workbox con precarga del build.
 */
const CACHE = 'biomap-v1';
/* Archivos pesados que casi no cambian: primero la copia guardada, y se refresca por detrás. */
const STATIC = /^\/(diorama|models|animations|assets|media)\//;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

const save = (request, response) => {
  if (response.ok) {
    /* La copia se saca ahora: después, el navegador ya habrá leído la respuesta. */
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  /* El panel de administración y la voz nunca se guardan. */
  if (/^\/(api\/(admin|events|tts)|admin)/.test(url.pathname)) return;
  if (STATIC.test(url.pathname)) {
    /* Un modelo o relieve nuevo llega en la visita siguiente, sin cambiar el nombre de la caché. */
    const fresh = fetch(request).then((response) => save(request, response));
    event.waitUntil(fresh.catch(() => {}));
    event.respondWith(caches.match(request).then((hit) => hit ?? fresh));
    return;
  }
  /* Página y datos: lo más nuevo si hay red; si no, la última copia. */
  event.respondWith(
    fetch(request)
      .then((response) => save(request, response))
      .catch(() =>
        caches
          .match(request)
          .then(
            (hit) => hit ?? (request.mode === 'navigate' ? caches.match('/') : Response.error()),
          ),
      ),
  );
});
