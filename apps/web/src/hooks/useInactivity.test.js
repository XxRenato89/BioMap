import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInactivity } from './useInactivity.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * Monta el hook con 120 s de inactividad y 10 s de aviso.
 */
function setup() {
  const onReset = vi.fn();
  const hook = renderHook(() => useInactivity({ timeoutMs: 120_000, warningMs: 10_000, onReset }));
  return { ...hook, onReset };
}

const advance = (ms) => act(() => vi.advanceTimersByTime(ms));

describe('useInactivity', () => {
  it('never warns while nobody has touched the screen', () => {
    const { result, onReset } = setup();
    advance(600_000);
    expect(result.current.phase).toBe('clean');
    expect(onReset).not.toHaveBeenCalled();
  });

  it('shows the warning 120 s after the last interaction', () => {
    const { result } = setup();
    act(() => result.current.markActive());
    advance(119_000);
    expect(result.current.phase).toBe('active');
    advance(1_000);
    expect(result.current.phase).toBe('warning');
    expect(result.current.secondsLeft).toBe(10);
  });

  it('counts down and resets when the warning ends', () => {
    const { result, onReset } = setup();
    act(() => result.current.markActive());
    advance(120_000);
    advance(3_000);
    expect(result.current.secondsLeft).toBe(7);
    advance(7_000);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('clean');
  });

  it('keeps exploring when there is an interaction during the warning', () => {
    const { result, onReset } = setup();
    act(() => result.current.markActive());
    advance(120_000);
    act(() => result.current.markActive());
    expect(result.current.phase).toBe('active');
    advance(30_000);
    expect(onReset).not.toHaveBeenCalled();
  });

  it('counts from the last interaction, without re-rendering on every event', () => {
    let renders = 0;
    const onReset = vi.fn();
    const { result } = renderHook(() => {
      renders += 1;
      return useInactivity({ timeoutMs: 120_000, warningMs: 10_000, onReset });
    });
    act(() => result.current.markActive());
    const rendersAfterFirst = renders;
    advance(100_000);
    for (let i = 0; i < 50; i += 1) act(() => result.current.markActive());
    expect(renders - rendersAfterFirst).toBeLessThanOrEqual(1);
    advance(100_000);
    expect(result.current.phase).toBe('active');
    advance(20_000);
    expect(result.current.phase).toBe('warning');
  });

  it('markClean stops the timer', () => {
    const { result, onReset } = setup();
    act(() => result.current.markActive());
    act(() => result.current.markClean());
    advance(300_000);
    expect(result.current.phase).toBe('clean');
    expect(onReset).not.toHaveBeenCalled();
  });
});
