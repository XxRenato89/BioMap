/**
 * Datos de EJEMPLO para desarrollo y demostraciones. Los lugares son reales y
 * sus coordenadas son las de OpenStreetMap (© colaboradores de OpenStreetMap,
 * ODbL), dentro de la zona de la maqueta (Angostura). Los textos son de
 * ejemplo y se reemplazarán por el contenido validado por el Centro de
 * Visitantes (paquete 1.3.11).
 */
export const SAMPLE_LAYERS = [
  { slug: 'history', name: 'Historia', color: '#b45309', icon: 'landmark', sortOrder: 1 },
  {
    slug: 'ecology',
    name: 'Ecología y Biodiversidad',
    color: '#15803d',
    icon: 'leaf',
    sortOrder: 2,
  },
  { slug: 'tourism', name: 'Turismo', color: '#1d4ed8', icon: 'binoculars', sortOrder: 3 },
];

/**
 * Texto de ejemplo para un lugar (aún sin contenido validado).
 */
const draft = (what) =>
  `${what} Texto de ejemplo: el contenido está por validar con el Centro de Visitantes.`;

/*
 * Lugares del mapa oficial y de la maqueta física del Centro de Visitantes
 * (fotos de octubre de 2026, ver docs/referencias.md), con coordenadas de
 * OpenStreetMap salvo donde se indica. Playas, campings, Arboretum y el puente
 * colgante: coordenadas de Google Maps (revisadas en noviembre de 2026).
 */
export const SAMPLE_POINTS = [
  {
    layerSlug: 'history',
    name: 'Central Hidroeléctrica Angostura',
    description: draft(
      'Central de pasada de Colbún, en operación desde 2014: 316 MW con tres turbinas instaladas en una caverna bajo el cerro. Su presa forma el embalse Angostura.',
    ),
    lng: -71.8175502,
    lat: -37.7122666,
    tourStop: 1,
  },
  {
    layerSlug: 'history',
    name: 'Puente Piulo Oriente',
    description: draft(
      'Puente de la Ruta Q-61 sobre el Biobío, aguas abajo de la presa, en el sector El Piulo.',
    ),
    lng: -71.82189,
    lat: -37.70965,
  },
  {
    layerSlug: 'history',
    name: 'Puente El Piulo',
    description: draft('El antiguo puente de la ruta, junto al nuevo; hoy solo peatonal.'),
    lng: -71.82348,
    lat: -37.70908,
  },
  {
    layerSlug: 'history',
    name: 'Puente Quilaco',
    description: draft('Puente de la Ruta Q-61 que cruza el embalse hacia Quilaco.'),
    lng: -71.795905,
    lat: -37.737284,
  },
  {
    layerSlug: 'history',
    name: 'Sector Lo Nieve',
    description: draft('Localidad rural junto al río Huequecura, al norte del embalse.'),
    lng: -71.766676,
    lat: -37.701958,
    secret: true,
  },
  {
    layerSlug: 'ecology',
    name: 'Parque Angostura',
    description: draft(
      'Área natural junto a la central y el embalse, con senderos entre bosque nativo, playas, campings y un mirador.',
    ),
    lng: -71.8154768,
    lat: -37.7106418,
    tourStop: 2,
  },
  {
    layerSlug: 'ecology',
    name: 'Arboretum',
    description: draft(
      'Colección de árboles junto a la playa de Quilaco, en la ribera sur del embalse.',
    ),
    /* El pin de Google cae en el letrero de la entrada; el sendero va por el bosque al poniente. */
    lng: -71.79434,
    lat: -37.74261,
  },
  {
    layerSlug: 'ecology',
    name: 'Cerro el Calvario',
    description: draft('Cerro con bosque nativo entre el embalse y el brazo del río Huequecura.'),
    lng: -71.8044955,
    lat: -37.7171099,
  },
  {
    layerSlug: 'ecology',
    name: 'Embalse Angostura',
    description: draft(
      'Embalse de 641 hectáreas y unos 100 millones de m³ formado por la presa Angostura en el río Biobío. Su nivel varía apenas un metro.',
    ),
    /* En el cuerpo del embalse: el centro que da OSM cae en tierra, a 1 km del agua. */
    lng: -71.806,
    lat: -37.7265,
  },
  {
    layerSlug: 'tourism',
    name: 'Sendero y Mirador Huequecura',
    description: draft('Sendero que sube a un mirador sobre la presa y el embalse.'),
    lng: -71.8155104,
    lat: -37.7106622,
    tourStop: 3,
  },
  {
    layerSlug: 'tourism',
    name: 'Mirador Central Angostura',
    description: draft('Vista a la represa, junto al Biobío al pie de la presa.'),
    lng: -71.81516,
    lat: -37.7102651,
  },
  {
    layerSlug: 'tourism',
    name: 'Centro de Visitantes Angostura',
    description: draft(
      'Punto de partida de la visita: exposición sobre la central, el territorio y su gente, con esta maqueta.',
    ),
    /* El edificio de información de OSM en la ribera sur, donde lo ubica el mapa oficial (por validar). */
    lng: -71.8127746,
    lat: -37.7272949,
  },
  {
    layerSlug: 'tourism',
    name: 'Informaciones Turísticas',
    description: draft('Punto de información turística del parque.'),
    lng: -71.816259,
    lat: -37.70972,
  },
  {
    layerSlug: 'tourism',
    name: 'Playa Santa Bárbara',
    description: draft('Playa en la ribera norte del brazo del río Huequecura.'),
    /* No está en OSM: en la orilla del brazo, donde la muestra el mapa oficial (por validar). */
    lng: -71.7977756,
    lat: -37.7075806,
  },
  {
    layerSlug: 'tourism',
    name: 'Puente Colgante Huequecura',
    description: draft('Puente peatonal colgante sobre el río Huequecura, donde entra al embalse.'),
    lng: -71.7806875,
    lat: -37.7078125,
    secret: true,
  },
  {
    layerSlug: 'tourism',
    name: 'Playa Quilaco',
    description: draft('Playa pública en la ribera sur del embalse, junto al Arboretum.'),
    lng: -71.7939082,
    lat: -37.7415318,
    tourStop: 4,
  },
  {
    layerSlug: 'tourism',
    name: 'Camping Los Notros',
    description: draft(
      'Camping a orillas del embalse, en el sector Los Notros, con playa, quinchos, muelle y pasarelas accesibles.',
    ),
    lng: -71.7987735,
    lat: -37.7264148,
  },
  {
    layerSlug: 'tourism',
    name: 'Camping Trompelhueno de Quilaco',
    description: draft('Camping y playa en la ribera sur del embalse, con quinchos de paja.'),
    lng: -71.79239,
    lat: -37.7426992,
  },
  {
    layerSlug: 'tourism',
    name: 'Camping La Patagua de Lo Nieve',
    description: draft('Camping junto al río Huequecura, en Lo Nieve.'),
    lng: -71.767142,
    lat: -37.702461,
  },
];

/*
 * Fotos con licencia abierta (Wikimedia Commons, ver docs/referencias.md):
 * se copian a MEDIA_DIR y cada ficha muestra su crédito, como exige la licencia.
 */
const DAM_CREDIT = 'Marcelo A Contreras (Panoramio), CC BY-SA 3.0, Wikimedia Commons';
const MAPS_CREDIT = 'Google Maps / Parque Angostura';

export const SAMPLE_IMAGES = [
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'presa-angostura-aerea.jpg',
    altText: 'Vista aérea panorámica del complejo hidroeléctrico Angostura, vertedero y embalse',
    credit: MAPS_CREDIT,
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'presa-angostura-vertedero.jpg',
    altText: 'Vertedero de compuertas radiales y grúa pórtico de la presa Angostura',
    credit: MAPS_CREDIT,
    isMain: false,
    kind: 'photo',
    sortOrder: 2,
  },
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'presa-angostura-carretera.jpg',
    altText: 'Vista de la presa Angostura y el canal de descarga desde la Ruta Q-61',
    credit: MAPS_CREDIT,
    isMain: false,
    kind: 'photo',
    sortOrder: 3,
  },
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'presa-construccion-1.jpg',
    altText:
      'Coronamiento de la presa Angostura con la grúa pórtico y el portal del túnel, durante la construcción',
    credit: DAM_CREDIT,
    isMain: false,
    kind: 'photo',
    sortOrder: 4,
  },
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'presa-construccion-3.jpg',
    altText: 'Losa de compuertas y grúa pórtico sobre la presa Angostura, en obra',
    credit: DAM_CREDIT,
    isMain: false,
    kind: 'photo',
    sortOrder: 5,
  },
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'presa-construccion-2.jpg',
    altText: 'Portal de túnel y obras junto al Biobío, al pie de la presa',
    credit: DAM_CREDIT,
    isMain: false,
    kind: 'photo',
    sortOrder: 6,
  },
  {
    pointName: 'Cerro el Calvario',
    filePath: 'mirador-san-sebastian.jpg',
    altText: 'Vista panorámica del valle del Biobío desde el Santuario y Mirador San Sebastián',
    credit: MAPS_CREDIT,
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Puente Quilaco',
    filePath: 'biobio-desde-puente-quilaco.jpg',
    altText: 'El río Biobío visto desde el puente Quilaco',
    credit: 'Sebastianperezlizana, CC BY-SA 3.0, Wikimedia Commons',
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Arboretum',
    filePath: 'arboreto-quilaco.jpg',
    altText: 'Visita al Arboreto de Quilaco',
    credit: 'Bastet&Anubis, CC BY-SA 4.0, Wikimedia Commons',
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Sendero y Mirador Huequecura',
    filePath: 'mirador-huequecura-1.jpg',
    altText:
      'Vista panorámica desde la terraza del Mirador Huequecura hacia el Embalse Angostura y la presa',
    credit: MAPS_CREDIT,
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Sendero y Mirador Huequecura',
    filePath: 'mirador-huequecura-2.jpg',
    altText: 'Sendero entre el bosque nativo con vista hacia la captación de la central Angostura',
    credit: MAPS_CREDIT,
    isMain: false,
    kind: 'photo',
    sortOrder: 2,
  },
  {
    pointName: 'Mirador Central Angostura',
    filePath: 'presa-angostura-carretera.jpg',
    altText: 'Vista al aliviadero y caída de agua de la presa Angostura desde la Ruta Q-61',
    credit: MAPS_CREDIT,
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Centro de Visitantes Angostura',
    filePath: 'centro-visitantes-angostura.jpg',
    altText: 'Fachada exterior del Centro de Visitantes Angostura y jardines en Ruta Q-61',
    credit: MAPS_CREDIT,
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Playa Santa Bárbara',
    filePath: 'playa-santa-barbara.jpg',
    altText: 'Playa pública Santa Bárbara en la ribera norte del Embalse Angostura',
    credit: MAPS_CREDIT,
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Camping Los Notros',
    filePath: 'camping-los-notros-1.jpg',
    altText: 'Vista aérea de la ensenada, espigón y muelle de Camping Los Notros',
    credit: MAPS_CREDIT,
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Camping Los Notros',
    filePath: 'camping-los-notros-2.jpg',
    altText: 'Borde de playa y quinchos frente al embalse en Camping Los Notros',
    credit: MAPS_CREDIT,
    isMain: false,
    kind: 'photo',
    sortOrder: 2,
  },
  {
    pointName: 'Camping Los Notros',
    filePath: 'camping-los-notros-3.jpg',
    altText: 'Pasarelas accesibles y sector de picnic arbolado en Camping Los Notros',
    credit: MAPS_CREDIT,
    isMain: false,
    kind: 'photo',
    sortOrder: 3,
  },
  {
    pointName: 'Camping Trompelhueno de Quilaco',
    filePath: 'camping-trompelhueno.jpg',
    altText: 'Playa del Camping Trompelhueno, con quinchos de paja junto al embalse',
    credit: 'Bastet&Anubis, CC BY-SA 4.0, Wikimedia Commons',
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
];
