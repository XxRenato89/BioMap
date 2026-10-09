import { create } from 'zustand';

/**
 * Estado y control del avatar explorador ("BioGuía" de Angostura).
 * - mode:
 *     'patrol': recorre los puntos de interés de forma autónoma en vista general.
 *     'running_to_point': corre directamente hacia el punto seleccionado por el usuario.
 *     'arrived': llegó al punto y comienza a explicar.
 *     'speaking': interactuando y explicando el lugar con voz y texto.
 */
export const useAvatarStore = create((set) => ({
  mode: 'patrol',
  targetPoint: null,
  activeSpeech: '',
  isSpeaking: false,
  muted: false,
  speedMultiplier: 1,

  setMode: (mode) => set({ mode }),

  setTargetPoint: (point) =>
    set({
      targetPoint: point,
      mode: point ? 'running_to_point' : 'patrol',
    }),

  startSpeaking: (speechText) => {
    set({
      isSpeaking: true,
      activeSpeech: speechText,
      mode: 'speaking',
    });
  },

  stopSpeaking: () => {
    set({
      isSpeaking: false,
      activeSpeech: '',
      mode: 'patrol',
      targetPoint: null,
    });
  },

  toggleMute: () => set((state) => ({ muted: !state.muted })),
}));
