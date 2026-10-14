# BioMap – Mapa Vivo del Bío Bío

Mapa interactivo 3D del territorio de Angostura, en la Región del Biobío, para el
kiosco táctil del Centro de Visitantes Angostura (Colbún S.A.). Funciona 100 % sin
internet. Proyecto de título, INACAP, Ingeniería en Informática.

El visitante explora una maqueta 3D a escala real (relieve, embalse, bosques,
caminos y la presa), toca un lugar y una mascota guía camina hasta él por los
caminos reales para presentarle su ficha: historia, fotos y vista 360°.

## Qué hace

- **Bajo el embalse**: con un botón, el embalse se vacía y deja ver el cañón del Biobío
  como era antes de la inundación de 2014 (relieve SRTM del año 2000), con la cota de hoy
  marcada en las laderas. Hasta ~45 m de profundidad.
- **Luz según la hora**: amanecer, mediodía, tarde dorada y atardecer siguen el reloj del
  kiosco (`?hora=19` en la URL para presentarlo). Aves sobre el embalse.

- **Maqueta 3D a escala real**: relieve SRTM, foto satelital, agua de OpenStreetMap con
  orillas suaves, la presa Angostura (50 m), decenas de miles de árboles instanciados
  (nativo, pino y eucalipto) y rocas en las laderas.
- **Carreteras y senderos reales** de OpenStreetMap, con los números de ruta (Q-61,
  Q-685…) y puentes con su estructura.
- **Recorrido guiado**: la mascota camina por los caminos (nunca cruza el agua salvo por
  un puente), el camino se dibuja con puntos que avanzan y las paradas se desbloquean
  en orden. Las paradas las define el campo `tour_stop` de cada punto.
- **Puntos de interés** con poste e insignia de tamaño fijo en pantalla; si se pisan,
  de cerca suben su poste en escalones. Cada uno tiene un modelo 3D por tipo (central,
  playa, camping, mirador, información, arboreto…) apoyado en terreno plano y mirando
  al agua.
- **Ficha del lugar** con la mascota a su lado, pestañas Historia / Fotos / 360° y el
  crédito de cada foto.
- **Bio-Book**: un libro que se abre en su lugar con un código QR para seguir en el
  teléfono.
- **Kiosco**: modo atracción, regreso automático a la vista inicial, aviso y reinicio
  por inactividad (borra el progreso del visitante), alto contraste, texto grande e
  inglés.

## Estructura

| Ruta                      | Contenido                                                                    |
| ------------------------- | ---------------------------------------------------------------------------- |
| `apps/api`                | API REST (Node.js 24, Express 5, PostgreSQL + PostGIS)                       |
| `apps/api/seeds`          | Datos de ejemplo: capas, puntos, recorrido y fotos                           |
| `apps/web`                | Visor táctil (React 19, Vite, Three.js con React Three Fiber, Tailwind)      |
| `apps/web/src/diorama`    | La maqueta: relieve, agua, bosque, caminos, modelos y cámara                 |
| `apps/web/src/features`   | Ficha, mascota, recorrido y modo atracción                                   |
| `apps/web/public/diorama` | Datos horneados de la maqueta (generados, ver más abajo)                     |
| `apps/web/scripts`        | Generador de la maqueta (`build-diorama.mjs`)                                |
| `docs`                    | Arquitectura (`arquitectura.md`) y fuentes del territorio (`referencias.md`) |

## Requisitos

- Node.js 24 o más.
- Docker Desktop, para PostgreSQL/PostGIS y el stack completo (opcional en desarrollo:
  ver modo sin base de datos).

## Puesta en marcha

```bash
npm install
cp .env.example .env
npm run media:fetch          # fotos de ejemplo (Wikimedia Commons, CC BY-SA) en media/
```

### Rápido, sin base de datos

Con `USE_MOCKS=true` en `.env`, la API sirve los mismos datos de las semillas sin
PostgreSQL:

```bash
npm run dev -w apps/api      # http://localhost:3000/api/health
npm run dev -w apps/web      # http://localhost:5173
```

### Stack completo con Docker

```bash
docker compose up --build
docker compose exec api npm run db:migrate
docker compose exec api npm run db:seed    # datos de ejemplo (nunca en producción)
```

### API con una base ya levantada

```bash
npm run db:migrate
npm run db:seed
npm run dev -w apps/api
```

## La maqueta 3D

Los datos de la maqueta están en `apps/web/public/diorama/` y no necesitan internet ni
servidor de mapas. Se regeneran con internet solo si cambian los límites del territorio:

```bash
npm run build:diorama -w apps/web                       # todo: relieve, cobertura, foto, caminos
node apps/web/scripts/build-diorama.mjs --only-roads     # solo caminos, puentes e hitos de OSM
```

Para usar una ortofoto, un relieve o una cobertura de mejor resolución (por ejemplo un
vuelo de dron de Colbún), se dejan en `apps/web/data/sources/` (ver su README) y el
generador los prefiere a las descargas.

Los hitos agregados a mano (miradores, campings, ríos) están en
`apps/web/src/data/landmarks_local.json`. Los modelos 3D reales (`.glb`) se agregan en
`apps/web/public/models/` (ver su README).

Calidad: el nivel `low | medium | high` se ajusta solo según la tarjeta gráfica, o se
fija con `VITE_QUALITY`.

## Kiosco

En el mini PC, la API sirve también el visor compilado (`WEB_DIR`), y
`infra/kiosk/start-kiosk.ps1` lo abre a pantalla completa y lo reabre si se cierra. Ver
`infra/kiosk/README.md`.

## Tests

```bash
npm test                                   # unitarios de la API y del visor
TEST_DATABASE_URL=postgres://biomap:biomap@localhost:5432/biomap_test npm test
```

Los de integración corren contra PostGIS real y solo si `TEST_DATABASE_URL` está
definido (el servicio `db` de Docker crea `biomap_test`). Borran y recrean el esquema,
así que se niegan a correr si el nombre de la base no termina en `_test`. El CI
(`.github/workflows/ci.yml`) corre lint, formato, migraciones, semillas y todos los tests.

## Scripts

| Comando                           | Qué hace                                                      |
| --------------------------------- | ------------------------------------------------------------- |
| `npm test`                        | Todos los tests                                               |
| `npm run test:e2e`                | Flujos completos en un navegador (Playwright; API de prueba)  |
| `npm run lint`                    | ESLint                                                        |
| `npm run format` / `format:check` | Prettier                                                      |
| `npm run db:migrate`              | Aplica las migraciones                                        |
| `npm run db:seed`                 | Carga los datos de ejemplo (se niega en producción)           |
| `npm run media:fetch`             | Descarga las fotos de ejemplo a `MEDIA_DIR`                   |
| `npm run loadtest -w apps/api`    | Prueba de carga contra una API levantada: 50 conexiones, 30 s |

## API

| Ruta                                     | Descripción                                            |
| ---------------------------------------- | ------------------------------------------------------ |
| `GET /api/health`                        | `200` si la base responde, `503` si no                 |
| `GET /api/layers`                        | Capas temáticas activas                                |
| `GET /api/points?layers=history,tourism` | Puntos como FeatureCollection GeoJSON (con `tourStop`) |
| `GET /api/points/:id`                    | Ficha completa del punto, con sus imágenes y créditos  |

Los errores siempre tienen la forma `{ "error": { "code": "...", "message": "..." } }`.

## Contenido pendiente del cliente

`PENDING.md` y `docs/referencias.md` listan lo que falta: textos validados, fotos del
mirador y el centro de visitantes, coordenadas tomadas en terreno, medidas de la presa
y el modelo 3D de la mascota oficial (Quibar).

## Convenciones

- Código, nombres de archivos, objetos de la base, rutas de la API y commits en inglés.
- Comentarios del código en español, como comentarios de bloque sobre el código.
- Sin recursos externos en tiempo de ejecución: nada de CDN ni servicios en línea.
- Créditos visibles para toda foto o dato con licencia que lo exija.
