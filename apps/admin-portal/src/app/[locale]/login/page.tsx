'use client';

import { LoginForm, useAuth } from '@roviq/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roviq/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function LoginPage() {
  const t = useTranslations('auth');
  const { isAuthenticated, needsOrgSelection } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (needsOrgSelection) {
      router.replace('/select-org');
      return;
    }
    if (isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      router.replace(params.get('returnUrl') ?? '/dashboard');
    }
  }, [isAuthenticated, needsOrgSelection, router]);

  const labels = {
    username: t('username'),
    password: t('password'),
    enterUsername: t('enterUsername'),
    enterPassword: t('enterPassword'),
    signIn: t('signIn'),
    signingIn: t('signingIn'),
    usernameRequired: t('usernameRequired'),
    passwordRequired: t('passwordRequired'),
    loginFailed: t('loginFailed'),
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md">
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
    </div>
  );
}
