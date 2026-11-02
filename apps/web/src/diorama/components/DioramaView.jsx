import { PerspectiveCamera, View } from '@react-three/drei';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CameraRig from './CameraRig.jsx';
import DioramaScene from './DioramaScene.jsx';
import Landmarks from './Landmarks.jsx';

import { Lightbulb } from 'lucide-react';
import { ROTATING_TIPS } from '../../data/curiosities.js';

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
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'es';
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(15);
  const [stage, setStage] = useState('Iniciando maqueta 3D...');

  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % ROTATING_TIPS.length);
    }, 3800);

    const stages = [
      { at: 400, p: 32, label: 'Cargando relieve y satélite...' },
      { at: 1100, p: 58, label: 'Generando agua y caminos...' },
      { at: 1900, p: 78, label: 'Plantando bosques nativos...' },
      { at: 2600, p: 92, label: 'Preparando personaje Quibar...' },
    ];

    const timeouts = stages.map(({ at, p, label }) =>
      setTimeout(() => {
        setProgress(p);
        setStage(label);
      }, at),
    );

    return () => {
      clearInterval(tipTimer);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const tip = ROTATING_TIPS[tipIndex];

  return (
    <motion.div
      className="absolute inset-0 z-[5] grid place-items-center bg-[radial-gradient(circle_at_50%_40%,#1c75bc,#14334d_70%)] text-cream pointer-events-none select-none px-6"
      role="status"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8 } }}
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-lg">
        <p className="m-0 font-display font-extrabold text-6xl tracking-tight text-white drop-shadow-sm">
          BioMap
        </p>
        <p className="m-0 text-lg text-cream/90 font-medium">
          {stage}
        </p>

        {/* Barra de progreso con porcentaje */}
        <div className="w-72 mt-2">
          <div className="flex justify-between text-xs text-cream/75 mb-1.5 font-medium">
            <span>Cargando</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div
            className="relative h-2 w-full overflow-hidden rounded-full bg-cream/15"
            aria-hidden="true"
          >
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-ochre"
              initial={{ width: '15%' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.5 }}
            />
          </div>
        </div>

        {/* Dato curioso rotativo */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tipIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="mt-6 flex items-start gap-2.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3 text-left text-cream/90 shadow-lg text-sm leading-relaxed"
          >
            <Lightbulb size={20} className="flex-none text-ochre mt-0.5" aria-hidden="true" />
            <p className="m-0">
              <strong className="text-ochre">¿Sabías que?</strong>{' '}
              {tip[lang] ?? tip.es}
            </p>
          </motion.div>
        </AnimatePresence>
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
 * @param {string} [props.fogColor] Color de la bruma (el del horizonte del cielo).
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
  fogColor: horizon = '#dcd8c8',
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
  const fogColor = background ?? horizon;
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
