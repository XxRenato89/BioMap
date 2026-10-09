import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRestMode } from './useRestMode.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const advance = (ms) => act(() => vi.advanceTimersByTime(ms));
const touch = () => act(() => window.dispatchEvent(new Event('pointerdown')));

describe('useRestMode', () => {
  it('does nothing while nobody has touched the screen', () => {
    const onRest = vi.fn();
    renderHook(() => useRestMode({ delayMs: 45_000, onRest }));
    advance(300_000);
    expect(onRest).not.toHaveBeenCalled();
  });

  it('rests once, 45 s after the last interaction', () => {
    const onRest = vi.fn();
    renderHook(() => useRestMode({ delayMs: 45_000, onRest }));
    touch();
    advance(30_000);
    touch();
    advance(44_000);
    expect(onRest).not.toHaveBeenCalled();
    advance(1_000);
    expect(onRest).toHaveBeenCalledTimes(1);
    advance(300_000);
    expect(onRest).toHaveBeenCalledTimes(1);
  });

  it('stays off while disabled', () => {
    const onRest = vi.fn();
    renderHook(() => useRestMode({ delayMs: 45_000, onRest, enabled: false }));
    touch();
    advance(60_000);
    expect(onRest).not.toHaveBeenCalled();
  });
});
