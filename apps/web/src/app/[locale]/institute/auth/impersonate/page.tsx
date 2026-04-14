'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@roviq/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const EXCHANGE_CODE_MUTATION = `
  mutation ExchangeImpersonationCode($code: String!) {
    exchangeImpersonationCode(code: $code) {
      accessToken
      user { id username }
      institute { id name }
    }
  }
`;

export default function ImpersonatePage() {
  const tAuth = useTranslations('auth');
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) {
      setError(tAuth('noImpersonationCode'));
      setLoading(false);
      return;
    }

    async function exchangeCode() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
        const response = await fetch(`${apiUrl}/api/graphql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: EXCHANGE_CODE_MUTATION,
            variables: { code },
          }),
        });

        const result = await response.json();

        if (result.errors) {
          setError(result.errors[0]?.message || tAuth('codeExpiredOrInvalid'));
          setLoading(false);
          return;
        }

        const { accessToken, user } = result.data.exchangeImpersonationCode;

        // Store impersonation token + user name in sessionStorage (NOT localStorage)
        // Dies with the tab — clean separation from main session
        sessionStorage.setItem('roviq-impersonation-token', accessToken);
        if (user?.username) {
          sessionStorage.setItem('roviq-impersonation-user-name', user.username);
        }

        // Redirect to institute dashboard
        router.replace('/dashboard');
      } catch {
        setError(tAuth('impersonationExchangeFailed'));
      } finally {
        setLoading(false);
      }
    }

    exchangeCode();
  }, [code, router, tAuth]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{tAuth('establishingImpersonation')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{tAuth('impersonationFailed')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => window.close()} variant="outline">
              {tAuth('closeTab')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
