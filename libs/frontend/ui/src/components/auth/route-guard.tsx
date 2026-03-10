'use client';

import type { AppAction, AppSubject } from '@roviq/common-types';
import type * as React from 'react';
import { useAbility } from './ability-provider';

interface RouteGuardProps {
  action: AppAction;
  subject: AppSubject;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

function DefaultForbidden() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">403</h1>
      <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
    </div>
  );
}

export function RouteGuard({ action, subject, fallback, children }: RouteGuardProps) {
  const ability = useAbility();

  if (!ability.can(action, subject)) {
    return <>{fallback ?? <DefaultForbidden />}</>;
  }

  return <>{children}</>;
}
