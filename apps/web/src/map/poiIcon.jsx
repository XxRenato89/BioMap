import {
  Binoculars,
  Bridge,
  Footprints,
  Info,
  Landmark,
  MapPin,
  Mountain,
  Tent,
  TreeDeciduous,
  Trees,
  Umbrella,
  Waves,
  Zap,
} from 'lucide-react';

/*
 * Tipo de lugar según su nombre: el primero que calce. Cada uno con su icono
 * y su rótulo corto, para que el pin diga qué es el lugar sin leer la ficha.
 */
const KINDS = [
  [/puente/i, Bridge, 'bridge'],
  [/playa|balneario/i, Umbrella, 'beach'],
  [/camping|acampar/i, Tent, 'camping'],
  [/mirador|vista/i, Binoculars, 'lookout'],
  [/central|hidroel[eé]ctrica|presa/i, Zap, 'power'],
  [/informaci|visitante/i, Info, 'info'],
  [/arboreto/i, TreeDeciduous, 'arboretum'],
  [/sendero/i, Footprints, 'trail'],
  [/cerro|volc[aá]n/i, Mountain, 'hill'],
  [/embalse|lago|laguna|r[ií]o/i, Waves, 'water'],
  [/parque|bosque|reserva/i, Trees, 'park'],
];
const LAYER_ICON = { history: Landmark, ecology: Trees, tourism: MapPin };
/* Iconos por clave: la que trae el punto en sus datos (`icon`, editable en el panel). */
const BY_KEY = { ...Object.fromEntries(KINDS.map(([, Icon, key]) => [key, Icon])), ...LAYER_ICON };

/**
 * Icono del lugar: el de sus datos (`iconKey`), si no el de su tipo según el
 * nombre y, si no calza ninguno, el de su capa.
 */
export function getPoiIcon(layer, name = '', size = 22, iconKey = null) {
  const Icon =
    BY_KEY[iconKey] ??
    KINDS.find(([re]) => re.test(name))?.[1] ??
    LAYER_ICON[layer?.slug] ??
    MapPin;
  return <Icon size={size} strokeWidth={2.4} aria-hidden="true" />;
}
