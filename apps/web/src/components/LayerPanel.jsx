import { useTranslation } from 'react-i18next';
import { layerName } from '../i18n/index.js';
import LayerShape from './LayerShape.jsx';

/**
 * Panel de capas temáticas: un interruptor grande por capa, con su figura y la
 * cantidad de puntos. Usa role="switch" y aria-checked para que los lectores de
 * pantalla anuncien si la capa está encendida.
 *
 * @param {{ layers: Array<{ id: number, slug: string, name: string, color: string }>,
 *   visibleLayerIds: Set<number>, counts: Map<number, number>,
 *   onToggle: (id: number) => void }} props
 */
export default function LayerPanel({ layers, visibleLayerIds, counts, onToggle }) {
  const { t } = useTranslation();
  return (
    <nav className="panel glass-dark layer-panel" aria-label={t('layers.nav')}>
      <h2 className="eyebrow">{t('layers.title')}</h2>
      {layers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          role="switch"
          aria-checked={visibleLayerIds.has(layer.id)}
          className="layer-switch"
          onClick={() => onToggle(layer.id)}
        >
          <LayerShape layer={layer} size="lg" />
          <span className="layer-switch__text">
            <span className="layer-switch__name">{layerName(t, layer)}</span>
            <span className="layer-switch__count">
              {t('layers.count', { count: counts.get(layer.id) ?? 0 })}
            </span>
          </span>
          <span className="toggle" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
