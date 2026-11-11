import { create } from 'zustand';

/*
 * Etapas de la carga de la maqueta, en orden, y qué parte del total (0 a 1)
 * lleva al terminar cada una. La descarga pesa más: es lo que demora en un teléfono.
 */
export const LOAD_STAGES = ['terrain', 'water', 'forest', 'ready'];
const SHARE = { terrain: 0.5, water: 0.68, forest: 0.9, ready: 1 };

/**
 * Avance real de la carga de la maqueta, para la pantalla de espera.
 * `stage` es la etapa en curso; `progress` va de 0 a 1.
 */
export const useLoadProgress = create(() => ({ stage: LOAD_STAGES[0], progress: 0.04 }));

/** Avance dentro de la descarga: `done` archivos de `total`. */
export function reportDownload(done, total) {
  useLoadProgress.setState({
    stage: 'terrain',
    progress: 0.04 + (SHARE.terrain - 0.04) * (done / total),
  });
}

/**
 * Marca una etapa como terminada y cede un cuadro al navegador, para que la
 * pantalla de espera alcance a dibujar el avance antes del siguiente tramo de cálculo.
 *
 * @param {'terrain' | 'water' | 'forest' | 'ready'} finished
 */
export function stageDone(finished) {
  const next = LOAD_STAGES[Math.min(LOAD_STAGES.indexOf(finished) + 1, LOAD_STAGES.length - 1)];
  useLoadProgress.setState({ stage: next, progress: SHARE[finished] });
  return new Promise((resolve) => setTimeout(resolve, 0));
}
