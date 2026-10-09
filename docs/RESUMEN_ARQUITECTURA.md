# BioMap – Resumen Maestro de Arquitectura y Sistema

> **Propósito de este documento:** Este archivo sirve como la referencia técnica definitiva y autosuficiente del proyecto. Resume la arquitectura, flujo de datos, renderizado 3D, backend, bases de datos y decisiones de diseño para evitar tener que releer todo el código base en futuras iteraciones.

---

## 1. Identidad y Propósito del Proyecto

- **Proyecto:** BioMap – Mapa Vivo del Bío Bío.
- **Contexto:** Proyecto de Título para INACAP (Ingeniería en Informática).
- **Cliente / Entorno:** Centro de Visitantes Angostura (Colbún S.A.), ubicado en la cuenca del Río Bío Bío, Región del Biobío, Chile.
- **Dispositivo de Despliegue:** Tótem interactivo vertical/horizontal con **pantalla táctil 55" 4K** operado por un Mini PC local.
- **Principio No Negociable (Offline-First):** El sistema opera en un entorno de museo sin acceso a internet garantizado. Ningún componente en tiempo de ejecución puede solicitar recursos a CDNs externas ni depender de servicios en la nube. Todas las fuentes (Google Fonts empaquetadas localmente vía Fontsource), teselas, librerías JS, texturas y modelos 3D se sirven de forma 100% local.

---

## 2. Mapa Tecnológico Global

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TÓTEM KIOSCO TÁCTIL 55" 4K                      │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ apps/web (Frontend SPA)                                        │   │
│   │ React 19 + Vite 7 + Three.js 0.185 + React Three Fiber 9       │   │
│   │ Zustand 5 (Estado) + TanStack Query 5 (Sondeo API)             │   │
│   │ Lucide React (Iconos) + i18next (es/en) + Photo Sphere Viewer  │   │
│   └───────────────▲───────────────────────────────▲────────────────┘   │
│                   │ HTTP Fetch (/api, /media)     │ Carga binaria      │
│                   │                               │                    │
│   ┌───────────────▼────────────────┐   ┌──────────┴────────────────┐   │
│   │ apps/api (Backend REST)        │   │ public/diorama/           │   │
│   │ Node.js 24 + Express 5         │   │ terrain.bin (DEM 16-bit)  │   │
│   │ Zod (Validación) + Pino (Logs) │   │ surface.webp / normal     │   │
│   │ Helmet + Compression           │   │ context.bin / water.json  │   │
│   └───────────────▲────────────────┘   └───────────────────────────┘   │
│                   │ Pool SQL                                           │
│   ┌───────────────▼────────────────┐                                   │
│   │ db (PostgreSQL 17 + PostGIS)   │                                   │
│   │ Geometrías EPSG:4326           │                                   │
│   │ Tablas: layers, points, images │                                   │
│   └────────────────────────────────┘                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Arquitectura del Diorama 3D (`apps/web`)

En lugar de utilizar un mapa satelital plano convencional (Leaflet o MapLibre), BioMap representa el territorio como una **maqueta volumétrica digital interactiva (diorama)** con estética cartográfica clara («naturaleza clara»), pedestal tipo museo, cortes estratigráficos en los bordes y relieve real.

### 3.1. Pipeline de Preparación de Datos (`build-diorama.mjs`)

El relieve y las texturas se precalculan fuera de línea (una sola vez con internet) mediante el script `apps/web/scripts/build-diorama.mjs`, generando los archivos binarios que se alojan en `apps/web/public/diorama/`:

1. **Elevación (`terrain.bin` + `terrain.json`):** Malla de elevación en metros (enteros `Uint16`) muestreada desde Mapzen Terrarium (SRTM) a nivel de zoom 15 para la zona central y zoom 12 para el contexto circundante.
2. **Texturas Horneadas (`surface.webp` + `normal.webp`):** Textura 4096×4096 px que fusiona foto Sentinel-2 libre de nubes, paleta de cobertura de suelo (ESA WorldCover 2021), oclusión ambiental en quebradas y sombreado de laderas (hillshade). El mapa de normales en espacio de objeto (`normal.webp`) garantiza nitidez y relieve visual sin requerir millones de polígonos adicionales.
3. **Paisaje de Contexto (`context.bin` + `context.webp`):** Escenario de 60×60 km alrededor de la zona de Angostura que rodea la maqueta para que la pantalla 4K nunca muestre un vacío negro en el horizonte. Se une al relieve central mediante una costura matemática suave (`seamBlend` en `context.js`).
4. **Agua e Hidrografía (`water.json` + `shore.bin`):** Polígonos de agua obtenidos de OpenStreetMap. El fondo del terreno viene rebajado bajo el agua (`inlay.js`) y `water.js` genera una superficie animada con corriente, espuma en las orillas calculada según distancia de costa (`shore.bin`), transparencia y reflejos.
5. **Vegetación Instanciada:** Bosque compuesto por araucarias, lengas y bosque nativo plantado de acuerdo a la clase de cobertura de suelo (`landcover.bin`). Se dibuja mediante `InstancedMesh` particionado en una grilla de mosaicos (8×8) con culling de distancia (9 km) y modelos simplificados/detallados según cercanía de cámara (`DioramaScene.jsx` y `trees.js`).
6. **Modelos 3D Arquitectónicos (`models.js`):** Modelos procedurales específicos para represas (muros de presa a escala real triangulados de OSM), puentes colgantes, rukas pehuenche, miradores, centros de visitantes y zonas de acampada.

### 3.2. Proyección y Espacio de Coordenadas (`projection.js`)

- **Escala:** 1 unidad en Three.js = 1 kilómetro en la realidad.
- **Orientación:** Eje X apunta al Este, eje Z apunta al Sur, eje Y apunta hacia arriba (altitud).
- **Conversión:** Longitud y latitud se proyectan ortográficamente ajustadas por el factor $\cos(\text{latitud media})$.

---

## 4. Experiencia de Usuario y UI del Kiosco

### 4.1. Cámara y Navegación (`CameraRig.jsx`)

- **Control Gestual:** Control orbital mediante `CameraControls` de Drei. Soporta rotación con 1 dedo, zoom/inclinación con 2 dedos y controles táctiles en pantalla para usuarios con movilidad reducida (`MapControls.jsx`).
- **Vuelo a Puntos de Interés:** Al tocar un punto en el mapa, la cámara vuela suavemente (`flyTo`) posicionándose a 1.000 m de distancia con una inclinación de -32° para destacar el relieve que rodea el hito.
- **Regreso a Vista General:** Al cerrar la ficha, la cámara regresa a la vista de inicio panorámica (`homeView`).

### 4.2. Ficha Multimedia del Punto (`PointSheet.jsx`)

- Panel lateral flotante con puntero visual orientado hacia la posición del punto en la maqueta.
- Contenido: Nombre, capa temática, descripción extensa, créditos fotográficos.
- **Galería Deslizable (`ImageGallery.jsx`):** Carrusel táctil de fotografías con contador.
- **Visor Panorámico 360° (`PanoramaViewer.jsx`):** Esfera interactiva equirrectangular mediante `@photo-sphere-viewer/core` que permite al visitante "entrar" virtualmente al lugar arrastrando el dedo por la pantalla.

### 4.3. Ciclo de Vida de Kiosco Autónomo

- **Modo de Reposo (`useRestMode.js`):** Tras 45 segundos sin interacción con una ficha abierta, la ficha se cierra y la cámara vuelve automáticamente a la vista general.
- **Modo de Atracción (`useAttractMode.js` + `AttractOverlay.jsx`):** Tras 60 segundos de inactividad total, la cámara inicia un recorrido cinematográfico lento visitando los puntos destacados del territorio de forma continua para captar la atención de los transeúntes del museo.
- **Reinicio de Sesión (`useInactivity.js` + `InactivityWarning.jsx`):** Si un usuario deja la pantalla a mitad de exploración, un temporizador avisa a los 120 segundos y muestra una cuenta regresiva de 10 segundos antes de restaurar capas, idioma y zoom al estado inicial predeterminado.
- **Accesibilidad (`AccessibilityBar.jsx`):** Soporta ciclado de tamaño de texto (100%, 120%, 140%), modo de alto contraste para personas con visión reducida y alternancia de idioma (Español / Inglés).

### 4.4. Avatar Explorador («BioGuía»), Narración por Voz y QR Animado

- **Avatar 3D Procedural (`Avatar.jsx`):** Personaje guardaparques estilizado visible en la maqueta 3D con articulaciones animadas (carrera, braceo, respiración y gesticulación) y baliza superior luminosa.
  - _Patrulla autónoma en zoom lejos:_ Recorre la cuenca siguiendo el relieve (`heightAt`) entre punto y punto de interés.
  - _Interacción al tocar un punto:_ Al presionar cualquier hito, interrumpe su patrulla y corre velozmente hacia él.
  - _Narración y Explicación hablada (`AvatarNarrator.jsx`):_ Al llegar al lugar, se detiene, mira al visitante y narra la información del lugar con voz offline en español (vía Web Speech API `speechSynthesis`) complementado con una tarjeta de diálogo con ondas de audio y texto sincrónico.
- **Animación en Tarjeta QR (`QrCard.jsx`):** El mismo personaje guardaparques ilustrado en SVG interactivo saluda dinámicamente con la mano, guiña un ojo e invita a los visitantes a escanear el código QR con el globo «¡Escanea aquí! 👇».

---

## 5. Arquitectura del Backend (`apps/api`) y Base de Datos

### 5.1. Principios de Construcción

- **Express 5:** Aprovecha el manejo nativo de promesas en rutas asíncronas sin necesidad de envoltorios `asyncHandler`.
- **Inyección de Dependencias (`app.js`):** Todas las conexiones a base de datos, repositorios, instancias de caché y loggers se pasan a `createApp(deps)`. Permite testing unitario total sin infraestructura.
- **Resiliencia de Conexión:** Pool de PostgreSQL (`pg.Pool`) con timeouts de sentencia estrictos (2000 ms), caché en memoria para capas y puntos, y endpoint de diagnóstico `GET /api/health`.

### 5.2. Esquema Relacional (PostGIS)

- `layers`: `id (smallint)`, `slug (varchar)`, `name`, `color`, `icon`, `sort_order`, `is_active`.
- `points_of_interest`: `id (int)`, `layer_id`, `name`, `description`, `location (geography(Point, 4326))`, `created_at`, `deleted_at`.
- `images`: `id (int)`, `point_id`, `file_path`, `alt_text`, `credit`, `is_main (boolean)`, `kind ('photo' | 'panorama')`, `sort_order`.
- `audit_log`: Registro de eventos para trazabilidad.

### 5.3. Contratos de la API REST

- `GET /api/health`: 200 OK si la BD responde `SELECT 1`, 503 si hay falla.
- `GET /api/layers`: Array de capas activas ordenadas por `sort_order`.
- `GET /api/points?layers=history,ecology`: FeatureCollection GeoJSON donde cada feature incluye `properties: { id, name, layerId, layerSlug }`.
- `GET /api/points/:id`: Feature GeoJSON completo con `properties: { description, images: [ { url, altText, credit, isMain, kind } ] }`.
- Formato de error unificado: `{ "error": { "code": "STRING_CODE", "message": "Descripción" } }`.

---

## 6. Variables de Entorno Clave (`.env`)

| Variable               | Rol                                       | Valor por defecto                                     |
| :--------------------- | :---------------------------------------- | :---------------------------------------------------- |
| `DATABASE_URL`         | Conexión a PostgreSQL/PostGIS             | `postgres://biomap:biomap@localhost:5432/biomap`      |
| `TEST_DATABASE_URL`    | BD aislada para tests de integración      | `postgres://biomap:biomap@localhost:5432/biomap_test` |
| `MEDIA_DIR`            | Directorio local de imágenes              | `./media` (o `../../media` en desarrollo local)       |
| `MEDIA_BASE_URL`       | Prefijo de ruta pública para fotos        | `/media`                                              |
| `VITE_MAP_BOUNDS`      | Límites geográficos oeste,sur,este,norte  | `-71.855,-37.7672,-71.75374,-37.672`                  |
| `VITE_REST_S`          | Segundos para cerrar ficha abierta        | `45`                                                  |
| `VITE_ATTRACT_DELAY_S` | Segundos para iniciar modo atracción      | `60` (`0` lo desactiva)                               |
| `VITE_IDLE_TIMEOUT_S`  | Segundos para aviso de inactividad        | `120`                                                 |
| `VITE_KIOSK_WIFI`      | Nombre de la red Wi-Fi para la tarjeta QR | `BioMap-Angostura`                                    |
| `VITE_PUBLIC_URL`      | URL del visor para la tarjeta QR          | `http://biomap.local`                                 |
