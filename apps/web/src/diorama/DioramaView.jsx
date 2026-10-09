import { PerspectiveCamera, View } from '@react-three/drei';
import { Suspense, useState } from 'react';
import CameraRig from './CameraRig.jsx';
import DioramaScene from './DioramaScene.jsx';
import Landmarks from './Landmarks.jsx';

/**
 * Una vista de la maqueta (la general o una ventana de exploración). Todas
 * se dibujan en un único canvas WebGL, cada una en su rectángulo de pantalla
 * y con su propia cámara: así cinco personas exploran a la vez sin multiplicar
 * el costo de la tarjeta gráfica. `children` son objetos 3D extra (marcadores).
 *
 * @param {object} props
 * @param {import('react').Ref<object>} [props.ref] Órdenes de cámara (ver CameraRig).
 * @param {string} props.id Identifica la vista para los toques.
 * @param {ReturnType<import('../config.js').buildConfig>} props.config
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
  /* Bruma del color del cielo cerca del horizonte: el paisaje se funde con él. */
  const fogColor = background ?? '#cbd9d6';
  return (
    <div ref={setElement} className="diorama-view" data-view={id} role="region" aria-label={label}>
      <View className="diorama-view__port" visible={visible}>
        {background && <color attach="background" args={[background]} />}
        <fog attach="fog" args={[fogColor, ...fog]} />
        <PerspectiveCamera makeDefault fov={32} near={0.003} far={200} />
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
        </Suspense>
      </View>
    </div>
  );
}
