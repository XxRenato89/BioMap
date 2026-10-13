# Fuentes Locales de Alta Resolución (BioMap Diorama)

Esta carpeta permite inyectar datos locales de alta resolución para generar la maqueta 3D sin depender de descargas externas de baja resolución:

### 1. Modelo Digital de Elevación (DEM / Topografía)

- Coloca tu archivo GeoTIFF de alta resolución (LiDAR MOP, curvas de nivel o ALOS PALSAR 12.5m) como:
  - `dem_zona.tif` (o `dem.tif`)
- El script `scripts/diorama/terrain.mjs` lo detectará automáticamente y muestreará las alturas de detalle en lugar de usar Terrarium SRTM (30m).

### 2. Fotografía Satelital / Ortofoto Aérea

- Coloca tu ortofoto de alta resolución (sub-métrica SAF FACh, ortomosaico de dron o satélite de alta resolución) como:
  - `surface_zona.png`, `surface_zona.webp`, `surface_zona.jpg` o `surface_zona.tif` (o `surface.png`)
- El script `scripts/diorama/satellite.mjs` lo utilizará automáticamente, permitiendo máxima nitidez al acercar la cámara.

### 3. Cobertura de Suelo y Hitos

- Los edificios 3D, presa y campings locales se configuran en `src/data/landmarks_local.json`.
- La zonificación de bosque nativo protegido vs plantaciones forestales se configura en `src/data/landcover_local.json`.
- Los cuerpos de agua y cotas de embalse se configuran en `src/data/water.json`.

Al ejecutar:

```bash
npm run build:diorama -w apps/web
```

El pipeline integrará todas las fuentes locales de forma nativa e incremental.
