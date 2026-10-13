# Referencias del territorio

Datos y fotos usados para modelar la maqueta a escala. Todo lo marcado como
"por validar" debe confirmarlo el Centro de Visitantes o Colbún.

## Central y presa Angostura

| Dato                  | Valor                                                                              | Fuente                             |
| --------------------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| Potencia              | 316 MW, 3 turbinas                                                                 | La Tercera; comunicado Colbún 2023 |
| Embalse               | 641 ha, ~100 millones de m³, el nivel varía ~1 m                                   | La Tercera; CIPER                  |
| Altura de la presa    | 50 m (por validar)                                                                 | CIPER, 2008                        |
| Ubicación de la presa | ~700 m aguas arriba del puente El Piulo, cerca de la confluencia Biobío–Huequecura | CIPER                              |
| Casa de máquinas      | Caverna subterránea de 59 × 177 × 30 m (alto × largo × ancho)                      | La Tercera                         |
| Obras                 | Presa principal, pretil (presa secundaria) y caverna                               | La Tercera                         |

En superficie no hay un edificio de máquinas: el modelo de la central
(`apps/web/src/diorama/models/powerhouse.js`) muestra lo que se ve en las fotos
de la obra: el portal del túnel, la losa de compuertas y la grúa pórtico amarilla.
El muro largo que OpenStreetMap dibuja junto a la orilla oeste
probablemente corresponde al pretil (por validar).

Fuentes:

- La Tercera, "Colbún inaugura el mayor proyecto hidroeléctrico en 10 años en Chile": https://www.latercera.com/pulso/colbun-inaugura-el-mayor-proyecto-hidroelectrico-en-10-anos-en-chile/
- CIPER, "Angostura: La hidroeléctrica que vuelve a despertar al Bío Bío" (2008): https://ciperchile.cl/2008/12/04/angostura-la-hidroelectrica-que-vuelve-a-despertar-al-bio-bio
- Colbún, comunicado por embalse Angostura (2023): https://www.colbun.cl/docs/default-source/noticias/2023/junio/24/2023.06.24-comunicado-colbún-por-embalse-angostura.pdf
- Colbún, 10 años de Central Angostura (2024): https://colbun.cl/docs/default-source/noticias/2024/diciembre/05/cp-10-anos-central-angostura.pdf

## Fotos con licencia abierta (Wikimedia Commons)

Se guardan en `media/` (fuera del repositorio). La ficha de cada punto muestra
su crédito, como exige la licencia.

| Archivo                                        | Lugar                                                                  | Autor y licencia                              |
| ---------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| `presa-construccion-1.jpg`, `-2.jpg`, `-3.jpg` | Presa Angostura en construcción (geolocalizadas en -37.7122, -71.8163) | Marcelo A Contreras (Panoramio), CC BY-SA 3.0 |
| `camping-trompelhueno.jpg`                     | Playa del Camping Trompelhueno                                         | Bastet&Anubis, CC BY-SA 4.0                   |
| `arboreto-quilaco.jpg`                         | Arboreto de Quilaco (solo 275 px)                                      | Bastet&Anubis, CC BY-SA 4.0                   |
| `biobio-desde-puente-quilaco.jpg`              | Río Biobío desde el puente Quilaco                                     | Sebastianperezlizana, CC BY-SA 3.0            |

Páginas: https://commons.wikimedia.org/wiki/File:Construcci%C3%B3n_Presa_Angostura_-_panoramio.jpg,
https://commons.wikimedia.org/wiki/File:Tropelhueno.jpg,
https://commons.wikimedia.org/wiki/File:Arboretum_Quilaco.jpg,
https://commons.wikimedia.org/wiki/File:Rio_bio_bio_desde_puente_quilaco.jpg

## Lo que falta (pedir al cliente)

- Medidas y fotos actuales de la presa terminada (coronamiento, vertedero, compuertas).
- Fotos del Mirador Huequecura, el Centro de Visitantes, Informaciones Turísticas y Playa Quilaco.
- Coordenadas tomadas en terreno de cada punto de interés.
- Ortofoto o vuelo de dron de la zona, si Colbún lo tiene.
