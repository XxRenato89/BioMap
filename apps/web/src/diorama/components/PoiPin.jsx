import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Check, HelpCircle, Lock } from 'lucide-react';
import { memo, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Color, CylinderGeometry, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { getPoiIcon } from '../../map/poiIcon.jsx';

export { getPoiIcon };

/* Poste de 1 de alto, de los que 0,25 quedan bajo el suelo: así su pie es
 * siempre donde corta el relieve que se ve, sea cual sea el nivel de detalle. */
const STEM = new CylinderGeometry(0.05, 0.05, 1.25, 8).translate(0, 0.375, 0);
/* Remache en el pie: medio queda sobre el relieve en cualquier pendiente y "clava" el poste. */
const FOOT = new SphereGeometry(0.16, 16, 10);
/* Alto del poste en pantalla: ~48 px (un píxel ≈ 0,00052 rad). */
const STEM_PX = 0.00052 * 48;
/* Sin colores de capa (como en el video de referencia): poste gris claro para todos. */
const STEM_MATERIAL = new MeshStandardMaterial({ color: new Color('#d4d4d4'), roughness: 0.5 });

/**
 * Un punto de interés: un poste gris claro que sale del suelo y,
 * en su punta, un marcador con el icono del lugar y una placa con su nombre.
 * Poste y marcador miden siempre lo mismo en pantalla y el pie no se mueve al
 * acercarse. Neutro (sin color de capa): el color solo avisa un estado: verde
 * visitado, azul un grupo de lugares, ámbar un lugar secreto.
 */
export const PoiPin = memo(function PoiPin({
  id,
  position,
  layer,
  name,
  icon = null,
  selected,
  onSelect,
  registry,
  state = 'disponible',
  stop = 0,
  isSecret = false,
  scale = 1,
}) {
  const { t } = useTranslation();
  const group = useRef(null);
  const button = useRef(null);
  const anchor = useMemo(() => new Vector3(...position), [position]);
  /* Punta del poste sin escalón: desde ahí se reparten las insignias. */
  const base = useMemo(() => new Vector3(...position), [position]);
  const locked = state === 'bloqueado';
  const material = STEM_MATERIAL;

  useFrame(({ camera }) => {
    const stem = group.current;
    if (!stem) return;
    /* El poste mide lo mismo en pantalla. Si el pin quedó dentro de un grupo, no se ve. */
    stem.visible = button.current?.dataset.hidden !== 'true';
    const size = camera.position.distanceTo(stem.position) * STEM_PX * scale;
    stem.scale.setScalar(size);
    base.set(position[0], position[1] + size, position[2]);
    /* El marcador va en la punta del poste: de ahí se proyecta y se tapa. */
    anchor.set(position[0], position[1] + size, position[2]);
    /*
     * Prioridad −1: corre antes que el <Html> del marcador, que se ubica con la
     * escala del poste. Si no, en el último cuadro de un zoom (el mapa solo
     * dibuja cuando algo cambia) el marcador quedaba despegado de la punta.
     */
  }, -1);

  const register = (element) => {
    button.current = element;
    if (element)
      registry.set(id, {
        element,
        anchor,
        base,
        name,
        selected,
        label: element.querySelector('.poi-pin__label'),
      });
    else registry.delete(id);
  };

  return (
    <group ref={group} position={position}>
      <mesh geometry={STEM} material={material} />
      <mesh geometry={FOOT} material={material} />
      {/* En la punta del poste (el grupo se escala con la distancia). */}
      {/* Bajo los paneles de la interfaz (z-10): un pin nunca tapa la cabecera ni los paneles. */}
      <Html position={[0, 1, 0]} zIndexRange={selected ? [9, 8] : [7, 3]}>
        <button
          ref={register}
          type="button"
          className="poi-pin group absolute left-0 top-0 flex items-center -translate-x-[21px] -translate-y-[52px] data-[side=left]:flex-row-reverse data-[side=left]:-translate-x-[calc(100%-21px)] border-0 bg-transparent p-0 cursor-pointer pointer-events-auto select-none transition-[opacity,filter] duration-300 data-[occluded=true]:opacity-40 data-[occluded=true]:grayscale data-[hidden=true]:!opacity-0 data-[hidden=true]:!pointer-events-none aria-disabled:cursor-default data-[count]:cursor-pointer"
          data-selected={selected || undefined}
          data-state={state}
          data-secret={isSecret || undefined}
          data-name={name}
          /* En el teléfono, pin y placa más chicos (zoom escala también su desplazamiento). */
          style={scale === 1 ? undefined : { zoom: scale }}
          onClick={onSelect}
          aria-disabled={locked || undefined}
          aria-label={isSecret ? t('pin.secret') : stop ? `${stop}. ${name}` : name}
        >
          {/* Marcador: círculo blanco con punta hacia el poste y el icono gris del lugar. */}
          <span className="relative z-10 flex-none flex items-center justify-center w-[42px] h-[42px] rounded-full bg-white text-neutral-600 border-[3px] border-white shadow-[0_4px_10px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-[50%_calc(100%+10px)] group-hover:scale-105 group-data-[state=visitado]:shadow-[0_0_0_3px_var(--color-ok),0_4px_10px_rgba(0,0,0,0.35)] group-data-[secret]:border-dashed group-data-[secret]:border-warning group-data-[selected=true]:scale-115 group-data-[selected=true]:bg-forest group-data-[selected=true]:border-forest group-data-[selected=true]:text-white group-data-[selected=true]:shadow-[0_0_0_6px_rgba(255,255,255,0.65),0_0_0_14px_rgba(141,198,63,0.45),0_8px_18px_rgba(0,0,0,0.5)] motion-safe:group-data-[selected=true]:animate-[pin-pulse_0.9s_ease-out_2] group-data-[count]:scale-125 group-data-[count]:bg-forest-light group-data-[count]:border-white group-data-[count]:[&>svg]:hidden group-data-[state=bloqueado]:opacity-70 group-data-[count]:!opacity-100">
            {isSecret ? (
              <HelpCircle size={22} strokeWidth={2.6} aria-hidden="true" className="text-warning" />
            ) : locked ? (
              <Lock size={20} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              getPoiIcon(layer, name, 20, icon)
            )}
            <span
              className="absolute left-1/2 top-full -mt-px -translate-x-1/2 w-0 h-0 border-x-[7px] border-x-transparent border-t-[10px] border-t-white group-data-[selected=true]:border-t-forest !opacity-100"
              aria-hidden="true"
            />
            {/* Número de lugares cuando el pin agrupa varios (lo escribe PoiMarkers). */}
            <span
              className="poi-pin__count hidden group-data-[count]:block text-cream text-lg font-extrabold leading-none"
              aria-hidden="true"
            />
            {stop > 0 && !isSecret && (
              <span
                className="absolute group-data-[count]:hidden -top-2 -left-2 flex items-center justify-center w-6 h-6 rounded-full bg-forest text-white text-[13px] font-extrabold ring-2 ring-white"
                aria-hidden="true"
              >
                {stop}
              </span>
            )}
            {(state === 'visitado' || locked) && !isSecret && (
              <span
                className={`absolute group-data-[count]:hidden -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full text-white ring-2 ring-white ${locked ? 'bg-neutral-400' : 'bg-ochre-deep'}`}
                aria-hidden="true"
              >
                {locked ? (
                  <Lock size={12} strokeWidth={3} />
                ) : (
                  <Check size={14} strokeWidth={3.2} />
                )}
              </span>
            )}
          </span>
          {/* Placa con el nombre, unida al marcador. */}
          <span className="poi-pin__label -ml-4 pl-6 pr-4 h-8 flex items-center rounded-r-full group-data-[side=left]:ml-0 group-data-[side=left]:-mr-4 group-data-[side=left]:pl-4 group-data-[side=left]:pr-6 group-data-[side=left]:rounded-r-none group-data-[side=left]:rounded-l-full bg-white text-neutral-700 font-bold text-[length:var(--fs-small)] whitespace-nowrap shadow-[0_4px_10px_rgba(0,0,0,0.35)] pointer-events-none transition-colors group-data-[selected=true]:bg-forest group-data-[selected=true]:pl-8 group-data-[selected=true]:text-white group-data-[state=bloqueado]:text-neutral-400 group-data-[compact=true]:hidden">
            {isSecret ? '?' : name}
          </span>
        </button>
      </Html>
    </group>
  );
}, samePin);

/* La posición llega como arreglo nuevo en cada dibujo: se compara por valor. */
function samePin(a, b) {
  for (const key of Object.keys(b)) {
    if (key === 'position') {
      if (a.position.some((value, index) => value !== b.position[index])) return false;
    } else if (a[key] !== b[key]) return false;
  }
  return true;
}

export default PoiPin;
