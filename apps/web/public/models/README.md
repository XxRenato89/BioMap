# Modelos 3D reales de los puntos de interés

Mientras no haya un modelo real, la maqueta usa los hechos a mano
(`src/diorama/models/`). Para reemplazar uno:

1. Copia aquí el archivo `.glb` con el nombre del tipo de modelo, por ejemplo
   `powerhouse.glb`.
2. Agrégalo a `manifest.json`: `{ "models": ["powerhouse"] }`.

Solo se cargan los modelos del manifiesto: así el visor no pide archivos que
no existen.

Tipos disponibles: `powerhouse` (central), `dam` (presa), `lookout` (mirador),
`beach` (playa), `camping`, `info` (informaciones turísticas), `visitors`
(centro de visitantes), `arboretum`, `trailhead` (inicio de sendero), `bridge`
(puente colgante), `ruka`, `wetland` (humedal), `araucaria`, `lenga`.

El modelo se escala igual que el hecho a mano (`METERS_PER_UNIT` en
`src/diorama/models/registry.js`): conviene exportarlo en las mismas unidades
o ajustar ese valor.
