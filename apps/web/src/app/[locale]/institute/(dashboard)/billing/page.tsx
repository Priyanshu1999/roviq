'use client';

import { useFormatDate, useFormatNumber, useI18nField } from '@roviq/i18n';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@roviq/ui';
import { parseISO } from 'date-fns';
import { AlertTriangle, Calendar, CreditCard, Shield } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { type MySubscription, useMySubscription } from './use-billing';

/** Status → badge variant mapping */
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  TRIALING: 'outline',
  ACTIVE: 'default',
  PAUSED: 'secondary',
  PAST_DUE: 'destructive',
  CANCELLED: 'destructive',
  EXPIRED: 'secondary',
};

export default function InstituteBillingPage() {
  const t = useTranslations('instituteBilling');
  const { subscription, loading } = useMySubscription();

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      {!subscription ? (
        <NoSubscriptionState />
      ) : (
        <>
          <StatusBanner subscription={subscription} />
          <SubscriptionCard subscription={subscription} />
        </>
      )}
    </div>
  );
}

function NoSubscriptionState() {
  const t = useTranslations('instituteBilling');
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Shield className="mb-4 size-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{t('noSubscription.title')}</h2>
        <p className="mt-2 text-center text-muted-foreground">{t('noSubscription.description')}</p>
      </CardContent>
    </Card>
  );
}

function StatusBanner({ subscription }: { subscription: MySubscription }) {
  const t = useTranslations('instituteBilling');
  const { status } = subscription;

  if (status === 'PAST_DUE') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
        <AlertTriangle className="size-5 text-orange-600" />
        <div className="flex-1">
          <p className="font-medium text-orange-800 dark:text-orange-200">{t('banner.pastDue')}</p>
          <p className="text-sm text-orange-600 dark:text-orange-400">
            {t('banner.pastDueDescription')}
          </p>
        </div>
        <Link
          href="/billing/invoices"
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          {t('banner.payNow')}
        </Link>
      </div>
    );
  }

  if (status === 'PAUSED') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
        <AlertTriangle className="size-5 text-yellow-600" />
        <p className="font-medium text-yellow-800 dark:text-yellow-200">{t('banner.paused')}</p>
      </div>
    );
  }

  if (status === 'CANCELLED' || status === 'EXPIRED') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
        <AlertTriangle className="size-5 text-red-600" />
        <p className="font-medium text-red-800 dark:text-red-200">
          {status === 'CANCELLED' ? t('banner.cancelled') : t('banner.expired')}
        </p>
      </div>
    );
  }

  return null;
}

function SubscriptionCard({ subscription }: { subscription: MySubscription }) {
  const t = useTranslations('instituteBilling');
  const ti = useI18nField();
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const plan = subscription.plan;

  const entitlements = (plan?.entitlements ?? {}) as Record<string, unknown>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5" />
              {plan ? ti(plan.name) : t('unknownPlan')}
            </CardTitle>
            <Badge variant={STATUS_VARIANT[subscription.status] ?? 'secondary'}>
              {t(`statuses.${subscription.status}`)}
            </Badge>
          </div>
          <CardDescription>
            {plan
              ? `${currency(Number(plan.amount) / 100)} / ${t(`intervals.${plan.interval}`)}`
              : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {subscription.currentPeriodStart && subscription.currentPeriodEnd && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="size-4" />
              {format(parseISO(subscription.currentPeriodStart), 'dd MMM yyyy')} —{' '}
              {format(parseISO(subscription.currentPeriodEnd), 'dd MMM yyyy')}
            </div>
          )}
          {subscription.status === 'TRIALING' && subscription.trialEndsAt && (
            <p className="text-muted-foreground">
              {t('trialEnds', { date: format(parseISO(subscription.trialEndsAt), 'dd MMM yyyy') })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('entitlements.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <EntitlementRow label={t('entitlements.maxStudents')} value={entitlements.maxStudents} />
          <EntitlementRow label={t('entitlements.maxStaff')} value={entitlements.maxStaff} />
          <EntitlementRow
            label={t('entitlements.storage')}
            value={entitlements.maxStorageMb}
            suffix="MB"
          />
          <EntitlementRow
            label={t('entitlements.auditRetention')}
            value={entitlements.auditLogRetentionDays}
            suffix={t('entitlements.days')}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function EntitlementRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value: unknown;
  suffix?: string;
}) {
  const t = useTranslations('instituteBilling');
  const display =
    value === null || value === undefined
      ? t('entitlements.unlimited')
      : `${value}${suffix ? ` ${suffix}` : ''}`;
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{display}</span>
    </div>
  );
}
