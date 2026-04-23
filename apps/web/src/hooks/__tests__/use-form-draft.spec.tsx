/**
 * Unit tests for `useFormDraft`.
 *
 * Guards the whole lifecycle of the draft-persistence utility:
 *   - localStorage envelope shape (`{values, savedAt}`) + rejection of
 *     legacy bare-values / corrupted payloads
 *   - `isDirty` gate so an untouched form (e.g. one that was pre-filled
 *     from async defaults) never writes a "draft" — the root cause of the
 *     spurious restore banner bug we fixed by splitting the student form
 *     into outer-loads + inner-renders-with-baked-defaults
 *   - Debounced autosave via `form.store.subscribe` (replaces the old
 *     `setInterval + window.focusout` hack)
 *   - Rapid mutations coalesce into a single write
 *   - `restoreDraft` / `discardDraft` / `clearDraft` / `saveDraft` API
 *   - `enabled: false` kills autosave
 *   - Unmount cancels pending debounce + unsubscribes
 */
import '@testing-library/jest-dom/vitest';
import { useAppForm } from '@roviq/ui';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFormDraft } from '../use-form-draft';

const KEY = 'test:draft';
const STORAGE_KEY = `roviq:draft:${KEY}`;

interface TestValues extends Record<string, unknown> {
  name: string;
  age: number;
}

/**
 * Standard harness: a real `useAppForm` + `useFormDraft` chained through
 * `renderHook` so we can drive the form via `setFieldValue` and observe
 * the draft side-effects.
 */
function setupDraft({ enabled, debounceMs }: { enabled?: boolean; debounceMs?: number } = {}) {
  return renderHook(() => {
    const form = useAppForm({
      defaultValues: { name: '', age: 0 } as TestValues,
      onSubmit: () => {},
    });
    const draft = useFormDraft<TestValues>({ key: KEY, form, enabled, debounceMs });
    return { form, draft };
  });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFormDraft — reading the stored draft', () => {
  it('returns hasDraft=false when localStorage is empty', () => {
    const { result } = setupDraft();
    expect(result.current.draft.hasDraft).toBe(false);
    expect(result.current.draft.storedDraft).toBeNull();
  });

  it('returns hasDraft=true and exposes values for a valid {values, savedAt} envelope', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { name: 'Stored', age: 5 }, savedAt: Date.now() }),
    );
    const { result } = setupDraft();
    expect(result.current.draft.hasDraft).toBe(true);
    expect(result.current.draft.storedDraft).toEqual({ name: 'Stored', age: 5 });
  });

  it('rejects legacy bare-values payloads (no `values` key)', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: 'Legacy' }));
    const { result } = setupDraft();
    expect(result.current.draft.hasDraft).toBe(false);
  });

  it('silently returns hasDraft=false when localStorage payload is corrupted JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{{not-json');
    const { result } = setupDraft();
    expect(result.current.draft.hasDraft).toBe(false);
  });
});

describe('useFormDraft — debounced autosave (regression: empty-draft bug)', () => {
  it('does NOT save on mount while the form is pristine', () => {
    setupDraft();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('writes exactly once after a single mutation, after the debounce window elapses', () => {
    const { result } = setupDraft();
    act(() => {
      result.current.form.setFieldValue('name', 'Alice');
    });
    // Before debounce fires → no write yet.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const payload = JSON.parse(raw as string) as { values: TestValues; savedAt: number };
    expect(payload.values).toEqual({ name: 'Alice', age: 0 });
    expect(typeof payload.savedAt).toBe('number');
  });

  it('coalesces rapid mutations into a single debounced write', () => {
    const setSpy = vi.spyOn(window.localStorage, 'setItem');
    const { result } = setupDraft();
    act(() => {
      for (const next of ['A', 'Al', 'Ali', 'Alic', 'Alice']) {
        result.current.form.setFieldValue('name', next);
      }
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const writes = setSpy.mock.calls.filter(([k]) => k === STORAGE_KEY);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]?.[1] as string).values).toEqual({ name: 'Alice', age: 0 });
    setSpy.mockRestore();
  });

  it('respects a custom debounceMs (shorter window fires sooner)', () => {
    const { result } = setupDraft({ debounceMs: 100 });
    act(() => {
      result.current.form.setFieldValue('name', 'Fast');
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});

describe('useFormDraft — restore / discard / clear', () => {
  it('restoreDraft hydrates form values and dismisses the banner', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { name: 'Bob', age: 9 }, savedAt: Date.now() }),
    );
    const { result } = setupDraft();
    expect(result.current.draft.hasDraft).toBe(true);
    act(() => {
      result.current.draft.restoreDraft();
    });
    expect(result.current.form.state.values).toEqual({ name: 'Bob', age: 9 });
    expect(result.current.draft.hasDraft).toBe(false);
  });

  it('discardDraft removes localStorage and dismisses the banner', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { name: 'X', age: 1 }, savedAt: Date.now() }),
    );
    const { result } = setupDraft();
    act(() => {
      result.current.draft.discardDraft();
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.draft.hasDraft).toBe(false);
  });

  it('clearDraft removes localStorage (post-submit cleanup)', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ values: { name: 'X', age: 1 }, savedAt: Date.now() }),
    );
    const { result } = setupDraft();
    act(() => {
      result.current.draft.clearDraft();
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('saveDraft writes current values immediately, bypassing the debounce', () => {
    const { result } = setupDraft();
    act(() => {
      result.current.form.setFieldValue('name', 'Force');
    });
    act(() => {
      result.current.draft.saveDraft();
    });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).values).toEqual({ name: 'Force', age: 0 });
  });
});

describe('useFormDraft — lifecycle', () => {
  it('enabled=false disables autosave entirely', () => {
    const { result } = setupDraft({ enabled: false });
    act(() => {
      result.current.form.setFieldValue('name', 'Anything');
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('unmount cancels a pending debounce (no late writes)', () => {
    const { result, unmount } = setupDraft();
    act(() => {
      result.current.form.setFieldValue('name', 'Before unmount');
    });
    // Teardown BEFORE the debounce window fires.
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('unmount unsubscribes from the form store (no writes from later mutations)', () => {
    const { result, unmount } = setupDraft();
    unmount();
    act(() => {
      result.current.form.setFieldValue('name', 'After unmount');
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
