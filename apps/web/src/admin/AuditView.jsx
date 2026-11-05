import { useEffect, useState } from 'react';
import { adminApi } from './api.js';
import { Notice } from './ui.jsx';

const ACTIONS = { create: 'Creó', update: 'Editó', delete: 'Eliminó', restore: 'Restauró' };
const ENTITIES = { point: 'lugar', image: 'foto', layer: 'capa' };

/**
 * Historial: los últimos 100 cambios hechos desde el panel.
 */
export default function AuditView({ onAuthError }) {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi('GET', '/audit')
      .then(setEntries)
      .catch((err) => {
        onAuthError(err);
        setError(err.message);
      });
  }, [onAuthError]);

  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <h2 className="m-0 text-lg font-extrabold text-forest">Historial de cambios</h2>
      {error && <Notice tone="error">{error}</Notice>}
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-lg bg-white px-4 py-2">
            <span className="text-sm text-muted">
              {new Date(entry.createdAt).toLocaleString('es-CL')} · {entry.username ?? 'sistema'}
            </span>
            <p className="m-0">
              {ACTIONS[entry.action]} {ENTITIES[entry.entity]} #{entry.entityId}
              {entry.details?.name ? ` — ${entry.details.name}` : ''}
            </p>
          </li>
        ))}
        {entries.length === 0 && !error && <li className="text-muted">Aún no hay cambios.</li>}
      </ol>
    </section>
  );
}
