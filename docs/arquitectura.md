# Arquitectura de BioMap

Cómo está hecho el visor y por qué. Para ponerlo en marcha, ver el `README.md`;
para los datos del territorio y sus fuentes, `referencias.md`. Lo histórico está en `archivo/`.

## Vista general

```
navegador del kiosco (Chrome a pantalla completa, sin internet)
  └─ apps/web  React 19 + Three.js (React Three Fiber)
       ├─ /diorama/*  datos horneados de la maqueta (estáticos)
       └─ /api, /media  →  apps/api  Express 5
                               └─ PostgreSQL + PostGIS (o las semillas, con USE_MOCKS)
```

Todo corre en un mini PC del Centro de Visitantes. El visor no pide nada a internet:
relieve, foto satelital, caminos y fuentes tipográficas se empaquetan con la app.

## La maqueta (`apps/web/src/diorama`)

| Carpeta       | Responsabilidad                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `terrain/`    | Carga de los datos horneados (`resources.js`), relieve en bloques con dos niveles de detalle, agua, caminos y puentes, árboles y sus materiales |
| `builders/`   | Geometría generada al cargar: muro de la presa, polígonos de agua, bosque y rocas, edificios                                                    |
| `models/`     | Modelos 3D de los puntos de interés, uno por tipo, a escala de la maqueta                                                                       |
| `components/` | La escena y sus piezas: cámara, mascota, camino dibujado, pines, etiquetas                                                                      |
| `utils/`      | Cálculos puros y probados: proyección, rutas, reparto de etiquetas y modelos, datos del embalse                                                 |

**Unidades.** Una unidad de la maqueta es 1 km en planta. La altura se exagera
(`VERTICAL_EXAGGERATION` en `utils/projection.js`) para que el relieve se lea en una
pantalla plana.

**Datos horneados.** `scripts/build-diorama.mjs` descarga una vez relieve (Terrarium),
cobertura de suelo (ESA WorldCover), foto (Sentinel-2) y caminos e hitos
(OpenStreetMap), y los deja en `public/diorama/`. Con `--only-roads` refresca solo
OpenStreetMap. Al cargar, el visor corrige el embalse (`utils/reservoir.js`): espejo de
agua horizontal a 326 m, fondo siempre bajo el agua y orillas en pendiente suave.

**Dibujo a pedido.** El canvas no redibuja si nada cambia (`frameloop="demand"`). Lo
que se anima (agua, camino, mascota, pines que suben) pide sus cuadros. Por eso los
cálculos periódicos usan tiempo (`performance.now()`), no conteo de cuadros.

**Rendimiento.** Hay un solo canvas WebGL. El relieve va en 64 bloques con dos mallas
(fina cerca, gruesa lejos). Los árboles lejanos son mallas instanciadas por mosaico que
se suben a la GPU una vez; los cercanos usan un modelo detallado y el shader cruza los
dos en un anillo, sin saltos. El nivel de calidad (`utils/quality.js`) se ajusta solo
según los cuadros por segundo, o se fija con `VITE_QUALITY`.

## El recorrido

1. El visitante toca un pin (`PoiMarkers`), o el botón "Seguir a…" de la ficha.
2. `features/tour/useTour.js` manda a la mascota (`Avatar`) hacia el punto.
3. `utils/pathfinder.js` calcula la ruta por la red de OpenStreetMap: A\* sobre un
   grafo donde un tramo que pisa agua solo vale si es puente. Los puntos se enganchan
   al tramo más cercano al que se llega sin cruzar el agua. Si no hay ruta, la mascota
   aparece en el destino en vez de volar.
4. `PathPainter` dibuja el camino: una cinta de ancho fijo en pantalla con puntos que
   avanzan; lo recorrido queda tenue.
5. Al llegar se abre la ficha (`features/point/PointSheet.jsx`) con la mascota al
   costado (`features/avatar/SheetMascot.jsx`), y se cuenta la visita.

Las paradas del recorrido guiado vienen de la columna `tour_stop` de cada punto. Cada
parada se desbloquea al visitar la anterior (`store/userStore.js`). El progreso vive
solo durante la visita: el reinicio por inactividad lo borra.

## Pines y modelos de los puntos

- Cada pin es un poste 3D y una insignia HTML en su punta. Ambos miden lo mismo en
  pantalla a cualquier distancia, y el pie del poste queda bajo el terreno visible.
- Las insignias que se pisan se reparten cada 150 ms con la cámara quieta, desde la
  base del poste: de cerca suben en escalones (`utils/labels.js#liftBadges`); de lejos,
  la de menos prioridad queda como un punto.
- Cada punto tiene un modelo según su nombre (`models/registry.js#KEYWORDS`). Se apoya
  en un lugar plano, fuera del agua y sin chocar con otro (`utils/placement.js`), y
  mira al agua más cercana. Un `.glb` real lo reemplaza si está en
  `public/models/manifest.json`.

## El kiosco

| Estado               | Cuándo                        | Qué pasa                                              |
| -------------------- | ----------------------------- | ----------------------------------------------------- |
| Reposo               | `VITE_REST_S` sin uso (45 s)  | Se cierra la ficha y la cámara vuelve al inicio       |
| Atracción            | `VITE_ATTRACT_DELAY_S` (60 s) | La cámara recorre los puntos sola, sin paneles encima |
| Aviso de inactividad | antes del reinicio            | Cuenta regresiva con "Seguir explorando"              |
| Reinicio             | `VITE_IDLE_TIMEOUT_S` (120 s) | Idioma, capas, contraste y progreso vuelven al inicio |

Accesibilidad: alto contraste, tres tamaños de texto, español e inglés, objetivos
táctiles grandes, controles con `role` y nombre accesible (revisados con axe en los
tests) y animaciones que respetan "reducir movimiento".

## La API (`apps/api`)

- Express 5 con dependencias inyectadas (`createApp`), configuración validada con zod
  al arrancar, logs de pino, caché en memoria y cierre ordenado.
- PostGIS guarda los puntos como `geometry(Point, 4326)`. Las imágenes exigen texto
  alternativo y crédito. Los puntos se eliminan de forma lógica (`deleted_at`).
- Con `USE_MOCKS=true` los repositorios leen las mismas semillas que cargan la base
  (`seeds/sample-data.js`): el modo de prueba y la base real no pueden divergir, y un
  test de integración lo comprueba.

## Calidad

- `npm run lint`, `npm run format:check` y `npm test` en el CI, con PostGIS real para
  los tests de integración.
- La lógica con riesgo tiene tests propios: rutas y agua, reparto de pines y modelos,
  orillas, recorrido, configuración, esquema y semillas.
