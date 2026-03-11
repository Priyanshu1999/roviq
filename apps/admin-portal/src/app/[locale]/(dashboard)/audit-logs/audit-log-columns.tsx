'use client';

import { Badge } from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { AuditLogNode } from './use-audit-logs';

const ACTION_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  RESTORE: 'outline',
  ASSIGN: 'default',
  REVOKE: 'destructive',
};

export function createAuditLogColumns(
  t: (key: string) => string,
  formatDate: (date: Date) => string,
): ColumnDef<AuditLogNode, unknown>[] {
  return [
    {
      accessorKey: 'createdAt',
      header: t('columns.timestamp'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">
          {formatDate(new Date(row.getValue('createdAt')))}
        </span>
      ),
    },
    {
      accessorKey: 'actorId',
      header: t('columns.actor'),
      cell: ({ row }) => {
        const impersonatorId = row.original.impersonatorId;
        const actorName = row.original.actorName;
        return (
          <div className="flex items-center gap-1">
            <span className="max-w-[120px] truncate text-xs">
              {actorName ?? row.getValue<string>('actorId').slice(0, 8)}
            </span>
            {impersonatorId && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                {t('detail.impersonated')}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'action',
      header: t('columns.action'),
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate text-sm">{row.getValue('action')}</span>
      ),
    },
    {
      accessorKey: 'actionType',
      header: t('columns.actionType'),
      cell: ({ row }) => {
        const actionType = row.getValue<string>('actionType');
        return (
          <Badge variant={ACTION_TYPE_VARIANT[actionType] ?? 'outline'}>
            {t(`actionTypes.${actionType}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'entityType',
      header: t('columns.entityType'),
      cell: ({ row }) => <span className="text-sm">{row.getValue('entityType')}</span>,
    },
    {
      accessorKey: 'entityId',
      header: t('columns.entityId'),
      cell: ({ row }) => {
        const entityId = row.getValue<string | null>('entityId');
        return entityId ? (
          <span className="max-w-[100px] truncate font-mono text-xs">{entityId.slice(0, 8)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: 'source',
      header: t('columns.source'),
    },
    {
      accessorKey: 'ipAddress',
      header: t('columns.ipAddress'),
      cell: ({ row }) => {
        const ip = row.getValue<string | null>('ipAddress');
        return ip ? (
          <span className="font-mono text-xs">{ip}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
  ];
}
