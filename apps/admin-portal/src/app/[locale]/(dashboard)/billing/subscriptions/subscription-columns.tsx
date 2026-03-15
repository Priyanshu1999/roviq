'use client';

import { Badge } from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { SubscriptionNode } from './use-subscriptions';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  PENDING_PAYMENT: 'outline',
  PAST_DUE: 'destructive',
  CANCELED: 'secondary',
  PAUSED: 'secondary',
  COMPLETED: 'outline',
};

export function createSubscriptionColumns(
  t: (key: string) => string,
  formatDate: (date: Date) => string,
  formatCurrency: (amount: number) => string,
): ColumnDef<SubscriptionNode, unknown>[] {
  return [
    {
      accessorKey: 'organization',
      header: t('subscriptions.columns.organization'),
      cell: ({ row }) => <span className="font-medium">{row.original.organization?.name}</span>,
    },
    {
      accessorKey: 'plan',
      header: t('subscriptions.columns.plan'),
      cell: ({ row }) => {
        const plan = row.original.plan;
        if (!plan) return null;
        return (
          <div className="flex flex-col">
            <span className="text-sm">{plan.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(plan.amount / 100)}/{t(`plans.intervals.${plan.billingInterval}`)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: t('subscriptions.columns.status'),
      cell: ({ row }) => {
        const status = row.getValue<string>('status');
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
