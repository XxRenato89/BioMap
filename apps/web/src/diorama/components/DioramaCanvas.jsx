import { PerformanceMonitor, View } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { ACESFilmicToneMapping } from 'three';
import { setFrameRequester } from '../utils/frame.js';
import { useRenderStore } from '../utils/quality.js';

/**
 * Deja disponible `requestFrame()` fuera del canvas (por ejemplo, al
 * arrastrar una ventana, para que su vista se redibuje en el nuevo lugar).
 */
function FrameBridge() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => setFrameRequester(invalidate), [invalidate]);
  return null;
}

/**
 * Exposición y sombras estáticas: el mapa de sombras (4096 px) se dibuja una
 * vez y solo se rehace cuando algo lo pide (`gl.shadowMap.needsUpdate`), no
 * en cada cuadro de la animación del agua.
 */
function RendererSetup() {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.toneMappingExposure = 1.2;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [gl]);
  return null;
}

/*
 * Densidad de dibujo: hasta 1,5× (nítido en la pantalla 4K sin dibujar 8
 * millones de píxeles por cuadro); baja a 1× si el equipo no da abasto.
 */
const MAX_DPR = 1.5;
const deviceDpr = () =>
  Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, MAX_DPR);

/**
 * Único canvas WebGL del visor. Dibuja "a pedido" (solo cuando algo cambia),
 * lo que mantiene la tarjeta gráfica descansada y los 60 cuadros por segundo
 * cuando hay movimiento. Si el equipo no da abasto, baja la resolución de
 * dibujo a 1× hasta recuperarse.
 *
 * @param {{ eventSource: import('react').RefObject<HTMLElement> }} props
 */
export default function DioramaCanvas({ eventSource }) {
  const [dpr, setDpr] = useState(deviceDpr);
  return (
    <Canvas
      className="!absolute inset-0 z-0 pointer-events-none"
      eventSource={eventSource}
      eventPrefix="client"
      frameloop="demand"
      dpr={dpr}
      shadows
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: ACESFilmicToneMapping,
        logarithmicDepthBuffer: true,
      }}
    >
      <RendererSetup />
      <FrameBridge />
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
        }}
        onIncline={() => {
          setDpr(deviceDpr());
        }}
      />
      <View.Port />
    </Canvas>
  );
}
