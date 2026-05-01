'use client';

import { Badge, Button } from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, X } from 'lucide-react';
import type { InstituteNode, InstituteStatus } from './types';

const STATUS_VARIANT: Record<InstituteStatus, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    PENDING_APPROVAL: 'outline',
    PENDING: 'secondary',
    ACTIVE: 'default',
    INACTIVE: 'secondary',
    SUSPENDED: 'destructive',
    REJECTED: 'outline',
  };

const STATUS_CLASS: Record<InstituteStatus, string> = {
  PENDING_APPROVAL: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400',
  PENDING: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  INACTIVE: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  SUSPENDED: '',
  REJECTED: 'line-through opacity-60',
};

const TYPE_CLASS: Record<string, string> = {
  SCHOOL: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  COACHING: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  LIBRARY: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
};

export function createInstituteColumns(
  t: (key: string) => string,
  resolveI18n: (field: Record<string, string>) => string,
  formatDate: (date: Date) => string,
): ColumnDef<InstituteNode>[] {
  return [
    {
      accessorKey: 'name',
      header: t('columns.name'),
      cell: ({ row }) => (
        <span className="font-medium" data-testid={`institute-name-cell-${row.original.id}`}>
          {resolveI18n(row.original.name)}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'code',
      header: t('columns.code'),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.code ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'type',
      header: t('columns.type'),
      cell: ({ row }) => (
        <Badge variant="secondary" className={TYPE_CLASS[row.original.type] ?? ''}>
          {t(`types.${row.original.type}`)}
        </Badge>
      ),
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
      id: 'reseller',
      header: t('columns.reseller'),
      cell: ({ row }) => <span className="text-sm">{row.original.resellerName ?? '—'}</span>,
    },
    {
      id: 'group',
      header: t('columns.group'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.groupName ?? '—'}</span>
      ),
    },
    {
      id: 'affiliations',
      header: t('columns.affiliations'),
      cell: ({ row }) => {
        const affiliations = row.original.affiliations;
        if (!affiliations || affiliations.length === 0) return '—';
        return (
          <div className="flex flex-wrap gap-1">
            {affiliations.map((aff) => (
              <Badge key={aff.board} variant="outline" className="text-xs">
                {aff.board.toUpperCase()}
              </Badge>
            ))}
          </div>
        );
      },
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

/** Columns for the Pending Approval tab. */
export function createApprovalColumns(
  t: (key: string) => string,
  resolveI18n: (field: Record<string, string>) => string,
  formatDate: (date: Date) => string,
  onApprove: (inst: InstituteNode) => void,
  onReject: (inst: InstituteNode) => void,
): ColumnDef<InstituteNode>[] {
  return [
    {
      accessorKey: 'name',
      header: t('approval.columns.name'),
      cell: ({ row }) => <span className="font-medium">{resolveI18n(row.original.name)}</span>,
    },
    {
      id: 'reseller',
      header: t('approval.columns.reseller'),
      cell: ({ row }) => row.original.resellerName ?? '—',
    },
    {
      accessorKey: 'createdAt',
      header: t('approval.columns.requestedDate'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(new Date(row.original.createdAt))}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onApprove(row.original);
            }}
          >
            <Check className="size-4" />
            {t('approval.approve')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onReject(row.original);
            }}
          >
            <X className="size-4" />
            {t('approval.reject')}
          </Button>
        </div>
      ),
    },
  ];
}
