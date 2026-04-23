'use client';

import { Button } from '@roviq/ui/components/ui/button';
import { Card, CardContent } from '@roviq/ui/components/ui/card';
import { History, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export interface DraftBannerProps {
  /** When false the banner renders nothing — wire `hasDraft` from `useFormDraft` directly. */
  hasDraft: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  /**
   * Overrides the default copy (pulled from the `common.draft` namespace).
   * Pass a nested `{ title, description, restoreLabel, discardLabel }` to
   * replace any subset; omitted keys fall back to `common.draft.*`.
   */
  labels?: Partial<{
    title: ReactNode;
    description: ReactNode;
    restoreLabel: ReactNode;
    discardLabel: ReactNode;
  }>;
  /** Test ID on the banner root. Buttons inherit `-restore-btn` / `-discard-btn`. */
  testId?: string;
  className?: string;
}

/**
 * Unsaved-draft restore prompt for auto-saved forms. Pairs with
 * `useFormDraft` — pass `hasDraft` / `restoreDraft` / `discardDraft` from it.
 *
 * All copy defaults to the shared `common.draft` namespace
 * (`found`, `foundDescription`, `restore`, `discard`) so every form speaks
 * the same language without repeating strings per feature namespace.
 *
 * Visuals: emerald-tinted Card with a `History` status icon on the left,
 * title + description in the centre, destructive "Discard" + emerald
 * "Restore" pill-style buttons on the right. Stacks vertically on mobile.
 */
export function DraftBanner({
  hasDraft,
  onRestore,
  onDiscard,
  labels,
  testId,
  className,
}: DraftBannerProps) {
  const t = useTranslations('common.draft');
  if (!hasDraft) return null;

  const title = labels?.title ?? t('found');
  const description = labels?.description ?? t('foundDescription');
  const restoreLabel = labels?.restoreLabel ?? t('restore');
  const discardLabel = labels?.discardLabel ?? t('discard');
  const restoreTestId = testId ? `${testId}-restore-btn` : undefined;
  const discardTestId = testId ? `${testId}-discard-btn` : undefined;

  return (
    <Card
      role="status"
      aria-live="polite"
      data-testid={testId}
      data-slot="draft-banner"
      className={[
        'overflow-hidden bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/[0.03] shadow-sm ring-emerald-500/30 dark:from-emerald-500/10 dark:to-emerald-500/[0.04] dark:ring-emerald-500/20',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 sm:py-0">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <div
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400"
          >
            <History className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium leading-snug tracking-tight">{title}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            data-testid={discardTestId}
            className="flex-1 border-destructive/20 bg-destructive/10 text-destructive shadow-none hover:bg-destructive/20 hover:text-destructive sm:flex-none dark:text-red-400"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            <span className="leading-none">{discardLabel}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRestore}
            data-testid={restoreTestId}
            className="flex-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 shadow-none hover:bg-emerald-500/20 hover:text-emerald-700 sm:flex-none dark:text-emerald-400 dark:hover:text-emerald-400"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            <span className="leading-none">{restoreLabel}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
