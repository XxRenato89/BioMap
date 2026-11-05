import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'biomap_admin';
/* La sesión dura una jornada de trabajo. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');

/**
 * Token de sesión firmado (HMAC-SHA256): id del usuario, cuándo cambió su
 * contraseña (al cambiarla, las sesiones viejas dejan de valer) y vencimiento.
 *
 * @param {{ userId: number, passwordChangedAt: Date }} user
 * @param {string} secret
 * @param {number} [now]
 */
export function createSessionToken({ userId, passwordChangedAt }, secret, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      u: userId,
      p: new Date(passwordChangedAt).getTime(),
      e: now + SESSION_TTL_MS,
    }),
  ).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Datos del token si la firma es válida y no venció; si no, null.
 *
 * @param {string | undefined} token
 * @param {string} secret
 * @param {number} [now]
 * @returns {{ userId: number, passwordChangedAt: number } | null}
 */
export function readSessionToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { u, p, e } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!Number.isInteger(u) || typeof e !== 'number' || e <= now) return null;
    return { userId: u, passwordChangedAt: p };
  } catch {
    return null;
  }
}

/**
 * Valor de una cookie de la cabecera Cookie (sin dependencias).
 *
 * @param {string | undefined} header
 * @param {string} name
 */
export function readCookie(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return undefined;
}
