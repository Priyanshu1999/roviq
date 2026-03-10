'use client';

import { Button } from '../ui/button';

export interface ErrorPageProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  reset: () => void;
}

export function ErrorPage({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  actionLabel = 'Try again',
  reset,
}: ErrorPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <h1 className="text-4xl font-bold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      <Button variant="outline" onClick={reset}>
        {actionLabel}
      </Button>
    </div>
  );
}
