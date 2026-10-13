import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FastForward } from 'lucide-react';
import { useAvatarStore } from '../store/avatarStore.js';

/**
 * Botón flotante accesible que aparece tras 3 segundos de caminata continua
 * si el visitante en quiosco desea trasladarse directamente al hito sin esperar.
 */
export default function SkipWalkButton() {
  const { t } = useTranslation();
  const mode = useAvatarStore((state) => state.mode);
  const skipWalk = useAvatarStore((state) => state.skipWalk);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer = null;
    if (mode === 'running_to_point') {
      timer = setTimeout(() => {
        setVisible(true);
      }, 3000);
    } else {
      setVisible(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [mode]);

  if (!visible || mode !== 'running_to_point') return null;

  return (
    <div
      className="fixed left-1/2 bottom-24 -translate-x-1/2 z-50 pointer-events-auto"
      role="region"
      aria-label="Control de animación"
    >
      <button
        type="button"
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent hover:bg-orange-600 text-white border-2 border-white/90 text-sm font-extrabold shadow-[0_8px_24px_rgba(217,99,26,0.45)] cursor-pointer transition-all duration-150 hover:-translate-y-0.5 active:scale-95"
        onClick={skipWalk}
        aria-label={t('skip') || 'Saltar caminata'}
      >
        <FastForward size={18} strokeWidth={2.4} aria-hidden="true" />
        <span>{t('skip') || 'Saltar caminata'}</span>
      </button>
    </div>
  );
}
