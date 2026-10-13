import { useTranslation } from 'react-i18next';
import { levelForRange } from '../diorama/utils/cameraMath.js';
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
    <div className="flex flex-col items-center gap-2">
      <div
        className="glass-dark flex p-1.5 gap-1.5 rounded-3xl border border-white/20 shadow-panel"
        role="group"
        aria-label={t('levels.group')}
      >
        {LEVELS.map((level) => {
          const isSelected = active === level;
          return (
            <button
              key={level}
              type="button"
              className={`flex flex-col items-center justify-center min-h-[56px] min-w-[124px] px-4 py-1.5 rounded-2xl cursor-pointer transition-all duration-200 active:scale-95 ${
                isSelected
                  ? 'bg-forest text-white shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              aria-pressed={isSelected}
              onClick={() => onPick(levels[level])}
            >
              <span className="font-extrabold text-base leading-tight">{t(`levels.${level}`)}</span>
              <span
                className={`text-sm mt-0.5 leading-tight ${
                  isSelected ? 'text-white/85' : 'text-mint-muted'
                }`}
              >
                {t(`levels.${level}Hint`)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm font-medium text-white/80 flex items-center gap-1.5 m-0 drop-shadow">
        <span>{t('levels.gestures')}</span>
        {restSeconds > 0 && (
          <span className="text-mint font-semibold">
            · {t('levels.rest', { seconds: restSeconds })}
          </span>
        )}
      </p>
    </div>
  );
}
