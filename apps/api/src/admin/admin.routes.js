import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import express, { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../audit/audit.service.js';
import { HttpError } from '../http/errors.js';
import { hashPassword, passwordProblem, verifyPassword } from './password.js';
import {
  createSessionToken,
  readCookie,
  readSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from './session.js';

/* Bloqueo por fuerza bruta: tantos fallos en esta ventana bloquean el usuario. */
export const MAX_FAILURES = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/* Marca UTF-8 al inicio del CSV: así Excel muestra bien las tildes. */
const BOM = String.fromCharCode(0xfeff);

/* Fotos que acepta el panel: tipo declarado y sus primeros bytes reales. */
const IMAGE_TYPES = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b.subarray(0, 4).toString('hex') === '89504e47' },
  'image/webp': {
    ext: 'webp',
    magic: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  },
};

const id = z.coerce.number().int().positive().max(2_147_483_647);
const text = (max) => z.string().trim().min(1).max(max);

/**
 * Esquema de un punto. Las coordenadas deben caer dentro de la maqueta.
 *
 * @param {[[number, number], [number, number]]} bounds [[oeste, sur], [este, norte]]
 */
function pointSchema([[west, south], [east, north]]) {
  return z.object({
    name: text(120),
    description: z.string().trim().max(5000).default(''),
    layerId: id,
    lng: z.number().min(west).max(east),
    lat: z.number().min(south).max(north),
    tourStop: z.number().int().min(1).max(99).nullable().optional(),
    isSecret: z.boolean().optional(),
  });
}

const layerChanges = z
  .object({
    name: text(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    sortOrder: z.number().int().min(0).max(1000),
    isActive: z.boolean(),
  })
  .partial();

const imageChanges = z
  .object({
    altText: text(300),
    credit: text(200),
    sortOrder: z.number().int().min(0).max(1000),
    isMain: z.literal(true),
  })
  .partial();

/** Valida `body` con `schema` o responde 400 con el primer problema. */
function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HttpError(
      400,
      'INVALID_INPUT',
      `${issue.path.join('.') || 'body'}: ${issue.message}`,
    );
  }
  return result.data;
}

/** Fecha en que vence la contraseña. */
const expiresAt = (user, maxAgeDays) =>
  new Date(new Date(user.passwordChangedAt).getTime() + maxAgeDays * DAY_MS);

/**
 * Panel de administración (/api/admin). Un único administrador entra con
 * usuario y contraseña; la sesión va en una cookie firmada HttpOnly y
 * SameSite=Strict (otro sitio no puede usarla). Mientras la contraseña sea la
 * inicial o haya vencido, solo puede cambiarla.
 *
 * @param {{ db: { query: Function },
 *   adminRepository: ReturnType<import('./admin.repository.js').createAdminRepository>,
 *   cache: { invalidate: Function }, sessionSecret: string, passwordMaxAgeDays: number,
 *   mapBounds: [[number, number], [number, number]], mediaDir: string, mediaBaseUrl: string,
 *   now?: () => number }} deps
 */
export function createAdminRouter({
  db,
  adminRepository: repo,
  cache,
  sessionSecret,
  passwordMaxAgeDays,
  mapBounds,
  mediaDir,
  mediaBaseUrl,
  now = () => Date.now(),
}) {
  const router = Router();
  const point = pointSchema(mapBounds);

  const setSession = (req, res, user) =>
    res.cookie(
      SESSION_COOKIE,
      createSessionToken(
        { userId: user.id, passwordChangedAt: user.passwordChangedAt },
        sessionSecret,
        now(),
      ),
      {
        httpOnly: true,
        sameSite: 'strict',
        secure: req.secure,
        path: '/api/admin',
        maxAge: SESSION_TTL_MS,
      },
    );

  const describeUser = (user) => ({
    username: user.username,
    mustChangePassword:
      user.mustChangePassword || expiresAt(user, passwordMaxAgeDays) <= new Date(now()),
    passwordExpiresAt: expiresAt(user, passwordMaxAgeDays).toISOString(),
    lastLoginAt: user.lastLoginAt,
  });

  /* Quién está conectado: sesión válida, usuario activo y misma contraseña. */
  async function authenticate(req, _res, next) {
    const session = readSessionToken(
      readCookie(req.headers.cookie, SESSION_COOKIE),
      sessionSecret,
      now(),
    );
    const user = session && (await repo.findUserById(session.userId));
    if (
      !user ||
      !user.isActive ||
      new Date(user.passwordChangedAt).getTime() !== session.passwordChangedAt
    ) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar');
    }
    req.adminUser = user;
    next();
  }

  /* El resto del panel exige una contraseña vigente. */
  function requireCurrentPassword(req, _res, next) {
    if (describeUser(req.adminUser).mustChangePassword) {
      throw new HttpError(403, 'PASSWORD_CHANGE_REQUIRED', 'Debes cambiar tu contraseña');
    }
    next();
  }

  /* Cada cambio: queda en el historial y el visor deja de usar la caché. */
  async function changed(req, action, entity, entityId, details = null) {
    cache.invalidate();
    await recordAudit(db, {
      userId: req.adminUser.id,
      action,
      entity,
      entityId,
      details,
    });
  }

  router.post('/session', async (req, res) => {
    const { username, password } = parse(
      z.object({ username: text(60), password: z.string().min(1).max(200) }),
      req.body,
    );
    const failures = await repo.countFailures(username, new Date(now() - LOCKOUT_MS));
    if (failures >= MAX_FAILURES) {
      throw new HttpError(429, 'LOCKED', 'Demasiados intentos. Espera 15 minutos.');
    }
    const user = await repo.findUserByUsername(username);
    const ok = Boolean(user?.isActive) && (await verifyPassword(password, user.passwordHash));
    await repo.recordLoginAttempt({ username, ip: req.ip, succeeded: ok });
    if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos');
    await repo.markLogin(user.id);
    setSession(req, res, user);
    res.json(describeUser(user));
  });

  router.delete('/session', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/api/admin' });
    res.status(204).end();
  });

  router.use(authenticate);

  router.get('/me', (req, res) => res.json(describeUser(req.adminUser)));

  router.put('/password', async (req, res) => {
    const { current, next } = parse(
      z.object({ current: z.string().min(1).max(200), next: z.string().max(200) }),
      req.body,
    );
    const user = req.adminUser;
    if (!(await verifyPassword(current, user.passwordHash))) {
      throw new HttpError(400, 'WRONG_PASSWORD', 'La contraseña actual no es correcta');
    }
    const problem = passwordProblem(next, { username: user.username, current });
    if (problem) throw new HttpError(400, 'WEAK_PASSWORD', problem);
    const changedAt = await repo.setPassword(user.id, await hashPassword(next));
    const updated = { ...user, passwordChangedAt: changedAt, mustChangePassword: false };
    setSession(req, res, updated);
    res.json(describeUser(updated));
  });

  router.use(requireCurrentPassword);

  router.get('/points', async (_req, res) => {
    const points = await repo.listPoints();
    res.json(
      points.map((p) => ({
        ...p,
        images: p.images.map((image) => ({ ...image, url: `${mediaBaseUrl}/${image.filePath}` })),
      })),
    );
  });

  router.post('/points', async (req, res) => {
    const data = parse(point, req.body);
    const newId = await repo.createPoint(data, req.adminUser.id);
    await changed(req, 'create', 'point', newId, { name: data.name });
    res.status(201).json(await repo.findPoint(newId));
  });

  router.patch('/points/:id', async (req, res) => {
    const pointId = parse(id, req.params.id);
    const data = parse(point.partial(), req.body);
    if ((data.lng === undefined) !== (data.lat === undefined)) {
      throw new HttpError(400, 'INVALID_INPUT', 'lng y lat van juntas');
    }
    if (!(await repo.updatePoint(pointId, data, req.adminUser.id))) {
      throw new HttpError(404, 'POINT_NOT_FOUND', 'El punto no existe');
    }
    await changed(req, 'update', 'point', pointId, data);
    res.json(await repo.findPoint(pointId));
  });

  router.delete('/points/:id', async (req, res) => {
    const pointId = parse(id, req.params.id);
    if (!(await repo.setPointDeleted(pointId, true, req.adminUser.id))) {
      throw new HttpError(404, 'POINT_NOT_FOUND', 'El punto no existe o ya está eliminado');
    }
    await changed(req, 'delete', 'point', pointId);
    res.status(204).end();
  });

  router.post('/points/:id/restore', async (req, res) => {
    const pointId = parse(id, req.params.id);
    if (!(await repo.setPointDeleted(pointId, false, req.adminUser.id))) {
      throw new HttpError(404, 'POINT_NOT_FOUND', 'El punto no existe o no está eliminado');
    }
    await changed(req, 'restore', 'point', pointId);
    res.json(await repo.findPoint(pointId));
  });

  /*
   * Subida de una foto: el cuerpo es la imagen tal cual (Content-Type
   * image/jpeg, image/png o image/webp) y los textos van en la URL.
   */
  router.post(
    '/points/:id/images',
    express.raw({ type: Object.keys(IMAGE_TYPES), limit: '10mb' }),
    async (req, res) => {
      const pointId = parse(id, req.params.id);
      const meta = parse(
        z.object({
          altText: text(300),
          credit: text(200),
          kind: z.enum(['photo', 'panorama']).default('photo'),
          isMain: z.enum(['true', 'false']).default('false'),
        }),
        req.query,
      );
      const type = IMAGE_TYPES[req.get('content-type')?.split(';')[0]];
      if (!type || !Buffer.isBuffer(req.body) || !type.magic(req.body)) {
        throw new HttpError(415, 'UNSUPPORTED_IMAGE', 'Sube una foto JPG, PNG o WebP');
      }
      if (!(await repo.findPoint(pointId))) {
        throw new HttpError(404, 'POINT_NOT_FOUND', 'El punto no existe');
      }
      /* Nombre generado: nunca se usa el nombre que manda el navegador. */
      const filePath = `uploads/${pointId}-${randomUUID()}.${type.ext}`;
      await mkdir(path.join(mediaDir, 'uploads'), { recursive: true });
      await writeFile(path.join(mediaDir, filePath), req.body);
      const isMain = meta.isMain === 'true' && meta.kind === 'photo';
      const imageId = await repo.addImage({ pointId, filePath, ...meta, isMain });
      await changed(req, 'create', 'image', imageId, { pointId, filePath });
      res.status(201).json({ id: imageId, url: `${mediaBaseUrl}/${filePath}` });
    },
  );

  router.patch('/images/:id', async (req, res) => {
    const imageId = parse(id, req.params.id);
    const data = parse(imageChanges, req.body);
    if (!(await repo.updateImage(imageId, data))) {
      throw new HttpError(404, 'IMAGE_NOT_FOUND', 'La imagen no existe');
    }
    await changed(req, 'update', 'image', imageId, data);
    res.status(204).end();
  });

  router.delete('/images/:id', async (req, res) => {
    const imageId = parse(id, req.params.id);
    const pointId = await repo.deleteImage(imageId);
    if (pointId === null) throw new HttpError(404, 'IMAGE_NOT_FOUND', 'La imagen no existe');
    await changed(req, 'delete', 'image', imageId, { pointId });
    res.status(204).end();
  });

  router.get('/layers', async (_req, res) => res.json(await repo.listLayers()));

  router.patch('/layers/:id', async (req, res) => {
    const layerId = parse(id, req.params.id);
    const data = parse(layerChanges, req.body);
    if (!(await repo.updateLayer(layerId, data))) {
      throw new HttpError(404, 'LAYER_NOT_FOUND', 'La capa no existe');
    }
    await changed(req, 'update', 'layer', layerId, data);
    res.status(204).end();
  });

  /* Estadísticas de un período (por defecto, los últimos 30 días). */
  const period = (query) => {
    const { from, to } = parse(
      z.object({
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
      }),
      query,
    );
    const end = to ? new Date(`${to}T00:00:00Z`).getTime() + DAY_MS : now();
    const start = from ? new Date(`${from}T00:00:00Z`).getTime() : end - 30 * DAY_MS;
    if (start >= end) throw new HttpError(400, 'INVALID_INPUT', 'El período está al revés');
    return [new Date(start), new Date(end)];
  };

  router.get('/stats', async (req, res) => res.json(await repo.visitStats(...period(req.query))));

  router.get('/stats.csv', async (req, res) => {
    const [from, to] = period(req.query);
    const { byPoint, byDay } = await repo.visitStats(from, to);
    /* Comillas dobles escapadas; y nada que Excel lea como fórmula. */
    const cell = (value) => {
      const s = String(value ?? '');
      return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    };
    const lines = [
      ['Lugar', 'Visitas'],
      ...byPoint.map((row) => [row.name, row.visits]),
      [],
      ['Día', 'Visitas a lugares', 'Recorridos completos'],
      ...byDay.map((row) => [row.day, row.visits, row.tours]),
    ].map((row) => row.map(cell).join(';'));
    const day = (d) => d.toISOString().slice(0, 10);
    res
      .type('text/csv; charset=utf-8')
      .attachment(`biomap-estadisticas-${day(from)}-a-${day(new Date(to.getTime() - 1))}.csv`)
      .send(`${BOM}${lines.join('\r\n')}\r\n`);
  });

  router.get('/audit', async (_req, res) => res.json(await repo.listAudit(100)));

  return router;
}

/**
 * Ruta pública POST /api/events: el visor registra una visita (ficha abierta
 * o recorrido completo), sin datos personales.
 *
 * @param {{ adminRepository: { recordVisit: Function } }} deps
 */
export function createEventsRouter({ adminRepository }) {
  const router = Router();
  router.post('/', async (req, res) => {
    const event = parse(
      z.object({
        type: z.enum(['point_open', 'tour_complete']),
        pointId: id.nullable().optional(),
      }),
      req.body,
    );
    await adminRepository.recordVisit(event);
    res.status(204).end();
  });
  return router;
}
