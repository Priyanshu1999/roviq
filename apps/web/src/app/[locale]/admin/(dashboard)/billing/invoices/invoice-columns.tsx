'use client';

import { Badge } from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { InvoiceNode } from './use-invoices';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PAID: 'default',
  PENDING: 'outline',
  OVERDUE: 'destructive',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
};

export function createInvoiceColumns(
  t: (key: string) => string,
  formatDate: (date: Date) => string,
  formatCurrency: (amount: number) => string,
  ti: (value: string | Record<string, string> | null | undefined) => string,
): ColumnDef<InvoiceNode, unknown>[] {
  return [
    {
      accessorKey: 'institute',
      header: t('invoices.columns.institute'),
      cell: ({ row }) => (
        <span className="font-medium">{ti(row.original.subscription?.institute?.name)}</span>
      ),
    },
    {
      accessorKey: 'amount',
      header: t('invoices.columns.amount'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatCurrency(row.getValue<number>('amount') / 100)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('invoices.columns.status'),
      cell: ({ row }) => {
        const status = row.getValue<string>('status');
        return (
          <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
            {t(`invoices.statuses.${status}`)}
          </Badge>
        );
      },
    },
    {
      id: 'billingPeriod',
      header: t('invoices.columns.billingPeriod'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">
          {formatDate(new Date(row.original.billingPeriodStart))} –{' '}
          {formatDate(new Date(row.original.billingPeriodEnd))}
        </span>
      ),
    },
    {
      accessorKey: 'dueDate',
      header: t('invoices.columns.dueDate'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">
          {formatDate(new Date(row.getValue('dueDate')))}
        </span>
      ),
    },
    {
      accessorKey: 'paidAt',
      header: t('invoices.columns.paidAt'),
      cell: ({ row }) => {
        const paidAt = row.getValue<string | null>('paidAt');
        return paidAt ? (
          <span className="whitespace-nowrap text-xs">{formatDate(new Date(paidAt))}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
  ];
}
