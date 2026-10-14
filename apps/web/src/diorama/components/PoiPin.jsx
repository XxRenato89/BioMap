import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  Binoculars,
  Bridge,
  Check,
  Footprints,
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
const stemMaterials = new Map();
/** Material del poste en el color de la capa (uno por color, compartido). */
function stemMaterial(color) {
  if (!stemMaterials.has(color))
    stemMaterials.set(color, new MeshStandardMaterial({ color: new Color(color), roughness: 0.5 }));
  return stemMaterials.get(color);
}

/**
 * Un punto de interés: un poste del color de su capa que sale del suelo y,
 * en su punta, un marcador con el icono del lugar y una placa con su nombre.
 * Poste y marcador miden siempre lo mismo en pantalla y el pie no se mueve al
 * acercarse. Las paradas del recorrido llevan su número.
 */
export function PoiPin({
  id,
  position,
  layer,
  name,
  selected,
  onSelect,
  registry,
  lifts,
  state = 'disponible',
  stop = 0,
}) {
  const group = useRef(null);
  const lift = useRef(0);
  const foot = useRef(null);
  const anchor = useMemo(() => new Vector3(...position), [position]);
  /* Punta del poste sin escalón: desde ahí se reparten las insignias (si no, subir una la movería y el reparto oscilaría). */
  const base = useMemo(() => new Vector3(...position), [position]);
  const locked = state === 'bloqueado';
  const material = stemMaterial(layer.color);

  useFrame(({ camera, invalidate }) => {
    const stem = group.current;
    if (!stem) return;
    /* El poste mide lo mismo en pantalla; solo crece si PoiMarkers le dio un escalón. */
    const goal = lifts?.get(id) ?? 0;
    lift.current += (goal - lift.current) * 0.25;
    if (Math.abs(goal - lift.current) > 0.01) invalidate();
    else lift.current = goal;
    const baseSize = camera.position.distanceTo(stem.position) * STEM_PX;
    const size = baseSize * (1 + lift.current);
    stem.scale.set(baseSize, size, baseSize);
    /* El remache no se estira con el escalón. */
    if (foot.current) foot.current.scale.y = baseSize / size;
    base.set(position[0], position[1] + baseSize, position[2]);
    /* El marcador va en la punta del poste: de ahí se proyecta y se tapa. */
    anchor.set(position[0], position[1] + size, position[2]);
  });

  const register = (element) => {
    if (element) registry.set(id, { element, anchor, base, name, selected });
    else registry.delete(id);
  };

  return (
    <group ref={group} position={position}>
      <mesh geometry={STEM} material={material} />
      <mesh ref={foot} geometry={FOOT} material={material} />
      {/* En la punta del poste (el grupo se escala con la distancia). */}
      {/* Bajo los paneles de la interfaz (z-10): un pin nunca tapa la cabecera ni el Bio-Book. */}
      <Html position={[0, 1, 0]} zIndexRange={selected ? [9, 8] : [7, 3]}>
        <button
          ref={register}
          type="button"
          className="poi-pin group absolute left-0 top-0 flex items-center -translate-x-[25px] -translate-y-[60px] border-0 bg-transparent p-0 cursor-pointer pointer-events-auto select-none transition-[opacity,filter] duration-300 data-[occluded=true]:opacity-40 data-[occluded=true]:grayscale disabled:cursor-default"
          data-selected={selected || undefined}
          data-state={state}
          data-name={name}
          onClick={locked ? undefined : onSelect}
          disabled={locked}
          aria-label={stop ? `${stop}. ${name}` : name}
        >
          {/* Marcador: círculo del color de la capa con la punta hacia el poste. */}
          <span
            className="relative z-10 flex-none flex items-center justify-center w-[50px] h-[50px] rounded-full text-white border-[3px] border-cream shadow-[0_5px_12px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-[50%_calc(100%+10px)] group-hover:scale-105 group-data-[selected=true]:scale-115 group-data-[selected=true]:shadow-[0_0_0_7px_rgba(243,236,220,0.55),0_8px_18px_rgba(0,0,0,0.5)] group-data-[mini=true]:scale-[0.36] group-data-[mini=true]:[&>*]:opacity-0 group-data-[state=bloqueado]:saturate-[0.35] group-data-[state=bloqueado]:brightness-90"
            style={{ backgroundColor: layer.color }}
          >
            {getPoiIcon(layer, name, 22)}
            <span
              className="absolute left-1/2 top-full -mt-px -translate-x-1/2 w-0 h-0 border-x-[7px] border-x-transparent border-t-[10px] !opacity-100"
              style={{ borderTopColor: 'var(--color-cream)' }}
              aria-hidden="true"
            />
            {stop > 0 && (
              <span
                className="absolute -top-2 -left-2 flex items-center justify-center w-6 h-6 rounded-full bg-forest text-cream text-[13px] font-extrabold ring-2 ring-cream"
                aria-hidden="true"
              >
                {stop}
              </span>
            )}
            {(state === 'visitado' || locked) && (
              <span
                className={`absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full text-white ring-2 ring-cream ${locked ? 'bg-stone-500' : 'bg-forest-light'}`}
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
          <span
            className="poi-pin__label -ml-4 pl-6 pr-4 h-9 flex items-center rounded-r-full bg-cream text-forest font-bold text-[length:var(--fs-small)] whitespace-nowrap shadow-[0_4px_10px_rgba(0,0,0,0.35)] border-b-[3px] pointer-events-none transition-colors group-data-[selected=true]:bg-forest group-data-[selected=true]:text-cream group-data-[state=bloqueado]:text-forest/60 group-data-[compact=true]:hidden"
            style={{ borderBottomColor: layer.color }}
          >
            {name}
          </span>
        </button>
      </Html>
    </group>
  );
}

export default PoiPin;
