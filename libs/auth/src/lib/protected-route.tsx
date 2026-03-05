'use client';

import * as React from 'react';
import { useAuth } from './auth-context';

interface ProtectedRouteProps {
  loginPath?: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ loginPath = '/login', children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const currentPath = window.location.pathname + window.location.search;
      const returnUrl = encodeURIComponent(currentPath);
      window.location.href = `${loginPath}?returnUrl=${returnUrl}`;
    }
  }, [isAuthenticated, isLoading, loginPath]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
