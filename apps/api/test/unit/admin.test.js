import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword, passwordProblem, verifyPassword } from '../../src/admin/password.js';
import { createSessionToken, readCookie, readSessionToken } from '../../src/admin/session.js';
import { buildTestApp } from './fakes.js';

const SECRET = 's'.repeat(40);
const BOUNDS = [
  [-71.855, -37.7672],
  [-71.75374, -37.672],
];

describe('passwords', () => {
  it('hashes with a random salt and verifies only the right password', async () => {
    const a = await hashPassword('clave-segura-123');
    expect(a).not.toBe(await hashPassword('clave-segura-123'));
    expect(await verifyPassword('clave-segura-123', a)).toBe(true);
    expect(await verifyPassword('otra-clave-1234', a)).toBe(false);
    expect(await verifyPassword('x', 'basura')).toBe(false);
  });

  it('rejects short, letter-only, username-based or repeated passwords', () => {
    expect(passwordProblem('corta1')).toMatch(/12/);
    expect(passwordProblem('solamenteletras')).toMatch(/números/);
    expect(passwordProblem('admin-angostura-1', { username: 'admin' })).toMatch(/usuario/);
    expect(passwordProblem('angostura-2026', { current: 'angostura-2026' })).toMatch(/distinta/);
    expect(passwordProblem('embalse-biobio-2026', { username: 'admin' })).toBeNull();
  });
});

describe('session tokens', () => {
  const user = { userId: 1, passwordChangedAt: new Date('2026-11-01T00:00:00Z') };

  it('round-trips, and rejects tampered, foreign or expired tokens', () => {
    const now = Date.UTC(2026, 10, 4);
    const token = createSessionToken(user, SECRET, now);
    expect(readSessionToken(token, SECRET, now)).toEqual({
      userId: 1,
      passwordChangedAt: user.passwordChangedAt.getTime(),
    });
    expect(readSessionToken(`${token}x`, SECRET, now)).toBeNull();
    expect(readSessionToken(token, 'o'.repeat(40), now)).toBeNull();
    expect(readSessionToken(token, SECRET, now + 9 * 3600 * 1000)).toBeNull();
  });

  it('reads one cookie from the header', () => {
    expect(readCookie('a=1; biomap_admin=tok%3D; b=2', 'biomap_admin')).toBe('tok=');
    expect(readCookie(undefined, 'biomap_admin')).toBeUndefined();
  });
});

/**
 * Repositorio falso del panel: un administrador en memoria.
 */
function fakeAdminRepository(user) {
  const state = { attempts: [], points: [], audit: [], visits: [] };
  return {
    state,
    async findUserByUsername(name) {
      return name === user.username ? user : null;
    },
    async findUserById(id) {
      return id === user.id ? user : null;
    },
    async recordLoginAttempt(attempt) {
      state.attempts.push(attempt);
    },
    async countFailures(name) {
      return state.attempts.filter((a) => a.username === name && !a.succeeded).length;
    },
    async markLogin() {},
    async setPassword(_id, hash) {
      user.passwordHash = hash;
      user.passwordChangedAt = new Date();
      user.mustChangePassword = false;
      return user.passwordChangedAt;
    },
    async createPoint(point) {
      state.points.push(point);
      return state.points.length;
    },
    async findPoint(id) {
      return { id, ...state.points[id - 1] };
    },
    async recordVisit(event) {
      state.visits.push(event);
    },
    async visitStats() {
      return {
        byPoint: [{ id: 1, name: '=HYPERLINK("x")', visits: 3 }],
        byDay: [{ day: '2026-11-03', visits: 3, tours: 1 }],
      };
    },
  };
}

describe('admin panel routes', () => {
  let hash;
  beforeAll(async () => {
    hash = await hashPassword('inicial-angostura-1');
  });

  function setup({ mustChange = false } = {}) {
    const user = {
      id: 1,
      username: 'admin',
      passwordHash: hash,
      isActive: true,
      passwordChangedAt: new Date(),
      mustChangePassword: mustChange,
    };
    const repo = fakeAdminRepository(user);
    const audit = [];
    const db = {
      async query(_sql, params) {
        audit.push(params);
        return { rows: [{ id: '1' }] };
      },
    };
    const app = buildTestApp({
      db,
      admin: {
        adminRepository: repo,
        sessionSecret: SECRET,
        passwordMaxAgeDays: 90,
        mapBounds: BOUNDS,
      },
    });
    return { app, repo, audit, agent: request.agent(app) };
  }

  const login = (agent, password = 'inicial-angostura-1') =>
    agent.post('/api/admin/session').send({ username: 'admin', password });

  it('needs a session for everything but the login', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/admin/points')).status).toBe(401);
  });

  it('logs in with an HttpOnly, SameSite=Strict cookie, and rejects a wrong password', async () => {
    const { agent } = setup();
    expect((await login(agent, 'mala-clave-0000')).status).toBe(401);
    const res = await login(agent);
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(res.headers['set-cookie'][0]).toMatch(/SameSite=Strict/);
    expect((await agent.get('/api/admin/me')).body.username).toBe('admin');
  });

  it('locks the account after 5 failed attempts, even with the right password', async () => {
    const { agent } = setup();
    for (let i = 0; i < 5; i += 1) await login(agent, `mala-clave-000${i}`);
    expect((await login(agent)).status).toBe(429);
  });

  it('with the initial password, only allows changing it', async () => {
    const { agent } = setup({ mustChange: true });
    await login(agent);
    expect((await agent.get('/api/admin/points')).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    const weak = await agent
      .put('/api/admin/password')
      .send({ current: 'inicial-angostura-1', next: 'corta' });
    expect(weak.status).toBe(400);
    const ok = await agent
      .put('/api/admin/password')
      .send({ current: 'inicial-angostura-1', next: 'embalse-biobio-2026' });
    expect(ok.status).toBe(200);
    expect(ok.body.mustChangePassword).toBe(false);
  });

  it('validates new points against the map bounds and records them in the audit log', async () => {
    const { agent, repo, audit } = setup();
    await login(agent);
    const outside = await agent
      .post('/api/admin/points')
      .send({ name: 'Lejos', layerId: 1, lng: -70, lat: -37.7 });
    expect(outside.status).toBe(400);
    const res = await agent
      .post('/api/admin/points')
      .send({ name: 'Mirador nuevo', layerId: 1, lng: -71.8, lat: -37.72 });
    expect(res.status).toBe(201);
    expect(repo.state.points).toHaveLength(1);
    expect(audit.at(-1)).toEqual([
      1,
      'create',
      'point',
      1,
      JSON.stringify({ name: 'Mirador nuevo' }),
    ]);
  });

  it('records anonymous visits from the viewer', async () => {
    const { app, repo } = setup();
    expect(
      (await request(app).post('/api/events').send({ type: 'point_open', pointId: 3 })).status,
    ).toBe(204);
    expect((await request(app).post('/api/events').send({ type: 'hack' })).status).toBe(400);
    expect(repo.state.visits).toEqual([{ type: 'point_open', pointId: 3 }]);
  });

  it('answers 503 without a database (mock mode)', async () => {
    const res = await request(buildTestApp()).get('/api/admin/me');
    expect(res.status).toBe(503);
  });

  it('exports the stats as an Excel-safe CSV', async () => {
    const { agent } = setup();
    await login(agent);
    const res = await agent.get('/api/admin/stats.csv?from=2026-11-01&to=2026-11-03');
    expect(res.headers['content-disposition']).toMatch(
      /biomap-estadisticas-2026-11-01-a-2026-11-03\.csv/,
    );
    /* Una fórmula en un nombre no se ejecuta al abrir el archivo. */
    expect(res.text).toContain(`"'=HYPERLINK(""x"")";"3"`);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
  });
});
