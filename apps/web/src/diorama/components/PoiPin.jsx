import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  Binoculars,
  Bridge,
  Check,
  Footprints,
  HelpCircle,
  Info,
  Landmark,
  Lock,
  MapPin,
  Mountain,
  Tent,
  TreeDeciduous,
  Trees,
  Umbrella,
  Waves,
  Zap,
} from 'lucide-react';
import { Color, CylinderGeometry, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';

/*
 * Tipo de lugar según su nombre: el primero que calce. Cada uno con su icono
 * y su rótulo corto, para que el pin diga qué es el lugar sin leer la ficha.
 */
const KINDS = [
  [/puente/i, Bridge, 'bridge'],
  [/playa|balneario/i, Umbrella, 'beach'],
  [/camping|acampar/i, Tent, 'camping'],
  [/mirador|vista/i, Binoculars, 'lookout'],
  [/central|hidroel[eé]ctrica|presa/i, Zap, 'power'],
  [/informaci|visitante/i, Info, 'info'],
  [/arboreto/i, TreeDeciduous, 'arboretum'],
  [/sendero/i, Footprints, 'trail'],
  [/cerro|volc[aá]n/i, Mountain, 'hill'],
  [/embalse|lago|laguna|r[ií]o/i, Waves, 'water'],
  [/parque|bosque|reserva/i, Trees, 'park'],
];
const LAYER_ICON = { history: Landmark, ecology: Trees, tourism: MapPin };

/**
 * Icono del tipo de lugar (por nombre) o, si no calza ninguno, el de su capa.
 */
export function getPoiIcon(layer, name = '', size = 22) {
  const Icon = KINDS.find(([re]) => re.test(name))?.[1] ?? LAYER_ICON[layer?.slug] ?? MapPin;
  return <Icon size={size} strokeWidth={2.4} aria-hidden="true" />;
}

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
 * acercarse.
 */
export function PoiPin({
  id,
  position,
  layer,
  name,
  selected,
  onSelect,
  registry,
  state = 'disponible',
  stop = 0,
  isSecret = false,
  scale = 1,
}) {
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
    if (element) registry.set(id, { element, anchor, base, name, selected });
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
          data-name={name}
          /* En el teléfono, pin y placa más chicos (zoom escala también su desplazamiento). */
          style={scale === 1 ? undefined : { zoom: scale }}
          onClick={onSelect}
          aria-disabled={locked || undefined}
          aria-label={isSecret ? 'Lugar secreto por descubrir' : stop ? `${stop}. ${name}` : name}
        >
          {/* Marcador: círculo blanco con punta hacia el poste y el icono gris del lugar. */}
          <span className="relative z-10 flex-none flex items-center justify-center w-[42px] h-[42px] rounded-full bg-white text-neutral-600 border-[3px] border-white shadow-[0_4px_10px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-[50%_calc(100%+10px)] group-hover:scale-105 group-data-[selected=true]:scale-115 group-data-[selected=true]:bg-neutral-800 group-data-[selected=true]:border-neutral-800 group-data-[selected=true]:text-white group-data-[selected=true]:shadow-[0_0_0_6px_rgba(255,255,255,0.6),0_8px_18px_rgba(0,0,0,0.5)] group-data-[count]:scale-125 group-data-[count]:bg-forest group-data-[count]:border-white group-data-[count]:[&>svg]:hidden group-data-[state=bloqueado]:opacity-70 group-data-[count]:!opacity-100">
            {isSecret ? (
              <HelpCircle
                size={22}
                strokeWidth={2.6}
                aria-hidden="true"
                className="text-neutral-400"
              />
            ) : locked ? (
              <Lock size={20} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              getPoiIcon(layer, name, 20)
            )}
            <span
              className="absolute left-1/2 top-full -mt-px -translate-x-1/2 w-0 h-0 border-x-[7px] border-x-transparent border-t-[10px] border-t-white group-data-[selected=true]:border-t-neutral-800 !opacity-100"
              aria-hidden="true"
            />
            {/* Número de lugares cuando el pin agrupa varios (lo escribe PoiMarkers). */}
            <span
              className="poi-pin__count hidden group-data-[count]:block text-cream text-lg font-extrabold leading-none"
              aria-hidden="true"
            />
            {stop > 0 && !isSecret && (
              <span
                className="absolute group-data-[count]:hidden -top-2 -left-2 flex items-center justify-center w-6 h-6 rounded-full bg-neutral-800 text-white text-[13px] font-extrabold ring-2 ring-white"
                aria-hidden="true"
              >
                {stop}
              </span>
            )}
            {(state === 'visitado' || locked) && !isSecret && (
              <span
                className={`absolute group-data-[count]:hidden -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full text-white ring-2 ring-white ${locked ? 'bg-neutral-400' : 'bg-neutral-600'}`}
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
          <span className="poi-pin__label -ml-4 pl-6 pr-4 h-8 flex items-center rounded-r-full group-data-[side=left]:ml-0 group-data-[side=left]:-mr-4 group-data-[side=left]:pl-4 group-data-[side=left]:pr-6 group-data-[side=left]:rounded-r-none group-data-[side=left]:rounded-l-full bg-white text-neutral-700 font-bold text-[length:var(--fs-small)] whitespace-nowrap shadow-[0_4px_10px_rgba(0,0,0,0.35)] pointer-events-none transition-colors group-data-[selected=true]:bg-neutral-800 group-data-[selected=true]:text-white group-data-[state=bloqueado]:text-neutral-400 group-data-[compact=true]:hidden">
            {isSecret ? '?' : name}
          </span>
        </button>
      </Html>
    </group>
  );
}

export default PoiPin;
