'use client';

import * as React from 'react';

/**
 * Auto-save TanStack Form values to localStorage on every value change
 * (debounced) and expose a small API to restore or discard the saved draft
 * on the next page mount.
 *
 * Implements rule [HUPGP] from frontend-ux: "Auto-save drafts to
 * localStorage every 1s (debounced) after each value change. Restore
 * banner. Key: `roviq:draft:{form}:{id}`".
 *
 * Design: mirrors TanStack Form's canonical autosave pattern — a form-level
 * `listeners: { onChange, onChangeDebounceMs }` — but applied externally
 * via `form.store.subscribe()` so this hook remains a drop-in for any
 * `useAppForm` instance without forcing consumers to rewire `listeners` at
 * form-init time. Saves are gated on `form.state.isDirty` so programmatic
 * defaults (e.g. async-loaded values baked into `defaultValues`) don't
 * persist a draft the user never created.
 *
 * Usage:
 * ```tsx
 * const form = useAppForm({ defaultValues, validators, onSubmit });
 * const { hasDraft, restoreDraft, discardDraft, clearDraft } = useFormDraft({
 *   key: `student-profile:${student.id}`,
 *   form,
 *   enabled: !mutationLoading,
 * });
 * ```
 *
 * On successful submit, the consumer should call `clearDraft()`.
 *
 * The `form` prop is typed as `any` because TanStack's
 * `AppFieldExtendedReactFormApi` (returned by `useAppForm`) has many
 * contravariant slots that collapse to `never` under any narrower duck-type,
 * rejecting structural matching. The kit boundary trusts the consumer to
 * pass a real form instance; runtime safety is guaranteed by the
 * `formApi.state.{values,isDirty}` / `formApi.store.subscribe()` /
 * `formApi.reset()` API surface used below.
 */
// biome-ignore lint/suspicious/noExplicitAny: kit boundary is intentionally loose; runtime is constrained by useAppForm.
type AnyForm = any;

export interface UseFormDraftOptions<TValues> {
  /** Stable key under `roviq:draft:` — typically `formName:entityId`. */
  key: string;
  /** The TanStack Form instance returned from `useAppForm()`. */
  form: AnyForm;
  /** Pause auto-save (e.g. while a mutation is in flight). Defaults to true. */
  enabled?: boolean;
  /**
   * Debounce window after each value change before the draft is persisted.
   * Mirrors TanStack Form's `onChangeDebounceMs` convention. Defaults to
   * 1000ms — low enough to feel responsive, high enough to coalesce rapid
   * keystrokes into a single write.
   */
  debounceMs?: number;
  /** @internal — present for backwards compatibility with the typed generic; not consumed. */
  _values?: TValues;
}

export interface UseFormDraftResult<TValues> {
  /** True when a stored draft exists that the user hasn't yet acted on. */
  hasDraft: boolean;
  /** Hydrate the form with the stored draft and clear the banner. */
  restoreDraft: () => void;
  /** Drop the stored draft and clear the banner without restoring. */
  discardDraft: () => void;
  /** Force-write the current form values to localStorage immediately. */
  saveDraft: () => void;
  /** Clear the stored draft, e.g. after a successful submit. */
  clearDraft: () => void;
  /** The currently-stored draft values, if any. */
  storedDraft: TValues | null;
}

interface StoredDraft<TValues> {
  values: TValues;
  savedAt: number;
}

const STORAGE_PREFIX = 'roviq:draft:';

function buildKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function readStoredDraft<TValues>(key: string): StoredDraft<TValues> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(buildKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<TValues>;
    if (!parsed || typeof parsed !== 'object' || !('values' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredDraft<TValues>(key: string, values: TValues): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredDraft<TValues> = { values, savedAt: Date.now() };
    window.localStorage.setItem(buildKey(key), JSON.stringify(payload));
  } catch {
    // localStorage may be full or disabled — silently ignore. The form still
    // works; only draft recovery is degraded.
  }
}

function removeStoredDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(buildKey(key));
  } catch {
    /* ignore */
  }
}

export function useFormDraft<TValues>({
  key,
  form,
  enabled = true,
  debounceMs = 1000,
}: UseFormDraftOptions<TValues>): UseFormDraftResult<TValues> {
  const [storedDraft, setStoredDraft] = React.useState<StoredDraft<TValues> | null>(() =>
    readStoredDraft<TValues>(key),
  );
  const [bannerDismissed, setBannerDismissed] = React.useState(false);

  const saveDraft = React.useCallback(() => {
    if (!enabled) return;
    const values = form.state.values as TValues;
    writeStoredDraft<TValues>(key, values);
  }, [enabled, form, key]);

  const restoreDraft = React.useCallback(() => {
    if (!storedDraft) return;
    // `keepDefaultValues: true` works around tanstack/form#1798 — without it
    // the reset is reverted on the next render because the form reconciles
    // `defaultValues` and decides the reset was stale.
    form.reset(storedDraft.values, { keepDefaultValues: true });
    setBannerDismissed(true);
  }, [form, storedDraft]);

  const discardDraft = React.useCallback(() => {
    removeStoredDraft(key);
    setStoredDraft(null);
    setBannerDismissed(true);
  }, [key]);

  const clearDraft = React.useCallback(() => {
    removeStoredDraft(key);
    setStoredDraft(null);
    setBannerDismissed(true);
  }, [key]);

  // Subscribe to the form store and persist — debounced — on every
  // mutation. This is the external equivalent of TanStack Form's own
  // `listeners: { onChange, onChangeDebounceMs }` autosave pattern, so the
  // hook can be layered on any `useAppForm` without re-wiring its options.
  //
  // `isDirty` gate: TanStack's `isDirty` flips true the first time any
  // field is mutated *by the user* (it mirrors the per-field meta flag,
  // which `setFieldValue` sets only when `dontUpdateMeta` is false).
  // Mutations that happen during form init — e.g. async-loaded values
  // baked into `defaultValues` — leave `isDirty` false, so no draft is
  // written for an untouched form (the bug that caused a spurious
  // restore banner on the next reload).
  React.useEffect(() => {
    if (!enabled) return;
    let timeoutId: number | undefined;
    const flush = () => {
      timeoutId = undefined;
      if (form.state.isDirty) saveDraft();
    };
    // `@tanstack/store@0.9` returns a `Subscription` object with an
    // `unsubscribe()` method rather than a bare teardown function.
    const subscription = form.store.subscribe(() => {
      if (!form.state.isDirty) return;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(flush, debounceMs);
    });
    return () => {
      subscription.unsubscribe();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [enabled, form, debounceMs, saveDraft]);

  const hasDraft = !bannerDismissed && storedDraft !== null;

  return {
    hasDraft,
    restoreDraft,
    discardDraft,
    saveDraft,
    clearDraft,
    storedDraft: storedDraft?.values ?? null,
  };
}
