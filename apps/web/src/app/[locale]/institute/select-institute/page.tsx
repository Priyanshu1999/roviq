'use client';

import type { MembershipInfo } from '@roviq/auth';
import { useAuth } from '@roviq/auth';
import { useI18nField } from '@roviq/i18n';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roviq/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function SelectInstitutePage() {
  const t = useTranslations('selectInstitute');
  const ti = useI18nField();
  const { memberships, needsInstituteSelection, isAuthenticated, isLoading, selectInstitute } =
    useAuth();
  const router = useRouter();
  const [selecting, setSelecting] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && !needsInstituteSelection) {
      router.replace('/dashboard');
    }
    if (!isAuthenticated && !needsInstituteSelection) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, needsInstituteSelection, router]);

  const handleSelect = async (membership: MembershipInfo) => {
    setSelecting(membership.membershipId);
    setError(null);
    try {
      await selectInstitute(membership.membershipId);
      router.replace('/dashboard');
    } catch {
      setError(t('selectFailed'));
      setSelecting(null);
    }
  };

  if (!needsInstituteSelection || !memberships) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl" data-test-id="select-institute-title">
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
              {error}
            </div>
          )}
          {memberships.length === 0 ? (
            <p className="text-muted-foreground text-center text-sm">{t('noInstitutes')}</p>
          ) : (
            <div className="space-y-2">
              {memberships.map((membership) => (
                <Button
                  key={membership.membershipId}
                  type="button"
                  variant="outline"
                  disabled={selecting !== null}
                  onClick={() => handleSelect(membership)}
                  className="flex h-auto w-full items-center gap-3 p-3 text-left"
                  data-test-id={`select-institute-option-${membership.membershipId}`}
                  data-institute-name={ti(membership.instituteName)}
                >
                  {membership.instituteLogoUrl ? (
                    <Image
                      src={membership.instituteLogoUrl}
                      alt={ti(membership.instituteName)}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold">
                      {ti(membership.instituteName).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{ti(membership.instituteName)}</div>
                    <div className="text-muted-foreground text-xs">
                      {t('role')}: {ti(membership.roleName)}
                    </div>
                  </div>
                  {selecting === membership.membershipId && (
                    <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  )}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
