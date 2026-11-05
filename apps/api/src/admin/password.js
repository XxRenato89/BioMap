import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
/* Parámetros de scrypt (costo N, bloque r, paralelismo p) y largo de la clave. */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Hash de una contraseña con scrypt y sal aleatoria, en el formato
 * `scrypt$N$r$p$sal$hash` (base64), para poder subir el costo más adelante.
 *
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

/**
 * Compara una contraseña con su hash en tiempo constante.
 *
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(key, expected);
}

/**
 * Motivo por el que una contraseña nueva no sirve, o null si sirve.
 *
 * @param {string} password
 * @param {{ username?: string, current?: string }} [context]
 * @returns {string | null}
 */
export function passwordProblem(password, { username = '', current = '' } = {}) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  if (password.length > 200) return 'La contraseña es demasiado larga';
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe tener letras y números';
  }
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    return 'La contraseña no puede contener el nombre de usuario';
  }
  if (current && password === current) return 'La contraseña nueva debe ser distinta de la actual';
  return null;
}
