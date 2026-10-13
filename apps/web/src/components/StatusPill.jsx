import { useTranslation } from 'react-i18next';

/**
 * Estado del visor: «100 % local · sin internet» cuando todo funciona, o el
 * aviso de conexión o del mapa base cuando algo falla.
 *
 * @param {{ messages: string[] }} props
 */
export default function StatusPill({ messages }) {
  const { t } = useTranslation();
  const ok = messages.length === 0;
  return (
    <div
      className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full font-bold text-sm shadow-soft transition-colors ${
        ok ? 'glass-dark text-white' : 'bg-amber-500/90 text-black border border-amber-300'
      }`}
      role="status"
    >
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          ok
            ? 'bg-ok shadow-[0_0_0_4px_rgba(74,222,128,0.25)]'
            : 'bg-black shadow-[0_0_0_4px_rgba(0,0,0,0.2)]'
        }`}
        aria-hidden="true"
      />
      <span>{ok ? t('status.local') : messages.join(' · ')}</span>
    </div>
  );
}
