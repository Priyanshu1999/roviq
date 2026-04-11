'use client';

import {
  Badge,
  Button,
  Can,
  DataTable,
  DataTablePagination,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@roviq/ui';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { Building2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { type InstituteGroupNode, useInstituteGroups } from './use-institute-groups';

// ─── Badge color maps ───────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  TRUST: 'bg-amber-100 text-amber-700',
  SOCIETY: 'bg-blue-100 text-blue-700',
  CHAIN: 'bg-violet-100 text-violet-700',
  FRANCHISE: 'bg-emerald-100 text-emerald-700',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-zinc-100 text-zinc-500',
  SUSPENDED: 'bg-red-100 text-red-700',
};

// ─── Column helper ──────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<InstituteGroupNode>();

export default function InstituteGroupsPage() {
  const t = useTranslations('instituteGroups');
  const router = useRouter();
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const { groups, totalCount, hasNextPage, loading, loadMore } = useInstituteGroups();

  const columns = React.useMemo<ColumnDef<InstituteGroupNode, unknown>[]>(
    () => [
      columnHelper.accessor('name', {
        header: t('name'),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }) as ColumnDef<InstituteGroupNode, unknown>,
      columnHelper.accessor('code', {
        header: t('code'),
        cell: ({ getValue }) => (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{getValue()}</code>
        ),
      }) as ColumnDef<InstituteGroupNode, unknown>,
      columnHelper.accessor('type', {
        header: t('type'),
        cell: ({ getValue }) => {
          const type = getValue() as string;
          return (
            <Badge
              variant="secondary"
              className={`text-[10px] border-0 ${TYPE_COLORS[type] ?? ''}`}
            >
              {t(`types.${type}` as Parameters<typeof t>[0])}
            </Badge>
          );
        },
      }) as ColumnDef<InstituteGroupNode, unknown>,
      columnHelper.accessor('registrationNumber', {
        header: t('registrationNumber'),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{(getValue() as string | null) ?? '—'}</span>
        ),
      }) as ColumnDef<InstituteGroupNode, unknown>,
      columnHelper.accessor('status', {
        header: t('status'),
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <Badge
              variant="secondary"
              className={`text-[10px] border-0 ${STATUS_COLORS[status] ?? ''}`}
            >
              {t(`statuses.${status}` as Parameters<typeof t>[0])}
            </Badge>
          );
        },
      }) as ColumnDef<InstituteGroupNode, unknown>,
    ],
    [t],
  );

  const handleRowClick = (row: InstituteGroupNode) => {
    router.push(`/admin/institute-groups/${row.id}`);
  };

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <Can I="read" a="InstituteGroup" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-4" data-test-id="institute-groups-page">
            <div className="flex items-center justify-between">
              <div>
                <h1
                  className="text-2xl font-bold tracking-tight"
                  data-test-id="institute-groups-title"
                >
                  {t('title')}
                </h1>
                <p className="text-muted-foreground" data-test-id="institute-groups-description">
                  {t('description')}
                </p>
              </div>
              <Can I="create" a="InstituteGroup">
                <Button
                  data-test-id="institute-groups-new-btn"
                  onClick={() => router.push('/admin/institute-groups/new')}
                >
                  <Plus className="size-4" />
                  {t('newGroup')}
                </Button>
              </Can>
            </div>

            <DataTable
              data-test-id="institute-groups-table"
              columns={columns}
              data={groups}
              isLoading={loading && groups.length === 0}
              onRowClick={handleRowClick}
              emptyState={
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Building2 />
                    </EmptyMedia>
                    <EmptyTitle data-test-id="institute-groups-empty">{t('noGroups')}</EmptyTitle>
                    <EmptyDescription>{t('noGroupsDescription')}</EmptyDescription>
                  </EmptyHeader>
                  <Can I="create" a="InstituteGroup">
                    <Button onClick={() => router.push('/admin/institute-groups/new')}>
                      <Plus className="me-1 size-4" />
                      {t('newGroup')}
                    </Button>
                  </Can>
                </Empty>
              }
            />

            <DataTablePagination
              hasNextPage={hasNextPage}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
              totalCount={totalCount}
              currentCount={groups.length}
              labels={{
                loadMore: t('pagination.loadMore'),
                showing: t('pagination.showing'),
                of: t('pagination.of'),
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">{t('accessDenied')}</p>
          </div>
        )
      }
    </Can>
  );
}
