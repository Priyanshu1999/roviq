'use client';

import { LoginForm, useAuth } from '@roviq/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roviq/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function LoginPage() {
  const t = useTranslations('auth');
  const { isAuthenticated, needsInstituteSelection } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (needsInstituteSelection) {
      router.replace('/select-institute');
      return;
    }
    if (isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      router.replace(params.get('returnUrl') ?? '/dashboard');
    }
  }, [isAuthenticated, needsInstituteSelection, router]);

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
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('welcomeBack')}</CardTitle>
            <CardDescription>{t('loginDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm
              labels={labels}
              onSuccess={() => {
                const params = new URLSearchParams(window.location.search);
                router.replace(params.get('returnUrl') ?? '/dashboard');
              }}
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
                  <span className="ml-2 text-[10px]">({t('multipleInstitutes')})</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">teacher1</span> / teacher123
                </div>
                <div>
                  <span className="font-medium text-foreground">student1</span> / student123
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
