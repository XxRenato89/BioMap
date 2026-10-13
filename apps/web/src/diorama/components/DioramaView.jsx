import { PerspectiveCamera, View } from '@react-three/drei';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CameraRig from './CameraRig.jsx';
import DioramaScene from './DioramaScene.jsx';
import Landmarks from './Landmarks.jsx';

/**
 * Avisa cuando la maqueta terminó de cargar (se monta al resolverse el Suspense).
 */
function Ready({ onReady }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

/**
 * Pantalla de espera mientras se arma la maqueta (relieve, agua y bosque).
 */
function Loading() {
  const { t } = useTranslation();
  return (
    <motion.div
      className="absolute inset-0 z-[5] grid place-items-center bg-[radial-gradient(circle_at_50%_40%,#2a5a3f,#13241d_70%)] text-cream pointer-events-none"
      role="status"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8 } }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="m-0 font-display font-extrabold text-6xl tracking-tight">BioMap</p>
        <p className="m-0 text-xl text-cream/80">{t('loading.text')}</p>
        <span
          className="relative mt-2 block h-1.5 w-64 overflow-hidden rounded-full bg-cream/15"
          aria-hidden="true"
        >
          <span className="absolute inset-y-0 w-1/3 rounded-full bg-ochre motion-safe:animate-[loading_1.4s_ease-in-out_infinite]" />
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Una vista de la maqueta (la general o una ventana de exploración). Todas
 * se dibujan en un único canvas WebGL, cada una en su rectángulo de pantalla
 * y con su propia cámara: así cinco personas exploran a la vez sin multiplicar
 * el costo de la tarjeta gráfica. `children` son objetos 3D extra (marcadores).
 *
 * @param {object} props
 * @param {import('react').Ref<object>} [props.ref] Órdenes de cámara (ver CameraRig).
 * @param {string} props.id Identifica la vista para los toques.
 * @param {ReturnType<import('../../config.js').buildConfig>} props.config
 * @param {object} props.homeView
 * @param {object | null} [props.startView]
 * @param {boolean} [props.shadows]
 * @param {string | null} [props.background] Color de fondo; null deja ver el fondo de la página.
 * @param {[number, number]} props.fog Distancias de inicio y fin de la bruma.
 * @param {boolean} [props.visible]
 * @param {string} props.label Nombre accesible.
 */
export default function DioramaView({
  ref,
  id,
  config,
  homeView,
  startView = null,
  shadows = false,
  forest = true,
  background = null,
  fog,
  visible = true,
  label,
  onView,
  onTiltChange,
  children,
}) {
  const [element, setElement] = useState(null);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  /* Bruma del color del cielo cerca del horizonte: el paisaje se funde con él. */
  const fogColor = background ?? '#dcd8c8';
  return (
    <div
      ref={setElement}
      className="absolute inset-0 touch-none"
      data-view={id}
      role="region"
      aria-label={label}
    >
      <View className="absolute inset-0" visible={visible}>
        {background && <color attach="background" args={[background]} />}
        <fog attach="fog" args={[fogColor, ...fog]} />
        <PerspectiveCamera makeDefault fov={32} near={0.01} far={200} />
        <Suspense fallback={null}>
          <DioramaScene shadows={shadows} forest={forest} />
          <Landmarks shadows={shadows} />
          {element && (
            <CameraRig
              ref={ref}
              config={config}
              homeView={homeView}
              startView={startView}
              domElement={element}
              onView={onView}
              onTiltChange={onTiltChange}
            />
          )}
          {children}
          <Ready onReady={markReady} />
        </Suspense>
      </View>
      <AnimatePresence>{!ready && <Loading />}</AnimatePresence>
    </div>
  );
}
