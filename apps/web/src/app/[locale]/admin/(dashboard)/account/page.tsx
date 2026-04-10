'use client';

import type { PasskeyManagerLabels } from '@roviq/auth';
import { createAuthMutations, PasskeyManager, useAuth } from '@roviq/auth';
import type { AuthScope } from '@roviq/common-types';
import { useFormatDate } from '@roviq/i18n';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@roviq/ui';
import { Check, Copy, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const GRAPHQL_HTTP = `${API_URL}/api/graphql`;

const authMutations = createAuthMutations(GRAPHQL_HTTP);

const passkeyMutations = {
  myPasskeys: authMutations.myPasskeys,
  generateRegistrationOptions: authMutations.generatePasskeyRegistrationOptions,
  verifyRegistration: authMutations.verifyPasskeyRegistration,
  removePasskey: authMutations.removePasskey,
};

// Auto-hide the unmasked email after this many ms (ZKFQP rule).
const REVEAL_AUTO_HIDE_MS = 10_000;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export default function AccountPage() {
  const t = useTranslations('account');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const { format } = useFormatDate();
  const { user } = useAuth();

  const formatDate = React.useCallback((d: string) => format(new Date(d), 'PP'), [format]);

  const [emailRevealed, setEmailRevealed] = React.useState(false);
  const [emailCopied, setEmailCopied] = React.useState(false);

  // Auto-hide revealed email after REVEAL_AUTO_HIDE_MS (ZKFQP).
  React.useEffect(() => {
    if (!emailRevealed) return;
    const timer = window.setTimeout(() => setEmailRevealed(false), REVEAL_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [emailRevealed]);

  const handleCopyEmail = React.useCallback(async () => {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setEmailCopied(true);
      toast.success(t('copiedToClipboard'));
      window.setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      toast.error(t('copyFailed'));
    }
  }, [t, user?.email]);

  const scopeLabel = React.useMemo<string>(() => {
    const scope: AuthScope | undefined = user?.scope;
    if (scope === 'platform') return t('scopePlatform');
    if (scope === 'reseller') return t('scopeReseller');
    if (scope === 'institute') return t('scopeInstitute');
    return t('scopeUnknown');
  }, [t, user?.scope]);

  const passkeyLabels = React.useMemo<PasskeyManagerLabels>(
    () => ({
      title: tAuth('passkeys'),
      description: tAuth('passkeysDescription'),
      addPasskey: tAuth('addPasskey'),
      removePasskey: tAuth('removePasskey'),
      noPasskeys: tAuth('noPasskeys'),
      passkeyName: tAuth('passkeyName'),
      enterPasskeyName: tAuth('enterPasskeyName'),
      passkeyNameHint: tAuth('passkeyNameHint'),
      confirmPassword: tAuth('confirmPassword'),
      registeredAt: tAuth('registeredAt'),
      lastUsedAt: tAuth('lastUsedAt'),
      never: tAuth('never'),
      backedUp: tAuth('backedUp'),
      cancel: tAuth('cancel'),
      removePasskeyConfirm: tAuth('removePasskeyConfirm'),
      nameTooLong: tAuth('nameTooLong'),
      passkeyPasswordRequired: tAuth('passkeyPasswordRequired'),
    }),
    [tAuth],
  );

  return (
    <div className="space-y-6" data-test-id="account-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-test-id="account-title">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground" data-test-id="account-description">
          {t('description')}
        </p>
      </div>

      <div className="grid max-w-3xl gap-6">
        {/* Profile summary — read-only per FVOLK. Identity mutations are handled by the
            Identity Service and are not exposed in this portal today; show metadata only. */}
        <Card>
          <CardHeader>
            <CardTitle>{t('profileTitle')}</CardTitle>
            <CardDescription>{t('profileDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldSet>
              <FieldLegend className="sr-only">{t('profileTitle')}</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="account-roviq-id">{tAuth('username')}</FieldLabel>
                  <output
                    id="account-roviq-id"
                    className="text-sm font-medium tabular-nums"
                    aria-live="polite"
                  >
                    {user?.username ?? tCommon('loading')}
                  </output>
                  <FieldDescription>{t('roviqIdDescription')}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="account-email">{t('emailLabel')}</FieldLabel>
                  <div className="flex items-center gap-2">
                    <output
                      id="account-email"
                      className="text-sm font-medium"
                      aria-live="polite"
                      data-test-id="account-email-value"
                    >
                      {user?.email
                        ? emailRevealed
                          ? user.email
                          : maskEmail(user.email)
                        : tCommon('loading')}
                    </output>
                    {user?.email ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => setEmailRevealed((prev) => !prev)}
                          title={emailRevealed ? t('hideEmail') : t('revealEmail')}
                          aria-label={emailRevealed ? t('hideEmail') : t('revealEmail')}
                          aria-pressed={emailRevealed}
                          data-test-id="account-email-reveal-btn"
                        >
                          {emailRevealed ? (
                            <EyeOff className="size-3.5" aria-hidden="true" />
                          ) : (
                            <Eye className="size-3.5" aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={handleCopyEmail}
                          title={t('copyEmail')}
                          aria-label={t('copyEmail')}
                          data-test-id="account-email-copy-btn"
                        >
                          {emailCopied ? (
                            <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                          ) : (
                            <Copy className="size-3.5" aria-hidden="true" />
                          )}
                        </Button>
                      </>
                    ) : null}
                  </div>
                  <FieldDescription>{t('emailDescription')}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="account-scope">{t('scopeLabel')}</FieldLabel>
                  <div id="account-scope" className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1.5">
                      <ShieldCheck className="size-3" aria-hidden="true" />
                      {scopeLabel}
                    </Badge>
                  </div>
                  <FieldDescription>{t('scopeDescription')}</FieldDescription>
                </Field>
              </FieldGroup>
            </FieldSet>
          </CardContent>
        </Card>

        {/* Passkey security (ZJRNK — encourage passkey adoption in account settings). */}
        <PasskeyManager
          mutations={passkeyMutations}
          labels={passkeyLabels}
          formatDate={formatDate}
        />
      </div>
    </div>
  );
}
