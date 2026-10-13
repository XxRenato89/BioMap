import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { layerName } from '../i18n/index.js';
import LayerShape from './LayerShape.jsx';

/**
 * Panel de capas temáticas colapsable estilo wireframe ("CAPAS 3/3 ˅"):
 * Un botón compacto que despliega los interruptores de capas cuando el usuario los necesita,
 * manteniendo el mapa despejado y limpio.
 *
 * @param {{ layers: Array<{ id: number, slug: string, name: string, color: string }>,
 *   visibleLayerIds: Set<number>, counts: Map<number, number>,
 *   onToggle: (id: number) => void }} props
 */
export default function LayerPanel({ layers, visibleLayerIds, counts, onToggle }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);

  const activeCount = layers.filter((l) => visibleLayerIds.has(l.id)).length;
  const totalCount = layers.length;

  return (
    <nav className="flex flex-col gap-2" aria-label={t('layers.nav')}>
      {/* Botón desplegable estilo wireframe: CAPAS  3/3 ˅ */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="glass-light flex items-center justify-between px-4 py-3 rounded-2xl border border-white/70 shadow-soft font-black text-sm uppercase tracking-wider text-ink cursor-pointer hover:bg-white active:scale-98 transition-all"
        aria-expanded={isOpen}
      >
        <span className="font-extrabold text-sm tracking-wider">
          {t('layers.title') || 'CAPAS'}
        </span>
        <span className="flex items-center gap-1.5 font-bold text-sm text-[#44554b]">
          <span>
            {activeCount}/{totalCount}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2.8}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {/* Lista desplegable de capas con interruptores táctiles */}
      {isOpen && (
        <div className="glass-dark flex flex-col gap-2 p-3 rounded-2xl border border-white/15 shadow-panel">
          {layers.map((layer) => {
            const isChecked = visibleLayerIds.has(layer.id);
            return (
              <button
                key={layer.id}
                type="button"
                role="switch"
                aria-checked={isChecked}
                className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all duration-150 cursor-pointer active:scale-98 ${
                  isChecked
                    ? 'bg-white/15 border-white/35 shadow-sm'
                    : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100 hover:bg-white/10'
                }`}
                onClick={() => onToggle(layer.id)}
              >
                <LayerShape layer={layer} size="lg" />
                <span className="flex flex-col text-left flex-1">
                  <span className="font-extrabold text-base text-white leading-snug">
                    {layerName(t, layer)}
                  </span>
                  <span className="text-sm text-mint-muted">
                    {t('layers.count', { count: counts.get(layer.id) ?? 0 })}
                  </span>
                </span>
                <span
                  className={`w-10 h-6 rounded-full relative transition-colors duration-200 flex-none ${
                    isChecked ? 'bg-[#2a8a55]' : 'bg-white/20'
                  }`}
                  aria-hidden="true"
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                      isChecked ? 'left-5' : 'left-1'
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
