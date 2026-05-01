'use client';

import { useFormatDate } from '@roviq/i18n';
import {
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
import { testIds } from '@roviq/ui/testing/testid-registry';
import { Plus, SearchX, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { createResellerColumns } from './reseller-columns';
import { ResellerFilters, useResellerFilters } from './reseller-filters';
import type { ResellerNode } from './types';
import {
  useAdminResellerCreated,
  useAdminResellerStatusChanged,
  useAdminResellerUpdated,
  useResellers,
} from './use-resellers';

const { adminResellers } = testIds;
export default function ResellersPage() {
  const t = useTranslations('adminResellers');
  const { formatDistance } = useFormatDate();
  const router = useRouter();
  const [filters] = useResellerFilters();
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  const formatDate = React.useCallback(
    (date: Date) => formatDistance(date, new Date()),
    [formatDistance],
  );

  const queryFilter = React.useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filters.search) f.search = filters.search;
    if (filters.status) f.status = [filters.status];
    if (filters.tier) f.tier = [filters.tier];
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filters]);

  const { resellers, totalCount, hasNextPage, loading, loadMore, refetch } = useResellers({
    filter: queryFilter,
  });

  // Real-time: refetch when any of the three subscription streams delivers a
  // new event. Apollo delivers events as prop-like payloads that never get
  // "cleared," so we dedupe against the last-seen id per stream to avoid
  // refetch storms when React re-runs the effect.
  const { data: createdEvent } = useAdminResellerCreated();
  const { data: updatedEvent } = useAdminResellerUpdated();
  const { data: statusEvent } = useAdminResellerStatusChanged();

  const lastSeenRef = React.useRef<{ created?: string; updated?: string; status?: string }>({});

  React.useEffect(() => {
    const seen = lastSeenRef.current;
    const createdId = createdEvent?.adminResellerCreated.id;
    const updatedId = updatedEvent?.adminResellerUpdated.id;
    const statusId = statusEvent?.adminResellerStatusChanged.id;

    let changed = false;
    if (createdId && createdId !== seen.created) {
      seen.created = createdId;
      changed = true;
    }
    if (updatedId && updatedId !== seen.updated) {
      seen.updated = updatedId;
      changed = true;
    }
    if (statusId && statusId !== seen.status) {
      seen.status = statusId;
      changed = true;
    }
    if (changed) refetch();
  }, [createdEvent, updatedEvent, statusEvent, refetch]);

  const columns = React.useMemo(() => createResellerColumns(t, formatDate), [t, formatDate]);

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRowClick = (row: ResellerNode) => {
    router.push(`/admin/resellers/${row.id}`);
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4" data-testid={adminResellers.page}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid={adminResellers.title}>
            {t('title')}
          </h1>
          <p className="text-muted-foreground" data-testid={adminResellers.description}>
            {t('description')}
          </p>
        </div>
        <Can I="create" a="Reseller">
          <Button
            onClick={() => router.push('/admin/resellers/new')}
            data-testid={adminResellers.createBtn}
          >
            <Plus className="size-4" />
            {t('createReseller')}
          </Button>
        </Can>
      </div>

      <ResellerFilters />

      <DataTable
        data-testid={adminResellers.table}
        columns={columns}
        data={resellers}
        isLoading={loading && resellers.length === 0}
        onRowClick={handleRowClick}
        emptyState={
          hasFilters ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX />
                </EmptyMedia>
                <EmptyTitle data-testid={adminResellers.emptyFilteredTitle}>
                  {t('empty.title')}
                </EmptyTitle>
                <EmptyDescription>{t('empty.description')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Store />
                </EmptyMedia>
                <EmptyTitle data-testid={adminResellers.emptyTitle}>{t('empty.noData')}</EmptyTitle>
                <EmptyDescription>{t('empty.noDataDescription')}</EmptyDescription>
              </EmptyHeader>
              <Can I="create" a="Reseller">
                <Button
                  onClick={() => router.push('/admin/resellers/new')}
                  data-testid={adminResellers.createEmptyBtn}
                >
                  <Plus className="me-1 size-4" />
                  {t('createReseller')}
                </Button>
              </Can>
            </Empty>
          )
        }
      />

      <DataTablePagination
        hasNextPage={hasNextPage}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
        totalCount={totalCount}
        currentCount={resellers.length}
        labels={{
          loadMore: t('pagination.loadMore'),
          showing: t('pagination.showing'),
          of: t('pagination.of'),
        }}
      />
    </div>
  );
}
