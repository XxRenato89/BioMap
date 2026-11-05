import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './api.js';
import { Button, Notice, inputClass } from './ui.jsx';

/**
 * Capas temáticas: nombre, color, orden y si se muestran en el kiosco.
 */
export default function LayersView({ onAuthError }) {
  const [layers, setLayers] = useState([]);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    try {
      setLayers(await adminApi('GET', '/layers'));
    } catch (error) {
      onAuthError(error);
      setMessage({ tone: 'error', text: error.message });
    }
  }, [onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const edit = (id, key, value) =>
    setLayers(layers.map((l) => (l.id === id ? { ...l, [key]: value } : l)));

  const save = async (layer) => {
    try {
      await adminApi('PATCH', `/layers/${layer.id}`, {
        name: layer.name,
        color: layer.color,
        sortOrder: Number(layer.sortOrder),
        isActive: layer.isActive,
      });
      setMessage({ tone: 'ok', text: `Capa "${layer.name}" guardada.` });
      await load();
    } catch (error) {
      onAuthError(error);
      setMessage({ tone: 'error', text: error.message });
    }
  };

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <h2 className="m-0 text-lg font-extrabold text-forest">Capas temáticas</h2>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <table className="w-full border-collapse rounded-xl bg-white text-left">
        <thead>
          <tr className="text-sm text-muted">
            <th className="p-3">Nombre</th>
            <th className="p-3">Color</th>
            <th className="p-3">Orden</th>
            <th className="p-3">Visible</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {layers.map((layer) => (
            <tr key={layer.id} className="border-t border-forest/10">
              <td className="p-3">
                <input
                  className={inputClass}
                  aria-label="Nombre de la capa"
                  value={layer.name}
                  onChange={(e) => edit(layer.id, 'name', e.target.value)}
                />
              </td>
              <td className="p-3">
                <input
                  type="color"
                  aria-label="Color de la capa"
                  value={layer.color}
                  onChange={(e) => edit(layer.id, 'color', e.target.value)}
                />
              </td>
              <td className="p-3">
                <input
                  className={`${inputClass} w-20`}
                  type="number"
                  min={0}
                  aria-label="Orden"
                  value={layer.sortOrder}
                  onChange={(e) => edit(layer.id, 'sortOrder', e.target.value)}
                />
              </td>
              <td className="p-3">
                <input
                  type="checkbox"
                  aria-label="Visible en el kiosco"
                  checked={layer.isActive}
                  onChange={(e) => edit(layer.id, 'isActive', e.target.checked)}
                />
              </td>
              <td className="p-3">
                <Button onClick={() => save(layer)}>Guardar</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
