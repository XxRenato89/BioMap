# Aspecto visual del diorama (decisiones y ajustes)

Objetivo: el mapa más bonito posible, basado en imágenes reales, con volumen
(no plano) y con vegetación visible. Pantalla objetivo: tótem 4K de 55".

## Problema detectado

- El relieve se veía plano y sin árboles, a diferencia de la referencia
  (maqueta con bosques volumétricos).
- Causa 1: `DioramaView` nunca pasaba `forest` a `DioramaScene` (por defecto
  `false`), así que el bosque instanciado, ya implementado en
  `builders.js#buildForest`, jamás se dibujaba.
- Causa 2: exceso de luz ambiente (hemisferio) aplanaba las sombras.

## Ajustes aplicados

| Archivo                     | Cambio                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `diorama/DioramaView.jsx`   | Nueva prop `forest` (por defecto `true`) reenviada a la escena.                                                  |
| `diorama/resources.js`      | Bosque de 20 000 a 70 000 árboles; color de la textura con más saturación, menos grano y curvas de nivel suaves. |
| `diorama/projection.js`     | `VERTICAL_EXAGGERATION` 2.5 → 3.3 (más volumen).                                                                 |
| `diorama/DioramaScene.jsx`  | Luz equilibrada: hemisferio 1.1, sol 2.8 desde el poniente a media altura, relleno frío 0.35.                    |
| `diorama/DioramaCanvas.jsx` | `toneMappingExposure` = 1.2.                                                                                     |
| `styles/map.css`            | Fondo con degradado atmosférico en vez de negro plano.                                                           |

## Ajustes finos pendientes

- Si algún equipo va lento, bajar el conteo de árboles en `resources.js`
  (`buildForest(..., { count })`) o la calidad por nivel (`quality.js`).
- Las sombras proyectadas dependen de la prop `shadows` de cada vista (`App.jsx`).
- Para más nitidez en la textura: `npm run build:diorama -w apps/web`.
- Los errores `ECONNREFUSED` de `/api/*` en Vite son del backend apagado, no del mapa.
