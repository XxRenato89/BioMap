import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { Box3, MathUtils, Vector3 } from 'three';
import { normalizeHeading } from './cameraMath.js';
import { useDiorama } from './DioramaScene.jsx';

const { ACTION } = CameraControlsImpl;
const TILTED_PITCH = -33;
const TOP_PITCH = -88;
const target = new Vector3();

/**
 * Posición y objetivo de la cámara para una vista {center, range, heading,
 * pitch}: mira `center` (apoyado en el relieve) desde `range` metros, con el
 * rumbo y la inclinación indicados (grados).
 */
export function viewToPose(view, projection, heightAt) {
  const { x, z } = projection.toWorld(view.center);
  const y = heightAt(x, z);
  const polar = MathUtils.degToRad(90 + view.pitch);
  const azimuth = MathUtils.degToRad(-view.heading);
  const distance = view.range / 1000;
  return {
    target: [x, y, z],
    position: [
      x + Math.sin(polar) * Math.sin(azimuth) * distance,
      y + Math.cos(polar) * distance,
      z + Math.sin(polar) * Math.cos(azimuth) * distance,
    ],
  };
}

/**
 * Cámara de una vista de la maqueta, con gestos táctiles: un dedo gira la
 * maqueta, dos dedos acercan y desplazan. Todas las órdenes de los botones
 * usan transiciones suaves. Publica qué está mirando y expone sus órdenes
 * por `ref` (zoomBy, orbitBy, setTilted, resetNorth, zoomToRange, flyTo,
 * resetView, fly, startAttract, view).
 *
 * @param {object} props
 * @param {import('react').Ref<object>} props.ref
 * @param {ReturnType<import('../config.js').buildConfig>} props.config
 * @param {object} props.homeView Vista de inicio de esta vista.
 * @param {object | null} [props.startView] Si se indica, la cámara parte aquí y vuela a `homeView`.
 * @param {HTMLElement} props.domElement Elemento que recibe los gestos.
 * @param {(view: object) => void} [props.onView]
 * @param {(tilted: boolean) => void} [props.onTiltChange]
 */
export default function CameraRig({
  ref,
  config,
  homeView,
  startView,
  domElement,
  onView,
  onTiltChange,
}) {
  const controls = useRef(null);
  const { projection, heightAt } = useDiorama();
  const invalidate = useThree((state) => state.invalidate);
  const homeRef = useRef(homeView);
  const callbacks = useRef({ onView, onTiltChange });
  const attract = useRef(null);

  useEffect(() => {
    homeRef.current = homeView;
    callbacks.current = { onView, onTiltChange };
  });

  const currentView = () => {
    const c = controls.current;
    c.getTarget(target);
    return {
      center: projection.toLngLat(target.x, target.z),
      range: c.distance * 1000,
      heading: normalizeHeading(-MathUtils.radToDeg(c.azimuthAngle)),
      pitch: MathUtils.radToDeg(c.polarAngle) - 90,
    };
  };

  const flyTo = (view, transition = true) => {
    const { position, target: look } = viewToPose(view, projection, heightAt);
    controls.current.setLookAt(...position, ...look, transition);
    invalidate();
  };

  /*
   * Configuración de los gestos y vuelo inicial (desde la vista general hacia
   * el punto, cuando la ventana se abre sobre uno).
   */
  useEffect(() => {
    const c = controls.current;
    c.touches.one = ACTION.TOUCH_ROTATE;
    c.touches.two = ACTION.TOUCH_DOLLY;
    c.touches.three = ACTION.NONE;
    c.mouseButtons.left = ACTION.ROTATE;
    c.mouseButtons.right = ACTION.NONE;
    c.mouseButtons.middle = ACTION.NONE;
    c.mouseButtons.wheel = ACTION.DOLLY;
    c.setBoundary(
      new Box3(
        new Vector3(-projection.width / 2, 0, -projection.depth / 2),
        new Vector3(projection.width / 2, 2, projection.depth / 2),
      ),
    );
    flyTo(startView ?? homeRef.current, false);
    if (startView) setTimeout(() => flyTo(homeRef.current), 60);
    // Solo al montar: después, la cámara la mueve el visitante.
  }, []);

  /*
   * Publica la vista a lo más una vez por cuadro y avisa si cambió la inclinación.
   */
  const tilted = useRef(null);
  useEffect(() => {
    const c = controls.current;
    let frame = null;
    const publish = () => {
      frame = null;
      const view = currentView();
      callbacks.current.onView?.(view);
      const isTilted = view.pitch > -70;
      if (isTilted !== tilted.current) {
        tilted.current = isTilted;
        callbacks.current.onTiltChange?.(isTilted);
      }
    };
    const onUpdate = () => {
      frame ??= requestAnimationFrame(publish);
    };
    c.addEventListener('update', onUpdate);
    onUpdate();
    return () => {
      c.removeEventListener('update', onUpdate);
      if (frame) cancelAnimationFrame(frame);
    };
    // currentView solo depende de la proyección, que no cambia.
  }, [projection]);

  /*
   * Modo atracción: la cámara rodea lentamente cada parada y salta a la siguiente.
   */
  useFrame((_, delta) => {
    const state = attract.current;
    if (!state) return;
    controls.current.rotate(delta * 0.12, 0, false);
    if (performance.now() > state.nextAt) {
      const stop = state.stops[state.index % state.stops.length];
      state.index += 1;
      state.nextAt = performance.now() + 14_000;
      state.onStop?.(stop);
      flyTo({
        center: stop.center,
        range: stop.range ?? 1_500,
        heading: currentView().heading + 40,
        pitch: -30,
      });
    }
    invalidate();
  });

  useImperativeHandle(ref, () => ({
    zoomBy: (factor) => {
      const c = controls.current;
      c.dollyTo(
        MathUtils.clamp(c.distance * factor, config.minRange / 1000, config.maxRange / 1000),
        true,
      );
      invalidate();
    },
    orbitBy: (degrees) => {
      controls.current.rotate(MathUtils.degToRad(-degrees), 0, true);
      invalidate();
    },
    setTilted: (isTilted) => {
      controls.current.rotatePolarTo(
        MathUtils.degToRad(90 + (isTilted ? TILTED_PITCH : TOP_PITCH)),
        true,
      );
      invalidate();
    },
    resetNorth: () => {
      controls.current.rotateAzimuthTo(0, true);
      invalidate();
    },
    zoomToRange: (range) => {
      controls.current.dollyTo(range / 1000, true);
      invalidate();
    },
    flyTo: (view) => flyTo(view),
    resetView: () => flyTo(homeRef.current),
    view: () => currentView(),
    /*
     * Un paso del mando de vuelo: avanzar sobre el terreno en la dirección
     * en que se mira, girar, y subir o bajar (alejar o acercar).
     */
    fly: ({ forward = 0, turn = 0, climb = 0 }, seconds) => {
      const c = controls.current;
      const speed = c.distance * 0.7;
      if (forward) {
        c.getTarget(target);
        const azimuth = c.azimuthAngle;
        const x = target.x - Math.sin(azimuth) * forward * speed * seconds;
        const z = target.z - Math.cos(azimuth) * forward * speed * seconds;
        c.moveTo(x, heightAt(x, z), z, false);
      }
      if (turn) c.rotate(-turn * seconds * 1.1, 0, false);
      if (climb) c.dolly(-climb * c.distance * seconds * 0.9, false);
      invalidate();
    },
    startAttract: (stops, onStop) => {
      attract.current = { stops, onStop, index: 0, nextAt: 0 };
      invalidate();
      return () => {
        attract.current = null;
      };
    },
  }));

  return (
    <CameraControls
      ref={controls}
      makeDefault
      domElement={domElement}
      minDistance={config.minRange / 1000}
      maxDistance={config.maxRange / 1000}
      minPolarAngle={0.02}
      maxPolarAngle={1.32}
      smoothTime={0.45}
      draggingSmoothTime={0.12}
      dollyToCursor={false}
    />
  );
}
