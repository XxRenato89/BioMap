import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGracefulShutdown } from '../../src/http/shutdown.js';

const logger = { info: vi.fn(), error: vi.fn() };
const flush = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  vi.useRealTimers();
});

describe('createGracefulShutdown', () => {
  it('closes the server, then the pool, then exits with 0', async () => {
    const order = [];
    const server = {
      close: vi.fn((cb) => {
        order.push('server');
        cb();
      }),
      closeIdleConnections: vi.fn(),
    };
    const pool = { end: vi.fn(async () => order.push('pool')) };
    const exit = vi.fn();

    createGracefulShutdown({ server, pool, logger, exit })('SIGTERM');
    await flush();

    expect(order).toEqual(['server', 'pool']);
    expect(server.closeIdleConnections).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('ignores a second signal', async () => {
    const server = { close: vi.fn((cb) => cb()) };
    const pool = { end: vi.fn(async () => {}) };
    const shutdown = createGracefulShutdown({ server, pool, logger, exit: vi.fn() });
    shutdown('SIGTERM');
    shutdown('SIGINT');
    await flush();
    expect(server.close).toHaveBeenCalledTimes(1);
  });

  it('exits with 1 when the pool fails to close', async () => {
    const server = { close: vi.fn((cb) => cb()) };
    const pool = {
      end: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    const exit = vi.fn();
    createGracefulShutdown({ server, pool, logger, exit })('SIGTERM');
    await flush();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('forces exit with 1 after the timeout', () => {
    vi.useFakeTimers();
    const server = { close: vi.fn() };
    const pool = { end: vi.fn() };
    const exit = vi.fn();
    createGracefulShutdown({ server, pool, logger, exit, timeoutMs: 10_000 })('SIGTERM');
    vi.advanceTimersByTime(10_000);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
