import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './api.js';
import { Field, Notice, inputClass } from './ui.jsx';

/* Fecha local AAAA-MM-DD (la de Chile en el kiosco, no la UTC). */
const day = (date) => date.toLocaleDateString('sv-SE');

/**
 * Visitas por lugar y por día en un período, con descarga en CSV (Excel).
 */
export default function StatsView({ onAuthError }) {
  const today = new Date();
  const [from, setFrom] = useState(day(new Date(today.getTime() - 29 * 86_400_000)));
  const [to, setTo] = useState(day(today));
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const query = new URLSearchParams({ from, to }).toString();

  const load = useCallback(async () => {
    setError(null);
    try {
      setStats(await adminApi('GET', `/stats?${query}`));
    } catch (err) {
      onAuthError(err);
      setError(err.message);
    }
  }, [query, onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const total = stats?.byPoint.reduce((sum, row) => sum + row.visits, 0) ?? 0;
  const tours = stats?.byDay.reduce((sum, row) => sum + row.tours, 0) ?? 0;
  const max = Math.max(1, ...(stats?.byPoint.map((row) => row.visits) ?? []));

  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <h2 className="m-0 mr-auto text-lg font-extrabold text-forest">Estadísticas de visitas</h2>
        <Field label="Desde">
          <input
            className={inputClass}
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Hasta">
          <input
            className={inputClass}
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <a
          href={`/api/admin/stats.csv?${query}`}
          className="rounded-lg bg-forest px-4 py-2 font-bold text-cream no-underline hover:bg-forest-dark"
          download
        >
          Descargar CSV
        </a>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-white p-4">
          <p className="m-0 text-sm text-muted">Fichas de lugares abiertas</p>
          <p className="m-0 font-display text-3xl font-extrabold text-forest">{total}</p>
        </div>
        <div className="rounded-xl bg-white p-4">
          <p className="m-0 text-sm text-muted">Recorridos completos</p>
          <p className="m-0 font-display text-3xl font-extrabold text-forest">{tours}</p>
        </div>
      </div>
      <table className="w-full border-collapse rounded-xl bg-white text-left">
        <thead>
          <tr className="text-sm text-muted">
            <th className="p-3">Lugar</th>
            <th className="p-3 w-1/2">Visitas</th>
          </tr>
        </thead>
        <tbody>
          {stats?.byPoint.map((row) => (
            <tr key={row.id} className="border-t border-forest/10">
              <td className="p-3">{row.name}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 rounded-full bg-forest-light"
                    style={{ width: `${(row.visits / max) * 100}%`, minWidth: row.visits ? 4 : 0 }}
                  />
                  <span className="text-sm font-bold">{row.visits}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
