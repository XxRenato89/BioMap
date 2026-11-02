import { useEffect, useMemo, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useAnimations, useGLTF } from '@react-three/drei';

export const QUIBAR_MODEL_PATH = '/models/quibar.glb?v=tpose_baseline';
export const ANIMATIONS_DIR = '/animations';
export const ANIMATIONS_MANIFEST = '/animations/manifest.json';

export const STANDARD_ANIM_NAMES = ['idle', 'walk', 'run', 'dance', 'wave', 'paddle', 'sit'];

/**
 * Mapeo de alias para estandarizar nombres de animaciones.
 * Permite que run.glb, Running, run, etc. se resuelvan al mismo clip.
 */
export const ANIM_ALIASES = {
  idle: ['idle', 'Idle', 'reposo', 'Victory Idle'],
  walk: ['walk', 'Walk', 'walking', 'Walking', 'AN_Quibar_WalkCycle', 'Holding Walk'],
  run: ['run', 'Run', 'running', 'Running', 'AN_Quibar_RunCycle'],
  dance: ['dance', 'Dance', 'twerk', 'Dancing Twerk', 'Breakdance', 'Uprock'],
  wave: ['wave', 'Wave', 'saludo'],
  look: ['look', 'Look', 'Looking Around', 'mirar'],
  clapping: ['clapping', 'Clapping', 'aplauso', 'aplausos', 'Clap'],
  paddle: ['paddle', 'Paddle', 'paddling', 'Paddling', 'row', 'Row', 'rowing', 'Rowing', 'remar', 'remo'],
  sit: ['sit', 'Sit', 'sitting', 'Sitting', 'Sitting Idle', 'sentado'],
};

/**
 * Remueve el desplazamiento acumulado de root motion (p.ej. caderas avanzando en Mixamo)
 * para convertir clips cíclicos de caminar/correr en in-place y evitar el tirón al reiniciar el bucle.
 */
export function makeClipInPlace(clip) {
  if (!clip || !clip.tracks) return clip;
  for (const track of clip.tracks) {
    if (track.name.toLowerCase().endsWith('hips.position')) {
      const times = track.times;
      const values = track.values;
      const len = times.length;
      if (len < 2) continue;
      const t0 = times[0];
      const tEnd = times[len - 1];
      const duration = tEnd - t0;
      if (duration <= 0) continue;

      for (let axis = 0; axis < 3; axis++) {
        const startVal = values[axis];
        const endVal = values[(len - 1) * 3 + axis];
        const delta = endVal - startVal;
        if (Math.abs(delta) > 0.5) {
          for (let i = 0; i < len; i++) {
            const progress = (times[i] - t0) / duration;
            values[i * 3 + axis] -= progress * delta;
          }
        }
      }
    }
  }
  return clip;
}

/**
 * Normaliza y genera copias con nombres canónicos y de compatibilidad para Drei/Three.
 */
export function normalizeAnimationClips(clips = []) {
  const result = [];
  const registered = new Set();

  function addClip(clip, name) {
    const key = `${name}-${clip.duration}`;
    if (registered.has(key)) return;
    registered.add(key);

    if (clip.name === name) {
      result.push(clip);
    } else {
      const cloned = clip.clone();
      cloned.name = name;
      result.push(cloned);
    }
  }

  for (const clip of clips) {
    makeClipInPlace(clip);
    const raw = clip.name.replace(/mixamo\.com|armature\|/gi, '').trim();
    addClip(clip, clip.name);
    addClip(clip, raw);

    for (const [canonical, aliases] of Object.entries(ANIM_ALIASES)) {
      const matches = aliases.some(
        (a) =>
          raw.toLowerCase() === a.toLowerCase() ||
          raw.toLowerCase().includes(a.toLowerCase()),
      );
      if (matches) {
        addClip(clip, canonical);
        addClip(clip, canonical.charAt(0).toUpperCase() + canonical.slice(1));
        if (canonical === 'walk') addClip(clip, 'Walking');
        if (canonical === 'run') addClip(clip, 'Running');
      }
    }
  }

  // Si no se proporcionó clip específico de reposo (idle.glb), usar clip de walk
  const hasIdle = result.some((c) => c.name.toLowerCase() === 'idle');
  if (!hasIdle) {
    const walkClip = result.find((c) => c.name.toLowerCase() === 'walk');
    if (walkClip) {
      addClip(walkClip, 'idle');
      addClip(walkClip, 'Idle');
    }
  }

  return result;
}

// Preload standard model
useGLTF.preload(QUIBAR_MODEL_PATH);

export const ANIMATION_VERSION = 'v_wander_pauses_v4';

/**
 * Hook para cargar el modelo 3D con animaciones estandarizadas.
 * Carga el modelo base y las animaciones desde /animations/ (idle.glb, walk.glb, run.glb, etc.).
 */
export function useCharacterModel(groupRef) {
  const { scene, animations: baseAnimations } = useGLTF(QUIBAR_MODEL_PATH);
  const [extraClips, setExtraClips] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAnimations() {
      const gltfLoader = new GLTFLoader();
      const loaded = [];

      let filesToTry = STANDARD_ANIM_NAMES.map((name) => ({ name, file: `${name}.glb` }));

      try {
        const res = await fetch(`${ANIMATIONS_MANIFEST}?v=${ANIMATION_VERSION}&t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.animations)) {
            filesToTry = data.animations.map((a) =>
              typeof a === 'string'
                ? { name: a, file: a.endsWith('.glb') ? a : `${a}.glb` }
                : { name: a.name || a.id, file: a.file || `${a.name}.glb` },
            );
          }
        }
      } catch {
        // Usa lista estándar si no hay red o manifiesto
      }

      for (const item of filesToTry) {
        if (cancelled) break;
        const url = `${ANIMATIONS_DIR}/${item.file}?v=${ANIMATION_VERSION}&t=${Date.now()}`;
        try {
          const gltf = await gltfLoader.loadAsync(url);
          if (gltf.animations && gltf.animations.length > 0) {
            const clip = gltf.animations[0];
            clip.name = item.name;
            loaded.push(clip);
          }
        } catch {
          // Si el archivo no existe aún, se usan los clips base
        }
      }

      if (!cancelled && loaded.length > 0) {
        setExtraClips(loaded);
      }
    }

    loadAnimations();

    return () => {
      cancelled = true;
    };
  }, [ANIMATION_VERSION]);

  const mergedClips = useMemo(() => {
    const combined = [...extraClips, ...(baseAnimations || [])];
    return normalizeAnimationClips(combined);
  }, [baseAnimations, extraClips]);

  const { actions, mixer, names } = useAnimations(mergedClips, groupRef);

  return { scene, animations: mergedClips, actions, mixer, names };
}

