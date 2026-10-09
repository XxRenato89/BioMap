# Local tiles (EDT 1.3.3)

This folder holds the tile-server configuration. The map must work **without internet**,
so every tile, font and sprite is served from here by `tileserver-gl-light`.

The current style is a placeholder (a plain background). The real cartography is produced
in its own cycle (EDT package 1.3.3):

1. **Vector tiles:** download the Chile extract from Geofabrik and generate
   `mbtiles/biobio.mbtiles` for the Biobío bounds with Planetiler (requires Java 21+)
   or tilemaker.
2. **Terrain tiles:** download a DEM covering the region and convert it to
   `mbtiles/terrain.mbtiles` (Terrain-RGB) with GDAL and `rio-rgbify`.
3. **Style:** edit the style in Maputnik, using only local sources, and save it as
   `styles/biomap/style.json`. Include the OpenStreetMap attribution.
4. **Fonts and sprites:** place the glyph PBFs in `fonts/` and the sprites in `sprites/`.
   A first version of the style already exists in `styles/biomap/style.json` (light "nature"
   palette, OpenMapTiles schema, `Noto Sans` glyphs). It expects the data id `biobio`.
5. Register the data (`biobio`, `terrain`) and the style (`biomap`) in `config.json`, then run:

```bash
docker compose --profile tiles up tiles
```

Then set `VITE_MAP_STYLE_URL=/tiles/styles/biomap/style.json` and
`VITE_TERRAIN_URL=/tiles/data/terrain.json` for the viewer.

Acceptance (EDT 1.3.3): the map shows 3D terrain, labels and the OpenStreetMap attribution,
with the internet connection unplugged.
