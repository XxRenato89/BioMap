/**
 * Coordenadas de referencia de Presa Angostura para posicionar el modelo 3D (.glb).
 */
export const PRESA_ANGOSTURA_COORDINATES = {
  id: 738577784,
  name: 'Presa Angostura',
  // Centro geográfico sobre el cañón del río Biobío
  center: [-71.8173, -37.7131],
  // Un punto del embalse (aguas arriba): hacia ahí mira la cara vertical del muro
  upstream: [-71.806, -37.7265],
  // Cauce aguas abajo del vertedero hasta la orilla de la Central. Toma la cota del
  // río de OSM con que empalma, para que ambas aguas queden sin escalón.
  tailwater: {
    outer: [
      [-71.816583, -37.711898],
      [-71.817338, -37.712746],
      [-71.81829, -37.712486],
      [-71.8189, -37.711921],
      [-71.818382, -37.711104],
      [-71.817572, -37.710897],
      [-71.816803, -37.711441],
    ],
  },
  // Camino de servicio que baja en diagonal por la ladera desde el estribo norte
  // del vertedero, por la orilla norte del cauce, hasta la Central (punto de interés 1;
  // foto aérea "represa.PNG"; no está en OSM). Parte del camino de acceso al
  // estribo (red principal): sin ese tramo quedaba aislado y la mascota se atascaba.
  powerhouseRoad: [
    [-71.8151862, -37.7110558],
    [-71.8164, -37.7117],
    [-71.8168, -37.71125],
    [-71.8174, -37.71077],
    [-71.8181, -37.71085],
  ],
  // Posición en espacio 3D de la maqueta (Three.js world coordinates)
  worldPosition: {
    x: -1.13,
    y: 0.44, // cota de coronamiento (~327 m sobre el nivel del mar con exageración vertical)
    z: -0.78,
  },
  // Orientación del flujo aguas abajo hacia el cañón (rad)
  rotationY: 0.0,
  // Cota de coronamiento y altura física sobre el lecho
  crestMeters: 327,
  heightMeters: 50,
  // Polígono perimetral exacto del muro de la presa sobre el cañón (27 puntos)
  line: [
    [-71.8162591, -37.7120807],
    [-71.8167628, -37.7125603],
    [-71.8171598, -37.7129578],
    [-71.8173284, -37.7130938],
    [-71.8177074, -37.7134514],
    [-71.8177424, -37.7134898],
    [-71.8177906, -37.7135426],
    [-71.8178362, -37.7136127],
    [-71.817871, -37.7136784],
    [-71.8178844, -37.7137336],
    [-71.8178791, -37.7137994],
    [-71.817863, -37.7138694],
    [-71.8178228, -37.7139585],
    [-71.8181956, -37.7142577],
    [-71.8183029, -37.7140964],
    [-71.8183672, -37.7139776],
    [-71.8183726, -37.7138418],
    [-71.8183833, -37.7136975],
    [-71.8183619, -37.7134684],
    [-71.8183029, -37.7132986],
    [-71.8182278, -37.7131586],
    [-71.8180937, -37.7129803],
    [-71.817863, -37.7127936],
    [-71.8176752, -37.7126281],
    [-71.8172191, -37.7122466],
    [-71.8170127, -37.7120679],
    [-71.8162591, -37.7120807],
  ],
  /*
   * Muro lateral (pretil) que sigue la ruta por la ribera poniente del embalse,
   * desde el estribo sur del muro frontal (~1,6 km). Mismo polígono de OSM (vía
   * 738577784), separado del frontal en su arista común.
   */
  lateral: [
    [-71.8178228, -37.7139585],
    [-71.8153015, -37.7171263],
    [-71.8151862, -37.7172876],
    [-71.8150976, -37.7174234],
    [-71.8150252, -37.717538],
    [-71.8149662, -37.7176801],
    [-71.8149233, -37.717818],
    [-71.8148831, -37.7179835],
    [-71.8148536, -37.7182339],
    [-71.8142527, -37.724028],
    [-71.814242, -37.7241808],
    [-71.8142259, -37.7242911],
    [-71.8141964, -37.7244014],
    [-71.8141508, -37.7245287],
    [-71.8141079, -37.7246411],
    [-71.8140596, -37.7247451],
    [-71.8140087, -37.7248257],
    [-71.813904, -37.7249615],
    [-71.8127909, -37.7265399],
    [-71.8129116, -37.7265993],
    [-71.813145, -37.7263362],
    [-71.813381, -37.7260859],
    [-71.8135795, -37.7258674],
    [-71.813888, -37.725564],
    [-71.8142957, -37.7250273],
    [-71.8144834, -37.7247303],
    [-71.8145692, -37.7245308],
    [-71.8146765, -37.7242211],
    [-71.8148267, -37.7232409],
    [-71.8149287, -37.7221759],
    [-71.8149608, -37.7216964],
    [-71.8150145, -37.7213103],
    [-71.8151218, -37.7197869],
    [-71.8153042, -37.7183569],
    [-71.8153524, -37.7181108],
    [-71.8153846, -37.7179241],
    [-71.8154705, -37.717695],
    [-71.8156743, -37.7173852],
    [-71.816774, -37.716023],
    [-71.8175948, -37.715081],
    [-71.8181956, -37.7142577],
    [-71.8178228, -37.7139585],
  ],
};
