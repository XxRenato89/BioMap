import { create } from 'zustand';

/**
 * Huellas de los modelos de los lugares ({ x, z, r } en km del mundo): el
 * bosque no planta árboles dentro (campings, miradores y playas despejados).
 * Las publica PoiMarkers cuando ubica los modelos.
 */
export const useClearingStore = create(() => ({ clearings: [] }));
