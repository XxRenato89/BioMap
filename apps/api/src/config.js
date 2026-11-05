import { z } from 'zod';

/**
 * Esquema de las variables de entorno de la API.
 * Los valores llegan como texto y se convierten al tipo correcto;
 * si falta algo obligatorio o un valor es inválido, la API no debe arrancar.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    USE_MOCKS: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string')
      .optional(),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).default(2000),
    CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(60),
    MEDIA_DIR: z.string().default('./media'),
    /* Build del visor (apps/web/dist): en el kiosco la API lo sirve en la raíz. */
    WEB_DIR: z.string().optional(),
    MEDIA_BASE_URL: z
      .string()
      .regex(/^\//, 'must start with "/"')
      .transform((value) => value.replace(/\/+$/, '') || '/')
      .default('/media'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /* Firma de las sesiones del panel. Sin ella (solo en desarrollo) se genera una por proceso. */
    SESSION_SECRET: z.string().min(32, 'must have at least 32 characters').optional(),
    PASSWORD_MAX_AGE_DAYS: z.coerce.number().int().min(1).max(365).default(90),
    /* Límites de la maqueta (oeste,sur,este,norte): los puntos nuevos deben caer adentro. */
    MAP_BOUNDS: z
      .string()
      .regex(/^-?[\d.]+(,-?[\d.]+){3}$/, 'must be "west,south,east,north"')
      .default('-71.855,-37.7672,-71.75374,-37.672'),
  })
  .superRefine((data, ctx) => {
    if (!data.USE_MOCKS && !data.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DATABASE_URL is required',
        path: ['DATABASE_URL'],
      });
    }
    if (data.NODE_ENV === 'production' && !data.USE_MOCKS && !data.SESSION_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SESSION_SECRET is required in production',
        path: ['SESSION_SECRET'],
      });
    }
  });

/**
 * Lee y valida la configuración desde un objeto de entorno.
 * Las variables definidas como texto vacío se tratan como no definidas,
 * para que Docker o un .env incompleto no rompan los valores por defecto.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ nodeEnv: string, port: number, databaseUrl: string, dbPoolMax: number,
 *   dbStatementTimeoutMs: number, cacheTtlSeconds: number, mediaDir: string, webDir?: string,
 *   mediaBaseUrl: string, logLevel: string, useMocks?: boolean, sessionSecret?: string,
 *   passwordMaxAgeDays: number, mapBounds: [[number, number], [number, number]] }}
 */
export function loadConfig(env = process.env) {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${details}`);
  }
  const c = result.data;
  const config = {
    nodeEnv: c.NODE_ENV,
    port: c.PORT,
    databaseUrl: c.DATABASE_URL,
    dbPoolMax: c.DB_POOL_MAX,
    dbStatementTimeoutMs: c.DB_STATEMENT_TIMEOUT_MS,
    cacheTtlSeconds: c.CACHE_TTL_SECONDS,
    mediaDir: c.MEDIA_DIR,
    webDir: c.WEB_DIR,
    mediaBaseUrl: c.MEDIA_BASE_URL,
    logLevel: c.LOG_LEVEL,
    sessionSecret: c.SESSION_SECRET,
    passwordMaxAgeDays: c.PASSWORD_MAX_AGE_DAYS,
    mapBounds: (([w, s, e, n]) => [
      [w, s],
      [e, n],
    ])(c.MAP_BOUNDS.split(',').map(Number)),
  };
  if (c.USE_MOCKS) {
    config.useMocks = true;
  }
  return config;
}
