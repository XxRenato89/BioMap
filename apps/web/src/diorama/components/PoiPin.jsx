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
import { Color, CylinderGeometry, MeshStandardMaterial, Vector3 } from 'three';

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
const STEM = new CylinderGeometry(0.06, 0.06, 1.25, 8).translate(0, 0.375, 0);
const STEM_MATERIAL = new MeshStandardMaterial({ color: new Color('#24382c'), roughness: 0.6 });
/* Alto del poste en pantalla: ~48 px (un píxel ≈ 0,00052 rad). */
const STEM_PX = 0.00052 * 48;

/**
 * Un punto de interés: un poste que sale del suelo y, en su punta, una
 * insignia con el icono del lugar y su nombre al lado. Poste e insignia
 * miden siempre lo mismo en pantalla y el pie no se mueve al acercarse.
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
}) {
  const group = useRef(null);
  const lift = useRef(0);
  const anchor = useMemo(() => new Vector3(...position), [position]);
  /* Punta del poste sin escalón: desde ahí se reparten las insignias (si no, subir una la movería y el reparto oscilaría). */
  const base = useMemo(() => new Vector3(...position), [position]);
  const locked = state === 'bloqueado';

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
    stem.scale.setScalar(size);
    base.set(position[0], position[1] + baseSize, position[2]);
    /* La insignia va en la punta del poste: de ahí se proyecta y se tapa. */
    anchor.set(position[0], position[1] + size, position[2]);
  });

  const register = (element) => {
    if (element) registry.set(id, { element, anchor, base, name, selected });
    else registry.delete(id);
  };

  return (
    <group ref={group} position={position}>
      <mesh geometry={STEM} material={STEM_MATERIAL} />
      {/* En la punta del poste (el grupo se escala con la distancia). */}
      <Html position={[0, 1, 0]} zIndexRange={[selected ? 30 : 20, 10]}>
        <button
          ref={register}
          type="button"
          className="poi-pin group absolute left-0 top-0 flex items-center gap-2.5 -translate-x-[28px] -translate-y-[56px] border-0 bg-transparent p-0 cursor-pointer pointer-events-auto select-none transition-[opacity,filter] duration-300 data-[occluded=true]:opacity-40 data-[occluded=true]:grayscale disabled:cursor-default"
          data-selected={selected || undefined}
          data-state={state}
          onClick={locked ? undefined : onSelect}
          disabled={locked}
          aria-label={name}
        >
          <span
            className="relative flex-none flex items-center justify-center w-14 h-14 rounded-full bg-cream shadow-[0_6px_14px_rgba(0,0,0,0.4)] ring-[5px] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-bottom group-hover:scale-105 group-data-[selected=true]:scale-110 group-data-[mini=true]:scale-[0.3] group-data-[mini=true]:[&>svg]:opacity-0 group-data-[selected=true]:shadow-[0_0_0_9px_rgba(243,236,220,0.85),0_8px_18px_rgba(0,0,0,0.45)] group-data-[state=bloqueado]:grayscale group-data-[state=bloqueado]:opacity-80"
            style={{ '--tw-ring-color': layer.color, color: layer.color }}
          >
            {locked ? (
              <Lock size={20} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              getPoiIcon(layer, name)
            )}
            {state === 'visitado' && (
              <span
                className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-forest-light text-white ring-2 ring-cream"
                aria-hidden="true"
              >
                <Check size={14} strokeWidth={3.2} />
              </span>
            )}
          </span>
          <span className="poi-pin__label px-3.5 py-2 rounded-xl bg-forest/92 text-cream font-bold text-[length:var(--fs-small)] whitespace-nowrap shadow-[0_4px_12px_rgba(0,0,0,0.35)] pointer-events-none group-data-[compact=true]:hidden">
            {name}
          </span>
        </button>
      </Html>
    </group>
  );
}

export default PoiPin;
