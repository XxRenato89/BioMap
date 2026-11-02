import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Box3, MathUtils, Vector3 } from 'three';
import { normalizeHeading } from '../utils/cameraMath.js';
import { useDiorama } from './DioramaScene.jsx';
import { useAvatarStore } from '../../store/avatarStore.js';

const { ACTION } = CameraControlsImpl;
const TILTED_PITCH = -33;
const TOP_PITCH = -88;
const target = new Vector3();
/* Visor 3D a pie: ojos a 4 m del suelo (el relieve va exagerado) y la cámara
   pegada al objetivo, que gira en su lugar como Street View. */
const EYE_KM = 0.004;
const FIRST_PERSON_KM = 0.0001;
const STAND_OFF_KM = 0.08;
const DRONE_VIEW = { range: 450, pitch: -22 };

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
 * resetView, fly, startAttract, view, enterVisor, exitVisor, setSpin).
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
  /* Visor 3D: 'ground' (a pie) o 'drone' (dron que rodea el lugar); null = maqueta. */
  const [visor, setVisor] = useState(null);
  const visorRef = useRef(null);
  const spin = useRef(false);

  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

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

  /*
   * `view.shift`: fracción del ancho de pantalla en que el centro queda a la
   * izquierda (deja el lugar visible junto a la ficha y la mascota).
   */
  const flyTo = (view, transition = true) => {
    const { position, target: look } = viewToPose(view, projection, heightAt);
    const c = controls.current;
    c.setLookAt(...position, ...look, transition);
    const { fov, aspect } = c.camera;
    const halfWidth = (view.range / 1000) * Math.tan(MathUtils.degToRad(fov / 2)) * aspect;
    c.setFocalOffset((view.shift ?? 0) * 2 * halfWidth, 0, 0, transition);
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
      invalidate();
      frame ??= requestAnimationFrame(publish);
    };
    const onControl = () => {
      invalidate();
    };
    c.addEventListener('control', onControl);
    c.addEventListener('update', onUpdate);
    c.addEventListener('wake', onControl);
    c.addEventListener('rest', onControl);
    onUpdate();
    return () => {
      c.removeEventListener('control', onControl);
      c.removeEventListener('update', onUpdate);
      c.removeEventListener('wake', onControl);
      c.removeEventListener('rest', onControl);
      if (frame) cancelAnimationFrame(frame);
    };
    // currentView solo depende de la proyección, que no cambia.
  }, [projection]);

  /*
   * Modo atracción: la cámara rodea lentamente cada parada y salta a la siguiente.
   */
  useFrame((state, delta) => {
    const stateAttract = attract.current;
    if (stateAttract) {
      controls.current.rotate(delta * 0.12, 0, false);
      if (performance.now() > stateAttract.nextAt) {
        const stop = stateAttract.stops[stateAttract.index % stateAttract.stops.length];
        stateAttract.index += 1;
        stateAttract.nextAt = performance.now() + 14_000;
        stateAttract.onStop?.(stop);
        flyTo({
          center: stop.center,
          range: stop.range ?? 1_500,
          heading: currentView().heading + 40,
          pitch: -30,
        });
      }
      invalidate();
      return;
    }

    /*
     * Mientras la mascota corre al punto que eligió el visitante, la cámara la
     * acompaña sin cambiar distancia ni ángulo. En patrulla, el visitante
     * mueve la cámara libremente.
     */
    if (visorRef.current) {
      if (spin.current) {
        controls.current.rotate(delta * 0.18, 0, false);
        invalidate();
      }
      return;
    }
    const { mode, currentPosition } = useAvatarStore.getState();
    if (currentPosition && mode === 'running_to_point') {
      controls.current.moveTo(
        currentPosition.x,
        currentPosition.y,
        currentPosition.z,
        !reducedMotion,
      );
      invalidate();
    }
  });

  /* Ajusta la cámara al modo: a pie, gira en su lugar, acerca con zoom y ve de cerca. */
  const applyVisor = (kind) => {
    const c = controls.current;
    const ground = kind === 'ground';
    c.minDistance = ground ? FIRST_PERSON_KM : config.minRange / 1000;
    c.maxDistance = ground ? FIRST_PERSON_KM : config.maxRange / 1000;
    c.mouseButtons.wheel = ground ? ACTION.ZOOM : ACTION.DOLLY;
    c.touches.two = ground ? ACTION.TOUCH_ZOOM : ACTION.TOUCH_DOLLY;
    c.camera.near = ground ? 0.0008 : 0.01;
    c.camera.far = ground ? 60 : 200;
    c.camera.updateProjectionMatrix();
    if (!ground) c.zoomTo(1, true);
    spin.current = kind === 'drone';
  };
  const leaveVisor = () => {
    if (!visorRef.current) return;
    visorRef.current = null;
    setVisor(null);
    applyVisor(null);
    spin.current = false;
  };

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
      controls.current.setFocalOffset(0, 0, 0, true);
      invalidate();
    },
    flyTo: (view) => flyTo(view),
    resetView: () => {
      leaveVisor();
      flyTo(homeRef.current);
    },
    /*
     * Visor 3D de un lugar: 'ground' pone los ojos del visitante en el suelo y
     * se mira en 360° arrastrando; 'drone' lo rodea desde el aire.
     */
    enterVisor: (center, kind) => {
      const c = controls.current;
      visorRef.current ??= { saved: currentView() };
      visorRef.current.kind = kind;
      setVisor(kind);
      applyVisor(kind);
      if (kind === 'ground') {
        /* Parado a un costado del lugar (no dentro de su modelo), mirándolo. */
        const poi = projection.toWorld(center);
        const az = c.azimuthAngle;
        const x = poi.x + Math.sin(az) * STAND_OFF_KM;
        const z = poi.z + Math.cos(az) * STAND_OFF_KM;
        const y = heightAt(x, z) + EYE_KM;
        c.setLookAt(
          x + Math.sin(az) * FIRST_PERSON_KM,
          y,
          z + Math.cos(az) * FIRST_PERSON_KM,
          x,
          y,
          z,
          true,
        );
        c.setFocalOffset(0, 0, 0, true);
      } else {
        flyTo({ center, heading: currentView().heading, ...DRONE_VIEW });
      }
      invalidate();
    },
    exitVisor: () => {
      const saved = visorRef.current?.saved;
      leaveVisor();
      if (saved) flyTo(saved);
    },
    setSpin: (on) => {
      spin.current = on;
      invalidate();
    },
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
      minDistance={visor === 'ground' ? FIRST_PERSON_KM : config.minRange / 1000}
      maxDistance={visor === 'ground' ? FIRST_PERSON_KM : config.maxRange / 1000}
      minPolarAngle={visor === 'ground' ? 0.6 : 0.05}
      maxPolarAngle={visor === 'ground' ? 2.3 : 1.22}
      azimuthRotateSpeed={visor === 'ground' ? -0.4 : 1}
      polarRotateSpeed={visor === 'ground' ? -0.4 : 1}
      minZoom={1}
      maxZoom={visor === 'ground' ? 4 : 1}
      smoothTime={0.45}
      draggingSmoothTime={0.12}
      dollyToCursor={false}
    />
  );
}
