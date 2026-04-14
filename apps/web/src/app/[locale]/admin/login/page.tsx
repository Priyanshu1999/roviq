'use client';

import { LoginForm, useAuth } from '@roviq/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roviq/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function AdminLoginPage() {
  const t = useTranslations('auth');
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const labels = {
    username: t('username'),
    password: t('password'),
    enterUsername: t('enterUsername'),
    enterPassword: t('enterPassword'),
    signIn: t('signIn'),
    signingIn: t('signingIn'),
    signInWithPasskey: t('signInWithPasskey'),
    or: t('or'),
    usernameRequired: t('usernameRequired'),
    passwordRequired: t('passwordRequired'),
    loginFailed: t('loginFailed'),
    passkeyNotAvailable: t('passkeyNotAvailable'),
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-4">
        <Card data-testid="login-card">
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="login-title">
              {t('platformLogin')}
            </CardTitle>
            <CardDescription data-testid="login-description">
              {t('platformLoginDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm
              scope="platform"
              labels={labels}
              onSuccess={() => router.replace('/dashboard')}
            />
          </CardContent>
        </Card>
        {process.env.NODE_ENV !== 'production' && (
          <Card className="border-dashed border-muted-foreground/40 bg-muted/30">
            <CardContent className="pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('devCredentials')}
              </p>
              <div className="space-y-1 font-mono text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">admin</span> / admin123
                  <span className="ms-2 text-[10px]">({t('platformAdmin')})</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
