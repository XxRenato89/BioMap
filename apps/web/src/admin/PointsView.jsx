import { useCallback, useEffect, useState } from 'react';
import { config } from '../config.js';
import { adminApi } from './api.js';
import { Button, Field, Notice, inputClass } from './ui.jsx';

const EMPTY = {
  name: '',
  description: '',
  layerId: '',
  lng: '',
  lat: '',
  tourStop: '',
  isSecret: false,
};
const [[WEST, SOUTH], [EAST, NORTH]] = config.maxBounds;

/** Posición (%) de una coordenada sobre la foto de la maqueta (norte arriba). */
const toPercent = (lng, lat) => ({
  left: `${((lng - WEST) / (EAST - WEST)) * 100}%`,
  top: `${((NORTH - lat) / (NORTH - SOUTH)) * 100}%`,
});

/**
 * Lugares: mapa de la maqueta (foto satelital) para ubicarlos con un clic,
 * la lista y el formulario de cada uno, con sus fotos.
 */
export default function PointsView({ onAuthError }) {
  const [points, setPoints] = useState([]);
  const [layers, setLayers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([adminApi('GET', '/points'), adminApi('GET', '/layers')]);
      setPoints(p);
      setLayers(l);
    } catch (error) {
      onAuthError(error);
      setMessage({ tone: 'error', text: error.message });
    }
  }, [onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  const select = (point) => {
    setSelectedId(point?.id ?? null);
    setMessage(null);
    setForm(
      point
        ? {
            name: point.name,
            description: point.description,
            layerId: String(point.layerId),
            lng: String(point.lng),
            lat: String(point.lat),
            tourStop: point.tourStop ? String(point.tourStop) : '',
            isSecret: point.isSecret,
          }
        : { ...EMPTY, layerId: String(layers[0]?.id ?? '') },
    );
  };

  const selected = points.find((p) => p.id === selectedId) ?? null;
  const set = (key) => (event) =>
    setForm({
      ...form,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    });

  /* Clic en el mapa: esas son las coordenadas del lugar. */
  const pickOnMap = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const lng = WEST + ((event.clientX - box.left) / box.width) * (EAST - WEST);
    const lat = NORTH - ((event.clientY - box.top) / box.height) * (NORTH - SOUTH);
    setForm({ ...form, lng: lng.toFixed(6), lat: lat.toFixed(6) });
  };

  const run = async (work, okText) => {
    setMessage(null);
    try {
      const result = await work();
      await load();
      setMessage({ tone: 'ok', text: okText });
      return result;
    } catch (error) {
      onAuthError(error);
      setMessage({ tone: 'error', text: error.message });
      return null;
    }
  };

  const save = async (event) => {
    event.preventDefault();
    const body = {
      name: form.name,
      description: form.description,
      layerId: Number(form.layerId),
      lng: Number(form.lng),
      lat: Number(form.lat),
      tourStop: form.tourStop ? Number(form.tourStop) : null,
      isSecret: form.isSecret,
    };
    const saved = await run(
      () =>
        selected
          ? adminApi('PATCH', `/points/${selected.id}`, body)
          : adminApi('POST', '/points', body),
      selected
        ? 'Cambios guardados. El kiosco los muestra en menos de un minuto.'
        : 'Lugar creado.',
    );
    if (saved && !selected) setSelectedId(saved.id);
  };

  const visible = points.filter((p) => showDeleted || !p.deletedAt);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_minmax(380px,1fr)]">
      <section
        className="flex flex-col gap-3"
        style={{ width: 'min(100%, calc(75vh * 2048 / 2434))' }}
      >
        <div className="flex items-center gap-3">
          <h2 className="m-0 text-lg font-extrabold text-forest">Mapa de la maqueta</h2>
          <span className="text-sm text-muted">
            Haz clic en el mapa para ubicar el lugar que estás editando.
          </span>
        </div>
        <div
          className="relative w-full cursor-crosshair overflow-hidden rounded-xl bg-forest/20"
          /* Mismas proporciones que la foto (public/diorama/terrain.json: 2048 × 2434). */
          style={{
            aspectRatio: '2048 / 2434',
            width: 'calc(75vh * 2048 / 2434)',
            maxWidth: '100%',
          }}
          onClick={pickOnMap}
          role="presentation"
        >
          <img
            src="/diorama/surface.webp"
            alt="Foto satelital de la zona de Angostura"
            className="absolute inset-0 h-full w-full select-none"
            draggable={false}
          />
          {visible.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.name}
              aria-label={`Editar ${p.name}`}
              onClick={(event) => {
                event.stopPropagation();
                select(p);
              }}
              className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white cursor-pointer ${
                p.deletedAt
                  ? 'bg-gray-400'
                  : p.id === selectedId
                    ? 'bg-amber-400 scale-150'
                    : 'bg-forest-light'
              }`}
              style={toPercent(p.lng, p.lat)}
            />
          ))}
          {form.lng && form.lat && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-400"
              style={toPercent(Number(form.lng), Number(form.lat))}
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="m-0 text-lg font-extrabold text-forest">Lugares ({visible.length})</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            Mostrar eliminados
          </label>
          <Button onClick={() => select(null)}>+ Nuevo lugar</Button>
        </div>
        <ul className="m-0 grid list-none gap-1 p-0 sm:grid-cols-2">
          {visible.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => select(p)}
                className={`w-full rounded-lg border px-3 py-2 text-left cursor-pointer ${
                  p.id === selectedId
                    ? 'border-forest bg-white'
                    : 'border-transparent bg-white/60 hover:bg-white'
                } ${p.deletedAt ? 'text-gray-400 line-through' : ''}`}
              >
                <span className="font-bold">{p.name}</span>
                <span className="block text-xs text-muted">
                  {layers.find((l) => l.id === p.layerId)?.name}
                  {p.tourStop ? ` · parada ${p.tourStop}` : ''}
                  {p.isSecret ? ' · secreto' : ''} · {p.images.length} fotos
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4 self-start rounded-2xl bg-white p-6 shadow-sm lg:sticky lg:top-6">
        <h2 className="m-0 text-lg font-extrabold text-forest">
          {selected ? `Editar: ${selected.name}` : 'Nuevo lugar'}
        </h2>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <form onSubmit={save} className="flex flex-col gap-3">
          <Field label="Nombre">
            <input
              className={inputClass}
              value={form.name}
              onChange={set('name')}
              maxLength={120}
              required
            />
          </Field>
          <Field label="Historia (texto de la ficha)">
            <textarea
              className={`${inputClass} min-h-40`}
              value={form.description}
              onChange={set('description')}
              maxLength={5000}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capa">
              <select
                className={inputClass}
                value={form.layerId}
                onChange={set('layerId')}
                required
              >
                <option value="" disabled>
                  Elige…
                </option>
                {layers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Parada del recorrido" hint="Vacío: no está en el recorrido">
              <input
                className={inputClass}
                type="number"
                min={1}
                max={99}
                value={form.tourStop}
                onChange={set('tourStop')}
              />
            </Field>
            <Field label="Longitud">
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.lng}
                onChange={set('lng')}
                required
              />
            </Field>
            <Field label="Latitud">
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.lat}
                onChange={set('lat')}
                required
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isSecret} onChange={set('isSecret')} />
            Lugar secreto (aparece cuando la mascota pasa cerca)
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">{selected ? 'Guardar cambios' : 'Crear lugar'}</Button>
            {selected && !selected.deletedAt && (
              <Button
                variant="danger"
                onClick={() =>
                  window.confirm(`¿Eliminar "${selected.name}"? Podrás restaurarlo después.`) &&
                  run(() => adminApi('DELETE', `/points/${selected.id}`), 'Lugar eliminado.')
                }
              >
                Eliminar
              </Button>
            )}
            {selected?.deletedAt && (
              <Button
                onClick={() =>
                  run(() => adminApi('POST', `/points/${selected.id}/restore`), 'Lugar restaurado.')
                }
              >
                Restaurar
              </Button>
            )}
          </div>
        </form>
        {selected && !selected.deletedAt && <Images point={selected} run={run} />}
      </section>
    </div>
  );
}

/**
 * Fotos del lugar: subir, marcar la principal, editar el crédito y quitar.
 */
function Images({ point, run }) {
  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState('');
  const [credit, setCredit] = useState('');
  const [kind, setKind] = useState('photo');

  const upload = async (event) => {
    event.preventDefault();
    const query = new URLSearchParams({
      altText,
      credit,
      kind,
      isMain: String(point.images.length === 0),
    });
    const done = await run(
      () => adminApi('POST', `/points/${point.id}/images?${query}`, file),
      'Foto agregada.',
    );
    if (done) {
      setFile(null);
      setAltText('');
      event.target.reset();
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-forest/10 pt-4">
      <h3 className="m-0 font-extrabold text-forest">Fotos ({point.images.length})</h3>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
        {point.images.map((image) => (
          <li key={image.id} className="flex flex-col gap-1 rounded-lg bg-land p-2 text-xs">
            <img
              src={image.url}
              alt={image.altText}
              className="aspect-video w-full rounded object-cover"
            />
            <span className="font-bold">
              {image.isMain ? '★ Principal' : image.kind === 'panorama' ? '360°' : 'Foto'}
            </span>
            <span className="text-muted">{image.credit}</span>
            <div className="flex gap-1">
              {!image.isMain && image.kind === 'photo' && (
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    run(
                      () => adminApi('PATCH', `/images/${image.id}`, { isMain: true }),
                      'Foto principal cambiada.',
                    )
                  }
                >
                  Hacer principal
                </Button>
              )}
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() => {
                  const next = window.prompt('Crédito de la foto', image.credit);
                  if (next)
                    run(
                      () => adminApi('PATCH', `/images/${image.id}`, { credit: next }),
                      'Crédito actualizado.',
                    );
                }}
              >
                Crédito
              </Button>
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs text-red-700"
                onClick={() =>
                  window.confirm('¿Quitar esta foto del lugar?') &&
                  run(() => adminApi('DELETE', `/images/${image.id}`), 'Foto quitada.')
                }
              >
                Quitar
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <form
        onSubmit={upload}
        className="flex flex-col gap-2 rounded-lg border border-dashed border-forest/30 p-3"
      >
        <Field label="Nueva foto (JPG, PNG o WebP, hasta 10 MB)">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files[0] ?? null)}
            required
          />
        </Field>
        <Field label="Descripción para lectores de pantalla">
          <input
            className={inputClass}
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            maxLength={300}
            required
          />
        </Field>
        <Field label="Crédito (autor o fuente)">
          <input
            className={inputClass}
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            maxLength={200}
            required
          />
        </Field>
        <Field label="Tipo">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="photo">Foto</option>
            <option value="panorama">Panorama 360°</option>
          </select>
        </Field>
        <Button type="submit" disabled={!file}>
          Subir foto
        </Button>
      </form>
    </div>
  );
}
