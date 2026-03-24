'use client';

import { Badge } from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { InvoiceNode } from './use-invoices';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'outline',
  SENT: 'outline',
  PAID: 'default',
  PARTIALLY_PAID: 'secondary',
  OVERDUE: 'destructive',
  CANCELLED: 'secondary',
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
      accessorKey: 'totalAmount',
      header: t('invoices.columns.amount'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatCurrency(Number(row.getValue<string>('totalAmount')) / 100)}
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
      cell: ({ row }) => {
        const start = row.original.periodStart;
        const end = row.original.periodEnd;
        if (!start || !end) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="whitespace-nowrap text-xs">
            {formatDate(new Date(start))} – {formatDate(new Date(end))}
          </span>
        );
      },
    },
    {
      accessorKey: 'dueAt',
      header: t('invoices.columns.dueDate'),
      cell: ({ row }) => {
        const dueAt = row.getValue<string | null>('dueAt');
        return dueAt ? (
          <span className="whitespace-nowrap text-xs">{formatDate(new Date(dueAt))}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
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
