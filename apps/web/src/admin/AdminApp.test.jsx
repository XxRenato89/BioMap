import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminApp from './AdminApp.jsx';

/**
 * fetch falso de la API del panel: responde según método y ruta.
 */
function fakeApi(routes) {
  return vi.fn(async (url, { method = 'GET' } = {}) => {
    const [status, body] = routes[`${method} ${url}`] ?? [404, { error: { code: 'NOT_FOUND' } }];
    return { ok: status < 300, status, json: async () => body };
  });
}

describe('AdminApp', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks to log in, then forces the change of a temporary password', async () => {
    const api = fakeApi({
      'GET /api/admin/me': [401, { error: { code: 'UNAUTHENTICATED', message: 'Inicia sesión' } }],
      'POST /api/admin/session': [
        200,
        { username: 'admin', mustChangePassword: true, passwordExpiresAt: '2027-02-01T00:00:00Z' },
      ],
    });
    vi.stubGlobal('fetch', api);
    render(<AdminApp />);

    fireEvent.change(await screen.findByLabelText('Contraseña'), {
      target: { value: 'inicial-angostura-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Cambiar contraseña' })).toBeTruthy();
    expect(screen.getByText(/temporal o venció/)).toBeTruthy();
    const [, init] = api.mock.calls.find(([url]) => url === '/api/admin/session');
    expect(JSON.parse(init.body)).toEqual({ username: 'admin', password: 'inicial-angostura-1' });
  });

  it('shows a wrong-password error without leaving the login', async () => {
    vi.stubGlobal(
      'fetch',
      fakeApi({
        'GET /api/admin/me': [401, {}],
        'POST /api/admin/session': [
          401,
          { error: { code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos' } },
        ],
      }),
    );
    render(<AdminApp />);
    fireEvent.change(await screen.findByLabelText('Contraseña'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Usuario o contraseña incorrectos');
  });
});
