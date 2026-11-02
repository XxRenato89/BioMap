import { create } from 'zustand';

/**
 * Fichas abiertas a la vez como máximo (una por persona frente a la pantalla).
 */
export const MAX_OPEN_CARDS = 4;

/**
 * Escalas de texto que recorre el botón «Aa+».
 */
export const TEXT_SCALES = [1, 1.2, 1.4];

/**
 * Estado con que parte el visor y al que vuelve con el reinicio por inactividad.
 * `selectedPointIds` son los puntos con su ficha abierta, del más antiguo al
 * más reciente: varias personas pueden explorar a la vez.
 */
export function initialViewerState() {
  return {
    hiddenLayerIds: new Set(),
    selectedPointIds: [],
    pitched: true,
    textScale: 0,
    contrast: false,
    lang: 'es',
    attract: false,
    contours: false,
    /* «Bajo el embalse»: el agua se retira y deja ver el valle de antes de 2014. */
    drained: false,
    /* Iluminación horaria: 'auto' | 'day' | 'sunset' | 'night' */
    timeOfDay: 'auto',
  };
}

/**
 * Estado compartido del visor.
 */
export const useViewerStore = create((set) => ({
  ...initialViewerState(),

  toggleLayer: (id) =>
    set(({ hiddenLayerIds }) => {
      const next = new Set(hiddenLayerIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { hiddenLayerIds: next };
    }),

  /*
   * Olvida las capas ocultas que ya no existen en la API, para que una capa que
   * reaparece vuelva encendida.
   */
  pruneHiddenLayers: (currentIds) =>
    set(({ hiddenLayerIds }) => {
      const kept = [...hiddenLayerIds].filter((id) => currentIds.has(id));
      return kept.length === hiddenLayerIds.size ? {} : { hiddenLayerIds: new Set(kept) };
    }),

  /*
   * Abre la ficha de un punto (o la trae al frente si ya estaba abierta). Con
   * `MAX_OPEN_CARDS` abiertas, la más antigua se cierra.
   */
  openPoint: (id) =>
    set(({ selectedPointIds }) => ({
      selectedPointIds: [...selectedPointIds.filter((open) => open !== id), id].slice(
        -MAX_OPEN_CARDS,
      ),
    })),

  closePoint: (id) =>
    set(({ selectedPointIds }) => ({
      selectedPointIds: selectedPointIds.filter((open) => open !== id),
    })),

  closeAllPoints: () => set({ selectedPointIds: [] }),

  setPitched: (pitched) => set({ pitched }),

  cycleTextScale: () =>
    set(({ textScale }) => ({ textScale: (textScale + 1) % TEXT_SCALES.length })),
  setTextScale: (scale) => set({ textScale: scale }),

  toggleContrast: () => set(({ contrast }) => ({ contrast: !contrast })),

  setLang: (lang) => set({ lang }),

  setAttract: (attract) => set({ attract }),

  toggleContours: () => set(({ contours }) => ({ contours: !contours })),
  toggleDrained: () => set(({ drained }) => ({ drained: !drained })),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),

  /*
   * «Reiniciar vista»: todas las capas, curvas de nivel y sin ficha abierta. Respeta los
   * ajustes de lectura e idioma.
   */
  resetExploration: () =>
    set({ hiddenLayerIds: new Set(), selectedPointIds: [], contours: false, drained: false }),

  /*
   * Reinicio por inactividad: deja el visor como al inicio para el próximo visitante.
   */
  resetAll: () => set(initialViewerState()),
}));
