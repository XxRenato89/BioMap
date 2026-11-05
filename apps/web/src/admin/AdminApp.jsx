import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './api.js';
import AuditView from './AuditView.jsx';
import LayersView from './LayersView.jsx';
import PointsView from './PointsView.jsx';
import StatsView from './StatsView.jsx';
import { Button, Field, Notice, inputClass } from './ui.jsx';

const TABS = [
  ['points', 'Lugares'],
  ['layers', 'Capas'],
  ['stats', 'Estadísticas'],
  ['audit', 'Historial'],
];

/**
 * Panel de administración de BioMap (/admin): un único administrador edita
 * los lugares, sus fotos y las capas, y descarga las estadísticas de visitas.
 */
export default function AdminApp() {
  /* undefined: cargando; null: sin sesión. */
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState('points');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    document.title = 'BioMap · Administración';
    adminApi('GET', '/me')
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const logout = useCallback(async () => {
    await adminApi('DELETE', '/session').catch(() => {});
    setUser(null);
  }, []);

  /* Si la sesión vence en medio del trabajo, vuelve al ingreso. */
  const onAuthError = useCallback((error) => {
    if (error?.status === 401) setUser(null);
    if (error?.code === 'PASSWORD_CHANGE_REQUIRED') setChangingPassword(true);
  }, []);

  let content;
  if (user === undefined) content = <p className="p-10 text-muted">Cargando…</p>;
  else if (user === null) content = <Login onLogin={setUser} />;
  else if (user.mustChangePassword || changingPassword) {
    content = (
      <ChangePassword
        forced={user.mustChangePassword}
        onDone={(next) => {
          setUser(next);
          setChangingPassword(false);
        }}
        onCancel={user.mustChangePassword ? logout : () => setChangingPassword(false)}
      />
    );
  } else {
    const View = { points: PointsView, layers: LayersView, stats: StatsView, audit: AuditView }[
      tab
    ];
    content = (
      <>
        <header className="flex flex-wrap items-center gap-4 border-b border-forest/10 bg-white px-6 py-3">
          <h1 className="m-0 font-display text-xl font-extrabold text-forest">
            BioMap · Administración
          </h1>
          <nav className="flex gap-1" aria-label="Secciones">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-current={tab === id ? 'page' : undefined}
                className={`rounded-lg px-4 py-2 font-bold cursor-pointer ${
                  tab === id ? 'bg-forest text-cream' : 'text-forest hover:bg-forest/10'
                }`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted">
            <span>
              {user.username} · contraseña vigente hasta{' '}
              {new Date(user.passwordExpiresAt).toLocaleDateString('es-CL')}
            </span>
            <Button variant="ghost" onClick={() => setChangingPassword(true)}>
              Cambiar contraseña
            </Button>
            <Button variant="ghost" onClick={logout}>
              Salir
            </Button>
          </div>
        </header>
        <main className="p-6">
          <View onAuthError={onAuthError} />
        </main>
      </>
    );
  }

  return <div className="fixed inset-0 overflow-auto select-text bg-land text-ink">{content}</div>;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(await adminApi('POST', '/session', { username, password }));
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-24 flex max-w-sm flex-col gap-4 rounded-2xl bg-white p-8 shadow-lg"
    >
      <h1 className="m-0 font-display text-2xl font-extrabold text-forest">BioMap</h1>
      <p className="m-0 text-muted">Panel de administración</p>
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Usuario">
        <input
          className={inputClass}
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </Field>
      <Field label="Contraseña">
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}

function ChangePassword({ forced, onDone, onCancel }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (next !== repeat) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(await adminApi('PUT', '/password', { current, next }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-16 flex max-w-md flex-col gap-4 rounded-2xl bg-white p-8 shadow-lg"
    >
      <h1 className="m-0 font-display text-2xl font-extrabold text-forest">Cambiar contraseña</h1>
      {forced && (
        <Notice tone="warning">
          Tu contraseña es temporal o venció. Elige una nueva para continuar.
        </Notice>
      )}
      <p className="m-0 text-sm text-muted">
        Al menos 12 caracteres, con letras y números, sin tu nombre de usuario.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Contraseña actual">
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </Field>
      <Field label="Contraseña nueva">
        <input
          className={inputClass}
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </Field>
      <Field label="Repite la contraseña nueva">
        <input
          className={inputClass}
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          required
        />
      </Field>
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          Guardar
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {forced ? 'Salir' : 'Cancelar'}
        </Button>
      </div>
    </form>
  );
}
