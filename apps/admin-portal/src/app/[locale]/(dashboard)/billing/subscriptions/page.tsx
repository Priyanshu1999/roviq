'use client';

import { useFormatDate, useFormatNumber, useI18nField } from '@roviq/i18n';
import {
  Button,
  Can,
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { CreditCard, Plus, SearchX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';
import * as React from 'react';
import { AssignPlanDialog } from './assign-plan-dialog';
import { createSubscriptionColumns } from './subscription-columns';
import { SubscriptionDetail } from './subscription-detail';
import { type SubscriptionNode, useSubscriptions } from './use-subscriptions';

const STATUSES = [
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'PENDING_PAYMENT',
  'PAUSED',
  'COMPLETED',
] as const;

const filterParsers = {
  status: parseAsString,
};

export default function SubscriptionsPage() {
  const t = useTranslations('billing');
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const ti = useI18nField();

  const [filters, setFilters] = useQueryStates(filterParsers);
  const [selectedSub, setSelectedSub] = React.useState<SubscriptionNode | null>(null);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  const queryFilter = React.useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filters.status) f.status = filters.status;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filters]);

  const { subscriptions, totalCount, hasNextPage, loading, loadMore } = useSubscriptions({
    filter: queryFilter as Parameters<typeof useSubscriptions>[0]['filter'],
    first: 20,
  });

  const formatDate = React.useCallback((date: Date) => format(date, 'dd MMM yyyy'), [format]);

  const formatCurrency = React.useCallback((amount: number) => currency(amount), [currency]);

  const columns = React.useMemo(
    () => createSubscriptionColumns(t, formatDate, formatCurrency, ti),
    [t, formatDate, formatCurrency, ti],
  );

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('subscriptions.title')}</h1>
          <p className="text-muted-foreground">{t('subscriptions.description')}</p>
        </div>
        <Can I="create" a="Subscription">
          <Button onClick={() => setAssignOpen(true)}>
            <Plus className="mr-1 size-4" />
            {t('subscriptions.assignPlan')}
          </Button>
        </Can>
      </div>

      <Can I="read" a="Subscription" passThrough>
        {(allowed: boolean) =>
          allowed ? (
            <>
              <DataTableToolbar>
                <div className="relative">
                  <Select
                    value={filters.status ?? ''}
                    onValueChange={(v) => setFilters({ status: v || null })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder={t('subscriptions.filters.status')} />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`subscriptions.statuses.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filters.status && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-7 top-1/2 size-5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setFilters({ status: null })}
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>

                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={() => setFilters({ status: null })}>
                    <X className="mr-1 size-4" />
                    {t('subscriptions.filters.clearFilters')}
                  </Button>
                )}
              </DataTableToolbar>

              <DataTable
                columns={columns}
                data={subscriptions}
                isLoading={loading && subscriptions.length === 0}
                emptyMessage={t('subscriptions.empty')}
                onRowClick={setSelectedSub}
              />

              <DataTablePagination
                hasNextPage={hasNextPage}
                isLoadingMore={isLoadingMore}
                onLoadMore={handleLoadMore}
                totalCount={totalCount}
                currentCount={subscriptions.length}
                labels={{
                  loadMore: t('pagination.loadMore'),
                  showing: t('pagination.showing'),
                  of: t('pagination.of'),
                }}
              />

              <SubscriptionDetail
                subscription={selectedSub}
                open={selectedSub !== null}
                onOpenChange={(open) => {
                  if (!open) setSelectedSub(null);
                }}
              />

              <AssignPlanDialog open={assignOpen} onOpenChange={setAssignOpen} />
            </>
          ) : (
            <div className="flex h-[50vh] items-center justify-center">
              <p className="text-muted-foreground">{t('subscriptions.accessDenied')}</p>
            </div>
          )
        }
      </Can>
    </div>
  );
}
