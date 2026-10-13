import { create } from 'zustand';
import { Vector3 } from 'three';

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
  currentPath: [],
  lastArrivedPoint: null,
  currentPosition: new Vector3(0, 0, 0),
  skipRequested: false,

  setMode: (mode) => set({ mode }),

  setTargetPoint: (point) =>
    set({
      targetPoint: point,
      mode: point ? 'running_to_point' : 'patrol',
      skipRequested: false,
    }),

  setPath: (path) => set({ currentPath: path }),

  setPosition: (pos) => set({ currentPosition: pos }),

  setLastArrivedPoint: (point) => set({ lastArrivedPoint: point }),

  skipWalk: () => set({ skipRequested: true }),

  startSpeaking: (speechText) => {
    set({
      isSpeaking: true,
      activeSpeech: speechText,
      mode: 'speaking',
      skipRequested: false,
    });
  },

  stopSpeaking: () => {
    set({
      isSpeaking: false,
      activeSpeech: '',
      mode: 'patrol',
      targetPoint: null,
      currentPath: [],
      lastArrivedPoint: null,
      skipRequested: false,
    });
  },

  toggleMute: () => set((state) => ({ muted: !state.muted })),
}));
