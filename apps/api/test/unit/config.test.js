import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const DATABASE_URL = 'postgres://biomap:biomap@localhost:5432/biomap';

describe('loadConfig', () => {
  it('applies defaults when only DATABASE_URL is set', () => {
    expect(loadConfig({ DATABASE_URL })).toEqual({
      nodeEnv: 'development',
      port: 3000,
      databaseUrl: DATABASE_URL,
      dbPoolMax: 10,
      dbStatementTimeoutMs: 2000,
      cacheTtlSeconds: 60,
      mediaDir: './media',
      mediaBaseUrl: '/media',
      logLevel: 'info',
      passwordMaxAgeDays: 90,
      elevenLabsVoiceId: 'tbfu7H6JPPlpF9clW89V',
      mapBounds: [
        [-71.855, -37.7672],
        [-71.75374, -37.672],
      ],
    });
  });

  it('requires SESSION_SECRET in production, for the admin panel', () => {
    expect(() => loadConfig({ DATABASE_URL, NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
    const secret = 'x'.repeat(32);
    expect(
      loadConfig({ DATABASE_URL, NODE_ENV: 'production', SESSION_SECRET: secret }).sessionSecret,
    ).toBe(secret);
  });

  it('coerces numeric strings', () => {
    const config = loadConfig({ DATABASE_URL, PORT: '8080', DB_POOL_MAX: '20' });
    expect(config.port).toBe(8080);
    expect(config.dbPoolMax).toBe(20);
  });

  it('treats empty strings as unset', () => {
    expect(loadConfig({ DATABASE_URL, PORT: '', LOG_LEVEL: '' }).port).toBe(3000);
  });

  it('removes trailing slashes from MEDIA_BASE_URL', () => {
    expect(loadConfig({ DATABASE_URL, MEDIA_BASE_URL: '/media//' }).mediaBaseUrl).toBe('/media');
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('does not require DATABASE_URL in mock mode', () => {
    expect(loadConfig({ USE_MOCKS: 'true' })).toMatchObject({
      useMocks: true,
      databaseUrl: undefined,
    });
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => loadConfig({ DATABASE_URL, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects a MEDIA_BASE_URL that does not start with a slash', () => {
    expect(() => loadConfig({ DATABASE_URL, MEDIA_BASE_URL: 'media' })).toThrow(/MEDIA_BASE_URL/);
  });
});
