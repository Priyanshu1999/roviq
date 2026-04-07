'use client';

import { useFormatDate, useI18nField } from '@roviq/i18n';
import {
  Badge,
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useDebounce,
} from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Building2, Plus, Search, SearchX, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import * as React from 'react';
import { type ResellerInstituteNode, useResellerInstitutes } from './use-reseller-institutes';

/** All institute statuses a reseller can see. */
const STATUSES = [
  'PENDING_APPROVAL',
  'PENDING',
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'REJECTED',
] as const;

/** Available institute types on the platform. */
const TYPES = ['SCHOOL', 'COACHING', 'LIBRARY'] as const;

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  /** Awaiting platform admin approval after reseller request. */
  PENDING_APPROVAL: 'outline',
  /** Approved but setup not yet complete. */
  PENDING: 'secondary',
  /** Fully operational institute. */
  ACTIVE: 'default',
  /** Temporarily deactivated by admin or reseller. */
  INACTIVE: 'secondary',
  /** Suspended due to policy violation or non-payment. */
  SUSPENDED: 'destructive',
  /** Rejected by platform admin during approval. */
  REJECTED: 'outline',
};

const STATUS_CLASS: Record<string, string> = {
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

const filterParsers = {
  search: parseAsString,
  status: parseAsString,
  type: parseAsString,
  group: parseAsString,
};

export default function ResellerInstitutesPage() {
  const t = useTranslations('resellerInstitutes');
  const resolveI18n = useI18nField();
  const { formatDistance } = useFormatDate();
  const router = useRouter();
  const [activeTab, setActiveTab] = useQueryState('tab', parseAsString.withDefault('all'));
  const [filters, setFilters] = useQueryStates(filterParsers);
  const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  React.useEffect(() => {
    setFilters({ search: debouncedSearch || null });
  }, [debouncedSearch, setFilters]);

  const queryFilter = React.useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filters.search) f.search = filters.search;
    if (filters.status) f.status = filters.status;
    if (filters.type) f.type = filters.type;
    if (filters.group) f.group = filters.group;
    if (activeTab === 'pending') f.status = 'PENDING_APPROVAL';
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filters, activeTab]);

  const { institutes, totalCount, hasNextPage, loading, loadMore } =
    useResellerInstitutes(queryFilter);

  const formatDate = React.useCallback(
    (date: Date) => formatDistance(date, new Date()),
    [formatDistance],
  );

  const columns = React.useMemo<ColumnDef<ResellerInstituteNode>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('columns.name'),
        cell: ({ row }) => <span className="font-medium">{resolveI18n(row.original.name)}</span>,
      },
      {
        accessorKey: 'code',
        header: t('columns.code'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.code ?? '\u2014'}
          </span>
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
        cell: ({ row }) => (
          <Badge
            variant={STATUS_VARIANT[row.original.status]}
            className={STATUS_CLASS[row.original.status] ?? ''}
          >
            {t(`statuses.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: 'groupName',
        header: t('columns.group'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.groupName ?? '\u2014'}
          </span>
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
      },
    ],
    [t, resolveI18n, formatDate],
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
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Can I="create" a="Institute">
          <Button onClick={() => router.push('/reseller/institutes/new')}>
            <Plus className="size-4" />
            {t('requestInstitute')}
          </Button>
        </Can>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
          <TabsTrigger value="pending">{t('tabs.pending')}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} forceMount className="mt-4 space-y-4">
          {activeTab === 'all' && (
            <DataTableToolbar>
              <div className="relative flex-1">
                <Search className="absolute start-2.5 top-2 size-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t('filters.search')}
                  className="ps-8"
                />
              </div>
              <Select
                value={filters.status ?? '__all__'}
                onValueChange={(v) => setFilters({ status: v === '__all__' ? null : v })}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('filters.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.allStatuses')}</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.type ?? '__all__'}
                onValueChange={(v) => setFilters({ type: v === '__all__' ? null : v })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t('filters.allTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.allTypes')}</SelectItem>
                  {TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {t(`types.${tp}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={filters.group ?? ''}
                onChange={(e) => setFilters({ group: e.target.value || null })}
                placeholder={t('filters.groupPlaceholder')}
                className="w-[180px]"
              />
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFilters({ search: null, status: null, type: null, group: null })
                  }
                >
                  <X className="me-1 size-4" />
                  {t('filters.clearFilters')}
                </Button>
              )}
            </DataTableToolbar>
          )}

          <DataTable
            columns={columns}
            data={institutes}
            isLoading={loading && institutes.length === 0}
            onRowClick={(row) => router.push(`/reseller/institutes/${row.id}`)}
            emptyState={
              hasFilters || activeTab === 'pending' ? (
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchX />
                    </EmptyMedia>
                    <EmptyTitle>
                      {activeTab === 'pending' ? t('empty.noPending') : t('empty.title')}
                    </EmptyTitle>
                    <EmptyDescription>
                      {activeTab === 'pending'
                        ? t('empty.noPendingDescription')
                        : t('empty.description')}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Building2 />
                    </EmptyMedia>
                    <EmptyTitle>{t('empty.noData')}</EmptyTitle>
                    <EmptyDescription>{t('empty.noDataDescription')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )
            }
          />

          <DataTablePagination
            hasNextPage={hasNextPage}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
            totalCount={totalCount}
            currentCount={institutes.length}
            labels={{
              loadMore: t('pagination.loadMore'),
              showing: t('pagination.showing'),
              of: t('pagination.of'),
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
