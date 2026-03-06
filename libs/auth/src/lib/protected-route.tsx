'use client';

import * as React from 'react';
import { useAuth } from './auth-context';

interface ProtectedRouteProps {
  loginPath?: string;
  selectOrgPath?: string;
  children: React.ReactNode;
}

export function ProtectedRoute({
  loginPath = '/login',
  selectOrgPath = '/select-org',
  children,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, needsOrgSelection } = useAuth();

  React.useEffect(() => {
    if (isLoading) return;

    if (needsOrgSelection) {
      window.location.href = selectOrgPath;
      return;
    }

    if (!isAuthenticated) {
      const currentPath = window.location.pathname + window.location.search;
      const returnUrl = encodeURIComponent(currentPath);
      window.location.href = `${loginPath}?returnUrl=${returnUrl}`;
    }
  }, [isAuthenticated, isLoading, needsOrgSelection, loginPath, selectOrgPath]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || needsOrgSelection) {
    return null;
  }

  return <>{children}</>;
}
