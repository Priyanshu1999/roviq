'use client';

import { Badge } from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Lock } from 'lucide-react';
import { STATUS_CLASS, STATUS_VARIANT, TIER_CLASS } from './reseller-badge-styles';
import type { ResellerNode } from './types';

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
          {row.original.isSystem && (
            <Lock
              className="size-3 text-muted-foreground"
              aria-label={t('detail.systemBadge')}
            />
          )}
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
