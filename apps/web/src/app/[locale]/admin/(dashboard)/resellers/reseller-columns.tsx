'use client';

import { Badge } from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { ResellerNode, ResellerStatus, ResellerTier } from './types';

const STATUS_VARIANT: Record<ResellerStatus, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    ACTIVE: 'default',
    SUSPENDED: 'destructive',
    DELETED: 'outline',
  };

const STATUS_CLASS: Record<ResellerStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  SUSPENDED: '',
  DELETED: 'line-through opacity-60',
};

const TIER_CLASS: Record<ResellerTier, string> = {
  FULL_MANAGEMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  SUPPORT_MANAGEMENT: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  READ_ONLY: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function createResellerColumns(
  t: (key: string) => string,
  formatDate: (date: Date) => string,
): ColumnDef<ResellerNode>[] {
  return [
    {
      accessorKey: 'name',
      header: t('columns.name'),
      cell: ({ row }) => (
        <div
          className="flex items-center gap-2"
          data-testid={`reseller-name-cell-${row.original.id}`}
        >
          <span className="font-medium">{row.original.name}</span>
          {row.original.isSystem && (
            <Badge variant="outline" className="text-xs">
              {t('detail.systemBadge')}
            </Badge>
          )}
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'slug',
      header: t('columns.slug'),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.slug}</span>
      ),
    },
    {
      accessorKey: 'tier',
      header: t('columns.tier'),
      cell: ({ row }) => {
        const tier = row.original.tier;
        return (
          <Badge variant="secondary" className={TIER_CLASS[tier] ?? ''}>
            {t(`tiers.${tier}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge variant={STATUS_VARIANT[status]} className={STATUS_CLASS[status] ?? ''}>
            {t(`statuses.${status}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'instituteCount',
      header: t('columns.instituteCount'),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">{row.original.instituteCount}</span>
      ),
    },
    {
      accessorKey: 'teamSize',
      header: t('columns.teamSize'),
      cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.teamSize}</span>,
    },
    {
      accessorKey: 'customDomain',
      header: t('columns.customDomain'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.customDomain ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: t('columns.createdAt'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(new Date(row.original.createdAt))}
        </span>
      ),
      enableSorting: true,
    },
  ];
}
