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
    <div className={`status-pill glass-dark${ok ? '' : ' status-pill--warning'}`} role="status">
      <span className="status-pill__dot" aria-hidden="true" />
      {ok ? t('status.local') : messages.join(' · ')}
    </div>
  );
}
