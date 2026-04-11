'use client';

import { Button } from '../ui/button';

export interface NotFoundPageProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function NotFoundPage({
  title = '404',
  description = 'The page you are looking for does not exist.',
  actionLabel = 'Go to dashboard',
  onAction,
}: NotFoundPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <h1 className="text-4xl font-bold" data-test-id="not-found-title">
        {title}
      </h1>
      <p className="text-muted-foreground">{description}</p>
      {onAction && (
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
