'use client';

import type { SubscriptionStatus as SubscriptionStatusType } from '@roviq/graphql/generated';
import { Badge } from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { SubscriptionNode } from './use-subscriptions';

const STATUS_VARIANT: Record<
  SubscriptionStatusType,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  TRIALING: 'outline',
  ACTIVE: 'default',
  PAUSED: 'secondary',
  PAST_DUE: 'destructive',
  CANCELLED: 'secondary',
  EXPIRED: 'outline',
};

export function createSubscriptionColumns(
  t: (key: string) => string,
  formatDate: (date: Date) => string,
  formatCurrency: (amount: number) => string,
  ti: (field: Record<string, string> | string | null | undefined) => string,
): ColumnDef<SubscriptionNode, unknown>[] {
  return [
    {
      accessorKey: 'institute',
      header: t('subscriptions.columns.institute'),
      cell: ({ row }) => <span className="font-medium">{ti(row.original.institute?.name)}</span>,
    },
    {
      accessorKey: 'plan',
      header: t('subscriptions.columns.plan'),
      cell: ({ row }) => {
        const plan = row.original.plan;
        if (!plan) return null;
        return (
          <div className="flex flex-col">
            <span className="text-sm">{ti(plan.name)}</span>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(Number(plan.amount) / 100)}/{t(`plans.intervals.${plan.interval}`)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: t('subscriptions.columns.status'),
      cell: ({ row }) => {
        const status = row.getValue<SubscriptionStatusType>('status');
        return (
          <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
            {t(`subscriptions.statuses.${status}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'currentPeriodEnd',
      header: t('subscriptions.columns.currentPeriodEnd'),
      cell: ({ row }) => {
        const date = row.getValue<string | null>('currentPeriodEnd');
        return date ? (
          <span className="whitespace-nowrap text-xs">{formatDate(new Date(date))}</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: t('subscriptions.columns.createdAt'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">
          {formatDate(new Date(row.getValue('createdAt')))}
        </span>
      ),
    },
  ];
}
