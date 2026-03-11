'use client';

import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';

export interface ErrorBoundaryLabels {
  title?: string;
  fallbackMessage?: string;
  tryAgain?: string;
}

function ErrorFallback({
  error,
  resetErrorBoundary,
  labels,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
  labels?: ErrorBoundaryLabels;
}) {
  const message =
    error instanceof Error
      ? error.message
      : (labels?.fallbackMessage ?? 'An unexpected error occurred');
  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">
            {labels?.title ?? 'Something went wrong'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
        <CardFooter>
          <Button onClick={resetErrorBoundary}>{labels?.tryAgain ?? 'Try again'}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export function PageErrorBoundary({
  children,
  labels,
}: {
  children: React.ReactNode;
  labels?: ErrorBoundaryLabels;
}) {
  return (
    <ReactErrorBoundary FallbackComponent={(props) => <ErrorFallback {...props} labels={labels} />}>
      {children}
    </ReactErrorBoundary>
  );
}
