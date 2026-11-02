import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { layerName } from '../i18n/index.js';
import { layerShape } from '../map/shapes.js';

/* Marca de la capa: su forma (para no depender solo del color) en su color. */
function Mark({ layer }) {
  const shape = layerShape(layer);
  return (
    <span
      className={`inline-block h-4 w-4 flex-none ${shape === 'circle' ? 'rounded-full' : shape === 'square' ? 'rounded-[3px]' : 'rotate-45 rounded-[2px]'}`}
      style={{ backgroundColor: layer.color }}
      aria-hidden="true"
    />
  );
}

/**
 * Capas temáticas: lo que en el kiosco se quitó por exceso, aquí sí va. Cada
 * persona elige qué lugares ver en su mapa.
 *
 * @param {{ layers: Array<object>, hidden: Set<number>, counts: Map<number, number>,
 *   onToggle: (id: number) => void, onClose: () => void }} props
 */
export default function LayersSheet({ layers, hidden, counts, onToggle, onClose }) {
  const { t } = useTranslation();
  return (
    <section
      className="absolute inset-x-0 bottom-0 z-30 rounded-t-[28px] bg-cream px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] text-forest shadow-[0_-8px_30px_rgba(20,51,77,0.3)]"
      role="dialog"
      aria-label={t('m.layers')}
    >
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-forest/20" aria-hidden="true" />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">{t('m.layers')}</h2>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border-0 bg-transparent text-forest"
          aria-label={t('settings.close')}
          onClick={onClose}
        >
          <X size={24} aria-hidden="true" />
        </button>
      </div>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {layers.map((layer) => {
          const on = !hidden.has(layer.id);
          return (
            <li key={layer.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border-0 px-4 text-left ${on ? 'bg-forest-light/12' : 'bg-forest/5'}`}
                onClick={() => onToggle(layer.id)}
              >
                <Mark layer={layer} />
                <span className="flex-1">
                  <span className="block text-lg font-bold">{layerName(t, layer)}</span>
                  <span className="block text-sm text-muted">
                    {t('layers.count', { count: counts.get(layer.id) ?? 0 })}
                  </span>
                </span>
                <span
                  className={`flex h-8 w-14 flex-none items-center rounded-full p-1 transition-colors ${on ? 'bg-forest-light' : 'bg-forest/25'}`}
                  aria-hidden="true"
                >
                  <span
                    className={`h-6 w-6 rounded-full bg-white transition-transform ${on ? 'translate-x-6' : ''}`}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
