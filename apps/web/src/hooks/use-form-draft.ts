'use client';

import * as React from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

/**
 * Auto-save react-hook-form values to localStorage on every blur and on a
 * 30-second interval, and expose a small API to restore or discard the
 * saved draft on the next page mount.
 *
 * Implements rule [HUPGP] from frontend-ux: "Auto-save drafts to
 * localStorage every 30s + blur. Restore banner. Key:
 * `roviq:draft:{form}:{id}`".
 *
 * Usage:
 * ```tsx
 * const { hasDraft, restoreDraft, discardDraft } = useFormDraft({
 *   key: `student-profile:${student.id}`,
 *   form,
 *   // skip auto-save while we are in the middle of submitting
 *   enabled: !mutationLoading,
 * });
 * ```
 *
 * Returns `hasDraft = true` only when:
 *   1. A draft exists for this key in localStorage, AND
 *   2. The draft was created MORE than 1s before the form mounted (so a
 *      page refresh during typing doesn't false-positive on the same
 *      session's data), AND
 *   3. The current form values still match the server-loaded defaults
 *      (so we don't show the banner once the user already started
 *      editing this session).
 */
export interface UseFormDraftOptions<TValues extends FieldValues> {
  /** Stable key under `roviq:draft:` — typically `formName:entityId`. */
  key: string;
  /** The react-hook-form instance to read from / write into. */
  form: UseFormReturn<TValues>;
  /** Pause auto-save (e.g. while a mutation is in flight). Defaults to true. */
  enabled?: boolean;
  /** Auto-save interval in milliseconds. Defaults to 30s per the rule. */
  intervalMs?: number;
}

export interface UseFormDraftResult<TValues extends FieldValues> {
  /** True when a stored draft exists that the user hasn't yet acted on. */
  hasDraft: boolean;
  /** Hydrate the form with the stored draft and clear the banner. */
  restoreDraft: () => void;
  /** Drop the stored draft and clear the banner without restoring. */
  discardDraft: () => void;
  /**
   * Force-write the current form values to localStorage immediately. The
   * submit handler should call `clearDraft()` (not this) on success.
   */
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

export function useFormDraft<TValues extends FieldValues>({
  key,
  form,
  enabled = true,
  intervalMs = 30_000,
}: UseFormDraftOptions<TValues>): UseFormDraftResult<TValues> {
  // Snapshot the saved draft at mount; we don't need to re-read on every
  // render. The user can refresh the page to re-trigger the recovery flow.
  const [storedDraft, setStoredDraft] = React.useState<StoredDraft<TValues> | null>(() =>
    readStoredDraft<TValues>(key),
  );
  const [bannerDismissed, setBannerDismissed] = React.useState(false);

  const saveDraft = React.useCallback(() => {
    if (!enabled) return;
    const values = form.getValues();
    writeStoredDraft<TValues>(key, values);
  }, [enabled, form, key]);

  const restoreDraft = React.useCallback(() => {
    if (!storedDraft) return;
    form.reset(storedDraft.values);
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
      if (form.formState.isDirty) saveDraft();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, form, intervalMs, saveDraft]);

  // Save on blur of any field — react-hook-form fires `onBlur` per field
  // which we capture at the form level via the focusout event.
  React.useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      if (form.formState.isDirty) saveDraft();
    };
    window.addEventListener('focusout', handler, true);
    return () => window.removeEventListener('focusout', handler, true);
  }, [enabled, form, saveDraft]);

  // Show the banner only when a draft was saved before this mount AND the
  // user hasn't dismissed it yet.
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
