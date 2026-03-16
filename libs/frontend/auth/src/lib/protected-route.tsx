'use client';

import * as React from 'react';
import { useAuth } from './auth-context';

interface ProtectedRouteProps {
  loginPath?: string;
  selectInstitutePath?: string;
  children: React.ReactNode;
}

export function ProtectedRoute({
  loginPath = '/login',
  selectInstitutePath = '/select-institute',
  children,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, needsInstituteSelection } = useAuth();

  React.useEffect(() => {
    if (isLoading) return;

    if (needsInstituteSelection) {
      window.location.href = selectInstitutePath;
      return;
    }

    if (!isAuthenticated) {
      const currentPath = window.location.pathname + window.location.search;
      const returnUrl = encodeURIComponent(currentPath);
      window.location.href = `${loginPath}?returnUrl=${returnUrl}`;
    }
  }, [isAuthenticated, isLoading, needsInstituteSelection, loginPath, selectInstitutePath]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || needsInstituteSelection) {
    return null;
  }

  return <>{children}</>;
}
