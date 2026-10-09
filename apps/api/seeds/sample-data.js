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

export const SAMPLE_POINTS = [
  {
    layerSlug: 'history',
    name: 'Central Hidroeléctrica Angostura',
    description: draft('Central hidroeléctrica junto a la presa del embalse Angostura.'),
    lng: -71.818262,
    lat: -37.710765,
  },
  {
    layerSlug: 'history',
    name: 'Puente Ruta Q-61 sobre el Biobío',
    description: draft('Puente de la Ruta Q-61 aguas abajo de la presa.'),
    lng: -71.821886,
    lat: -37.709653,
  },
  {
    layerSlug: 'history',
    name: 'Puente Ruta Q-61 sobre el embalse',
    description: draft('Puente de la Ruta Q-61 que cruza el embalse Angostura.'),
    lng: -71.795905,
    lat: -37.737284,
  },
  {
    layerSlug: 'history',
    name: 'Lo Nieve',
    description: draft('Localidad rural en la ribera norte del embalse.'),
    lng: -71.766676,
    lat: -37.701958,
  },
  {
    layerSlug: 'ecology',
    name: 'Parque Angostura',
    description: draft('Área natural junto a la central y el embalse.'),
    lng: -71.814816,
    lat: -37.711177,
  },
  {
    layerSlug: 'ecology',
    name: 'Arboreto',
    description: draft('Arboreto en la ribera sur del embalse.'),
    lng: -71.796316,
    lat: -37.742917,
  },
  {
    layerSlug: 'ecology',
    name: 'Cerro Calvario',
    description: draft('Cerro sobre la ribera del embalse, cerca de Los Notros.'),
    lng: -71.804508,
    lat: -37.716848,
  },
  {
    layerSlug: 'ecology',
    name: 'Embalse Angostura',
    description: draft('Embalse formado por la presa Angostura en el río Biobío.'),
    lng: -71.774414,
    lat: -37.737646,
  },
  {
    layerSlug: 'tourism',
    name: 'Mirador Huequecura',
    description: draft('Mirador sobre la presa y el embalse.'),
    lng: -71.813986,
    lat: -37.712067,
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
    name: 'Playa Quilaco',
    description: draft('Playa en la ribera sur del embalse.'),
    lng: -71.793541,
    lat: -37.741749,
  },
  {
    layerSlug: 'tourism',
    name: 'Camping Los Notros',
    description: draft('Zona de camping a orillas del embalse.'),
    lng: -71.798078,
    lat: -37.726323,
  },
  {
    layerSlug: 'tourism',
    name: 'Camping Trompelhueno',
    description: draft('Zona de camping en la ribera sur del embalse.'),
    lng: -71.791274,
    lat: -37.743429,
  },
  {
    layerSlug: 'tourism',
    name: 'Camping La Patagua de Lo Nieve',
    description: draft('Zona de camping en la ribera norte, en Lo Nieve.'),
    lng: -71.767656,
    lat: -37.703407,
  },
];

export const SAMPLE_IMAGES = [
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'angostura-central.jpg',
    altText: 'Presa y vertedero de la Central Angostura',
    credit: 'Colbún S.A.',
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Central Hidroeléctrica Angostura',
    filePath: 'angostura-360.jpg',
    altText: 'Panorámica 360° mirador Central Angostura',
    credit: 'BioMap 360',
    isMain: false,
    kind: 'panorama',
    sortOrder: 2,
  },
  {
    pointName: 'Parque Angostura',
    filePath: 'parque-angostura.jpg',
    altText: 'Sendero y vegetación nativa en Parque Angostura',
    credit: 'Centro de Visitantes',
    isMain: true,
    kind: 'photo',
    sortOrder: 1,
  },
  {
    pointName: 'Mirador Huequecura',
    filePath: 'mirador-huequecura-360.jpg',
    altText: 'Vista panorámica 360° desde Mirador Huequecura',
    credit: 'BioMap 360',
    isMain: false,
    kind: 'panorama',
    sortOrder: 1,
  },
];
