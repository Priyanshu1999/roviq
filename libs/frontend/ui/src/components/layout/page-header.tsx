'use client';

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard page header. Title + optional description on the left, actions on the right.
 * Below `sm` breakpoint, actions stack below the title block (full-width row) so
 * action buttons don't squeeze the title's description into one-word-per-line wrap.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      data-testid="page-header"
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="min-w-0 space-y-1">
        <h1 data-testid="page-header-title" className="text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <p data-testid="page-header-description" className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div
          data-testid="page-header-actions"
          className="flex shrink-0 flex-wrap items-center gap-2"
        >
          {actions}
        </div>
      )}
    </div>
  );
}
