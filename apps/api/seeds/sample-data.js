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
 * OpenStreetMap salvo donde se indica.
 */
export const SAMPLE_POINTS = [
  {
    layerSlug: 'history',
    name: 'Central Hidroeléctrica Angostura',
    description: draft(
      'Central de pasada de Colbún, en operación desde 2014: 316 MW con tres turbinas instaladas en una caverna bajo el cerro. Su presa forma el embalse Angostura.',
    ),
    lng: -71.818262,
    lat: -37.710765,
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
  },
  {
    layerSlug: 'ecology',
    name: 'Parque Angostura',
    description: draft(
      'Área natural junto a la central y el embalse, con senderos entre bosque nativo, playas, campings y un mirador.',
    ),
    lng: -71.814816,
    lat: -37.711177,
    tourStop: 2,
  },
  {
    layerSlug: 'ecology',
    name: 'Arboretum',
    description: draft(
      'Colección de árboles junto a la playa de Quilaco, en la ribera sur del embalse.',
    ),
    lng: -71.796316,
    lat: -37.742917,
  },
  {
    layerSlug: 'ecology',
    name: 'Cerro el Calvario',
    description: draft('Cerro con bosque nativo entre el embalse y el brazo del río Huequecura.'),
    lng: -71.804508,
    lat: -37.716848,
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
    lng: -71.813986,
    lat: -37.712067,
    tourStop: 3,
  },
  {
    layerSlug: 'tourism',
    name: 'Mirador Central Angostura',
    description: draft('Vista a la represa, junto al Biobío al pie de la presa.'),
    lng: -71.81483,
    lat: -37.71175,
  },
  {
    layerSlug: 'tourism',
    name: 'Centro de Visitantes Angostura',
    description: draft(
      'Punto de partida de la visita: exposición sobre la central, el territorio y su gente, con esta maqueta.',
    ),
    /* El edificio de información de OSM en la ribera sur, donde lo ubica el mapa oficial (por validar). */
    lng: -71.81222,
    lat: -37.72794,
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
    lng: -71.803,
    lat: -37.7086,
  },
  {
    layerSlug: 'tourism',
    name: 'Puente Colgante Huequecura',
    description: draft('Puente peatonal colgante sobre el río Huequecura, donde entra al embalse.'),
    lng: -71.78058,
    lat: -37.70792,
  },
  {
    layerSlug: 'tourism',
    name: 'Playa Quilaco',
    description: draft('Playa pública en la ribera sur del embalse, junto al Arboretum.'),
    lng: -71.793541,
    lat: -37.741749,
    tourStop: 4,
  },
  {
    layerSlug: 'tourism',
    name: 'Camping Los Notros',
    description: draft('Camping a orillas del embalse, en el sector Los Notros.'),
    lng: -71.798078,
    lat: -37.726323,
  },
  {
    layerSlug: 'tourism',
    name: 'Camping Trompelhueno de Quilaco',
    description: draft('Camping y playa en la ribera sur del embalse, con quinchos de paja.'),
    lng: -71.791274,
    lat: -37.743429,
  },
  {
    layerSlug: 'tourism',
    name: 'Camping La Patagua de Lo Nieve',
    description: draft('Camping junto al río Huequecura, en Lo Nieve.'),
    lng: -71.767656,
    lat: -37.703407,
  },
];

/*
 * Fotos con licencia abierta (Wikimedia Commons, ver docs/referencias.md):
 * se copian a MEDIA_DIR y cada ficha muestra su crédito, como exige la licencia.
 */
const DAM_CREDIT = 'Marcelo A Contreras (Panoramio), CC BY-SA 3.0, Wikimedia Commons';

export const SAMPLE_IMAGES = [
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'presa-construccion-1.jpg',
    altText:
      'Coronamiento de la presa Angostura con la grúa pórtico y el portal del túnel, durante la construcción',
    credit: DAM_CREDIT,
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'presa-construccion-3.jpg',
    altText: 'Losa de compuertas y grúa pórtico sobre la presa Angostura, en obra',
    credit: DAM_CREDIT,
    isMain: false,
    kind: 'photo',
    sortOrder: 2,
  },
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'presa-construccion-2.jpg',
    altText: 'Portal de túnel y obras junto al Biobío, al pie de la presa',
    credit: DAM_CREDIT,
    isMain: false,
    kind: 'photo',
    sortOrder: 3,
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
    pointName: 'Camping Trompelhueno de Quilaco',
    filePath: 'camping-trompelhueno.jpg',
    altText: 'Playa del Camping Trompelhueno, con quinchos de paja junto al embalse',
    credit: 'Bastet&Anubis, CC BY-SA 4.0, Wikimedia Commons',
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
];
