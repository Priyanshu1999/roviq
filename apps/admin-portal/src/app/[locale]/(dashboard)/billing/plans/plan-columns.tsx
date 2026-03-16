'use client';

import { Badge } from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { SubscriptionPlanNode } from './use-plans';

export function createPlanColumns(
  t: (key: string) => string,
  formatDate: (date: Date) => string,
  formatCurrency: (amount: number) => string,
  ti: (field: Record<string, string> | string | null | undefined) => string,
): ColumnDef<SubscriptionPlanNode, unknown>[] {
  return [
    {
      accessorKey: 'name',
      header: t('plans.columns.name'),
      cell: ({ row }) => <span className="font-medium">{ti(row.getValue('name'))}</span>,
    },
    {
      accessorKey: 'amount',
      header: t('plans.columns.amount'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatCurrency(row.getValue<number>('amount') / 100)}
        </span>
      ),
    },
    {
      accessorKey: 'billingInterval',
      header: t('plans.columns.interval'),
      cell: ({ row }) => {
        const interval = row.getValue<string>('billingInterval');
        return <span>{t(`plans.intervals.${interval}`)}</span>;
      },
    },
    {
      accessorKey: 'isActive',
      header: t('plans.columns.status'),
      cell: ({ row }) => {
        const isActive = row.getValue<boolean>('isActive');
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? t('plans.active') : t('plans.inactive')}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: t('plans.columns.createdAt'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">
          {formatDate(new Date(row.getValue('createdAt')))}
        </span>
      ),
    },
  ];
}
