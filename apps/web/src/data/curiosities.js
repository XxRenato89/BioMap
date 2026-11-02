/*
 * Datos curiosos de algunos lugares, para la ficha. Solo cifras con fuente
 * (docs/referencias.md); un lugar sin dato verificado no muestra ninguno.
 * Se buscan por el nombre del punto, igual que sus iconos y modelos.
 */
const CURIOSITIES = [
  {
    match: /central|hidroel[eé]ctrica/i,
    es: 'Las máquinas están dentro de un cerro, en una caverna de 59 × 177 × 30 m (alto × largo × ancho).',
    en: 'The machines sit inside a hill, in a cavern 59 × 177 × 30 m (height × length × width).',
    source: 'La Tercera',
  },
  {
    match: /embalse/i,
    es: 'Tiene 641 hectáreas y cerca de 100 millones de m³ de agua, y su nivel varía solo alrededor de 1 m.',
    en: 'It covers 641 hectares and holds about 100 million m³ of water, and its level varies by only around 1 m.',
    source: 'La Tercera, CIPER',
  },
];

export const ROTATING_TIPS = [
  {
    es: 'El Embalse Angostura tiene 641 hectáreas y su cota varía solo 1 m, cuidando la flora ribereña.',
    en: 'Angostura Reservoir covers 641 hectares and varies by only 1 m, protecting riparian flora.',
  },
  {
    es: 'La caverna de máquinas de la Central Angostura está dentro de un cerro y mide 59 m de alto.',
    en: 'The powerhouse cavern of Angostura sits inside a hill and measures 59 m in height.',
  },
  {
    es: 'Quibar te acompañará a recorrer los senderos, miradores y secretos del Parque Angostura.',
    en: 'Quibar will accompany you exploring the trails, lookouts, and secrets of Parque Angostura.',
  },
  {
    es: 'El río Biobío recorre 380 km desde la alta cordillera andina hasta desembocar en el Océano Pacífico.',
    en: 'The Biobío River travels 380 km from the high Andes mountains down to the Pacific Ocean.',
  },
  {
    es: 'El Puente Colgante Huequecura cruza el río conectando senderos en medio del bosque nativo.',
    en: 'The Huequecura Suspension Bridge crosses the river connecting trails in the native forest.',
  },
  {
    es: 'En el Parque Angostura conviven robles, coigües, araucarias y una rica avifauna acuática.',
    en: 'Parque Angostura is home to oaks, coigües, monkey puzzle trees, and rich aquatic birdlife.',
  },
];

/**
 * Dato curioso de un lugar en el idioma pedido, o null si no hay uno con fuente.
 *
 * @param {string} name Nombre del punto.
 * @param {'es' | 'en'} lang
 * @returns {{ text: string, source: string } | null}
 */
export function curiosityFor(name, lang) {
  const found = CURIOSITIES.find(({ match }) => match.test(name));
  return found ? { text: found[lang] ?? found.es, source: found.source } : null;
}
