import { ContactShadows } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Volume2, VolumeX } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Box3, MathUtils, Vector3 } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useAvatarStore } from '../../store/avatarStore.js';
import { useCharacterModel } from '../../diorama/utils/characterModel.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx';

/* Duración del gesto hacia la ficha al cambiar de foto o pestaña (s). */
const GESTURE_S = 1.2;
const MASCOT_HEIGHT = 2.3;
const MASCOT_FPS = 30;

/**
 * La mascota en primer plano: saluda al llegar y, con cada cambio en la
 * ficha (`gestureKey`), se gira hacia ella como mostrándola.
 */
export function Mascot({ gestureKey, facing = 0.35 }) {
  const group = useRef(null);
  const { scene, actions } = useCharacterModel(group);
  /* Copia propia (la original la usa el avatar del mapa), con los pies en y = 0 y 2.3 de alto. */
  const model = useMemo(() => {
    const copy = clone(scene);
    copy.scale.setScalar(1);
    copy.position.set(0, 0, 0);
    /* La armadura viene escalada ×100: sin esto la caja mide la malla sin escalar. */
    copy.updateMatrixWorld(true);
    const box = new Box3().setFromObject(copy);
    const size = box.getSize(new Vector3());
    const scale = MASCOT_HEIGHT / (size.y || 1);
    copy.scale.setScalar(scale);
    copy.position.set(
      -box.getCenter(new Vector3()).x * scale,
      -box.min.y * scale,
      -box.getCenter(new Vector3()).z * scale,
    );
    return copy;
  }, [scene]);
  const gestureAt = useRef(-Infinity);

  useEffect(() => {
    const wave =
      actions?.dance ??
      actions?.Dance ??
      actions?.wave ??
      actions?.Wave ??
      actions?.idle ??
      actions?.Idle;
    wave?.reset().fadeIn(0.3).play();
    return () => wave?.fadeOut(0.3);
  }, [actions]);

  useEffect(() => {
    gestureAt.current = performance.now() / 1000;
  }, [gestureKey]);

  /* El lienzo va en frameloop="demand": a 30 fps basta y deja la GPU al mapa. */
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) invalidate();
    }, 1000 / MASCOT_FPS);
    return () => clearInterval(timer);
  }, [invalidate]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const since = performance.now() / 1000 - gestureAt.current;
    /* Giro hacia la ficha (a la derecha) que se deshace solo. */
    const turn = since < GESTURE_S ? Math.sin((since / GESTURE_S) * Math.PI) * 0.7 : 0;
    const sway = Math.sin(clock.elapsedTime * 0.8) * 0.08;
    group.current.rotation.y = MathUtils.lerp(group.current.rotation.y, facing + turn + sway, 0.12);
  });

  return (
    <group ref={group} position={[0, -1.15, 0]}>
      <primitive object={model} />
    </group>
  );
}

/**
 * Mascota al costado izquierdo de la ficha de un punto, con el globo de lo
 * que va narrando. El texto y la voz los lleva el estado del avatar.
 *
 * @param {{ gestureKey: string }} props
 */
export default function SheetMascot({ gestureKey }) {
  const { t } = useTranslation();
  const speech = useAvatarStore((state) => state.activeSpeech);
  const muted = useAvatarStore((state) => state.muted);
  const toggleMute = useAvatarStore((state) => state.toggleMute);

  return (
    <motion.div
      className="fixed bottom-[124px] right-[600px] z-[60] w-[340px] flex flex-col items-center pointer-events-none"
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      {speech && (
        <div
          className="relative mb-2 w-[300px] self-start rounded-2xl bg-cream text-ink p-5 pr-16 shadow-panel pointer-events-auto"
          role="region"
          aria-label={t('sheet.guide')}
          aria-live="polite"
        >
          <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-ochre-deep">
            {t('sheet.guide')}
          </p>
          <p className="m-0 mt-1 text-[length:var(--fs-body)] leading-snug">{speech}</p>
          <button
            type="button"
            className="absolute top-3 right-3 flex items-center justify-center w-12 h-12 rounded-xl bg-forest text-cream cursor-pointer"
            onClick={toggleMute}
            aria-label={muted ? t('sheet.unmute') : t('sheet.mute')}
            aria-pressed={muted}
          >
            {muted ? (
              <VolumeX size={22} aria-hidden="true" />
            ) : (
              <Volume2 size={22} aria-hidden="true" />
            )}
          </button>
          <span
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rotate-45 bg-cream"
            aria-hidden="true"
          />
        </div>
      )}
      <div className="w-[340px] h-[420px]" aria-hidden="true">
        <ErrorBoundary>
          <Canvas
            camera={{ position: [0, 0, 4.3], fov: 38 }}
            dpr={[1, 1.5]}
            frameloop="demand"
            gl={{ alpha: true, powerPreference: 'low-power' }}
          >
            <ambientLight intensity={1.1} />
            <directionalLight position={[3, 5, 4]} intensity={1.6} />
            <Mascot gestureKey={gestureKey} />
            {/* La sombra no cambia con el vaivén: se calcula una vez, no en cada cuadro. */}
            <ContactShadows
              frames={1}
              position={[0, -1.15, 0]}
              opacity={0.45}
              scale={4}
              blur={2}
              far={2}
            />
          </Canvas>
        </ErrorBoundary>
      </div>
    </motion.div>
  );
}
