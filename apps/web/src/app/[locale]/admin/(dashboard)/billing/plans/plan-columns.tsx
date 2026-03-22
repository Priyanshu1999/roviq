'use client';

import {
  Badge,
  Button,
  Can,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Archive, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { SubscriptionPlanNode } from './use-plans';

export type PlanAction =
  | { type: 'edit'; plan: SubscriptionPlanNode }
  | { type: 'archive'; plan: SubscriptionPlanNode }
  | { type: 'restore'; plan: SubscriptionPlanNode }
  | { type: 'delete'; plan: SubscriptionPlanNode };

export function createPlanColumns(
  t: (key: string) => string,
  formatDate: (date: Date) => string,
  formatCurrency: (amount: number) => string,
  ti: (field: Record<string, string> | string | null | undefined) => string,
  onAction?: (action: PlanAction) => void,
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
      accessorKey: 'status',
      header: t('plans.columns.status'),
      cell: ({ row }) => {
        const status = row.getValue<string>('status');
        const isActive = status === 'ACTIVE';
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {t(`plans.statuses.${status}`)}
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
    {
      id: 'actions',
      cell: ({ row }) => {
        const plan = row.original;
        const isArchived = plan.status === 'ARCHIVED';
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Can I="update" a="SubscriptionPlan">
                <DropdownMenuItem onClick={() => onAction?.({ type: 'edit', plan })}>
                  <Pencil className="me-2 size-4" />
                  {t('plans.actions.edit')}
                </DropdownMenuItem>
                {isArchived ? (
                  <DropdownMenuItem onClick={() => onAction?.({ type: 'restore', plan })}>
                    <RotateCcw className="me-2 size-4" />
                    {t('plans.actions.restore')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onAction?.({ type: 'archive', plan })}>
                    <Archive className="me-2 size-4" />
                    {t('plans.actions.archive')}
                  </DropdownMenuItem>
                )}
              </Can>
              <Can I="delete" a="SubscriptionPlan">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onAction?.({ type: 'delete', plan })}
                >
                  <Trash2 className="me-2 size-4" />
                  {t('plans.actions.delete')}
                </DropdownMenuItem>
              </Can>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
