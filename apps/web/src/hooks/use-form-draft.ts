'use client';

import * as React from 'react';

/**
 * Auto-save TanStack Form values to localStorage on every blur and on a
 * 30-second interval, and expose a small API to restore or discard the
 * saved draft on the next page mount.
 *
 * Implements rule [HUPGP] from frontend-ux: "Auto-save drafts to
 * localStorage every 30s + blur. Restore banner. Key:
 * `roviq:draft:{form}:{id}`".
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
 * `formApi.state.values`/`formApi.reset()` API surface used below.
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
  /** Auto-save interval in milliseconds. Defaults to 30s per the rule. */
  intervalMs?: number;
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
  intervalMs = 30_000,
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

  // 30-second interval autosave — only while the form is dirty so we don't
  // continuously rewrite the same untouched defaults.
  React.useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      if (form.state.isDirty) saveDraft();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, form, intervalMs, saveDraft]);

  // Save on blur of any field — TanStack Form fires `field.handleBlur` per
  // field which propagates as a native `focusout` event; capture at window
  // level so a single listener serves the whole form.
  React.useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      if (form.state.isDirty) saveDraft();
    };
    window.addEventListener('focusout', handler, true);
    return () => window.removeEventListener('focusout', handler, true);
  }, [enabled, form, saveDraft]);

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
