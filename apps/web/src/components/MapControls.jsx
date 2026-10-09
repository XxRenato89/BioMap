import { Minus, Mountain, Plus, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Controles del mapa para quien no domina los gestos táctiles.
 *
 * @param {{ onZoomIn: () => void, onZoomOut: () => void, pitched: boolean,
 *   onTogglePitch: () => void, contours?: boolean, onToggleContours?: () => void,
 *   onReset: () => void }} props
 */
export default function MapControls({
  onZoomIn,
  onZoomOut,
  pitched,
  onTogglePitch,
  contours = true,
  onToggleContours,
  onReset,
}) {
  const { t } = useTranslation();
  return (
    <div className="controls" role="group" aria-label={t('controls.group')}>
      <div className="zoom-stack glass-light">
        <button
          type="button"
          className="icon-button"
          aria-label={t('controls.zoomIn')}
          onClick={onZoomIn}
        >
          <Plus size={32} strokeWidth={2.6} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={t('controls.zoomOut')}
          onClick={onZoomOut}
        >
          <Minus size={32} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className="tilt-button"
        aria-label={t('controls.tilt')}
        aria-pressed={pitched}
        onClick={onTogglePitch}
      >
        3D
      </button>
      {onToggleContours && (
        <button
          type="button"
          className="tilt-button"
          aria-label={t('controls.contours')}
          title={t('controls.contours')}
          aria-pressed={contours}
          onClick={onToggleContours}
        >
          <Mountain size={34} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}
      <button type="button" className="primary-button" onClick={onReset}>
        <RotateCcw size={28} strokeWidth={2.4} aria-hidden="true" />
        {t('controls.reset')}
      </button>
    </div>
  );
}
