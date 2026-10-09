import { useTranslation } from 'react-i18next';
import { levelForRange } from '../diorama/cameraMath.js';
import { useViewsStore } from '../store/viewsStore.js';

const LEVELS = ['region', 'zone', 'detail'];

/**
 * Selector «Región · Zona · Detalle» de la vista general: tres distancias de
 * cámara con nombre, más fáciles de entender que un zoom numérico.
 *
 * @param {{ levels: { region: number, zone: number, detail: number },
 *   onPick: (range: number) => void, restSeconds?: number }} props
 */
export default function ZoomLevels({ levels, onPick, restSeconds }) {
  const { t } = useTranslation();
  const active = useViewsStore((state) =>
    state.main ? levelForRange(state.main.range, levels) : 'zone',
  );
  return (
    <div className="zoom-levels">
      <div className="segmented glass-dark" role="group" aria-label={t('levels.group')}>
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={active === level}
            onClick={() => onPick(levels[level])}
          >
            <span className="segmented__name">{t(`levels.${level}`)}</span>
            <span className="segmented__hint">{t(`levels.${level}Hint`)}</span>
          </button>
        ))}
      </div>
      <p className="gesture-hint">
        {t('levels.gestures')}
        {restSeconds > 0 && (
          <span className="gesture-hint__rest">{t('levels.rest', { seconds: restSeconds })}</span>
        )}
      </p>
    </div>
  );
}
