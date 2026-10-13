import { Minus, Mountain, Plus, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Controles de navegación del mapa para pantalla táctil, inspirados en el wireframe:
 * - Bloque vertical compacto unificado: [+] Zoom In, [-] Zoom Out, [3D] Inclinación.
 * - Botón inferior [↺ Reiniciar vista] para restaurar el encuadre territorial original.
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
    <div className="flex flex-col gap-2.5 items-end" role="group" aria-label={t('controls.group')}>
      {/* Bloque vertical unificado estilo wireframe: [ + ] [ - ] [ 3D ] */}
      <div className="glass-light flex flex-col rounded-2xl overflow-hidden border border-white/70 shadow-panel w-14">
        <button
          type="button"
          className="flex items-center justify-center w-14 h-13 text-ink hover:bg-white active:scale-95 transition-colors cursor-pointer border-b border-black/10"
          aria-label={t('controls.zoomIn')}
          onClick={onZoomIn}
        >
          <Plus size={26} strokeWidth={2.8} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="flex items-center justify-center w-14 h-13 text-ink hover:bg-white active:scale-95 transition-colors cursor-pointer border-b border-black/10"
          aria-label={t('controls.zoomOut')}
          onClick={onZoomOut}
        >
          <Minus size={26} strokeWidth={2.8} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`flex items-center justify-center w-14 h-13 font-black text-sm tracking-wider transition-all active:scale-95 cursor-pointer ${
            pitched ? 'bg-forest text-white' : 'text-ink hover:bg-white'
          }`}
          aria-label={t('controls.tilt')}
          aria-pressed={pitched}
          onClick={onTogglePitch}
        >
          3D
        </button>
      </div>

      {/* Botón opcional de curvas de nivel si está activo */}
      {onToggleContours && (
        <button
          type="button"
          className={`glass-light flex items-center justify-center w-14 h-12 rounded-2xl border border-white/70 shadow-panel transition-all active:scale-95 cursor-pointer ${
            contours ? 'bg-forest text-white' : 'text-ink hover:bg-white'
          }`}
          aria-label={t('controls.contours')}
          title={t('controls.contours')}
          aria-pressed={contours}
          onClick={onToggleContours}
        >
          <Mountain size={24} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}

      {/* Botón inferior: ↺ Reiniciar vista */}
      <button
        type="button"
        className="glass-light inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/70 shadow-panel font-extrabold text-sm text-ink hover:bg-white active:scale-95 transition-all cursor-pointer whitespace-nowrap"
        onClick={onReset}
      >
        <RotateCcw size={16} strokeWidth={2.6} aria-hidden="true" />
        <span>{t('controls.reset') || 'Reiniciar vista'}</span>
      </button>
    </div>
  );
}
