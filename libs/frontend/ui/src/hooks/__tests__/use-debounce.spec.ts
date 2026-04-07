import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from '../use-debounce';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebounce', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello'));
    expect(result.current).toBe('hello');
  });

  it('does not update before the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => vi.advanceTimersByTime(200));

    expect(result.current).toBe('a');
  });

  it('updates after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => vi.advanceTimersByTime(300));

    expect(result.current).toBe('ab');
  });

  it('resets the timer on rapid changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => vi.advanceTimersByTime(200));

    rerender({ value: 'abc' });
    act(() => vi.advanceTimersByTime(200));

    // 400ms total but timer reset — still waiting
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });

  it('uses default delay of 300ms', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: 'x' },
    });

    rerender({ value: 'y' });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('x');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('y');
  });

  it('supports custom delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
      initialProps: { value: 'x' },
    });

    rerender({ value: 'y' });
    act(() => vi.advanceTimersByTime(499));
    expect(result.current).toBe('x');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('y');
  });
});
